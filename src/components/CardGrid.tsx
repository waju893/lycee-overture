import { memo } from "react";
import type { SyntheticEvent } from "react";
import type { CardMeta } from "../types/card";
import {
  getCardImageCandidates,
  markCardImageFailed,
  markCardImageResolved,
} from "../config/cardImage";

type Props = {
  cards: CardMeta[];
  selectedCardId?: string;
  onSelect: (card: CardMeta) => void;
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

function getInitialImageSrc(card: CardMeta): string {
  return getCardImageCandidates(card.code, card.imageUrl)[0] ?? getFallbackSvg(card);
}

function handleCardImageLoad(event: SyntheticEvent<HTMLImageElement>, card: CardMeta) {
  markCardImageResolved(card.code, event.currentTarget.currentSrc || event.currentTarget.src);
}

function handleCardImageError(event: SyntheticEvent<HTMLImageElement>, card: CardMeta) {
  const target = event.currentTarget;
  const candidates = getCardImageCandidates(card.code, card.imageUrl);

  const failedUrl = target.currentSrc || target.src;
  markCardImageFailed(failedUrl);

  const currentAttempt = Number(target.dataset.imageAttempt ?? "0");
  const nextAttempt = currentAttempt + 1;

  if (nextAttempt < candidates.length) {
    target.dataset.imageAttempt = String(nextAttempt);
    target.src = candidates[nextAttempt];
    return;
  }

  target.onerror = null;
  target.src = getFallbackSvg(card);
}

type CardTileProps = {
  card: CardMeta;
  isSelected: boolean;
  onSelect: (card: CardMeta) => void;
  isPriority?: boolean;
};

const CardTile = memo(function CardTile({
  card,
  isSelected,
  onSelect,
  isPriority = false,
}: CardTileProps) {
  return (
    <button
      type="button"
      className={`card-tile ${isSelected ? "selected" : ""}`}
      onClick={() => onSelect(card)}
      style={{ contentVisibility: "auto", containIntrinsicSize: "320px 520px" }}
    >
      <div className="card-image-wrap">
        <img
          key={`${card.code}-${card.imageUrl ?? ""}`}
          src={getInitialImageSrc(card)}
          alt={card.name}
          className="card-image"
          loading={isPriority ? "eager" : "lazy"}
          decoding="async"
          fetchPriority={isPriority ? "high" : "low"}
          data-image-attempt="0"
          onLoad={(e) => handleCardImageLoad(e, card)}
          onError={(e) => handleCardImageError(e, card)}
        />
      </div>

      <div className="card-tile-body">
        <div className="card-tile-name">{card.name}</div>

        <div className="card-tile-sub">
          {card.code} · {getTypeDisplayLabel(card.type)}
        </div>

        <div className="card-chip-row">
          {card.attribute && (
            <span className="card-chip">
              {getAttributeDisplayLabel(card.attribute)}
            </span>
          )}

          {card.type && (
            <span className="card-chip">
              {getTypeDisplayLabel(card.type)}
            </span>
          )}

          {typeof card.ex === "number" && (
            <span className="card-chip">EX {card.ex}</span>
          )}
        </div>
      </div>
    </button>
  );
});

function CardGrid({ cards, selectedCardId, onSelect }: Props) {
  if (cards.length === 0) {
    return (
      <div className="empty-state">
        <p>표시할 카드가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="card-grid">
      {cards.map((card, index) => {
        const isSelected = selectedCardId === card.id;
        const isPriority = index < 4;

        return (
          <CardTile
            key={card.id}
            card={card}
            isSelected={isSelected}
            onSelect={onSelect}
            isPriority={isPriority}
          />
        );
      })}
    </div>
  );
}

export default memo(CardGrid);
