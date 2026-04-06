# build_cardmeta_from_json.py

from __future__ import annotations

import json
import re
import sys
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent
CARDS_DIR = ROOT / "public" / "cards"
OUT_TS = ROOT / "src" / "generated" / "cardmeta.ts"

CARD_FILE_RE = re.compile(r"^lo-(\d{4})\.json$", re.IGNORECASE)
PLACEHOLDER_NAME_RE = re.compile(r"^Card LO-\d{4}$", re.IGNORECASE)

ATTRIBUTE_MAP = {
    "日": "sun",
    "月": "moon",
    "花": "flower",
    "雪": "snow",
    "宙": "space",
    "星": "star",
    "無": "none",
}

ATTRIBUTE_LIST_MAP = {
    "sun": "sun",
    "moon": "moon",
    "flower": "flower",
    "snow": "snow",
    "cosmos": "space",
    "space": "space",
    "star": "star",
    "none": "none",
}

TYPE_MAP = {
    "character": "character",
    "event": "event",
    "item": "item",
    "area": "area",
}


def normalize_spaces(value: Any) -> str:
    if value is None:
        return ""
    return re.sub(r"\s+", " ", str(value)).strip()


def parse_optional_int(value: Any):
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float):
        return int(value)

    text = normalize_spaces(value)
    if not text or text in {"-", "—", "―", "null", "None"}:
        return None

    m = re.search(r"-?\d+", text)
    return int(m.group(0)) if m else None


def filename_to_code(path: Path) -> str:
    m = CARD_FILE_RE.match(path.name)
    if not m:
        raise ValueError(f"invalid filename: {path.name}")
    return f"LO-{m.group(1)}"


def code_to_no(code: str) -> int:
    m = re.search(r"LO-(\d{4})", code, re.IGNORECASE)
    if not m:
        raise ValueError(f"invalid code: {code}")
    return int(m.group(1))


def normalize_type(raw_type: Any) -> str:
    text = normalize_spaces(raw_type).lower()
    return TYPE_MAP.get(text, "unknown")


def normalize_attribute(data: dict[str, Any]) -> str:
    jp = normalize_spaces(data.get("attribute_jp"))
    if jp:
        return ATTRIBUTE_MAP.get(jp, "")

    attrs = data.get("attributes_list")
    if isinstance(attrs, list) and attrs:
        first = normalize_spaces(attrs[0]).lower()
        return ATTRIBUTE_LIST_MAP.get(first, first)

    return ""


def normalize_attributes_list(data: dict[str, Any]) -> list[str]:
    attrs = data.get("attributes_list")
    if not isinstance(attrs, list):
        return []

    out: list[str] = []
    for item in attrs:
        key = normalize_spaces(item).lower()
        if not key:
            continue
        out.append(ATTRIBUTE_LIST_MAP.get(key, key))
    return out


def load_json(path: Path) -> dict[str, Any]:
    raw = path.read_text(encoding="utf-8")
    data = json.loads(raw)
    if not isinstance(data, dict):
        raise ValueError(f"{path.name}: root JSON must be an object")
    return data


def build_card(path: Path) -> dict[str, Any]:
    file_code = filename_to_code(path)
    data = load_json(path)

    json_id = normalize_spaces(data.get("id")).upper()
    code = json_id or file_code

    if code != file_code:
        raise ValueError(f"{path.name}: filename code {file_code} != json id {code}")

    no = code_to_no(code)

    card = {
        "code": code,
        "baseCode": code,
        "no": no,
        "name": normalize_spaces(data.get("name")),
        "kana": "",
        "type": normalize_type(data.get("type")),
        "attribute": normalize_attribute(data),
        "attributesList": normalize_attributes_list(data),
        "ex": parse_optional_int(data.get("ex")),
        "useTarget": normalize_spaces(data.get("target_jp")),
        "ap": parse_optional_int(data.get("ap")),
        "dp": parse_optional_int(data.get("dp")),
        "sp": parse_optional_int(data.get("sp")),
        "dmg": parse_optional_int(data.get("dmg")),
        "imageUrl": "",
        "detailUrl": "",
    }

    return card


def build_ts(cards: list[dict[str, Any]]) -> str:
    body = json.dumps(cards, ensure_ascii=False, indent=2)

    return f"""/* eslint-disable */

export type CardType = "character" | "event" | "item" | "area" | "unknown";

export type CardAttribute =
  | "sun"
  | "moon"
  | "flower"
  | "snow"
  | "space"
  | "star"
  | "none"
  | "";

export interface CardMeta {{
  code: string;
  baseCode: string;
  no: number;
  name: string;
  kana: string;
  type: CardType;
  attribute: CardAttribute;
  attributesList: string[];
  ex: number | null;
  useTarget: string;
  ap: number | null;
  dp: number | null;
  sp: number | null;
  dmg: number | null;
  imageUrl: string;
  detailUrl: string;
}}

export const CARD_META: CardMeta[] = {body};

export const CARD_META_BY_CODE: Record<string, CardMeta> = Object.fromEntries(
  CARD_META.map((card) => [card.code, card])
);
"""


def main() -> None:
    if not CARDS_DIR.exists():
        raise FileNotFoundError(f"cards directory not found: {CARDS_DIR}")

    files = sorted(
        [p for p in CARDS_DIR.glob("lo-*.json") if CARD_FILE_RE.match(p.name)],
        key=lambda p: p.name.lower(),
    )

    if not files:
        raise RuntimeError(f"no matching json files found in {CARDS_DIR}")

    cards: list[dict[str, Any]] = []
    failed: list[str] = []

    placeholder_name_count = 0
    unknown_type_count = 0
    empty_attribute_count = 0

    type_counts: dict[str, int] = {}
    attribute_counts: dict[str, int] = {}

    print(f"[INFO] cards dir: {CARDS_DIR}")
    print(f"[INFO] files found: {len(files)}")

    for index, path in enumerate(files, start=1):
        try:
            card = build_card(path)
            cards.append(card)

            if PLACEHOLDER_NAME_RE.match(card["name"]):
                placeholder_name_count += 1

            if card["type"] == "unknown":
                unknown_type_count += 1

            if not card["attribute"]:
                empty_attribute_count += 1

            type_counts[card["type"]] = type_counts.get(card["type"], 0) + 1
            attribute_counts[card["attribute"]] = attribute_counts.get(card["attribute"], 0) + 1

        except Exception as e:
            failed.append(f"{path.name}: {e}")

        if index % 500 == 0:
            print(f"[DEBUG] processed {index}/{len(files)}")

    cards.sort(key=lambda c: c["no"], reverse=True)

    OUT_TS.parent.mkdir(parents=True, exist_ok=True)
    OUT_TS.write_text(build_ts(cards), encoding="utf-8")

    print(f"[INFO] cards generated: {len(cards)}")
    print(f"[INFO] output: {OUT_TS}")
    print(f"[INFO] placeholder names: {placeholder_name_count}")
    print(f"[INFO] unknown types: {unknown_type_count}")
    print(f"[INFO] empty attributes: {empty_attribute_count}")
    print(f"[INFO] type counts: {type_counts}")
    print(f"[INFO] attribute counts: {attribute_counts}")

    if failed:
        print(f"[WARN] failed files: {len(failed)}")
        for msg in failed[:20]:
            print(f"[WARN] {msg}")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\\n[INFO] interrupted")
        sys.exit(1)
    except Exception as e:
        print(f"[ERROR] {e}")
        sys.exit(1)