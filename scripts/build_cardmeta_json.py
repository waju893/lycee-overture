# -*- coding: utf-8 -*-

import json
import re
from pathlib import Path


# =============================
# 프로젝트 경로
# =============================

ROOT = Path(__file__).resolve().parent.parent
CARDS_DIR = ROOT / "public" / "cards"
OUT_JSON = ROOT / "cardmeta.json"

CARD_FILE_RE = re.compile(r"^LO-(\d{4})\.json$", re.IGNORECASE)


# =============================
# 공통 유틸
# =============================

def normalize_spaces(value):
    if value is None:
        return ""
    return re.sub(r"\s+", " ", str(value)).strip()


def parse_optional_int(value):
    if value is None:
        return None

    if isinstance(value, bool):
        return None

    if isinstance(value, int):
        return value

    if isinstance(value, float):
        return int(value)

    text = normalize_spaces(value)
    if not text:
        return None

    m = re.search(r"-?\d+", text)
    if not m:
        return None

    try:
        return int(m.group(0))
    except ValueError:
        return None


def normalize_type(value):
    text = normalize_spaces(value).lower()

    if text in ("character", "event", "item", "area"):
        return text

    return "unknown"


def normalize_attributes_list(value):
    if not isinstance(value, list):
        return []

    result = []
    seen = set()

    for item in value:
        text = normalize_spaces(item).lower()
        if not text:
            continue

        if text == "space":
            text = "cosmos"
        if text == "none":
            text = "star"

        if text not in seen:
            result.append(text)
            seen.add(text)

    return result


def normalize_use_target(value):
    """
    useTarget은
    - 0
    - ["flower", "flower"]
    - ["snow", "moon"]
    형태를 모두 허용
    """
    if value == 0:
        return 0

    if isinstance(value, list):
        result = []
        for item in value:
            text = normalize_spaces(item).lower()
            if not text:
                continue

            if text == "space":
                text = "cosmos"
            if text == "none":
                text = "star"

            result.append(text)

        return result if result else 0

    text = normalize_spaces(value)
    if not text:
        return 0

    # 숫자 0 같은 경우
    if text == "0":
        return 0

    return text


def normalize_keyeffects(value):
    if not isinstance(value, list):
        return []

    result = []
    seen = set()

    for item in value:
        if isinstance(item, int):
            n = item
        elif isinstance(item, str) and item.isdigit():
            n = int(item)
        else:
            continue

        # 11은 leader로 별도 처리하므로 keyeffects에서는 제외
        if n == 11:
            continue

        if n not in seen:
            result.append(n)
            seen.add(n)

    result.sort()
    return result


def code_from_filename(path: Path):
    m = CARD_FILE_RE.match(path.name)
    if not m:
        raise ValueError(f"invalid filename: {path.name}")
    return f"LO-{m.group(1)}"


def no_from_code(code: str):
    m = re.match(r"^LO-(\d{4})$", code, re.IGNORECASE)
    if not m:
        raise ValueError(f"invalid code: {code}")
    return int(m.group(1))


def load_json(path: Path):
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    if not isinstance(data, dict):
        raise ValueError(f"{path.name} is not a JSON object")

    return data


# =============================
# 카드 레코드 생성
# =============================

def build_card_record(path: Path):
    data = load_json(path)

    file_code = code_from_filename(path)
    code = normalize_spaces(data.get("code")) or file_code

    attributes_list = normalize_attributes_list(
        data.get("attributesList") if data.get("attributesList") is not None else data.get("attributes_list")
    )

    keyeffects = normalize_keyeffects(
        data.get("keyEffects") if data.get("keyEffects") is not None else data.get("keyeffects")
    )

    leader = bool(data.get("leader", False))

    record = {
        "code": code,
        "baseCode": normalize_spaces(data.get("baseCode")) or code,
        "no": no_from_code(code),
        "name": normalize_spaces(data.get("name")) or code,
        "kana": normalize_spaces(data.get("kana")),
        "type": normalize_type(data.get("type")),
        "attribute": "",  # 대표 속성 개념은 비워 둠
        "attributesList": attributes_list,
        "ex": parse_optional_int(data.get("ex")),
        "useTarget": normalize_use_target(data.get("useTarget")),
        "imageUrl": normalize_spaces(data.get("imageUrl")),
        "detailUrl": normalize_spaces(data.get("detailUrl")),
        "leader": leader,
        "keyeffects": keyeffects,
        "keyEffects": keyeffects,
    }

    # 캐릭터만 능력치 포함
    if record["type"] == "character":
        record["ap"] = parse_optional_int(data.get("ap"))
        record["dp"] = parse_optional_int(data.get("dp"))
        record["sp"] = parse_optional_int(data.get("sp"))
        record["dmg"] = parse_optional_int(data.get("dmg"))

    return record


# =============================
# 메인
# =============================

def main():
    if not CARDS_DIR.exists():
        raise RuntimeError(f"Cards directory not found: {CARDS_DIR}")

    files = sorted(
        [p for p in CARDS_DIR.glob("LO-*.json") if CARD_FILE_RE.match(p.name)],
        key=lambda p: p.name.lower(),
    )

    if not files:
        raise RuntimeError(f"No card json files found in {CARDS_DIR}")

    cards = []
    failed = []

    print(f"[INFO] project root: {ROOT}")
    print(f"[INFO] cards dir: {CARDS_DIR}")
    print(f"[INFO] cards found: {len(files)}")

    for i, path in enumerate(files, start=1):
        try:
            card = build_card_record(path)
            cards.append(card)
        except Exception as e:
            failed.append(f"{path.name}: {e}")

        if i % 500 == 0:
            print(f"[DEBUG] processed {i}/{len(files)}")

    cards.sort(key=lambda c: c["no"], reverse=True)

    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(cards, f, ensure_ascii=False, indent=2)

    print(f"[INFO] wrote: {OUT_JSON}")
    print(f"[INFO] cards written: {len(cards)}")

    if failed:
        print(f"[WARN] failed files: {len(failed)}")
        for msg in failed[:30]:
            print(f"[WARN] {msg}")


if __name__ == "__main__":
    main()