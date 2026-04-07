import { memo, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, SyntheticEvent } from "react";
import { FixedSizeGrid as Grid, type GridChildComponentProps } from "react-window";
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
  minColumnWidth?: number;
  columnGap?: number;
  rowGap?: number;
  overscanRowCount?: number;
};

type ItemData = {
  cards: CardMeta[];
  columnCount: number;
  selectedCardId?: string;
  onSelect: (card: CardMeta) => void;
  columnGap: number;
  rowGap: number;
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

const CARD_ASPECT_RATIO = 360 / 500;
const CARD_TILE_SIDE_PADDING = 20;
const CARD_TILE_TEXT_HEIGHT = 114;
const CARD_TILE_BORDER_ADJUST = 2;

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
      style={{ width: "100%", height: "100%" }}
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
            <span className="card-chip">{getTypeDisplayLabel(card.type)}</span>
          )}

          {typeof card.ex === "number" && (
            <span className="card-chip">EX {card.ex}</span>
          )}
        </div>
      </div>
    </button>
  );
});

function estimateCardTileHeight(columnWidth: number): number {
  const imageWidth = Math.max(0, columnWidth - CARD_TILE_SIDE_PADDING);
  const imageHeight = imageWidth / CARD_ASPECT_RATIO;
  return Math.ceil(imageHeight + CARD_TILE_TEXT_HEIGHT + CARD_TILE_BORDER_ADJUST);
}

function GridCell({ columnIndex, rowIndex, style, data }: GridChildComponentProps<ItemData>) {
  const { cards, columnCount, selectedCardId, onSelect, columnGap, rowGap } = data;
  const cardIndex = rowIndex * columnCount + columnIndex;
  const card = cards[cardIndex];

  if (!card) {
    return null;
  }

  const adjustedStyle: CSSProperties = {
    ...style,
    left: Number(style.left) + columnGap / 2,
    top: Number(style.top) + rowGap / 2,
    width: Number(style.width) - columnGap,
    height: Number(style.height) - rowGap,
  };

  const isSelected = selectedCardId === card.id;
  const isPriority = cardIndex < 4;

  return (
    <div style={adjustedStyle}>
      <CardTile
        card={card}
        isSelected={isSelected}
        onSelect={onSelect}
        isPriority={isPriority}
      />
    </div>
  );
}

function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const update = () => {
      const nextWidth = Math.floor(element.clientWidth);
      const nextHeight = Math.floor(element.clientHeight);
      setSize((prev) => {
        if (prev.width === nextWidth && prev.height === nextHeight) {
          return prev;
        }

        return { width: nextWidth, height: nextHeight };
      });
    };

    update();

    const observer = new ResizeObserver(() => {
      update();
    });

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, []);

  return { ref, size, setSize };
}

function CardGrid({
  cards,
  selectedCardId,
  onSelect,
  minColumnWidth = 180,
  columnGap = 14,
  rowGap = 14,
  overscanRowCount = 2,
}: Props) {
  const { ref, size, setSize } = useElementSize<HTMLDivElement>();

  useEffect(() => {
    if (!ref.current) return;
    setSize({
      width: Math.floor(ref.current.clientWidth),
      height: Math.floor(ref.current.clientHeight),
    });
  }, [cards.length, ref, setSize]);

  const columnCount = useMemo(() => {
    if (size.width <= 0) return 1;
    const estimated = Math.floor(size.width / minColumnWidth);
    return Math.max(1, estimated);
  }, [size.width, minColumnWidth]);

  const columnWidth = useMemo(() => {
    if (size.width <= 0) return minColumnWidth;
    return Math.max(minColumnWidth, Math.floor(size.width / columnCount));
  }, [size.width, minColumnWidth, columnCount]);

  const rowHeight = useMemo(() => {
    return estimateCardTileHeight(columnWidth);
  }, [columnWidth]);

  const rowCount = useMemo(() => {
    return Math.ceil(cards.length / columnCount);
  }, [cards.length, columnCount]);

  const gridData = useMemo<ItemData>(
    () => ({
      cards,
      columnCount,
      selectedCardId,
      onSelect,
      columnGap,
      rowGap,
    }),
    [cards, columnCount, selectedCardId, onSelect, columnGap, rowGap]
  );

  if (cards.length === 0) {
    return (
      <div className="empty-state">
        <p>표시할 카드가 없습니다.</p>
      </div>
    );
  }

  return (
    <div ref={ref} style={{ width: "100%", height: "100%" }}>
      {size.width > 0 && size.height > 0 ? (
        <Grid
          width={size.width}
          height={size.height}
          columnCount={columnCount}
          columnWidth={columnWidth}
          rowCount={rowCount}
          rowHeight={rowHeight}
          itemData={gridData}
          overscanRowCount={overscanRowCount}
          overscanColumnCount={1}
        >
          {GridCell}
        </Grid>
      ) : null}
    </div>
  );
}

export default memo(CardGrid);
