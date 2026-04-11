import { type CSSProperties } from "react";
import type { CardRef, FieldSlot, GameState, PlayerID } from "../game/GameTypes";
import { CARD_META_BY_CODE } from "../lib/cards";

const FIELD_ROWS: FieldSlot[][] = [
  ["DF_LEFT", "DF_CENTER", "DF_RIGHT"],
  ["AF_LEFT", "AF_CENTER", "AF_RIGHT"],
];

function cardStats(card: CardRef): string {
  const ap = card.ap ?? card.power ?? 0;
  const dp = card.dp ?? card.hp ?? 0;
  const dmg = card.dmg ?? card.damage ?? 0;
  return `AP ${ap} / DP ${dp} / DMG ${dmg}`;
}

function getMeta(card: CardRef) {
  return CARD_META_BY_CODE[String(card.cardNo ?? "").trim().toUpperCase()];
}

function HandCardButton({
  playerId,
  card,
  onUse,
  onDeclare,
  onDeckTop,
  onDeckBottom,
}: {
  playerId: PlayerID;
  card: CardRef;
  onUse: (playerId: PlayerID, card: CardRef, costCardIds: string[]) => void;
  onDeclare: (playerId: PlayerID, cardId: string) => void;
  onDeckTop: (playerId: PlayerID, cardId: string) => void;
  onDeckBottom: (playerId: PlayerID, cardId: string) => void;
}) {
  return (
    <div style={cardBoxStyle}>
      <div style={cardTitleStyle}>{card.name}</div>
      <div style={cardMetaStyle}>{card.cardNo}</div>
      <div style={cardMetaStyle}>{card.cardType}</div>
      <div style={cardMetaStyle}>{cardStats(card)}</div>
      {getMeta(card)?.cost ? <div style={cardMetaStyle}>cost {String(getMeta(card)?.cost)}</div> : null}
      {typeof getMeta(card)?.ex === "number" ? <div style={cardMetaStyle}>ex {String(getMeta(card)?.ex ?? 0)}</div> : null}
      {(getMeta(card)?.attributesList ?? []).length > 0 ? (
        <div style={cardMetaStyle}>attr {(getMeta(card)?.attributesList ?? []).join(", ")}</div>
      ) : null}
      {String(getMeta(card)?.useTarget ?? "").trim() ? (
        <div style={cardMetaStyle}>useTarget {String(getMeta(card)?.useTarget ?? "")}</div>
      ) : null}
      <div style={buttonWrapStyle}>
        <button type="button" style={smallPrimaryStyle} onClick={() => onUse(playerId, card, [])}>
          사용/등장
        </button>
        <button type="button" style={smallSecondaryStyle} onClick={() => onDeclare(playerId, card.instanceId)}>
          패 선언
        </button>
        <button type="button" style={smallSecondaryStyle} onClick={() => onDeckTop(playerId, card.instanceId)}>
          덱 위
        </button>
        <button type="button" style={smallSecondaryStyle} onClick={() => onDeckBottom(playerId, card.instanceId)}>
          덱 아래
        </button>
      </div>
    </div>
  );
}

function FieldCell({
  playerId,
  slot,
  state,
  onClick,
  onFieldCharacterAction,
}: {
  playerId: PlayerID;
  slot: FieldSlot;
  state: GameState;
  onClick: (playerId: PlayerID, slot: FieldSlot) => void;
  onFieldCharacterAction: (
    playerId: PlayerID,
    slot: FieldSlot,
    actionKind: "attack" | "tap" | "untap" | "charge" | "move",
  ) => void;
}) {
  const cell = state.players[playerId].field[slot] as {
    card: CardRef | null;
    area?: CardRef | null;
    attachedItem?: CardRef | null;
  };
  const card = cell.card;

  return (
    <div style={fieldCellStyle}>
      <button type="button" style={slotHeaderButtonStyle} onClick={() => onClick(playerId, slot)}>
        {slot}
      </button>

      {card ? (
        <>
          <div style={cardTitleStyle}>{card.name}</div>
          <div style={cardMetaStyle}>{cardStats(card)}</div>
          <div style={cardMetaStyle}>{card.isTapped ? "DOWN" : "READY"}</div>
          <div style={buttonWrapStyle}>
            <button
              type="button"
              style={smallPrimaryStyle}
              onClick={() => onFieldCharacterAction(playerId, slot, "attack")}
            >
              공격
            </button>
            <button
              type="button"
              style={smallSecondaryStyle}
              onClick={() => onFieldCharacterAction(playerId, slot, "tap")}
            >
              탭
            </button>
            <button
              type="button"
              style={smallSecondaryStyle}
              onClick={() => onFieldCharacterAction(playerId, slot, "untap")}
            >
              언탭
            </button>
            <button
              type="button"
              style={smallSecondaryStyle}
              onClick={() => onFieldCharacterAction(playerId, slot, "move")}
            >
              이동
            </button>
            <button
              type="button"
              style={smallSecondaryStyle}
              onClick={() => onFieldCharacterAction(playerId, slot, "charge")}
            >
              차지
            </button>
          </div>
        </>
      ) : (
        <div style={emptyTextStyle}>빈 칸 (클릭해서 배치)</div>
      )}

      {cell.area ? <div style={attachmentTextStyle}>에리어: {cell.area.name}</div> : null}
      {cell.attachedItem ? <div style={attachmentTextStyle}>아이템: {cell.attachedItem.name}</div> : null}
    </div>
  );
}

function ZoneCardGrid({
  title,
  cards,
  playerId,
  source,
  onPrimaryCardAction,
  onMoveCardToHand,
}: {
  title: string;
  cards: CardRef[];
  playerId: PlayerID;
  source: "deck" | "discard";
  onPrimaryCardAction: (
    playerId: PlayerID,
    card: CardRef,
    source: "deck" | "discard",
    costCardIds: string[],
  ) => void;
  onMoveCardToHand: (playerId: PlayerID, cardId: string, source: "deck" | "discard") => void;
}) {
  return (
    <div style={zonePanelStyle}>
      <div style={subTitleStyle}>{title}</div>
      <div style={zoneCountStyle}>{cards.length}장</div>
      <div style={miniGridStyle}>
        {cards.slice(0, 10).map((card) => (
          <div key={card.instanceId} style={miniCardStyle}>
            <div style={miniCardTitleStyle}>{card.name}</div>
            <div style={buttonWrapStyle}>
              <button
                type="button"
                style={smallPrimaryStyle}
                onClick={() => onPrimaryCardAction(playerId, card, source, [])}
              >
                사용/배치
              </button>
              <button
                type="button"
                style={smallSecondaryStyle}
                onClick={() => onMoveCardToHand(playerId, card.instanceId, source)}
              >
                손패
              </button>
            </div>
          </div>
        ))}
        {cards.length === 0 ? <div style={emptyTextStyle}>없음</div> : null}
      </div>
    </div>
  );
}

function PlayerPane({
  label,
  playerId,
  state,
  onHandPrimaryAction,
  onHandDeclareAction,
  onMoveHandCardToDeckTop,
  onMoveHandCardToDeckBottom,
  onFieldClick,
  onDrawFromDeck,
  onDamageFromDeck,
  onShuffleDeck,
  onPrimaryCardAction,
  onMoveCardToHand,
  onFieldCharacterAction,
}: {
  label: string;
  playerId: PlayerID;
  state: GameState;
  onHandPrimaryAction: (playerId: PlayerID, card: CardRef, costCardIds: string[]) => void;
  onHandDeclareAction: (playerId: PlayerID, cardId: string) => void;
  onMoveHandCardToDeckTop: (playerId: PlayerID, cardId: string) => void;
  onMoveHandCardToDeckBottom: (playerId: PlayerID, cardId: string) => void;
  onFieldClick: (playerId: PlayerID, slot: FieldSlot) => void;
  onDrawFromDeck: (playerId: PlayerID) => void;
  onDamageFromDeck: (playerId: PlayerID) => void;
  onShuffleDeck: (playerId: PlayerID) => void;
  onPrimaryCardAction: (
    playerId: PlayerID,
    card: CardRef,
    source: "deck" | "discard",
    costCardIds: string[],
  ) => void;
  onMoveCardToHand: (playerId: PlayerID, cardId: string, source: "deck" | "discard") => void;
  onFieldCharacterAction: (
    playerId: PlayerID,
    slot: FieldSlot,
    actionKind: "attack" | "tap" | "untap" | "charge" | "move",
  ) => void;
}) {
  const player = state.players[playerId];

  return (
    <section style={panelStyle}>
      <div style={panelTitleStyle}>{label}</div>
      <div style={metaRowStyle}>
        <span>덱 {player.deck.length}</span>
        <span>패 {player.hand.length}</span>
        <span>쓰레기통 {player.discard.length}</span>
      </div>

      <div style={buttonWrapStyle}>
        <button type="button" style={smallPrimaryStyle} onClick={() => onDrawFromDeck(playerId)}>
          드로우 1
        </button>
        <button type="button" style={smallSecondaryStyle} onClick={() => onDamageFromDeck(playerId)}>
          덱 대미지 1
        </button>
        <button type="button" style={smallSecondaryStyle} onClick={() => onShuffleDeck(playerId)}>
          셔플
        </button>
      </div>

      <div style={subTitleStyle}>필드</div>
      <div style={fieldGridStyle}>
        {FIELD_ROWS.flat().map((slot) => (
          <FieldCell
            key={`${playerId}-${slot}`}
            playerId={playerId}
            slot={slot}
            state={state}
            onClick={onFieldClick}
            onFieldCharacterAction={onFieldCharacterAction}
          />
        ))}
      </div>

      <div style={subTitleStyle}>손패</div>
      <div style={handGridStyle}>
        {player.hand.length === 0 ? (
          <div style={emptyTextStyle}>손패가 없습니다.</div>
        ) : (
          player.hand.map((card) => (
            <HandCardButton
              key={card.instanceId}
              playerId={playerId}
              card={card}
              onUse={onHandPrimaryAction}
              onDeclare={onHandDeclareAction}
              onDeckTop={onMoveHandCardToDeckTop}
              onDeckBottom={onMoveHandCardToDeckBottom}
            />
          ))
        )}
      </div>

      <div style={zoneGridStyle}>
        <ZoneCardGrid
          title="덱 상단 보기"
          cards={player.deck}
          playerId={playerId}
          source="deck"
          onPrimaryCardAction={onPrimaryCardAction}
          onMoveCardToHand={onMoveCardToHand}
        />
        <ZoneCardGrid
          title="쓰레기통"
          cards={player.discard}
          playerId={playerId}
          source="discard"
          onPrimaryCardAction={onPrimaryCardAction}
          onMoveCardToHand={onMoveCardToHand}
        />
      </div>
    </section>
  );
}

export default function PracticeBoardView({
  state,
  perspective,
  onHandPrimaryAction,
  onHandDeclareAction,
  onMoveHandCardToDeckTop,
  onMoveHandCardToDeckBottom,
  onFieldClick,
  onDrawFromDeck,
  onDamageFromDeck,
  onShuffleDeck,
  onPrimaryCardAction,
  onMoveCardToHand,
  onRecoverCardsToDeckBottom,
  onFieldCharacterAction,
}: {
  state: GameState;
  perspective: PlayerID;
  onHandPrimaryAction: (playerId: PlayerID, card: CardRef, costCardIds: string[]) => void;
  onHandDeclareAction: (playerId: PlayerID, cardId: string) => void;
  onMoveHandCardToDeckTop: (playerId: PlayerID, cardId: string) => void;
  onMoveHandCardToDeckBottom: (playerId: PlayerID, cardId: string) => void;
  onFieldClick: (playerId: PlayerID, slot: FieldSlot) => void;
  onDrawFromDeck: (playerId: PlayerID) => void;
  onDamageFromDeck: (playerId: PlayerID) => void;
  onShuffleDeck: (playerId: PlayerID) => void;
  onPrimaryCardAction: (
    playerId: PlayerID,
    card: CardRef,
    source: "deck" | "discard",
    costCardIds: string[],
  ) => void;
  onMoveCardToHand: (playerId: PlayerID, cardId: string, source: "deck" | "discard") => void;
  onRecoverCardsToDeckBottom: (playerId: PlayerID, cardIdsInOrder: string[]) => void;
  onFieldCharacterAction: (
    playerId: PlayerID,
    slot: FieldSlot,
    actionKind: "attack" | "tap" | "untap" | "charge" | "move",
  ) => void;
}) {
  const opponent = perspective === "P1" ? "P2" : "P1";

  return (
    <div style={boardStyle}>
      <PlayerPane
        label={`상단 플레이어 (${opponent})`}
        playerId={opponent}
        state={state}
        onHandPrimaryAction={onHandPrimaryAction}
        onHandDeclareAction={onHandDeclareAction}
        onMoveHandCardToDeckTop={onMoveHandCardToDeckTop}
        onMoveHandCardToDeckBottom={onMoveHandCardToDeckBottom}
        onFieldClick={onFieldClick}
        onDrawFromDeck={onDrawFromDeck}
        onDamageFromDeck={onDamageFromDeck}
        onShuffleDeck={onShuffleDeck}
        onPrimaryCardAction={onPrimaryCardAction}
        onMoveCardToHand={onMoveCardToHand}
        onFieldCharacterAction={onFieldCharacterAction}
      />
      <PlayerPane
        label={`하단 플레이어 (${perspective})`}
        playerId={perspective}
        state={state}
        onHandPrimaryAction={onHandPrimaryAction}
        onHandDeclareAction={onHandDeclareAction}
        onMoveHandCardToDeckTop={onMoveHandCardToDeckTop}
        onMoveHandCardToDeckBottom={onMoveHandCardToDeckBottom}
        onFieldClick={onFieldClick}
        onDrawFromDeck={onDrawFromDeck}
        onDamageFromDeck={onDamageFromDeck}
        onShuffleDeck={onShuffleDeck}
        onPrimaryCardAction={onPrimaryCardAction}
        onMoveCardToHand={onMoveCardToHand}
        onFieldCharacterAction={onFieldCharacterAction}
      />
    </div>
  );
}

const boardStyle: CSSProperties = {
  display: "grid",
  gap: 16,
  marginBottom: 16,
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
  minHeight: 130,
};

const slotHeaderButtonStyle: CSSProperties = {
  width: "100%",
  textAlign: "left",
  background: "#1e293b",
  color: "#93c5fd",
  border: "1px solid #334155",
  borderRadius: 8,
  padding: "6px 8px",
  cursor: "pointer",
  fontWeight: 700,
  marginBottom: 8,
};

const handGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
  gap: 10,
};

const zoneGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 12,
  marginTop: 16,
};

const zonePanelStyle: CSSProperties = {
  background: "#0f172a",
  border: "1px solid #334155",
  borderRadius: 10,
  padding: 10,
};

const zoneCountStyle: CSSProperties = {
  color: "#b9c3d6",
  marginBottom: 8,
};

const miniGridStyle: CSSProperties = {
  display: "grid",
  gap: 8,
};

const miniCardStyle: CSSProperties = {
  background: "#172131",
  borderRadius: 8,
  padding: 8,
};

const miniCardTitleStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  marginBottom: 6,
};

const cardBoxStyle: CSSProperties = {
  background: "#0f172a",
  border: "1px solid #334155",
  borderRadius: 10,
  padding: 10,
};

const cardTitleStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  lineHeight: 1.35,
};

const cardMetaStyle: CSSProperties = {
  fontSize: 12,
  color: "#cbd5e1",
  marginTop: 4,
};

const attachmentTextStyle: CSSProperties = {
  fontSize: 12,
  color: "#fcd34d",
  marginTop: 6,
};

const emptyTextStyle: CSSProperties = {
  fontSize: 13,
  color: "#94a3b8",
};

const buttonWrapStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
  marginTop: 8,
};

const smallPrimaryStyle: CSSProperties = {
  background: "#4a7cff",
  color: "#ffffff",
  border: "none",
  borderRadius: 8,
  padding: "6px 8px",
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 700,
};

const smallSecondaryStyle: CSSProperties = {
  background: "#24324a",
  color: "#ffffff",
  border: "1px solid #3e5379",
  borderRadius: 8,
  padding: "6px 8px",
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 600,
};
