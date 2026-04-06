# -*- coding: utf-8 -*-

import json
import re
import time
from pathlib import Path
from urllib.request import Request, urlopen


# =============================
# 경로 설정
# =============================

ROOT = Path(__file__).resolve().parent.parent
CARDS_DIR = ROOT / "public" / "cards"


# =============================
# 사이트 설정
# =============================

BASE_URL = (
    "https://lycee-tcg.com/card/"
    "?deck=&smenu=&recommend=&word=&f_parallel=1"
    "&cost_min=0&cost_max=&ex_min=&ex_max=&ap_min=&ap_max=&dp_min=&dp_max="
    "&sp_min=&sp_max=&dmg_min=&dmg_max=&keyeffect={keyeffect}"
    "&sort=&limit=&output=&view=list&page={page}"
)

MIN_KEYEFFECT = 2
MAX_KEYEFFECT = 20
LEADER_KEYEFFECT = 11

MAX_PAGES = 500
REQUEST_DELAY = 0.5


# =============================
# 공통 유틸
# =============================

CARD_ID_RE = re.compile(r"\bLO-\d{4}\b", re.IGNORECASE)


def fetch_html(url: str) -> str:
    req = Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0",
            "Accept-Language": "ja,en;q=0.9",
        },
    )

    with urlopen(req, timeout=20) as resp:
        return resp.read().decode("utf-8", errors="ignore")


def extract_card_ids(html: str) -> list[str]:
    ids = CARD_ID_RE.findall(html)

    seen = set()
    result = []

    for card_id in ids:
        normalized = card_id.upper()
        if normalized in seen:
            continue
        seen.add(normalized)
        result.append(normalized)

    return result


def find_json_path(card_id: str) -> Path | None:
    candidates = [
        CARDS_DIR / f"{card_id}.json",
        CARDS_DIR / f"{card_id.lower()}.json",
        CARDS_DIR / f"{card_id.upper()}.json",
    ]

    for path in candidates:
        if path.exists():
            return path

    return None


def load_json(path: Path) -> dict:
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    if not isinstance(data, dict):
        return {}

    return data


def save_json(path: Path, data: dict) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def normalize_keyeffects(value) -> list[int]:
    if not isinstance(value, list):
        return []

    result = []

    for item in value:
        if isinstance(item, int):
            result.append(item)
        elif isinstance(item, str) and item.isdigit():
            result.append(int(item))

    return result


# =============================
# JSON 업데이트
# =============================

def apply_keyeffect(card_id: str, keyeffect_no: int) -> bool:
    path = find_json_path(card_id)

    if path is None:
        return False

    data = load_json(path)

    # keyeffect 11은 leader 처리
    if keyeffect_no == LEADER_KEYEFFECT:
        data["leader"] = True

        current = normalize_keyeffects(data.get("keyeffects"))
        current = [n for n in current if n != LEADER_KEYEFFECT]

        data["keyeffects"] = current
        data["keyEffects"] = current

        save_json(path, data)
        return True

    current = normalize_keyeffects(data.get("keyeffects"))

    if keyeffect_no not in current:
        current.append(keyeffect_no)

    data["keyeffects"] = current
    data["keyEffects"] = current

    # leader는 별도 필드이므로 기존 값 유지
    if "leader" not in data:
        data["leader"] = False

    save_json(path, data)
    return True


# =============================
# 페이지 순회
# =============================

def collect_keyeffect_cards(keyeffect_no: int) -> list[str]:
    collected = []
    seen = set()
    empty_streak = 0

    print("=" * 60)
    print(f"[INFO] keyeffect={keyeffect_no} collecting")
    print("=" * 60)

    for page in range(1, MAX_PAGES + 1):
        url = BASE_URL.format(keyeffect=keyeffect_no, page=page)
        print(f"[INFO] keyeffect={keyeffect_no} page={page}")

        try:
            html = fetch_html(url)
        except Exception as e:
            print(f"[WARN] fetch failed: {e}")
            break

        page_ids = extract_card_ids(html)

        if not page_ids:
            empty_streak += 1
            print("[INFO] no card ids found")
            if empty_streak >= 2:
                print("[INFO] stopping after consecutive empty pages")
                break
        else:
            empty_streak = 0

        before = len(seen)

        for card_id in page_ids:
            if card_id not in seen:
                seen.add(card_id)
                collected.append(card_id)

        added = len(seen) - before
        print(f"[INFO] page cards={len(page_ids)} / new={added} / total={len(seen)}")

        if page > 1 and added == 0:
            print("[INFO] no new cards found, stopping")
            break

        time.sleep(REQUEST_DELAY)

    return collected


# =============================
# 메인
# =============================

def main():
    if not CARDS_DIR.exists():
        raise RuntimeError(f"Cards directory not found: {CARDS_DIR}")

    total_written = 0
    total_missing = 0

    print(f"[INFO] cards dir: {CARDS_DIR}")

    for keyeffect_no in range(MIN_KEYEFFECT, MAX_KEYEFFECT + 1):
        card_ids = collect_keyeffect_cards(keyeffect_no)

        written = 0
        missing = []

        print(f"[INFO] applying keyeffect={keyeffect_no} ...")

        for card_id in card_ids:
            ok = apply_keyeffect(card_id, keyeffect_no)
            if ok:
                written += 1
            else:
                missing.append(card_id)

        total_written += written
        total_missing += len(missing)

        print(f"[INFO] keyeffect={keyeffect_no} written={written} missing={len(missing)}")

        if missing:
            print("[MISSING]")
            for card_id in missing[:50]:
                print(card_id)

    print("=" * 60)
    print("[DONE]")
    print(f"total written : {total_written}")
    print(f"total missing : {total_missing}")


if __name__ == "__main__":
    main()