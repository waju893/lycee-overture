import os
import re
import json
import time
import html as html_lib
from urllib.request import Request, urlopen

# -----------------------------
# 경로 설정
# -----------------------------
CARDLIST_ROOT = r"C:\Users\DESKTOP\Desktop\lycee\cardlist"
TEMPLATES_ROOT = r"C:\Users\DESKTOP\Desktop\lycee\templates"

TYPE_FOLDERS = {
    "character": os.path.join(TEMPLATES_ROOT, "character"),
    "event": os.path.join(TEMPLATES_ROOT, "event"),
    "item": os.path.join(TEMPLATES_ROOT, "item"),
    "area": os.path.join(TEMPLATES_ROOT, "area"),
}

# -----------------------------
# 사이트 설정
# -----------------------------
BASE_URL = (
    "https://lycee-tcg.com/card/"
    "?deck=&smenu=&recommend=&word=&f_parallel=1"
    "&cost_min=&cost_max=&ex_min=&ex_max=&ap_min=&ap_max=&dp_min=&dp_max="
    "&sp_min=&sp_max=&dmg_min=&dmg_max=&sort=&limit=&output=&view=list"
)

MAX_PAGES = 500
REQUEST_DELAY = 0.5

ATTRIBUTE_MAP = {
    "雪": "snow",
    "月": "moon",
    "花": "flower",
    "宙": "cosmos",
    "日": "sun",
    "無": "star",
}

# 설월화주일무 -> abcdef
ATTRIBUTE_CODE_MAP = {
    "雪": "a",
    "月": "b",
    "花": "c",
    "宙": "d",
    "日": "e",
    "無": "f",
}

ATTRIBUTE_ORDER = ["雪", "月", "花", "宙", "日", "無"]

CATEGORY_MAP = {
    "キャラクター": "character",
    "イベント": "event",
    "アイテム": "item",
    "エリア": "area",
}

# HTML에서 태그/공백/엔티티 사이를 유연하게 넘기는 패턴
SEP = r'(?:\s|&nbsp;|&#13;|&#10;|<[^>]+>)*'


# -----------------------------
# 공통 함수
# -----------------------------
def find_json_file(card_id: str):
    candidates = [
        os.path.join(CARDLIST_ROOT, f"{card_id}.json"),
        os.path.join(CARDLIST_ROOT, f"{card_id.lower()}.json"),
        os.path.join(CARDLIST_ROOT, f"{card_id.upper()}.json"),
    ]

    for path in candidates:
        if os.path.exists(path):
            return path

    return None


def load_json(json_path: str):
    try:
        with open(json_path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def save_json(json_path: str, data: dict):
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=4)


def ensure_type_flags(data: dict, card_type=None):
    if card_type is None:
        card_type = data.get("type")

    data["character"] = (card_type == "character")
    data["event"] = (card_type == "event")
    data["item"] = (card_type == "item")
    data["area"] = (card_type == "area")


# -----------------------------
# 템플릿 폴더 기반 타입 정보 읽기
# -----------------------------
def build_template_type_map():
    template_type_map = {}
    duplicate_cards = {}

    for card_type, folder_path in TYPE_FOLDERS.items():
        if not os.path.exists(folder_path):
            print(f"[경고] 템플릿 폴더 없음: {folder_path}")
            continue

        for file_name in os.listdir(folder_path):
            if not file_name.lower().endswith(".png"):
                continue

            card_id = os.path.splitext(file_name)[0].upper()

            if card_id in template_type_map and template_type_map[card_id] != card_type:
                duplicate_cards.setdefault(card_id, set()).update(
                    {template_type_map[card_id], card_type}
                )

            template_type_map[card_id] = card_type

    return template_type_map, duplicate_cards


# -----------------------------
# 사이트 파싱 함수
# -----------------------------
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


def parse_attributes_list(attr_text: str) -> list[str]:
    result = []
    seen = set()

    for ch in attr_text:
        if ch in ATTRIBUTE_MAP:
            eng = ATTRIBUTE_MAP[ch]
            if eng not in seen:
                result.append(eng)
                seen.add(eng)

    return result


def build_attribute_code(text: str) -> str:
    counts = {k: 0 for k in ATTRIBUTE_ORDER}

    for ch in text:
        if ch in counts:
            counts[ch] += 1

    parts = []
    for jp in ATTRIBUTE_ORDER:
        if counts[jp] > 0:
            parts.append(f"{ATTRIBUTE_CODE_MAP[jp]}{counts[jp]}")

    return "".join(parts)


def count_attribute_symbols(text: str) -> int:
    valid_symbols = set(ATTRIBUTE_CODE_MAP.keys())
    return sum(1 for ch in text if ch in valid_symbols)


def strip_tags_minimal(text: str) -> str:
    """
    카드 블록 하나 내부에서만 최소한으로 태그 제거
    전체 페이지를 텍스트화하지 않음
    """
    text = html_lib.unescape(text)
    text = re.sub(r"<br\s*/?>", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def parse_card_block_html(card_id: str, block_html: str):
    """
    raw HTML 블록에서 직접 파싱
    LO-xxxx 다음 블록 안에서 카테고리/속성/EX/사용대상/AP/DP/SP/DMG 추출
    """
    # 먼저 raw HTML 그대로 정규식 시도
    pattern_with_stats = re.compile(
        rf"(キャラクター|イベント|アイテム|エリア){SEP}"
        rf"([雪月花宙日無]+){SEP}"
        rf"(\d+){SEP}"
        rf"([雪月花宙日無]+){SEP}"
        rf"(\d+){SEP}(\d+){SEP}(\d+){SEP}(\d+)",
        re.DOTALL
    )

    pattern_no_stats = re.compile(
        rf"(キャラクター|イベント|アイテム|エリア){SEP}"
        rf"([雪月花宙日無]+){SEP}"
        rf"(\d+){SEP}"
        rf"([雪月花宙日無]+)",
        re.DOTALL
    )

    m = pattern_with_stats.search(block_html)
    if m:
        jp_category, attr_jp, ex, target_jp, ap, dp, sp, dmg = m.groups()
        category = CATEGORY_MAP[jp_category]
        return {
            "type": category,
            "category": category,
            "attributes_list": parse_attributes_list(attr_jp),
            "attributes": build_attribute_code(attr_jp),
            "attributes_total": count_attribute_symbols(attr_jp),
            "attribute_jp": attr_jp,
            "ex": int(ex),
            "target": build_attribute_code(target_jp),
            "target_total": count_attribute_symbols(target_jp),
            "target_jp": target_jp,
            "ap": int(ap),
            "dp": int(dp),
            "sp": int(sp),
            "dmg": int(dmg),
        }

    m = pattern_no_stats.search(block_html)
    if m:
        jp_category, attr_jp, ex, target_jp = m.groups()
        category = CATEGORY_MAP[jp_category]
        return {
            "type": category,
            "category": category,
            "attributes_list": parse_attributes_list(attr_jp),
            "attributes": build_attribute_code(attr_jp),
            "attributes_total": count_attribute_symbols(attr_jp),
            "attribute_jp": attr_jp,
            "ex": int(ex),
            "target": build_attribute_code(target_jp),
            "target_total": count_attribute_symbols(target_jp),
            "target_jp": target_jp,
            "ap": None,
            "dp": None,
            "sp": None,
            "dmg": None,
        }

    # 혹시 HTML 구조가 조금 달라 raw HTML 정규식이 실패하면
    # 카드 블록 "내부에서만" 최소 태그 제거 후 한 번 더 시도
    mini_text = strip_tags_minimal(block_html)

    text_with_stats = re.search(
        r"(キャラクター|イベント|アイテム|エリア)\s+([雪月花宙日無]+)\s+(\d+)\s+([雪月花宙日無]+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)",
        mini_text
    )
    if text_with_stats:
        jp_category, attr_jp, ex, target_jp, ap, dp, sp, dmg = text_with_stats.groups()
        category = CATEGORY_MAP[jp_category]
        return {
            "type": category,
            "category": category,
            "attributes_list": parse_attributes_list(attr_jp),
            "attributes": build_attribute_code(attr_jp),
            "attributes_total": count_attribute_symbols(attr_jp),
            "attribute_jp": attr_jp,
            "ex": int(ex),
            "target": build_attribute_code(target_jp),
            "target_total": count_attribute_symbols(target_jp),
            "target_jp": target_jp,
            "ap": int(ap),
            "dp": int(dp),
            "sp": int(sp),
            "dmg": int(dmg),
        }

    text_no_stats = re.search(
        r"(キャラクター|イベント|アイテム|エリア)\s+([雪月花宙日無]+)\s+(\d+)\s+([雪月花宙日無]+)",
        mini_text
    )
    if text_no_stats:
        jp_category, attr_jp, ex, target_jp = text_no_stats.groups()
        category = CATEGORY_MAP[jp_category]
        return {
            "type": category,
            "category": category,
            "attributes_list": parse_attributes_list(attr_jp),
            "attributes": build_attribute_code(attr_jp),
            "attributes_total": count_attribute_symbols(attr_jp),
            "attribute_jp": attr_jp,
            "ex": int(ex),
            "target": build_attribute_code(target_jp),
            "target_total": count_attribute_symbols(target_jp),
            "target_jp": target_jp,
            "ap": None,
            "dp": None,
            "sp": None,
            "dmg": None,
        }

    return None


def extract_cards_from_html(html: str) -> dict:
    cards = {}

    # raw HTML에서 카드 번호 위치를 직접 찾음
    id_matches = list(re.finditer(r"LO-\d{4}", html, flags=re.IGNORECASE))
    if not id_matches:
        return cards

    for i, match in enumerate(id_matches):
        card_id = match.group(0).upper()
        start = match.start()
        end = id_matches[i + 1].start() if i + 1 < len(id_matches) else len(html)

        block_html = html[start:end]
        parsed = parse_card_block_html(card_id, block_html)

        if parsed:
            cards[card_id] = parsed

    return cards


def collect_site_card_data():
    all_cards = {}
    empty_page_streak = 0

    for page in range(1, MAX_PAGES + 1):
        page_url = f"{BASE_URL}&page={page}"
        print(f"[페이지 읽는 중] {page_url}")

        try:
            html = fetch_html(page_url)
        except Exception as e:
            print("  -> 페이지 읽기 실패:", e)
            break

        page_cards = extract_cards_from_html(html)

        if not page_cards:
            empty_page_streak += 1
            print("  -> 카드 데이터가 없음")
            if empty_page_streak >= 2:
                print("  -> 연속 빈 페이지로 종료")
                break
        else:
            empty_page_streak = 0

        before = len(all_cards)
        all_cards.update(page_cards)
        added = len(all_cards) - before

        print(f"  -> 이번 페이지 추출: {len(page_cards)}개 / 누적: {len(all_cards)}개 / 신규: {added}개")

        if added == 0 and page > 1:
            print("  -> 신규 카드가 없어 종료")
            break

        time.sleep(REQUEST_DELAY)

    return all_cards


# -----------------------------
# JSON 업데이트
# -----------------------------
def update_json_from_site(card_id: str, card_data: dict, template_type_map: dict):
    json_path = find_json_file(card_id)
    if json_path is None:
        return False, "missing_json"

    data = load_json(json_path)

    data["type"] = card_data["type"]
    data["category"] = card_data["category"]

    data["attributes"] = card_data["attributes"]
    data["attributes_total"] = card_data["attributes_total"]
    data["attributes_list"] = card_data["attributes_list"]
    data["attribute_jp"] = card_data["attribute_jp"]

    data["ex"] = card_data["ex"]

    data["target"] = card_data["target"]
    data["target_total"] = card_data["target_total"]
    data["target_jp"] = card_data["target_jp"]

    data["ap"] = card_data["ap"]
    data["dp"] = card_data["dp"]
    data["sp"] = card_data["sp"]
    data["dmg"] = card_data["dmg"]

    template_type = template_type_map.get(card_id)
    if template_type:
        data["template_type"] = template_type

    ensure_type_flags(data, data["type"])

    save_json(json_path, data)
    return True, json_path


def update_json_from_templates_only(card_id: str, template_type: str):
    json_path = find_json_file(card_id)
    if json_path is None:
        return False, "missing_json"

    data = load_json(json_path)

    if "type" not in data or not data["type"]:
        data["type"] = template_type

    if "category" not in data or not data["category"]:
        data["category"] = template_type

    data["template_type"] = template_type
    ensure_type_flags(data, data.get("type"))

    save_json(json_path, data)
    return True, json_path


# -----------------------------
# 메인 실행
# -----------------------------
def main():
    print("=" * 60)
    print("1. 템플릿 폴더 카드 타입 맵 생성")
    print("=" * 60)
    template_type_map, duplicate_cards = build_template_type_map()

    print(f"템플릿에서 읽은 카드 수: {len(template_type_map)}")

    if duplicate_cards:
        print("\n[경고] 여러 타입 폴더에 중복된 카드:")
        for card_id, types in duplicate_cards.items():
            print(card_id, "->", sorted(types))

    print("\n" + "=" * 60)
    print("2. 사이트에서 카드 데이터 수집")
    print("=" * 60)
    all_cards = collect_site_card_data()

    test_id = "LO-6662"
    print("\n디버그 확인:")
    print(f"{test_id} in all_cards:", test_id in all_cards)
    if test_id in all_cards:
        print(all_cards[test_id])

    print("\n" + "=" * 60)
    print("3. 사이트 데이터 기준 JSON 업데이트")
    print("=" * 60)

    updated_count = 0
    missing_json_count = 0
    missing_json_cards = []

    for card_id, card_data in all_cards.items():
        ok, reason = update_json_from_site(card_id, card_data, template_type_map)
        if ok:
            updated_count += 1
            print(f"{card_id} -> 사이트 데이터 저장 완료")
        else:
            if reason == "missing_json":
                missing_json_count += 1
                missing_json_cards.append(card_id)

    print("\n" + "=" * 60)
    print("4. 사이트에 없지만 템플릿에 있는 카드 보조 업데이트")
    print("=" * 60)

    template_only_updated = 0
    template_only_missing = []

    for card_id, template_type in template_type_map.items():
        if card_id in all_cards:
            continue

        ok, reason = update_json_from_templates_only(card_id, template_type)
        if ok:
            template_only_updated += 1
            print(f"{card_id} -> 템플릿 타입만 저장 완료")
        else:
            if reason == "missing_json":
                template_only_missing.append(card_id)

    print("\n" + "=" * 60)
    print("최종 결과")
    print("=" * 60)
    print("사이트에서 추출한 카드 수         :", len(all_cards))
    print("사이트 데이터 저장 완료 수       :", updated_count)
    print("사이트 카드 중 JSON 없는 수      :", missing_json_count)
    print("템플릿 전용 보조 저장 완료 수    :", template_only_updated)
    print("템플릿 전용 카드 중 JSON 없는 수 :", len(template_only_missing))

    if missing_json_cards:
        print("\n사이트 카드 중 JSON 없는 카드 목록:")
        for card_id in missing_json_cards:
            print(card_id)

    if template_only_missing:
        print("\n템플릿 전용 카드 중 JSON 없는 카드 목록:")
        for card_id in template_only_missing:
            print(card_id)


if __name__ == "__main__":
    main()