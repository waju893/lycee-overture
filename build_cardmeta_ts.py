# -*- coding: utf-8 -*-
from __future__ import annotations

import json
import re
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional
from urllib.parse import urljoin, urlparse, parse_qs

import requests
from bs4 import BeautifulSoup, Tag

BASE_URL = "https://lycee-tcg.com"
CARD_LIST_URL = (
    "https://lycee-tcg.com/card/"
    "?deck=&smenu=&recommend=&word=&f_parallel=1"
    "&cost_min=&cost_max=&ex_min=&ex_max=&ap_min=&ap_max="
    "&dp_min=&dp_max=&sp_min=&sp_max=&dmg_min=&dmg_max="
    "&sort=&limit={limit}&output=&view=card&page={page}"
)

PAGE_LIMIT = 100
MAX_PAGES = 50

# False면 리스트 페이지만 수집해서 빨리 끝냄
# True면 상세 페이지까지 추가 보강
ENRICH_DETAILS = False
DETAIL_LIMIT = 300  # ENRICH_DETAILS=True일 때만 사용

OUT_TS = Path("cardmeta.ts")
DEBUG_HTML = Path("debug_last_page.html")

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Referer": "https://lycee-tcg.com/card/",
}

TYPE_MAP = {
    "キャラクター": "character",
    "イベント": "event",
    "アイテム": "item",
    "エリア": "area",
}

ATTRIBUTE_MAP = {
    "日": "sun",
    "月": "moon",
    "花": "flower",
    "雪": "snow",
    "宙": "space",
    "星": "star",
    "無": "none",
}

CARDNO_RE = re.compile(r"\bLO-\d{4}(?:-[A-Z])?\b", re.IGNORECASE)
JP_TYPE_RE = re.compile(r"(キャラクター|イベント|アイテム|エリア)")
JP_ATTR_RE = re.compile(r"(?:^|\s)(日|月|花|雪|宙|星|無)(?:\s|$)")


@dataclass
class CardMeta:
    code: str
    base_code: str
    no: int
    name: str = ""
    kana: str = ""
    card_type: str = "unknown"
    attribute: str = ""
    image_url: str = ""
    detail_url: str = ""


def normalize_spaces(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "")).strip()


def fetch(session: requests.Session, url: str, timeout: int = 30) -> str:
    r = session.get(url, headers=HEADERS, timeout=timeout)
    r.raise_for_status()
    if not r.encoding or r.encoding.lower() == "iso-8859-1":
        r.encoding = r.apparent_encoding or "utf-8"
    return r.text


def card_no_to_int(code: str) -> int:
    m = re.search(r"LO-(\d{4})", code, re.IGNORECASE)
    return int(m.group(1)) if m else -1


def to_base_code(code: str) -> str:
    m = re.search(r"(LO-\d{4})", code, re.IGNORECASE)
    return m.group(1).upper() if m else code.upper()


def normalize_type(text: str) -> str:
    m = JP_TYPE_RE.search(text or "")
    if not m:
        return "unknown"
    return TYPE_MAP.get(m.group(1), "unknown")


def normalize_attribute(text: str) -> str:
    m = JP_ATTR_RE.search(text or "")
    if not m:
        return ""
    return ATTRIBUTE_MAP.get(m.group(1), "")


def code_from_detail_href(href: str) -> Optional[str]:
    try:
        parsed = urlparse(href)
        q = parse_qs(parsed.query)
        raw = q.get("cardno", [""])[0].strip().upper()
        if CARDNO_RE.fullmatch(raw):
            return raw
    except Exception:
        pass

    m = CARDNO_RE.search(href or "")
    return m.group(0).upper() if m else None


def find_card_container(a_tag: Tag) -> Tag:
    cur = a_tag
    for _ in range(7):
        if not isinstance(cur.parent, Tag):
            break
        cur = cur.parent
        txt = normalize_spaces(cur.get_text(" ", strip=True))
        if "属性" in txt or "Version" in txt or "このカードを使用したデッキを検索する" in txt:
            return cur
    return a_tag.parent if isinstance(a_tag.parent, Tag) else a_tag


def extract_name_from_container(container: Tag, code: str) -> str:
    text = normalize_spaces(container.get_text(" ", strip=True))

    links = []
    for a in container.find_all("a", href=True):
        t = normalize_spaces(a.get_text(" ", strip=True))
        if not t:
            continue
        if "このカードを使用したデッキを検索する" in t:
            continue
        links.append(t)

    for t in links:
        if t != code and len(t) >= 2 and not CARDNO_RE.fullmatch(t):
            return t

    m = re.search(
        rf"{re.escape(code)}\s+(.+?)\s+(キャラクター|イベント|アイテム|エリア)\b",
        text,
    )
    if m:
        return normalize_spaces(m.group(1))

    base_code = to_base_code(code)
    if base_code != code:
        m = re.search(
            rf"{re.escape(base_code)}\s+(.+?)\s+(キャラクター|イベント|アイテム|エリア)\b",
            text,
        )
        if m:
            return normalize_spaces(m.group(1))

    return ""


def extract_image_url(container: Tag, page_url: str) -> str:
    for img in container.find_all("img"):
        src = (img.get("src") or img.get("data-src") or "").strip()
        if src:
            return urljoin(page_url, src)
    return ""


def parse_list_page(html: str, page_url: str) -> Dict[str, CardMeta]:
    soup = BeautifulSoup(html, "html.parser")
    found: Dict[str, CardMeta] = {}

    detail_links = soup.select('a[href*="card_detail.pl?cardno="]')

    for a in detail_links:
        href = a.get("href", "").strip()
        if not href:
            continue

        detail_url = urljoin(page_url, href)
        code = code_from_detail_href(detail_url)
        if not code:
            continue

        container = find_card_container(a)
        block_text = normalize_spaces(container.get_text(" ", strip=True))

        found[code] = CardMeta(
            code=code,
            base_code=to_base_code(code),
            no=card_no_to_int(code),
            name=extract_name_from_container(container, code),
            card_type=normalize_type(block_text),
            attribute=normalize_attribute(block_text),
            image_url=extract_image_url(container, page_url),
            detail_url=detail_url,
        )

    return found


def enrich_detail_page(html: str, card: CardMeta, detail_url: str) -> None:
    soup = BeautifulSoup(html, "html.parser")
    text = normalize_spaces(soup.get_text(" ", strip=True))

    if not card.name:
        m = re.search(
            rf"{re.escape(card.code)}\s+(.+?)\s+(キャラクター|イベント|アイテム|エリア)\b",
            text,
        )
        if m:
            card.name = normalize_spaces(m.group(1))
        else:
            m = re.search(
                rf"{re.escape(card.base_code)}\s+(.+?)\s+(キャラクター|イベント|アイテム|エリア)\b",
                text,
            )
            if m:
                card.name = normalize_spaces(m.group(1))

    if card.card_type == "unknown":
        card.card_type = normalize_type(text)

    if not card.attribute:
        card.attribute = normalize_attribute(text)

    if not card.image_url:
        for img in soup.find_all("img"):
            src = (img.get("src") or img.get("data-src") or "").strip()
            if src:
                card.image_url = urljoin(detail_url, src)
                break

    card.detail_url = detail_url


def to_typescript(cards: List[CardMeta]) -> str:
    rows = []
    for c in cards:
        rows.append(
            {
                "code": c.code,
                "baseCode": c.base_code,
                "no": c.no,
                "name": c.name,
                "kana": c.kana,
                "type": c.card_type,
                "attribute": c.attribute,
                "imageUrl": c.image_url,
                "detailUrl": c.detail_url,
            }
        )

    body = json.dumps(rows, ensure_ascii=False, indent=2)

    return f"""/* eslint-disable */
export type CardType = "character" | "event" | "item" | "area" | "unknown";

export interface CardMeta {{
  code: string;
  baseCode: string;
  no: number;
  name: string;
  kana: string;
  type: CardType;
  attribute: string;
  imageUrl: string;
  detailUrl: string;
}}

export const CARD_META: CardMeta[] = {body};

export const CARD_META_BY_CODE: Record<string, CardMeta> = Object.fromEntries(
  CARD_META.map((card) => [card.code, card])
);
"""


def main() -> None:
    session = requests.Session()
    all_cards: Dict[str, CardMeta] = {}
    empty_streak = 0

    print("[INFO] downloading card list pages...")

    for page in range(1, MAX_PAGES + 1):
        url = CARD_LIST_URL.format(limit=PAGE_LIMIT, page=page)

        try:
            html = fetch(session, url)
        except Exception as e:
            print(f"[WARN] page {page} fetch failed: {e}")
            empty_streak += 1
            if empty_streak >= 3:
                break
            continue

        DEBUG_HTML.write_text(html, encoding="utf-8")
        page_cards = parse_list_page(html, url)

        print(f"[DEBUG] page={page} unique_cards={len(page_cards)}")

        if not page_cards:
            empty_streak += 1
            if empty_streak >= 3:
                print("[INFO] repeated empty pages detected, stopping.")
                break
        else:
            empty_streak = 0

        before = len(all_cards)
        all_cards.update(page_cards)
        after = len(all_cards)

        print(f"[DEBUG] total_unique={after} (+{after - before})")
        time.sleep(0.15)

    if not all_cards:
        raise RuntimeError(
            "카드를 하나도 못 찾았어. debug_last_page.html 확인 필요."
        )

    if ENRICH_DETAILS:
        targets = list(all_cards.values())[:DETAIL_LIMIT]
        print(f"[INFO] enriching detail pages... target={len(targets)}")
        for i, card in enumerate(targets, 1):
            try:
                html = fetch(session, card.detail_url)
                enrich_detail_page(html, card, card.detail_url)
            except Exception as e:
                print(f"[WARN] detail failed {card.code}: {e}")

            if i % 25 == 0:
                print(f"[DEBUG] detail progress {i}/{len(targets)}")
            time.sleep(0.08)
    else:
        print("[INFO] detail enrichment skipped (ENRICH_DETAILS=False)")

    cards = sorted(
        all_cards.values(),
        key=lambda c: (c.no, c.code),
        reverse=True,
    )

    OUT_TS.write_text(to_typescript(cards), encoding="utf-8")

    print(f"[INFO] done. total cards = {len(cards)}")
    print(f"[INFO] wrote: {OUT_TS.resolve()}")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n[INFO] interrupted")
        sys.exit(1)
    except Exception as e:
        print(f"[ERROR] {e}")
        sys.exit(1)