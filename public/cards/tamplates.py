import os
import re
import shutil
import time
from urllib.request import Request, urlopen

SOURCE_FOLDER = r"C:\Users\DESKTOP\Desktop\lycee\cardlist"
TEMPLATE_ROOT = r"C:\Users\DESKTOP\Desktop\lycee\templates"

MAX_PAGES = 100
REQUEST_DELAY = 0.5

CATEGORY_INFO = {
    "character": {
        "category": 1,
        "folder": os.path.join(TEMPLATE_ROOT, "character"),
    },
    "event": {
        "category": 2,
        "folder": os.path.join(TEMPLATE_ROOT, "event"),
    },
    "item": {
        "category": 3,
        "folder": os.path.join(TEMPLATE_ROOT, "item"),
    },
    "area": {
        "category": 4,
        "folder": os.path.join(TEMPLATE_ROOT, "area"),
    },
}


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


def build_category_url(category_number: int, page: int) -> str:
    return (
        "https://lycee-tcg.com/card/"
        f"?deck=&smenu=&recommend=&word=&f_parallel=1&category={category_number}"
        "&cost_min=&cost_max=&ex_min=&ex_max=&ap_min=&ap_max=&dp_min=&dp_max="
        "&sp_min=&sp_max=&dmg_min=&dmg_max=&sort=&limit=&output=&view=list"
        f"&page={page}"
    )


def extract_lo_numbers(html: str) -> set[str]:
    numbers = set(re.findall(r"\bLO-\d{4}\b", html, flags=re.IGNORECASE))
    return {x.upper() for x in numbers}


def collect_lo_numbers(category_number: int) -> list[str]:
    found = set()

    for page in range(1, MAX_PAGES + 1):
        page_url = build_category_url(category_number, page)
        print(f"[페이지 읽는 중] category={category_number}, page={page}")

        try:
            html = fetch_html(page_url)
        except Exception as e:
            print(f"  -> 페이지 읽기 실패: {e}")
            break

        page_numbers = extract_lo_numbers(html)

        if not page_numbers:
            print("  -> 카드 번호가 더 이상 안 보여서 종료")
            break

        before = len(found)
        found.update(page_numbers)
        added = len(found) - before

        print(f"  -> 이번 페이지 추가: {added}개 / 누적: {len(found)}개")

        if added == 0:
            print("  -> 새 카드가 없어 종료")
            break

        time.sleep(REQUEST_DELAY)

    return sorted(found)


def find_source_file(card_no: str) -> str | None:
    candidates = [
        os.path.join(SOURCE_FOLDER, f"{card_no}.png"),
        os.path.join(SOURCE_FOLDER, f"{card_no.lower()}.png"),
        os.path.join(SOURCE_FOLDER, f"{card_no.upper()}.png"),
    ]

    for path in candidates:
        if os.path.exists(path):
            return path

    return None


def copy_matching_files(card_numbers: list[str], target_folder: str) -> tuple[int, list[str]]:
    os.makedirs(target_folder, exist_ok=True)

    copied = 0
    missing = []

    for card_no in card_numbers:
        src_path = find_source_file(card_no)

        if src_path is None:
            missing.append(card_no)
            continue

        dst_path = os.path.join(target_folder, os.path.basename(src_path))
        shutil.copy2(src_path, dst_path)
        copied += 1

    return copied, missing


def process_category(category_name: str, category_number: int, target_folder: str) -> dict:
    print("\n" + "=" * 50)
    print(f"[{category_name.upper()}] 처리 시작")
    print("=" * 50)

    card_numbers = collect_lo_numbers(category_number)
    copied, missing = copy_matching_files(card_numbers, target_folder)

    result = {
        "name": category_name,
        "category_number": category_number,
        "target_folder": target_folder,
        "total": len(card_numbers),
        "copied": copied,
        "missing_count": len(missing),
        "missing_cards": missing,
    }

    print("\n" + "-" * 50)
    print(f"[{category_name.upper()}] 처리 완료")
    print("-" * 50)
    print("카테고리 번호 :", category_number)
    print("대상 폴더     :", target_folder)
    print("총 카드 수    :", result["total"])
    print("복사 성공 수  :", result["copied"])
    print("누락 파일 수  :", result["missing_count"])

    if missing:
        print("누락 카드 번호:")
        for x in missing:
            print(" ", x)

    return result


def main():
    all_results = []

    for category_name, info in CATEGORY_INFO.items():
        result = process_category(
            category_name=category_name,
            category_number=info["category"],
            target_folder=info["folder"],
        )
        all_results.append(result)

    print("\n" + "=" * 60)
    print("최종 통계")
    print("=" * 60)

    grand_total = 0
    grand_copied = 0
    grand_missing = 0

    for result in all_results:
        print(
            f'{result["name"]:10s} | '
            f'총 {result["total"]:4d} | '
            f'복사 {result["copied"]:4d} | '
            f'누락 {result["missing_count"]:4d}'
        )
        grand_total += result["total"]
        grand_copied += result["copied"]
        grand_missing += result["missing_count"]

    print("-" * 60)
    print(f"전체 총 카드 수   : {grand_total}")
    print(f"전체 복사 성공 수 : {grand_copied}")
    print(f"전체 누락 수      : {grand_missing}")
    print("=" * 60)


if __name__ == "__main__":
    main()