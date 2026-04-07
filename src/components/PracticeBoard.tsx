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

function HandCardImage({
  card,
  selectable,
  onClick,
}: {
  card: CardRef;
  selectable: boolean;
  onClick: () => void;
}) {
  const cardCode = getCardCode(card);
  const candidates = useMemo(
    () => getCardImageCandidates(cardCode),
    [cardCode]
  );
  const [candidateIndex, setCandidateIndex] = useState(0);

  useEffect(() => {
    setCandidateIndex(0);
  }, [cardCode, candidates]);

  const currentSrc = candidates[candidateIndex] ?? "";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!selectable}
      title={getCardLabel(card)}
      style={{
        ...handImageButtonStyle,
        cursor: selectable ? "pointer" : "default",
        opacity: selectable ? 1 : 0.92,
      }}
    >
      <div style={handImageFrameStyle}>
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
            style={handImageStyle}
          />
        ) : (
          <div style={handImageFallbackStyle}>이미지 없음</div>
        )}
      </div>

      <div style={handCardTextWrapStyle}>
        <div style={handCardNameStyle}>{card.name}</div>
        <div style={handCardCodeStyle}>{cardCode || card.instanceId}</div>
      </div>
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
};

function PlayerArea({
  label,
  playerId,
  state,
  isPerspectivePlayer,
  onHandCardClick,
  onFieldClick,
}: PlayerAreaProps) {
  const player = state.players[playerId];

  return (
    <div style={panelStyle}>
      <div style={sectionTitleStyle}>{label}</div>

      <div style={metaRowStyle}>
        <span>덱 {player.deck.length}</span>
        <span>패 {player.hand.length}</span>
        <span>버림 {player.discard.length}</span>
        <span>현재 턴 {state.turn.activePlayer === playerId ? "예" : "아니오"}</span>
      </div>

      <div style={fieldGridStyle}>
        {FIELD_RENDER_ORDER.map((typedSlot) => {
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
      </div>

      <div style={sectionMinorTitleStyle}>
        손패 {isPerspectivePlayer ? "(카드 클릭으로 사용)" : "(연습 모드에서 확인 가능)"}
      </div>

      <div style={handGridStyle}>
        {player.hand.length === 0 ? (
          <div style={emptyHintStyle}>손패가 없습니다.</div>
        ) : (
          player.hand.map((card) => (
            <HandCardImage
              key={card.instanceId}
              card={card}
              selectable={isPerspectivePlayer}
              onClick={() => onHandCardClick(playerId, card)}
            />
          ))
        )}
      </div>

      <div style={sectionMinorTitleStyle}>버림더미 상단 5장</div>
      <div style={pileStyle}>
        {player.discard.length === 0 ? (
          <div style={emptyHintStyle}>버림더미가 비어 있습니다.</div>
        ) : (
          player.discard
            .slice(-5)
            .reverse()
            .map((card) => (
              <div key={card.instanceId} style={pileItemStyle}>
                {card.name}
              </div>
            ))
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

  return (
    <div style={boardLayoutStyle}>
      <PlayerArea
        label={`상단 플레이어 (${opponent})`}
        playerId={opponent}
        state={state}
        isPerspectivePlayer={false}
        onHandCardClick={onHandCardClick}
        onFieldClick={onFieldClick}
      />
      <PlayerArea
        label={`하단 플레이어 (${perspective})`}
        playerId={perspective}
        state={state}
        isPerspectivePlayer={true}
        onHandCardClick={onHandCardClick}
        onFieldClick={onFieldClick}
      />
    </div>
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

const fieldGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 10,
  marginTop: 12,
  marginBottom: 16,
};

const metaRowStyle: CSSProperties = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
  color: "#b9c3d6",
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

const handGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
  gap: 10,
  marginTop: 8,
};

const handImageButtonStyle: CSSProperties = {
  background: "#111827",
  border: "1px solid #3e5379",
  borderRadius: 10,
  padding: 8,
  color: "#ffffff",
  textAlign: "left",
  width: "100%",
};

const handImageFrameStyle: CSSProperties = {
  width: "100%",
  aspectRatio: "63 / 88",
  borderRadius: 8,
  overflow: "hidden",
  background: "#0b1220",
};

const handImageStyle: CSSProperties = {
  display: "block",
  width: "100%",
  height: "100%",
  objectFit: "cover",
};

const handImageFallbackStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#9ca3af",
  fontSize: 12,
};

const handCardTextWrapStyle: CSSProperties = {
  marginTop: 8,
};

const handCardNameStyle: CSSProperties = {
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

const handCardCodeStyle: CSSProperties = {
  marginTop: 4,
  fontSize: 11,
  color: "#9ca3af",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const pileStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  marginTop: 8,
};

const pileItemStyle: CSSProperties = {
  background: "#0f1724",
  borderRadius: 8,
  padding: "8px 10px",
  color: "#d9e2f2",
};

const emptyHintStyle: CSSProperties = {
  color: "#9fb0ca",
  padding: "6px 2px",
};
