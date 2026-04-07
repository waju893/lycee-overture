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

type CardActionMenuState =
  | {
      kind: "deck" | "discard";
      playerId: PlayerID;
      cardId: string;
    }
  | null;

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

type DeckMenuState =
  | {
      playerId: PlayerID;
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
  isDeckMenuOpen: boolean;
  onHandCardClick: (playerId: PlayerID, card: CardRef) => void;
  onFieldClick: (playerId: PlayerID, slot: FieldSlot) => void;
  onOpenPile: (
    kind: "discard" | "deck",
    playerId: PlayerID,
    label: string,
    cards: CardRef[],
  ) => void;
  onToggleDeckMenu: (playerId: PlayerID) => void;
  onDrawFromDeck: (playerId: PlayerID) => void;
  onDamageFromDeck: (playerId: PlayerID) => void;
  onShuffleDeck: (playerId: PlayerID) => void;
};

function PlayerArea({
  label,
  playerId,
  state,
  isPerspectivePlayer,
  isDeckMenuOpen,
  onHandCardClick,
  onFieldClick,
  onOpenPile,
  onToggleDeckMenu,
  onDrawFromDeck,
  onDamageFromDeck,
  onShuffleDeck,
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

        {isDeckMenuOpen ? (
          <div style={pileMenuCellStyle} data-deck-menu-keep="true">
            <button
              type="button"
              style={miniActionButtonStyle}
              onClick={() => onDrawFromDeck(playerId)}
            >
              드로우
            </button>
            <button
              type="button"
              style={miniActionButtonStyle}
              onClick={() => onDamageFromDeck(playerId)}
            >
              대미지
            </button>
            <button
              type="button"
              style={miniActionButtonStyle}
              onClick={() => onShuffleDeck(playerId)}
            >
              셔플
            </button>
            <button
              type="button"
              style={miniActionButtonStyle}
              onClick={() => onOpenPile("deck", playerId, label, player.deck)}
            >
              덱 보기
            </button>
          </div>
        ) : (
          <button
            type="button"
            style={pileCellButtonStyle}
            onClick={() => onToggleDeckMenu(playerId)}
            data-deck-menu-keep="true"
          >
            <div style={pileCellTitleStyle}>덱</div>
            <div style={pileCellBodyStyle}>{player.deck.length > 0 ? `${player.deck.length}장` : "비어 있음"}</div>
          </button>
        )}

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

        <button
          type="button"
          style={pileCellButtonStyle}
          onClick={() => onOpenPile("discard", playerId, label, player.discard)}
        >
          <div style={pileCellTitleStyle}>쓰레기통 보기</div>
          <div style={pileCellBodyStyle}>
            {player.discard.length > 0 ? `${player.discard.length}장` : "비어 있음"}
          </div>
        </button>
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

function CardActionOverlay({
  state,
  onClose,
  onMoveToField,
  onMoveToHand,
  onMoveToDiscard,
}: {
  state: CardActionMenuState;
  onClose: () => void;
  onMoveToField: (cardId: string, source: "deck" | "discard", playerId: PlayerID) => void;
  onMoveToHand: (cardId: string, source: "deck" | "discard", playerId: PlayerID) => void;
  onMoveToDiscard: (cardId: string, source: "deck" | "discard", playerId: PlayerID) => void;
}) {
  if (!state) return null;

  return (
    <div style={cardActionOverlayStyle} data-deck-menu-keep="true">
      <button
        type="button"
        style={cardActionButtonStyle}
        onClick={() => onMoveToField(state.cardId, state.kind, state.playerId)}
      >
        배치
      </button>
      <button
        type="button"
        style={cardActionButtonStyle}
        onClick={() => onMoveToHand(state.cardId, state.kind, state.playerId)}
      >
        손패로
      </button>
      <button
        type="button"
        style={cardActionButtonStyle}
        onClick={() => onMoveToDiscard(state.cardId, state.kind, state.playerId)}
      >
        쓰레기통으로
      </button>
      <button
        type="button"
        style={cardActionCloseButtonStyle}
        onClick={onClose}
      >
        닫기
      </button>
    </div>
  );
}

function CardPileModal({
  state,
  activeCardAction,
  onClose,
  onCardClick,
  onMoveToField,
  onMoveToHand,
  onMoveToDiscard,
}: {
  state: CardPileModalState;
  activeCardAction: CardActionMenuState;
  onClose: () => void;
  onCardClick: (kind: "deck" | "discard", playerId: PlayerID, cardId: string) => void;
  onMoveToField: (cardId: string, source: "deck" | "discard", playerId: PlayerID) => void;
  onMoveToHand: (cardId: string, source: "deck" | "discard", playerId: PlayerID) => void;
  onMoveToDiscard: (cardId: string, source: "deck" | "discard", playerId: PlayerID) => void;
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
            {state.cards.map((card, index) => {
              const isActionOpen =
                activeCardAction?.playerId === state.playerId &&
                activeCardAction?.kind === state.kind &&
                activeCardAction?.cardId === card.instanceId;

              return (
                <div key={`${state.kind}-${card.instanceId}-${index}`} style={pileItemWrapStyle}>
                  <div style={pileOrderStyle}>{index + 1}</div>
                  <div style={pileCardStackStyle}>
                    <div style={{ opacity: isActionOpen ? 0.42 : 1, transition: "opacity 0.15s ease" }}>
                      <CardImage
                        card={card}
                        clickable={true}
                        onClick={() => onCardClick(state.kind, state.playerId, card.instanceId)}
                      />
                    </div>

                    {isActionOpen ? (
                      <CardActionOverlay
                        state={activeCardAction}
                        onClose={() => onCardClick(state.kind, state.playerId, "")}
                        onMoveToField={onMoveToField}
                        onMoveToHand={onMoveToHand}
                        onMoveToDiscard={onMoveToDiscard}
                      />
                    ) : null}
                  </div>
                </div>
              );
            })}
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
  onDrawFromDeck?: (playerId: PlayerID) => void;
  onDamageFromDeck?: (playerId: PlayerID) => void;
  onShuffleDeck?: (playerId: PlayerID) => void;
  onMoveCardToField?: (playerId: PlayerID, cardId: string, source: "deck" | "discard") => void;
  onMoveCardToHand?: (playerId: PlayerID, cardId: string, source: "deck" | "discard") => void;
  onMoveCardToDiscard?: (playerId: PlayerID, cardId: string, source: "deck" | "discard") => void;
}

export default function PracticeBoard({
  state,
  perspective,
  onHandCardClick,
  onFieldClick,
  onDrawFromDeck,
  onDamageFromDeck,
  onShuffleDeck,
  onMoveCardToField,
  onMoveCardToHand,
  onMoveCardToDiscard,
}: PracticeBoardProps) {
  const opponent = perspective === "P1" ? "P2" : "P1";
  const [pileModalState, setPileModalState] = useState<CardPileModalState>(null);
  const [deckMenuState, setDeckMenuState] = useState<DeckMenuState>(null);
  const [cardActionState, setCardActionState] = useState<CardActionMenuState>(null);

  useEffect(() => {
    const handleGlobalPointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-deck-menu-keep='true']")) return;
      setDeckMenuState(null);
      setCardActionState(null);
    };

    window.addEventListener("mousedown", handleGlobalPointerDown);
    return () => {
      window.removeEventListener("mousedown", handleGlobalPointerDown);
    };
  }, []);

  const toggleDeckMenu = (playerId: PlayerID) => {
    setDeckMenuState((prev) =>
      prev?.playerId === playerId ? null : { playerId }
    );
  };

  const handleCardClick = (kind: "deck" | "discard", playerId: PlayerID, cardId: string) => {
    if (!cardId) {
      setCardActionState(null);
      return;
    }

    setCardActionState((prev) => {
      if (
        prev?.kind === kind &&
        prev.playerId === playerId &&
        prev.cardId === cardId
      ) {
        return null;
      }

      return { kind, playerId, cardId };
    });
  };

  return (
    <>
      <div style={boardLayoutStyle} data-deck-menu-keep="true">
        <PlayerArea
          label={`상단 플레이어 (${opponent})`}
          playerId={opponent}
          state={state}
          isPerspectivePlayer={false}
          isDeckMenuOpen={deckMenuState?.playerId === opponent}
          onHandCardClick={onHandCardClick}
          onFieldClick={onFieldClick}
          onOpenPile={(kind, playerId, label, cards) => {
            setPileModalState({
              kind,
              playerId,
              label,
              cards,
            });
            setCardActionState(null);
          }}
          onToggleDeckMenu={toggleDeckMenu}
          onDrawFromDeck={(playerId) => onDrawFromDeck?.(playerId)}
          onDamageFromDeck={(playerId) => onDamageFromDeck?.(playerId)}
          onShuffleDeck={(playerId) => onShuffleDeck?.(playerId)}
        />
        <PlayerArea
          label={`하단 플레이어 (${perspective})`}
          playerId={perspective}
          state={state}
          isPerspectivePlayer={true}
          isDeckMenuOpen={deckMenuState?.playerId === perspective}
          onHandCardClick={onHandCardClick}
          onFieldClick={onFieldClick}
          onOpenPile={(kind, playerId, label, cards) => {
            setPileModalState({
              kind,
              playerId,
              label,
              cards,
            });
            setCardActionState(null);
          }}
          onToggleDeckMenu={toggleDeckMenu}
          onDrawFromDeck={(playerId) => onDrawFromDeck?.(playerId)}
          onDamageFromDeck={(playerId) => onDamageFromDeck?.(playerId)}
          onShuffleDeck={(playerId) => onShuffleDeck?.(playerId)}
        />
      </div>

      <CardPileModal
        state={pileModalState}
        activeCardAction={cardActionState}
        onClose={() => {
          setPileModalState(null);
          setCardActionState(null);
        }}
        onCardClick={handleCardClick}
        onMoveToField={(cardId, source, playerId) => onMoveCardToField?.(playerId, cardId, source)}
        onMoveToHand={(cardId, source, playerId) => onMoveCardToHand?.(playerId, cardId, source)}
        onMoveToDiscard={(cardId, source, playerId) => onMoveCardToDiscard?.(playerId, cardId, source)}
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

const pileMenuCellStyle: CSSProperties = {
  background: "#24324a",
  border: "1px solid #4a7cff",
  borderRadius: 10,
  padding: 10,
  minHeight: 110,
  display: "grid",
  gap: 8,
  alignContent: "stretch",
};

const miniActionButtonStyle: CSSProperties = {
  background: "#111827",
  border: "1px solid #3e5379",
  borderRadius: 8,
  color: "#ffffff",
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 13,
  padding: "7px 10px",
  width: "100%",
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

const pileCardStackStyle: CSSProperties = {
  position: "relative",
};

const cardActionOverlayStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "grid",
  gridTemplateRows: "repeat(4, auto)",
  gap: 8,
  alignContent: "center",
  justifyItems: "stretch",
  padding: 10,
  boxSizing: "border-box",
};

const cardActionButtonStyle: CSSProperties = {
  background: "rgba(15, 23, 36, 0.86)",
  border: "1px solid rgba(96, 165, 250, 0.85)",
  borderRadius: 8,
  color: "#ffffff",
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 13,
  padding: "8px 10px",
  width: "100%",
};

const cardActionCloseButtonStyle: CSSProperties = {
  background: "rgba(36, 50, 74, 0.82)",
  border: "1px solid rgba(148, 163, 184, 0.65)",
  borderRadius: 8,
  color: "#ffffff",
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 12,
  padding: "7px 10px",
  width: "100%",
};
