import { type CSSProperties } from "react";
import type { CardRef, FieldSlot, GameState, PlayerID } from "../game/GameTypes";

const FIELD_ROWS: FieldSlot[][] = [
  ["DF_LEFT", "DF_CENTER", "DF_RIGHT"],
  ["AF_LEFT", "AF_CENTER", "AF_RIGHT"],
];

function getCardStats(card: CardRef): string {
  const ap = card.ap ?? card.power ?? 0;
  const dp = card.dp ?? card.hp ?? 0;
  const dmg = card.dmg ?? card.damage ?? 0;
  return `AP ${ap} / DP ${dp} / DMG ${dmg}`;
}

function CardButton({
  card,
  selected,
  onClick,
}: {
  card: CardRef;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...cardButtonStyle,
        borderColor: selected ? "#60a5fa" : "#334155",
        background: selected ? "#1e3a5f" : "#0f172a",
      }}
    >
      <div style={cardNameStyle}>{card.name}</div>
      <div style={cardMetaStyle}>{card.cardNo}</div>
      <div style={cardMetaStyle}>{getCardStats(card)}</div>
      {card.isTapped ? <div style={downBadgeStyle}>DOWN</div> : null}
    </button>
  );
}

function FieldCellButton({
  slot,
  card,
  selected,
  onClick,
}: {
  slot: FieldSlot;
  card: CardRef | null;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...fieldCellStyle,
        borderColor: selected ? "#60a5fa" : "#334155",
      }}
    >
      <div style={slotLabelStyle}>{slot}</div>
      {card ? (
        <>
          <div style={cardNameStyle}>{card.name}</div>
          <div style={cardMetaStyle}>{getCardStats(card)}</div>
          {card.isTapped ? <div style={downBadgeStyle}>DOWN</div> : null}
        </>
      ) : (
        <div style={emptyTextStyle}>비어 있음</div>
      )}
    </button>
  );
}

function PlayerSection({
  label,
  playerId,
  state,
  selectedHandCardId,
  selectedFieldSlot,
  onHandCardClick,
  onFieldCellClick,
}: {
  label: string;
  playerId: PlayerID;
  state: GameState;
  selectedHandCardId: string | null;
  selectedFieldSlot: FieldSlot | null;
  onHandCardClick: (cardId: string) => void;
  onFieldCellClick: (slot: FieldSlot) => void;
}) {
  const player = state.players[playerId];

  return (
    <div style={panelStyle}>
      <div style={panelTitleStyle}>{label}</div>
      <div style={metaRowStyle}>
        <span>덱 {player.deck.length}</span>
        <span>패 {player.hand.length}</span>
        <span>쓰레기통 {player.discard.length}</span>
      </div>

      <div style={fieldGridStyle}>
        {FIELD_ROWS.flat().map((slot) => (
          <FieldCellButton
            key={`${playerId}-${slot}`}
            slot={slot}
            card={player.field[slot].card}
            selected={selectedFieldSlot === slot}
            onClick={() => onFieldCellClick(slot)}
          />
        ))}
      </div>

      <div style={subTitleStyle}>손패</div>
      <div style={handGridStyle}>
        {player.hand.length === 0 ? (
          <div style={emptyTextStyle}>손패가 없습니다.</div>
        ) : (
          player.hand.map((card) => (
            <CardButton
              key={card.instanceId}
              card={card}
              selected={selectedHandCardId === card.instanceId}
              onClick={() => onHandCardClick(card.instanceId)}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default function PracticeBoardView({
  state,
  perspective,
  selectedHandCardId,
  selectedFieldSlot,
  onHandCardClick,
  onFieldCellClick,
}: {
  state: GameState;
  perspective: PlayerID;
  selectedHandCardId: string | null;
  selectedFieldSlot: FieldSlot | null;
  onHandCardClick: (playerId: PlayerID, cardId: string) => void;
  onFieldCellClick: (playerId: PlayerID, slot: FieldSlot) => void;
}) {
  const opponent = perspective === "P1" ? "P2" : "P1";

  return (
    <div style={boardStyle}>
      <PlayerSection
        label={`상단 플레이어 (${opponent})`}
        playerId={opponent}
        state={state}
        selectedHandCardId={perspective === opponent ? selectedHandCardId : null}
        selectedFieldSlot={perspective === opponent ? selectedFieldSlot : null}
        onHandCardClick={(cardId) => onHandCardClick(opponent, cardId)}
        onFieldCellClick={(slot) => onFieldCellClick(opponent, slot)}
      />
      <PlayerSection
        label={`하단 플레이어 (${perspective})`}
        playerId={perspective}
        state={state}
        selectedHandCardId={selectedHandCardId}
        selectedFieldSlot={selectedFieldSlot}
        onHandCardClick={(cardId) => onHandCardClick(perspective, cardId)}
        onFieldCellClick={(slot) => onFieldCellClick(perspective, slot)}
      />
    </div>
  );
}

const boardStyle: CSSProperties = {
  display: "grid",
  gap: 16,
};

const panelStyle: CSSProperties = {
  background: "#182233",
  border: "1px solid #2a3850",
  borderRadius: 12,
  padding: 16,
};

const panelTitleStyle: CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  marginBottom: 10,
};

const metaRowStyle: CSSProperties = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
  color: "#b9c3d6",
  marginBottom: 10,
};

const subTitleStyle: CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  marginTop: 12,
  marginBottom: 8,
};

const fieldGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 10,
};

const fieldCellStyle: CSSProperties = {
  background: "#0f172a",
  border: "1px solid #334155",
  borderRadius: 10,
  padding: 10,
  minHeight: 100,
  color: "#ffffff",
  textAlign: "left",
  cursor: "pointer",
};

const handGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
  gap: 10,
};

const cardButtonStyle: CSSProperties = {
  background: "#0f172a",
  border: "1px solid #334155",
  borderRadius: 10,
  padding: 10,
  color: "#ffffff",
  textAlign: "left",
  cursor: "pointer",
  position: "relative",
  minHeight: 96,
};

const slotLabelStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: "#93c5fd",
  marginBottom: 6,
};

const cardNameStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  lineHeight: 1.35,
};

const cardMetaStyle: CSSProperties = {
  fontSize: 12,
  color: "#cbd5e1",
  marginTop: 4,
};

const emptyTextStyle: CSSProperties = {
  fontSize: 13,
  color: "#94a3b8",
};

const downBadgeStyle: CSSProperties = {
  marginTop: 8,
  display: "inline-block",
  background: "#7f1d1d",
  color: "#ffffff",
  borderRadius: 9999,
  padding: "3px 8px",
  fontSize: 11,
  fontWeight: 800,
};
