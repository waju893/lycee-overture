import cv2
import numpy as np
import os

# -----------------------------
# 설정
# -----------------------------
CARD_FOLDER = r"C:\Users\DESKTOP\Desktop\lycee\cardlist"

TEMPLATE_PATHS = {
    "character": r"C:\Users\DESKTOP\Desktop\lycee\templates\character.png",
    "area": r"C:\Users\DESKTOP\Desktop\lycee\templates\area.png",
    "item": r"C:\Users\DESKTOP\Desktop\lycee\templates\item.png",
    "event": r"C:\Users\DESKTOP\Desktop\lycee\templates\event.png",
}

ROI_Y1 = 0.10
ROI_Y2 = 0.33
ROI_X1 = 0.02
ROI_X2 = 0.16

COMMON_STD_THRESHOLD = 14
MIN_VALID_RATIO = 0.01


def crop_type_roi(img):
    h, w = img.shape[:2]
    return img[int(h * ROI_Y1):int(h * ROI_Y2), int(w * ROI_X1):int(w * ROI_X2)]


def load_template_rois(template_paths):
    rois = {}
    base_size = None

    for card_type, path in template_paths.items():
        img = cv2.imread(path)
        if img is None:
            raise FileNotFoundError(f"기준 이미지 로드 실패: {path}")

        roi = crop_type_roi(img)

        if base_size is None:
            base_size = (roi.shape[1], roi.shape[0])

        roi = cv2.resize(roi, base_size, interpolation=cv2.INTER_AREA)
        rois[card_type] = roi

    return rois, base_size


def build_discriminative_mask(template_rois):
    hsv_list = []

    for roi in template_rois.values():
        hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV).astype(np.float32)
        hsv_list.append(hsv)

    stack = np.stack(hsv_list, axis=0)

    std_h = np.std(stack[:, :, :, 0], axis=0)
    std_s = np.std(stack[:, :, :, 1], axis=0)
    std_v = np.std(stack[:, :, :, 2], axis=0)

    diff_score = std_h * 2.2 + std_s * 0.6 + std_v * 0.2

    mask = (diff_score >= COMMON_STD_THRESHOLD).astype(np.uint8) * 255

    kernel = np.ones((3, 3), np.uint8)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
    mask = cv2.morphologyEx(mask, cv2.MORPH_DILATE, kernel)

    return mask


def get_hsv_color_ratios(hsv, valid_mask):
    """
    Lycee 카드 스타일 기준
    character를 뺏기지 않게 event/item/area 범위를 조금 줄인 버전
    """

    # -------------------------
    # event = 빨강 (축소)
    # -------------------------
    red1 = cv2.inRange(hsv, (0, 95, 85), (10, 255, 255))
    red2 = cv2.inRange(hsv, (170, 95, 85), (179, 255, 255))
    red_mask = cv2.bitwise_and(red1 + red2, valid_mask)

    # -------------------------
    # area = 노랑 (축소)
    # -------------------------
    yellow_raw = cv2.inRange(hsv, (20, 90, 90), (34, 255, 255))
    yellow_mask = cv2.bitwise_and(yellow_raw, valid_mask)

    # -------------------------
    # item = 초록 (축소)
    # -------------------------
    green_raw = cv2.inRange(hsv, (48, 65, 55), (84, 255, 255))
    green_mask = cv2.bitwise_and(green_raw, valid_mask)

    # -------------------------
    # character = 남색/청색 (유지)
    # -------------------------
    navy_raw = cv2.inRange(hsv, (96, 45, 35), (138, 255, 255))
    navy_mask = cv2.bitwise_and(navy_raw, valid_mask)

    valid_pixels = np.count_nonzero(valid_mask)

    if valid_pixels == 0:
        return {
            "event": 0.0,
            "area": 0.0,
            "item": 0.0,
            "character": 0.0
        }

    ratios = {
        "event": np.count_nonzero(red_mask) / valid_pixels,
        "area": np.count_nonzero(yellow_mask) / valid_pixels,
        "item": np.count_nonzero(green_mask) / valid_pixels,
        "character": np.count_nonzero(navy_mask) / valid_pixels,
    }

    return ratios


def detect_card_type(image_path, base_size, discriminative_mask, debug=False):
    img = cv2.imread(image_path)
    if img is None:
        print("이미지 로드 실패:", image_path)
        return "error"

    roi = crop_type_roi(img)
    roi = cv2.resize(roi, base_size, interpolation=cv2.INTER_AREA)
    hsv = cv2.cvtColor(roi, cv2.COLOR_BGR2HSV)

    ratios = get_hsv_color_ratios(hsv, discriminative_mask)

    if debug:
        print("DEBUG:", os.path.basename(image_path), ratios)

    card_type = max(ratios, key=ratios.get)

    if ratios[card_type] < MIN_VALID_RATIO:
        return "unknown"

    return card_type


template_rois, base_size = load_template_rois(TEMPLATE_PATHS)
discriminative_mask = build_discriminative_mask(template_rois)

mask_save_path = r"C:\Users\DESKTOP\Desktop\lycee\templates\discriminative_mask.png"
cv2.imwrite(mask_save_path, discriminative_mask)

counts = {
    "character": 0,
    "event": 0,
    "item": 0,
    "area": 0,
    "unknown": 0,
    "error": 0
}

for file in os.listdir(CARD_FOLDER):
    if file.lower().endswith(".png"):
        path = os.path.join(CARD_FOLDER, file)
        result = detect_card_type(path, base_size, discriminative_mask, debug=False)
        print(file, "→", result)

        if result in counts:
            counts[result] += 1
        else:
            counts["unknown"] += 1

print("\n====================")
print("분류 결과 통계")
print("====================")
print("character :", counts["character"])
print("event     :", counts["event"])
print("item      :", counts["item"])
print("area      :", counts["area"])
print("unknown   :", counts["unknown"])
print("error     :", counts["error"])
print("====================")
print("총합      :", sum(counts.values()))