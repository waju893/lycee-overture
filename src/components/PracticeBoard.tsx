import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { CardRef, FieldSlot, GameState, PlayerID } from "../game/GameTypes";
import {
  getCardImageCandidates,
  markCardImageFailed,
  markCardImageResolved,
} from "../config/cardImage";

const FIELD_RENDER_ORDER: FieldSlot[] = [
  "DF_LEFT",
  "DF_CENTER",
  "DF_RIGHT",
  "AF_LEFT",
  "AF_CENTER",
  "AF_RIGHT",
];

function getCardLabel(card: CardRef): string {
  const ap = card.ap ?? card.power ?? 0;
  const dp = card.dp ?? card.hp ?? card.power ?? 0;
  const dmg = card.dmg ?? card.damage ?? 0;
  const flags: string[] = [];

  if (card.isTapped) flags.push("DOWN");

  return `${card.name} AP ${ap} / DP ${dp} / DMG ${dmg}${
    flags.length ? ` [${flags.join(", ")}]` : ""
  }`;
}

function getCardCode(card: CardRef): string {
  return String(card.cardNo ?? card.sameNameKey ?? "").trim().toUpperCase();
}

function CardImage({
  card,
  clickable,
  onClick,
}: {
  card: CardRef;
  clickable: boolean;
  onClick: () => void;
}) {
  const cardCode = getCardCode(card);
  const candidates = useMemo(() => getCardImageCandidates(cardCode), [cardCode]);
  const [candidateIndex, setCandidateIndex] = useState(0);

  useEffect(() => {
    setCandidateIndex(0);
  }, [cardCode, candidates]);

  const currentSrc = candidates[candidateIndex] ?? "";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!clickable}
      title={getCardLabel(card)}
      style={{
        ...cardImageButtonStyle,
        cursor: clickable ? "pointer" : "default",
        opacity: clickable ? 1 : 0.96,
      }}
    >
      <div style={cardImageFrameStyle}>
        {currentSrc ? (
          <img
            src={currentSrc}
            alt={card.name}
            loading="lazy"
            decoding="async"
            draggable={false}
            onLoad={() => {
              markCardImageResolved(cardCode, currentSrc);
            }}
            onError={() => {
              markCardImageFailed(currentSrc);
              setCandidateIndex((prev) => prev + 1);
            }}
            style={cardImageStyle}
          />
        ) : (
          <div style={cardImageFallbackStyle}>이미지 없음</div>
        )}
      </div>

      <div style={cardTextWrapStyle}>
        <div style={cardNameStyle}>{card.name}</div>
        <div style={cardCodeStyle}>{cardCode || card.instanceId}</div>
      </div>
    </button>
  );
}

type CardPileModalState =
  | {
      kind: "discard" | "deck";
      playerId: PlayerID;
      label: string;
      cards: CardRef[];
    }
  | null;

type PileActionCellProps = {
  label: string;
  count: number;
  onClick: () => void;
};

function PileActionCell({ label, count, onClick }: PileActionCellProps) {
  return (
    <button type="button" style={pileCellButtonStyle} onClick={onClick}>
      <div style={pileCellTitleStyle}>{label}</div>
      <div style={pileCellBodyStyle}>{count > 0 ? `${count}장` : "비어 있음"}</div>
    </button>
  );
}

type PlayerAreaProps = {
  label: string;
  playerId: PlayerID;
  state: GameState;
  isPerspectivePlayer: boolean;
  onHandCardClick: (playerId: PlayerID, card: CardRef) => void;
  onFieldClick: (playerId: PlayerID, slot: FieldSlot) => void;
  onOpenPile: (
    kind: "discard" | "deck",
    playerId: PlayerID,
    label: string,
    cards: CardRef[],
  ) => void;
};

function PlayerArea({
  label,
  playerId,
  state,
  isPerspectivePlayer,
  onHandCardClick,
  onFieldClick,
  onOpenPile,
}: PlayerAreaProps) {
  const player = state.players[playerId];

  return (
    <div style={panelStyle}>
      <div style={sectionTitleStyle}>{label}</div>

      <div style={metaRowStyle}>
        <span>덱 {player.deck.length}</span>
        <span>패 {player.hand.length}</span>
        <span>쓰레기통 {player.discard.length}</span>
        <span>현재 턴 {state.turn.activePlayer === playerId ? "예" : "아니오"}</span>
      </div>

      <div style={fieldGridStyle}>
        {FIELD_RENDER_ORDER.slice(0, 3).map((typedSlot) => {
          const card = player.field[typedSlot].card;
          return (
            <button
              key={`${playerId}-${typedSlot}`}
              type="button"
              style={slotButtonStyle}
              onClick={() => onFieldClick(playerId, typedSlot)}
            >
              <div style={slotTitleStyle}>{typedSlot}</div>
              <div style={slotBodyStyle}>{card ? getCardLabel(card) : "비어 있음"}</div>
            </button>
          );
        })}

        <PileActionCell
          label="덱 보기"
          count={player.deck.length}
          onClick={() => onOpenPile("deck", playerId, label, player.deck)}
        />

        {FIELD_RENDER_ORDER.slice(3).map((typedSlot) => {
          const card = player.field[typedSlot].card;
          return (
            <button
              key={`${playerId}-${typedSlot}`}
              type="button"
              style={slotButtonStyle}
              onClick={() => onFieldClick(playerId, typedSlot)}
            >
              <div style={slotTitleStyle}>{typedSlot}</div>
              <div style={slotBodyStyle}>{card ? getCardLabel(card) : "비어 있음"}</div>
            </button>
          );
        })}

        <PileActionCell
          label="쓰레기통 보기"
          count={player.discard.length}
          onClick={() => onOpenPile("discard", playerId, label, player.discard)}
        />
      </div>

      <div style={sectionMinorTitleStyle}>
        손패 {isPerspectivePlayer ? "(카드 클릭으로 사용)" : "(연습 모드에서 확인 가능)"}
      </div>

      <div style={handGridStyle}>
        {player.hand.length === 0 ? (
          <div style={emptyHintStyle}>손패가 없습니다.</div>
        ) : (
          player.hand.map((card) => (
            <CardImage
              key={card.instanceId}
              card={card}
              clickable={isPerspectivePlayer}
              onClick={() => onHandCardClick(playerId, card)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function CardPileModal({
  state,
  onClose,
}: {
  state: CardPileModalState;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!state) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [state, onClose]);

  if (!state) return null;

  const pileTitle = state.kind === "deck" ? "덱" : "쓰레기통";
  const pileSubtitle =
    state.kind === "deck"
      ? "덱 맨 위부터 아래 방향 순서대로 표시"
      : "카드가 놓인 순서대로 표시";

  return (
    <div style={modalOverlayStyle} onClick={onClose}>
      <div style={modalCardStyle} onClick={(event) => event.stopPropagation()}>
        <div style={modalHeaderStyle}>
          <div>
            <div style={modalTitleStyle}>{state.label} {pileTitle}</div>
            <div style={modalSubTitleStyle}>{pileSubtitle}</div>
          </div>

          <button type="button" style={modalCloseButtonStyle} onClick={onClose}>
            닫기
          </button>
        </div>

        {state.cards.length === 0 ? (
          <div style={emptyHintStyle}>{pileTitle}이 비어 있습니다.</div>
        ) : (
          <div style={pileGridStyle}>
            {state.cards.map((card, index) => (
              <div key={`${state.kind}-${card.instanceId}-${index}`} style={pileItemWrapStyle}>
                <div style={pileOrderStyle}>{index + 1}</div>
                <CardImage card={card} clickable={false} onClick={() => {}} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface PracticeBoardProps {
  state: GameState;
  perspective: PlayerID;
  onHandCardClick: (playerId: PlayerID, card: CardRef) => void;
  onFieldClick: (playerId: PlayerID, slot: FieldSlot) => void;
}

export default function PracticeBoard({
  state,
  perspective,
  onHandCardClick,
  onFieldClick,
}: PracticeBoardProps) {
  const opponent = perspective === "P1" ? "P2" : "P1";
  const [pileModalState, setPileModalState] = useState<CardPileModalState>(null);

  return (
    <>
      <div style={boardLayoutStyle}>
        <PlayerArea
          label={`상단 플레이어 (${opponent})`}
          playerId={opponent}
          state={state}
          isPerspectivePlayer={false}
          onHandCardClick={onHandCardClick}
          onFieldClick={onFieldClick}
          onOpenPile={(kind, playerId, label, cards) =>
            setPileModalState({
              kind,
              playerId,
              label,
              cards,
            })
          }
        />
        <PlayerArea
          label={`하단 플레이어 (${perspective})`}
          playerId={perspective}
          state={state}
          isPerspectivePlayer={true}
          onHandCardClick={onHandCardClick}
          onFieldClick={onFieldClick}
          onOpenPile={(kind, playerId, label, cards) =>
            setPileModalState({
              kind,
              playerId,
              label,
              cards,
            })
          }
        />
      </div>

      <CardPileModal
        state={pileModalState}
        onClose={() => setPileModalState(null)}
      />
    </>
  );
}

const boardLayoutStyle: CSSProperties = {
  display: "grid",
  gap: 16,
};

const panelStyle: CSSProperties = {
  background: "#182233",
  border: "1px solid #2a3850",
  borderRadius: 12,
  padding: 16,
};

const metaRowStyle: CSSProperties = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
  color: "#b9c3d6",
};

const fieldGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 10,
  marginTop: 12,
  marginBottom: 16,
};

const sectionTitleStyle: CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  marginBottom: 10,
};

const sectionMinorTitleStyle: CSSProperties = {
  fontSize: 16,
  fontWeight: 600,
  marginTop: 10,
};

const slotTitleStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  marginBottom: 6,
};

const slotBodyStyle: CSSProperties = {
  fontSize: 13,
  lineHeight: 1.4,
  color: "#d9e2f2",
};

const slotButtonStyle: CSSProperties = {
  background: "#0f1724",
  border: "1px solid #33435e",
  borderRadius: 10,
  padding: 12,
  color: "#ffffff",
  textAlign: "left",
  minHeight: 110,
  cursor: "pointer",
};

const pileCellButtonStyle: CSSProperties = {
  background: "#24324a",
  border: "1px solid #4a7cff",
  borderRadius: 10,
  padding: 12,
  color: "#ffffff",
  textAlign: "left",
  minHeight: 110,
  cursor: "pointer",
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
};

const pileCellTitleStyle: CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
};

const pileCellBodyStyle: CSSProperties = {
  fontSize: 13,
  color: "#dbeafe",
};

const handGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
  gap: 10,
  marginTop: 8,
};

const cardImageButtonStyle: CSSProperties = {
  background: "#111827",
  border: "1px solid #3e5379",
  borderRadius: 10,
  padding: 8,
  color: "#ffffff",
  textAlign: "left",
  width: "100%",
};

const cardImageFrameStyle: CSSProperties = {
  width: "100%",
  aspectRatio: "63 / 88",
  borderRadius: 8,
  overflow: "hidden",
  background: "#0b1220",
};

const cardImageStyle: CSSProperties = {
  display: "block",
  width: "100%",
  height: "100%",
  objectFit: "cover",
};

const cardImageFallbackStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#9ca3af",
  fontSize: 12,
};

const cardTextWrapStyle: CSSProperties = {
  marginTop: 8,
};

const cardNameStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: "#f9fafb",
  lineHeight: 1.35,
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
  wordBreak: "break-word",
};

const cardCodeStyle: CSSProperties = {
  marginTop: 4,
  fontSize: 11,
  color: "#9ca3af",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const emptyHintStyle: CSSProperties = {
  color: "#9fb0ca",
  padding: "6px 2px",
};

const modalOverlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(3, 8, 18, 0.74)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
  zIndex: 1000,
};

const modalCardStyle: CSSProperties = {
  width: "min(1200px, 100%)",
  maxHeight: "min(88vh, 1000px)",
  overflow: "auto",
  background: "#182233",
  border: "1px solid #2a3850",
  borderRadius: 16,
  padding: 20,
  boxSizing: "border-box",
};

const modalHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 16,
  marginBottom: 16,
  flexWrap: "wrap",
};

const modalTitleStyle: CSSProperties = {
  fontSize: 22,
  fontWeight: 700,
  color: "#ffffff",
};

const modalSubTitleStyle: CSSProperties = {
  marginTop: 4,
  color: "#b9c3d6",
};

const modalCloseButtonStyle: CSSProperties = {
  background: "#24324a",
  color: "#ffffff",
  border: "1px solid #3e5379",
  borderRadius: 10,
  padding: "10px 14px",
  cursor: "pointer",
  fontWeight: 700,
};

const pileGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
  gap: 12,
};

const pileItemWrapStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const pileOrderStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: "#dbeafe",
  textAlign: "center",
};
