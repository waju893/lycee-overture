# -*- coding: utf-8 -*-

import json
import re
import time
import html as html_lib
from pathlib import Path
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parent.parent
CARDS_DIR = ROOT / "public" / "cards"

BASE_URL = (
    "https://lycee-tcg.com/card/"
    "?deck=&smenu=&recommend=&word=&f_parallel=1"
    "&cost_min=0&cost_max="
    "&ex_min=&ex_max=&ap_min=&ap_max=&dp_min=&dp_max="
    "&sp_min=&sp_max=&dmg_min=&dmg_max=&sort=&limit=&output=&page={page}&view=list"
)

MAX_PAGES = 500
REQUEST_DELAY = 0.5

JP_CATEGORY_MAP = {
    "キャラクター": "character",
    "イベント": "event",
    "アイテム": "item",
    "エリア": "area",
}

JP_ATTR_MAP = {
    "雪": "snow",
    "月": "moon",
    "花": "flower",
    "宙": "cosmos",
    "日": "sun",
    "無": "star",
}

CARD_BLOCK_RE = re.compile(
    r"(LO-\d{4}).*?"
    r"(キャラクター|イベント|アイテム|エリア)\s+"
    r"([雪月花宙日無]+)\s+"
    r"(\d+)"
    r"(?:\s+([雪月花宙日無]+))?"
    r"(?:\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+))?",
    re.S,
)


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


def normalize_spaces(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def html_to_text(html: str) -> str:
    text = html_lib.unescape(html)
    text = re.sub(r"<br\s*/?>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"</tr>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"</td>", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", " ", text)
    text = text.replace("\u3000", " ")
    text = normalize_spaces(text)
    return text


def parse_attributes_unique(attr_jp: str) -> list[str]:
    result = []
    seen = set()

    for ch in attr_jp:
        mapped = JP_ATTR_MAP.get(ch)
        if mapped and mapped not in seen:
            result.append(mapped)
            seen.add(mapped)

    return result


def parse_cost(cost_jp: str):
    """
    花花 -> ["flower", "flower"]
    日日無 -> ["sun", "sun", "star"]
    없거나 못 찾으면 -> 0
    """
    cost_jp = normalize_spaces(cost_jp)

    if not cost_jp or cost_jp == "0":
        return 0

    out = []
    for ch in cost_jp:
        mapped = JP_ATTR_MAP.get(ch)
        if mapped:
            out.append(mapped)

    return out if out else 0


def extract_cards_from_html(html: str) -> dict[str, dict]:
    text = html_to_text(html)
    cards: dict[str, dict] = {}

    for m in CARD_BLOCK_RE.finditer(text):
        card_id = m.group(1).upper()
        category_jp = m.group(2)
        attr_jp = m.group(3)
        ex_text = m.group(4)
        cost_jp = m.group(5) or ""
        ap = m.group(6)
        dp = m.group(7)
        sp = m.group(8)
        dmg = m.group(9)

        card_type = JP_CATEGORY_MAP[category_jp]
        payload = {
            "type": card_type,
            "attributes_list": parse_attributes_unique(attr_jp),
            "attributesList": parse_attributes_unique(attr_jp),
            "ex": int(ex_text),
            "useTarget": parse_cost(cost_jp),
        }

        if card_type == "character":
            # 캐릭터는 스탯이 있으면 넣고, 없으면 0으로 보정
            payload["ap"] = int(ap) if ap is not None else 0
            payload["dp"] = int(dp) if dp is not None else 0
            payload["sp"] = int(sp) if sp is not None else 0
            payload["dmg"] = int(dmg) if dmg is not None else 0

        cards[card_id] = payload

    return cards


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


def write_card_json(card_id: str, payload: dict) -> bool:
    path = find_json_path(card_id)
    if path is None:
        return False

    with open(path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    return True


def main():
    if not CARDS_DIR.exists():
        raise RuntimeError(f"Cards directory not found: {CARDS_DIR}")

    all_cards: dict[str, dict] = {}
    empty_streak = 0

    print(f"[INFO] cards dir: {CARDS_DIR}")

    for page in range(1, MAX_PAGES + 1):
        url = BASE_URL.format(page=page)
        print(f"[INFO] page {page}: {url}")

        try:
            html = fetch_html(url)
        except Exception as e:
            print(f"[WARN] page fetch failed: {e}")
            break

        page_cards = extract_cards_from_html(html)

        if not page_cards:
            empty_streak += 1
            print("[INFO] no cards parsed on this page")
            if empty_streak >= 2:
                print("[INFO] stopping after consecutive empty pages")
                break
        else:
            empty_streak = 0

        before = len(all_cards)
        all_cards.update(page_cards)
        added = len(all_cards) - before

        print(f"[INFO] parsed this page: {len(page_cards)} / new: {added} / total: {len(all_cards)}")

        if page > 1 and added == 0:
            print("[INFO] no new cards found, stopping")
            break

        time.sleep(REQUEST_DELAY)

    written = 0
    missing = []

    print("[INFO] writing json files...")

    for card_id, payload in sorted(all_cards.items(), reverse=True):
        ok = write_card_json(card_id, payload)
        if ok:
            written += 1
        else:
            missing.append(card_id)

    print("=" * 60)
    print("[DONE]")
    print(f"parsed cards : {len(all_cards)}")
    print(f"written json : {written}")
    print(f"missing json : {len(missing)}")

    if missing:
        print("[MISSING]")
        for card_id in missing[:100]:
            print(card_id)


if __name__ == "__main__":
    main()