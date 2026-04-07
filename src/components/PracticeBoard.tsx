import type { CSSProperties } from "react";
import type { CardRef, FieldSlot, GameState, PlayerID } from "../game/GameTypes";

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

function PlayerArea({
  label,
  playerId,
  state,
}: {
  label: string;
  playerId: PlayerID;
  state: GameState;
}) {
  const player = state.players[playerId];

  return (
    <div style={panelStyle}>
      <div style={sectionTitleStyle}>{label}</div>
      <div style={metaRowStyle}>
        <span>덱 {player.deck.length}</span>
        <span>패 {player.hand.length}</span>
        <span>버림 {player.discard.length}</span>
      </div>

      <div style={fieldGridStyle}>
        {FIELD_RENDER_ORDER.map((typedSlot) => {
          const card = player.field[typedSlot].card;
          return (
            <div key={`${playerId}-${typedSlot}`} style={slotBoxStyle}>
              <div style={slotTitleStyle}>{typedSlot}</div>
              <div style={slotBodyStyle}>{card ? getCardLabel(card) : "비어 있음"}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface PracticeBoardProps {
  state: GameState;
  perspective: PlayerID;
}

export default function PracticeBoard({ state, perspective }: PracticeBoardProps) {
  const opponent = perspective === "P1" ? "P2" : "P1";

  return (
    <div style={boardLayoutStyle}>
      <PlayerArea label={`상단 플레이어 (${opponent})`} playerId={opponent} state={state} />
      <PlayerArea label={`하단 플레이어 (${perspective})`} playerId={perspective} state={state} />
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

const slotBoxStyle: CSSProperties = {
  background: "#0f1724",
  border: "1px solid #33435e",
  borderRadius: 10,
  padding: 12,
  minHeight: 84,
};
