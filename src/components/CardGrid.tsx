import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type UIEvent,
} from "react";
import type { CardMeta } from "../types/card";
import { preloadCardImage } from "../config/cardImage";
import CardImage from "./CardImage";

type CardGridProps = {
  cards: CardMeta[];
  selectedCardId?: CardMeta["id"] | null;
  onSelect: (card: CardMeta) => void;
  minColumnWidth?: number;
  columnGap?: number;
  rowGap?: number;
  overscanRowCount?: number;
};

const DEFAULT_MIN_COLUMN_WIDTH = 180;
const DEFAULT_COLUMN_GAP = 14;
const DEFAULT_ROW_GAP = 14;
const DEFAULT_OVERSCAN_ROW_COUNT = 3;
const CARD_CAPTION_HEIGHT = 56;
const CARD_ASPECT_RATIO = 63 / 88;

function getCardKey(card: CardMeta, index: number): string {
  const idPart =
    card.id != null ? String(card.id) : card.code != null ? String(card.code) : "";
  return idPart || `card-${index}`;
}

export default function CardGrid({
  cards,
  selectedCardId = null,
  onSelect,
  minColumnWidth = DEFAULT_MIN_COLUMN_WIDTH,
  columnGap = DEFAULT_COLUMN_GAP,
  rowGap = DEFAULT_ROW_GAP,
  overscanRowCount = DEFAULT_OVERSCAN_ROW_COUNT,
}: CardGridProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [viewportWidth, setViewportWidth] = useState<number>(0);
  const [viewportHeight, setViewportHeight] = useState<number>(800);
  const [scrollTop, setScrollTop] = useState<number>(0);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const updateSize = () => {
      const nextWidth = Math.max(0, element.clientWidth);
      const nextHeight = Math.max(320, element.clientHeight || 800);
      setViewportWidth(nextWidth);
      setViewportHeight(nextHeight);
    };

    updateSize();

    const resizeObserver = new ResizeObserver(() => {
      updateSize();
    });

    resizeObserver.observe(element);
    window.addEventListener("resize", updateSize);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", updateSize);
    };
  }, []);

  const {
    columnCount,
    totalRows,
    visibleStartRow,
    visibleEndRow,
    topSpacerHeight,
    bottomSpacerHeight,
    visibleCards,
  } = useMemo(() => {
    const safeWidth = Math.max(1, viewportWidth);
    const safeColumnWidth = Math.max(120, minColumnWidth);

    const nextColumnCount = Math.max(
      1,
      Math.floor((safeWidth + columnGap) / (safeColumnWidth + columnGap))
    );

    const totalGapWidth = columnGap * Math.max(0, nextColumnCount - 1);
    const nextCardWidth = Math.max(
      100,
      Math.floor((safeWidth - totalGapWidth) / nextColumnCount)
    );

    const imageHeight = Math.ceil(nextCardWidth / CARD_ASPECT_RATIO);
    const nextRowHeight = imageHeight + CARD_CAPTION_HEIGHT + rowGap;

    const nextTotalRows = Math.ceil(cards.length / nextColumnCount);

    const startRow = Math.max(
      0,
      Math.floor(scrollTop / Math.max(1, nextRowHeight)) - overscanRowCount
    );

    const endRow = Math.min(
      Math.max(0, nextTotalRows - 1),
      Math.ceil((scrollTop + viewportHeight) / Math.max(1, nextRowHeight)) +
        overscanRowCount
    );

    const startIndex = startRow * nextColumnCount;
    const endIndexExclusive = Math.min(
      cards.length,
      (endRow + 1) * nextColumnCount
    );

    return {
      columnCount: nextColumnCount,
      totalRows: nextTotalRows,
      visibleStartRow: startRow,
      visibleEndRow: endRow,
      topSpacerHeight: startRow * nextRowHeight,
      bottomSpacerHeight: Math.max(
        0,
        (nextTotalRows - endRow - 1) * nextRowHeight
      ),
      visibleCards: cards.slice(startIndex, endIndexExclusive),
    };
  }, [
    cards,
    columnGap,
    minColumnWidth,
    overscanRowCount,
    rowGap,
    scrollTop,
    viewportHeight,
    viewportWidth,
  ]);

  useEffect(() => {
    const targets = visibleCards.slice(0, 18);
    for (const card of targets) {
      void preloadCardImage(card.code, card.imageUrl);
    }
  }, [visibleCards]);

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop);
  };

  if (cards.length === 0) {
    return (
      <div
        ref={containerRef}
        onScroll={handleScroll}
        style={{
          width: "100%",
          height: "100%",
          minHeight: 320,
          overflowY: "auto",
          overflowX: "hidden",
        }}
      >
        <div
          className="empty-state"
          style={{
            minHeight: 240,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          조건에 맞는 카드가 없습니다.
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      style={{
        width: "100%",
        height: "100%",
        minHeight: 320,
        overflowY: "auto",
        overflowX: "hidden",
        paddingRight: 4,
      }}
    >
      <div style={{ height: topSpacerHeight }} />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
          columnGap: `${columnGap}px`,
          rowGap: `${rowGap}px`,
          alignItems: "start",
        }}
      >
        {visibleCards.map((card, index) => {
          const isSelected =
            selectedCardId != null && String(selectedCardId) === String(card.id);

          return (
            <button
              key={getCardKey(card, index)}
              type="button"
              onClick={() => onSelect(card)}
              style={{
                display: "flex",
                flexDirection: "column",
                width: "100%",
                minWidth: 0,
                padding: 0,
                borderRadius: 14,
                overflow: "hidden",
                cursor: "pointer",
                background: isSelected ? "#1d4ed8" : "#111827",
                border: isSelected
                  ? "2px solid #93c5fd"
                  : "1px solid rgba(75, 85, 99, 0.95)",
                boxShadow: isSelected
                  ? "0 0 0 2px rgba(147, 197, 253, 0.18)"
                  : "none",
                textAlign: "left",
              }}
            >
              <div
                style={{
                  width: "100%",
                  aspectRatio: "63 / 88",
                  background: "#0b1220",
                  overflow: "hidden",
                }}
              >
                <CardImage
                  cardCode={card.code}
                  imageUrl={card.imageUrl}
                  alt={card.name}
                  fallbackLabel={card.code}
                  loading="lazy"
                  decoding="async"
                  style={{
                    display: "block",
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    background: "#0b1220",
                  }}
                />
              </div>

              <div
                style={{
                  minHeight: CARD_CAPTION_HEIGHT,
                  padding: "8px 10px 10px",
                  background: isSelected ? "rgba(15, 23, 42, 0.72)" : "#111827",
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#f9fafb",
                    lineHeight: 1.35,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                    wordBreak: "break-word",
                  }}
                >
                  {card.name}
                </div>
                <div
                  style={{
                    marginTop: 4,
                    fontSize: 11,
                    color: isSelected ? "#dbeafe" : "#9ca3af",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {card.code}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div style={{ height: bottomSpacerHeight }} />

      {totalRows > 0 && visibleEndRow < visibleStartRow && (
        <div
          style={{
            padding: "12px 0",
            color: "#9ca3af",
            fontSize: 12,
          }}
        >
          카드 계산 중...
        </div>
      )}
    </div>
  );
}
