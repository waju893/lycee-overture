# -*- coding: utf-8 -*-
from __future__ import annotations

import json
import re
import sys
import time
from pathlib import Path
from urllib.parse import parse_qs, urljoin, urlparse

import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent.parent
CARDMETA_JSON_PATH = ROOT / "src" / "generated" / "cardmeta.json"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    )
}

CARD_RE = re.compile(r"\bLO-\d{4}\b", re.IGNORECASE)

# keyeffect 번호 체계
# 1 = 없음 (저장 안 함)
# 11 = leader 로 별도 boolean 유지
KEYEFFECT_RANGE = list(range(2, 21))

# leader를 제외한 영문 플래그들은 모두 제거 대상
LEGACY_FLAG_FIELDS = [
    "step",
    "sidestep",
    "orderstep",
    "jump",
    "aggressive",
    "engage",
    "assist",
    "orderchange",
    "recovery",
    "supporter",
    "penalty",
    "guts",
    "bonus",
    "charge",
    "turnrecovery",
    "surprise",
    "principal",
    "convert",
]

LEADER_KEYEFFECT = 11


def build_list_url(keyeffect: int, page: int) -> str:
    return (
        "https://lycee-tcg.com/card/"
        "?deck=&smenu=&recommend=&word=&f_parallel=1"
        "&cost_min=&cost_max=&ex_min=&ex_max=&ap_min=&ap_max="
        "&dp_min=&dp_max=&sp_min=&sp_max=&dmg_min=&dmg_max="
        f"&keyeffect={keyeffect}&sort=&limit=&output=&view=list&page={page}"
    )


def fetch_html(url: str) -> str:
    r = requests.get(url, headers=HEADERS, timeout=30)
    r.raise_for_status()
    if not r.encoding or r.encoding.lower() == "iso-8859-1":
        r.encoding = r.apparent_encoding or "utf-8"
    return r.text


def extract_codes_from_list_page(html: str, page_url: str) -> set[str]:
    soup = BeautifulSoup(html, "html.parser")
    codes: set[str] = set()

    # 본문 텍스트에서 LO-xxxx 추출
    text = soup.get_text(" ", strip=True)
    for m in CARD_RE.finditer(text):
        codes.add(m.group(0).upper())

    # 링크의 cardno 파라미터에서도 추출
    for a in soup.find_all("a", href=True):
        href = a["href"]
        parsed = urlparse(urljoin(page_url, href))
        qs = parse_qs(parsed.query)
        raw = qs.get("cardno", [""])[0].strip().upper()
        if CARD_RE.fullmatch(raw):
            codes.add(raw)

    return codes


def collect_codes_from_all_pages(keyeffect: int, max_pages: int = 50) -> set[str]:
    all_codes: set[str] = set()
    empty_streak = 0

    for page in range(1, max_pages + 1):
        url = build_list_url(keyeffect, page)

        try:
            html = fetch_html(url)
        except Exception as e:
            print(f"[WARN] keyeffect={keyeffect} page={page} fetch failed: {e}")
            empty_streak += 1
            if empty_streak >= 2:
                break
            continue

        page_codes = extract_codes_from_list_page(html, url)
        print(f"[INFO] keyeffect={keyeffect} page={page} codes={len(page_codes)}")

        if not page_codes:
            empty_streak += 1
            if empty_streak >= 2:
                break
            continue

        before = len(all_codes)
        all_codes.update(page_codes)
        added = len(all_codes) - before
        print(f"[INFO] keyeffect={keyeffect} total={len(all_codes)} (+{added})")

        # 새 코드가 더 이상 안 늘어나면 중단
        if added == 0:
            print(f"[INFO] keyeffect={keyeffect} no new codes found, stopping.")
            break

        empty_streak = 0
        time.sleep(0.15)

    return all_codes


def load_cardmeta_json() -> list[dict]:
    if not CARDMETA_JSON_PATH.exists():
        raise FileNotFoundError(f"cardmeta.json not found: {CARDMETA_JSON_PATH}")

    data = json.loads(CARDMETA_JSON_PATH.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        raise RuntimeError("cardmeta.json root must be a JSON array")
    return data


def remove_legacy_flag_fields(card: dict) -> None:
    # leader는 남기고 나머지 영문 플래그 삭제
    for field in LEGACY_FLAG_FIELDS:
        card.pop(field, None)


def apply_flags_to_cards(cards: list[dict], keyeffect_code_sets: dict[int, set[str]]) -> list[dict]:
    leader_codes = keyeffect_code_sets.get(LEADER_KEYEFFECT, set())

    for card in cards:
        code = str(card.get("code", "")).upper()
        if not code:
            continue

        # 기존 영문 플래그 제거
        remove_legacy_flag_fields(card)

        # leader는 boolean으로 유지
        card["leader"] = code in leader_codes

        # keyeffects 배열 재생성 (leader=11은 제외)
        keyeffects = [
            keyeffect
            for keyeffect in KEYEFFECT_RANGE
            if keyeffect != LEADER_KEYEFFECT and code in keyeffect_code_sets.get(keyeffect, set())
        ]

        if keyeffects:
            card["keyeffects"] = sorted(keyeffects)
        else:
            card.pop("keyeffects", None)

    return cards


def main() -> None:
    print(f"[INFO] loading cardmeta: {CARDMETA_JSON_PATH}")

    keyeffect_code_sets: dict[int, set[str]] = {}

    for keyeffect in KEYEFFECT_RANGE:
        print(f"[INFO] collecting keyeffect={keyeffect} ...")
        codes = collect_codes_from_all_pages(keyeffect)
        keyeffect_code_sets[keyeffect] = codes
        print(f"[INFO] keyeffect={keyeffect} cards found: {len(codes)}")

    cards = load_cardmeta_json()
    cards = apply_flags_to_cards(cards, keyeffect_code_sets)

    CARDMETA_JSON_PATH.write_text(
        json.dumps(cards, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    print(f"[INFO] updated: {CARDMETA_JSON_PATH}")
    print("[INFO] leader kept as boolean")
    print("[INFO] keyeffects saved as numeric array")
    print("[INFO] legacy english flag fields removed")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n[INFO] interrupted")
        sys.exit(1)
    except Exception as e:
        print(f"[ERROR] {e}")
        sys.exit(1)