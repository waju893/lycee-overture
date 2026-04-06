import { memo } from "react";
import type { CardMeta } from "../types/card";

type Props = {
  card: CardMeta | null;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
};

const ATTRIBUTE_DISPLAY_LABELS: Record<string, string> = {
  snow: "설",
  moon: "월",
  flower: "화",
  cosmos: "주",
  sun: "일",
  star: "무",
};

const TYPE_DISPLAY_LABELS: Record<string, string> = {
  character: "캐릭터",
  event: "이벤트",
  item: "아이템",
  area: "에리어",
};

const KEY_EFFECT_CODE_LABELS: Record<number, string> = {
  2: "step",
  3: "sidestep",
  4: "order step",
  5: "jump",
  6: "aggressive",
  7: "engage",
  8: "assist",
  9: "order change",
  10: "recovery",
  11: "leader",
  12: "supporter",
  13: "penalty",
  14: "gots",
  15: "bonus",
  16: "charge",
  17: "turn recovery",
  18: "surprise",
  19: "principal",
  20: "convert",
};

const KEY_EFFECT_DISPLAY_LABELS: Record<number, string> = {
  2: "스텝",
  3: "사이드스텝",
  4: "오더 스텝",
  5: "점프",
  6: "어그레시브",
  7: "인게이지",
  8: "어시스트",
  9: "오더 체인지",
  10: "리커버리",
  11: "리더",
  12: "서포터",
  13: "페널티",
  14: "갓츠",
  15: "보너스",
  16: "차지",
  17: "턴 리커버리",
  18: "서프라이즈",
  19: "프린시펄",
  20: "컨버트",
};

function normalizeAttributeValue(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeTypeValue(value: string): string {
  return value.trim().toLowerCase();
}

function getAttributeDisplayLabel(value?: string): string {
  if (!value) return "-";
  return ATTRIBUTE_DISPLAY_LABELS[normalizeAttributeValue(value)] ?? value;
}

function getTypeDisplayLabel(value?: string): string {
  if (!value) return "-";
  return TYPE_DISPLAY_LABELS[normalizeTypeValue(value)] ?? value;
}

function getFallbackSvg(card: CardMeta): string {
  const label = encodeURIComponent(card.code || card.name || "NO IMAGE");

  return `data:image/svg+xml;utf8,
  <svg xmlns="http://www.w3.org/2000/svg" width="360" height="500">
    <rect width="100%" height="100%" fill="%2308171f"/>
    <text x="50%" y="45%" text-anchor="middle" fill="%23cbd5e1" font-size="28">NO IMAGE</text>
    <text x="50%" y="55%" text-anchor="middle" fill="%239ca3af" font-size="20">${label}</text>
  </svg>`;
}

function getPrimaryImageSrc(card: CardMeta): string {
  if (card.imageUrl && card.imageUrl.trim().length > 0) {
    return card.imageUrl;
  }

  return `/cards/${card.code}.webp`;
}

function getFallbackImageSrc(card: CardMeta): string {
  return `/cards/${card.code}.png`;
}

function CardDetailPanel({ card, isCollapsed, onToggleCollapse }: Props) {
  if (!card) {
    return (
      <aside className="detail-panel empty">
        <div className="detail-placeholder" style={{ width: "100%" }}>
          <h2 style={{ marginBottom: "8px" }}>카드 상세 정보</h2>

          <button
            type="button"
            className="filter-select"
            onClick={onToggleCollapse}
            style={{ marginBottom: isCollapsed ? 0 : "12px" }}
          >
            {isCollapsed ? "복원" : "최소화"}
          </button>

          {!isCollapsed && (
            <p>왼쪽에서 카드를 선택하면 이미지와 상세 정보가 표시됩니다.</p>
          )}
        </div>
      </aside>
    );
  }

  const effects = card.keyEffects ?? card.keyeffects ?? [];

  return (
    <aside className="detail-panel">
      <div className="detail-content">
        <div className="detail-header">
          <h2>카드 상세 정보</h2>
        </div>

        <div>
          <button
            type="button"
            className="filter-select"
            onClick={onToggleCollapse}
          >
            {isCollapsed ? "복원" : "최소화"}
          </button>
        </div>

        {!isCollapsed && (
          <>
            <div className="detail-image-box">
              <img
                src={getPrimaryImageSrc(card)}
                alt={card.name}
                className="detail-image"
                loading="eager"
                decoding="async"
                fetchPriority="high"
                onError={(e) => {
                  const target = e.currentTarget;
                  const fallbackPng = getFallbackImageSrc(card);

                  if (!target.dataset.fallbackTried) {
                    target.dataset.fallbackTried = "1";
                    target.src = fallbackPng;
                    return;
                  }

                  target.onerror = null;
                  target.src = getFallbackSvg(card);
                }}
              />
            </div>

            <div className="detail-header">
              <h2>{card.name}</h2>

              <div className="detail-subtitle">
                {card.code} · {getTypeDisplayLabel(card.type)} ·{" "}
                {getAttributeDisplayLabel(card.attribute)}
              </div>
            </div>

            <div className="detail-meta-grid">
              <div className="detail-meta-item">
                <span className="label">Code</span>
                <span className="value">{card.code}</span>
              </div>

              <div className="detail-meta-item">
                <span className="label">No</span>
                <span className="value">{card.no ?? "-"}</span>
              </div>

              <div className="detail-meta-item">
                <span className="label">EX</span>
                <span className="value">{card.ex ?? "-"}</span>
              </div>

              <div className="detail-meta-item">
                <span className="label">AP</span>
                <span className="value">{card.ap ?? "-"}</span>
              </div>

              <div className="detail-meta-item">
                <span className="label">DP</span>
                <span className="value">{card.dp ?? "-"}</span>
              </div>

              <div className="detail-meta-item">
                <span className="label">SP</span>
                <span className="value">{card.sp ?? "-"}</span>
              </div>

              <div className="detail-meta-item">
                <span className="label">DMG</span>
                <span className="value">{card.dmg ?? "-"}</span>
              </div>
            </div>

            <section className="detail-section">
              <h3>기본능력</h3>

              {effects.length > 0 ? (
                <div className="keyeffect-list">
                  {effects.map((effect) => (
                    <span
                      key={`${card.id}-${effect}`}
                      className="keyeffect-badge"
                      title={KEY_EFFECT_CODE_LABELS[effect] ?? "unknown"}
                    >
                      {KEY_EFFECT_DISPLAY_LABELS[effect] ??
                        KEY_EFFECT_CODE_LABELS[effect] ??
                        "미정의"}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="muted">없음</p>
              )}
            </section>

            <section className="detail-section">
              <h3>Text</h3>
              <p>{card.text || "효과 텍스트 없음"}</p>
            </section>

            <section className="detail-section">
              <h3>Flavor</h3>
              <p>{card.flavor || "플레이버 텍스트 없음"}</p>
            </section>
          </>
        )}
      </div>
    </aside>
  );
}

export default memo(CardDetailPanel);