import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { reduceGameState } from "../game/GameEngine";
import { createInitialGameState } from "../game/GameRules";
import type { GameAction } from "../game/GameActions";
import type { DeckEntry } from "../lib/deck";
import { CARD_META_BY_CODE } from "../lib/cards";
import type {
  CardRef,
  FieldSlot,
  GameState,
  PlayerID,
  ReplaySnapshot,
} from "../game/GameTypes";
import PracticeBoardView from "../components/PracticeBoard";

type PlacementMode =
  | {
      type: "hand_to_field";
      playerId: PlayerID;
      cardId: string;
    }
  | null;

const ALL_SLOTS: FieldSlot[] = [
  "AF_LEFT",
  "AF_CENTER",
  "AF_RIGHT",
  "DF_LEFT",
  "DF_CENTER",
  "DF_RIGHT",
];
const CURRENT_DECK_STORAGE_KEY = "lycee-current-deck";

const FIELD_RENDER_ORDER: FieldSlot[] = [
  "DF_LEFT",
  "DF_CENTER",
  "DF_RIGHT",
  "AF_LEFT",
  "AF_CENTER",
  "AF_RIGHT",
];

function makeCharacter(
  instanceId: string,
  owner: PlayerID,
  name: string,
  stats?: { ap?: number; dp?: number; dmg?: number },
): CardRef {
  const ap = stats?.ap ?? 3;
  const dp = stats?.dp ?? 3;
  const dmg = stats?.dmg ?? 1;

  return {
    instanceId,
    cardNo: instanceId,
    name,
    owner,
    cardType: "character",
    sameNameKey: instanceId,
    ap,
    dp,
    dmg,
    power: ap,
    hp: dp,
    damage: dmg,
    isTapped: false,
    canAttack: true,
    canBlock: true,
    revealed: false,
    location: "deck",
  };
}

function makeDeck(owner: PlayerID, prefix: string): CardRef[] {
  const deck: CardRef[] = [];

  while (deck.length < 60) {
    const i = deck.length + 1;
    deck.push(
      makeCharacter(
        `${prefix}_${String(i).padStart(3, "0")}`,
        owner,
        `${prefix}_CHAR_${i}`,
        {
          ap: 2 + (i % 4),
          dp: 2 + (i % 3),
          dmg: 1 + (i % 2),
        },
      ),
    );
  }

  return deck;
}

function normalizeDeckCardType(value: string | undefined): CardRef["cardType"] {
  switch ((value ?? "").toLowerCase()) {
    case "event":
      return "event";
    case "item":
      return "item";
    case "area":
      return "area";
    default:
      return "character";
  }
}

function readPracticeDeckFromStorage(owner: PlayerID): CardRef[] | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(CURRENT_DECK_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as DeckEntry[];
    if (!Array.isArray(parsed) || parsed.length === 0) return null;

    const cards: CardRef[] = [];
    for (const entry of parsed) {
      const code = String(entry?.code ?? "").trim().toUpperCase();
      const qty = Number(entry?.qty ?? 0);
      const meta = CARD_META_BY_CODE[code];
      if (!meta || !Number.isFinite(qty) || qty <= 0) continue;

      for (let i = 0; i < qty; i += 1) {
        cards.push({
          instanceId: `${owner}_${code}_${i + 1}_${cards.length + 1}`,
          cardNo: code,
          name: meta.name ?? code,
          owner,
          cardType: normalizeDeckCardType(meta.type),
          sameNameKey: code,
          ap: meta.ap ?? undefined,
          dp: meta.dp ?? undefined,
          dmg: meta.dmg ?? undefined,
          power: meta.ap ?? undefined,
          hp: meta.dp ?? undefined,
          damage: meta.dmg ?? undefined,
          isTapped: false,
          canAttack: true,
          canBlock: true,
          revealed: false,
          location: "deck",
        });
      }
    }

    return cards.length > 0 ? cards : null;
  } catch {
    return null;
  }
}

function createPracticeState(): GameState {
  const p1DeckFromBuilder = readPracticeDeckFromStorage("P1");
  const p1Deck = p1DeckFromBuilder ?? makeDeck("P1", "P1");

  return createInitialGameState({
    p1Deck,
    p2Deck: makeDeck("P2", "P2"),
    leaderEnabled: false,
  });
}

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

function getFirstEmptySlot(state: GameState, playerId: PlayerID): FieldSlot | null {
  for (const slot of ALL_SLOTS) {
    if (!state.players[playerId].field[slot].card) {
      return slot;
    }
  }
  return null;
}

function getDefaultPerspective(state: GameState): PlayerID {
  if (state.turn.activePlayer === "P1" || state.turn.activePlayer === "P2") {
    return state.turn.activePlayer;
  }
  return "P1";
}

function getPendingDeclarationSummary(state: GameState): string | null {
  const top = state.declarationStack[state.declarationStack.length - 1];
  if (!top) return null;

  if (top.kind === "useCharacter") {
    return `${top.playerId} 캐릭터 등장 선언 대기`;
  }
  if (top.kind === "attack") {
    return `${top.playerId} 공격 선언 대기`;
  }
  return `${top.playerId} 선언 대기`;
}

export default function PracticeBoard() {
  const [state, setState] = useState<GameState>(() => createPracticeState());
  const [perspective, setPerspective] = useState<PlayerID>("P1");
  const [placementMode, setPlacementMode] = useState<PlacementMode>(null);
  const initialStateRef = useRef<GameState>(structuredClone(state));
  const savedWinnerRef = useRef<PlayerID | null>(null);

  const opponent = perspective === "P1" ? "P2" : "P1";
  const activePlayer = state.turn.activePlayer;
  const currentPriority = state.turn.priorityPlayer;
  const pendingDeclaration = state.declarationStack.length > 0;
  const pendingSummary = getPendingDeclarationSummary(state);
  const usingDeckBuilderDeck = useMemo(
    () => state.players.P1.deck.some((card) => card.cardNo.startsWith("LO-")),
    [state.players.P1.deck],
  );

  function dispatch(action: GameAction) {
    setState((prev) => reduceGameState(prev, action));
  }

  function resetPractice() {
    const next = createPracticeState();
    setState(next);
    initialStateRef.current = structuredClone(next);
    savedWinnerRef.current = null;
    setPerspective(getDefaultPerspective(next));
    setPlacementMode(null);
  }

  useEffect(() => {
    if (!state.winner || savedWinnerRef.current === state.winner) return;

    const snapshot: ReplaySnapshot = {
      id: `replay_${Date.now()}`,
      savedAt: Date.now(),
      initialState: structuredClone(initialStateRef.current),
      events: [...state.replayEvents],
      winner: state.winner,
    };

    const key = "lycee.replay.snapshots";
    const prev = localStorage.getItem(key);
    const parsed = prev ? (JSON.parse(prev) as ReplaySnapshot[]) : [];
    const next = [snapshot, ...parsed].slice(0, 20);
    localStorage.setItem(key, JSON.stringify(next));
    savedWinnerRef.current = state.winner;
  }, [state]);

  function handleStartGame() {
    dispatch({ type: "START_GAME", firstPlayer: "P1", leaderEnabled: false });
  }

  function handleKeep(playerId: PlayerID) {
    dispatch({ type: "KEEP_STARTING_HAND", playerId });
  }

  function handleMulligan(playerId: PlayerID) {
    dispatch({ type: "MULLIGAN", playerId });
  }

  function handleFinalizeStartup() {
    dispatch({ type: "FINALIZE_STARTUP" });
  }

  function handleAdvancePhase() {
    dispatch({ type: "ADVANCE_PHASE" });
    setPlacementMode(null);
  }

  function handleStartTurn() {
    dispatch({ type: "START_TURN" });
    setPlacementMode(null);
  }

  function handlePassPriority() {
    dispatch({ type: "PASS_PRIORITY", playerId: currentPriority });
    setPlacementMode(null);
  }

  function handleConcede(playerId: PlayerID) {
    dispatch({ type: "CONCEDE", playerId });
  }

  function handleHandCardClick(playerId: PlayerID, card: CardRef) {
    if (card.cardType !== "character") return;
    if (pendingDeclaration) return;
    if (state.turn.priorityPlayer !== playerId) return;

    if (placementMode?.type === "hand_to_field" && placementMode.cardId === card.instanceId) {
      setPlacementMode(null);
      return;
    }

    const firstEmpty = getFirstEmptySlot(state, playerId);
    if (!firstEmpty) return;

    setPlacementMode({
      type: "hand_to_field",
      playerId,
      cardId: card.instanceId,
    });
  }

  function handleFieldClick(playerId: PlayerID, slot: FieldSlot) {
    const card = state.players[playerId].field[slot].card;

    if (placementMode?.type === "hand_to_field" && placementMode.playerId === playerId) {
      dispatch({
        type: "DECLARE_ACTION",
        playerId,
        kind: "useCharacter",
        sourceCardId: placementMode.cardId,
        targetSlots: [slot],
        targetingMode: "declareTime",
      });
      setPlacementMode(null);
      return;
    }

    if (!card) return;
    if (pendingDeclaration) return;
    if (playerId !== perspective) return;
    if (!slot.startsWith("AF")) return;

    dispatch({
      type: "DECLARE_ACTION",
      playerId,
      kind: "attack",
      sourceCardId: card.instanceId,
    });
    setPlacementMode(null);
  }

  const topPanel = useMemo(() => {
    return (
      <div style={panelStyle}>
        <div style={sectionTitleStyle}>게임 상태</div>
        <div style={statusGridStyle}>
          <div>승자: {state.winner ?? "없음"}</div>
          <div>현재 턴 플레이어: {state.turn.activePlayer}</div>
          <div>현재 페이즈: {state.turn.phase}</div>
          <div>우선권 플레이어: {state.turn.priorityPlayer}</div>
          <div>스타트업 진행 중: {state.startup.active ? "예" : "아니오"}</div>
          <div>배틀 진행 중: {state.battle.isActive ? "예" : "아니오"}</div>
          <div>배틀 공격자: {state.battle.attackerCardId ?? "없음"}</div>
          <div>배틀 방어자: {state.battle.defenderCardId ?? "없음"}</div>
        </div>
      </div>
    );
  }, [state]);

  const passButtonLabel = pendingDeclaration
    ? `대응 안 함 / 해결 (${currentPriority})`
    : `PASS_PRIORITY (${currentPriority})`;

  return (
    <div style={pageStyle}>
      <div style={pageInnerStyle}>
        <div style={headerRowStyle}>
          <div>
            <div style={pageTitleStyle}>연습 모드</div>
            <div style={pageSubTitleStyle}>
              Lycee 대응 흐름 기준: 선언 후에는 상대만 대응 가능, 상대가 대응하지 않으면 즉시 해결
            </div>
          </div>

          <div style={headerButtonsStyle}>
            <Link to="/" style={linkButtonStyle}>
              타이틀로
            </Link>
            <button type="button" style={secondaryButtonStyle} onClick={resetPractice}>
              연습판 초기화
            </button>
          </div>
        </div>

        <div style={toolbarStyle}>
          <button type="button" style={primaryButtonStyle} onClick={handleStartGame}>
            START_GAME
          </button>
          <button type="button" style={secondaryButtonStyle} onClick={handleStartTurn}>
            START_TURN
          </button>
          <button type="button" style={secondaryButtonStyle} onClick={handleAdvancePhase}>
            ADVANCE_PHASE
          </button>
          <button type="button" style={secondaryButtonStyle} onClick={handlePassPriority}>
            {passButtonLabel}
          </button>
          <button
            type="button"
            style={dangerButtonStyle}
            onClick={() => handleConcede(perspective)}
          >
            {perspective} 항복
          </button>
        </div>

        <div style={toolbarStyle}>
          <button type="button" style={secondaryButtonStyle} onClick={() => handleKeep("P1")}>
            P1 KEEP
          </button>
          <button type="button" style={secondaryButtonStyle} onClick={() => handleMulligan("P1")}>
            P1 MULLIGAN
          </button>
          <button type="button" style={secondaryButtonStyle} onClick={() => handleKeep("P2")}>
            P2 KEEP
          </button>
          <button type="button" style={secondaryButtonStyle} onClick={() => handleMulligan("P2")}>
            P2 MULLIGAN
          </button>
          <button type="button" style={primaryButtonStyle} onClick={handleFinalizeStartup}>
            FINALIZE_STARTUP
          </button>
        </div>

        <div style={toolbarStyle}>
          <button
            type="button"
            style={perspective === "P1" ? primaryButtonStyle : secondaryButtonStyle}
            onClick={() => setPerspective("P1")}
          >
            P1 시점
          </button>
          <button
            type="button"
            style={perspective === "P2" ? primaryButtonStyle : secondaryButtonStyle}
            onClick={() => setPerspective("P2")}
          >
            P2 시점
          </button>
          <div style={hintTextStyle}>
            현재 조작 시점: {perspective} / 손패 클릭 후 필드 칸 클릭 = 등장 선언 / 자신의 AF 클릭 = 공격 선언
          </div>
        </div>

        <div style={noticeStyle}>
          P1 덱 소스: {usingDeckBuilderDeck ? "덱 편성에서 저장한 현재 덱" : "기본 연습 덱"}
        </div>

        {placementMode ? (
          <div style={noticeStyle}>
            등장 선언 대기 중: {placementMode.playerId} / 카드 {placementMode.cardId} / 원하는 필드 칸을 클릭
          </div>
        ) : null}

        {pendingDeclaration ? (
          <div style={noticeStyle}>
            선언 스택 존재: {pendingSummary}
            <br />
            현재 우선권 플레이어인 <strong>{currentPriority}</strong>만 대응할 수 있어. 대응이 없으면
            <strong> {passButtonLabel}</strong> 버튼으로 즉시 해결돼.
          </div>
        ) : null}

        {topPanel}

        <PracticeBoardView state={state} perspective={perspective} />

        <div style={logGridStyle}>
          <div style={panelStyle}>
            <div style={sectionTitleStyle}>최근 로그</div>
            <div style={logListStyle}>
              {[...state.logs].reverse().map((log, index) => (
                <div key={`${log}-${index}`} style={logItemStyle}>
                  {log}
                </div>
              ))}
            </div>
          </div>

          <div style={panelStyle}>
            <div style={sectionTitleStyle}>최근 이벤트</div>
            <div style={logListStyle}>
              {[...state.events].reverse().map((event, index) => (
                <div
                  key={`${event.type}-${event.cardId ?? "none"}-${index}`}
                  style={logItemStyle}
                >
                  {event.type}
                  {event.playerId ? ` / ${event.playerId}` : ""}
                  {event.cardId ? ` / ${event.cardId}` : ""}
                  {typeof event.amount === "number" ? ` / ${event.amount}` : ""}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
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
        손패 {isPerspectivePlayer ? "(클릭으로 사용)" : ""}
      </div>
      <div style={handWrapStyle}>
        {player.hand.map((card) => (
          <button
            key={card.instanceId}
            type="button"
            style={handCardButtonStyle}
            onClick={() => onHandCardClick(playerId, card)}
          >
            {getCardLabel(card)}
          </button>
        ))}
      </div>

      <div style={sectionMinorTitleStyle}>버림더미 상단 5장</div>
      <div style={pileStyle}>
        {player.discard.slice(-5).reverse().map((card) => (
          <div key={card.instanceId} style={pileItemStyle}>
            {card.name}
          </div>
        ))}
      </div>
    </div>
  );
}

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  width: "100%",
  background: "#101722",
  color: "#ffffff",
  padding: 24,
  boxSizing: "border-box",
};

const pageInnerStyle: CSSProperties = {
  width: "100%",
  maxWidth: 1200,
  margin: "0 auto",
};

const headerRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 16,
  marginBottom: 16,
  flexWrap: "wrap",
};

const pageTitleStyle: CSSProperties = {
  fontSize: 28,
  fontWeight: 700,
  marginBottom: 4,
};

const pageSubTitleStyle: CSSProperties = {
  color: "#b9c3d6",
};

const headerButtonsStyle: CSSProperties = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
};

const toolbarStyle: CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  marginBottom: 12,
};

const panelStyle: CSSProperties = {
  background: "#182233",
  border: "1px solid #2a3850",
  borderRadius: 12,
  padding: 16,
  marginBottom: 16,
};

const boardLayoutStyle: CSSProperties = {
  display: "grid",
  gap: 16,
};

const statusGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 8,
};

const fieldGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 10,
  marginTop: 12,
  marginBottom: 16,
};

const handWrapStyle: CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
  marginTop: 8,
};

const pileStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  marginTop: 8,
};

const metaRowStyle: CSSProperties = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
  color: "#b9c3d6",
};

const sectionTitleStyle: CSSProperties = {
  fontSize: 20,
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

const handCardButtonStyle: CSSProperties = {
  background: "#24324a",
  border: "1px solid #3e5379",
  borderRadius: 10,
  padding: "10px 12px",
  color: "#ffffff",
  cursor: "pointer",
  textAlign: "left",
};

const pileItemStyle: CSSProperties = {
  background: "#0f1724",
  borderRadius: 8,
  padding: "8px 10px",
  color: "#d9e2f2",
};

const primaryButtonStyle: CSSProperties = {
  background: "#4a7cff",
  color: "#ffffff",
  border: "none",
  borderRadius: 10,
  padding: "10px 14px",
  cursor: "pointer",
  fontWeight: 700,
};

const secondaryButtonStyle: CSSProperties = {
  background: "#24324a",
  color: "#ffffff",
  border: "1px solid #3e5379",
  borderRadius: 10,
  padding: "10px 14px",
  cursor: "pointer",
  fontWeight: 600,
};

const dangerButtonStyle: CSSProperties = {
  background: "#7a2434",
  color: "#ffffff",
  border: "1px solid #a04a5b",
  borderRadius: 10,
  padding: "10px 14px",
  cursor: "pointer",
  fontWeight: 700,
};

const linkButtonStyle: CSSProperties = {
  ...secondaryButtonStyle,
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
};

const noticeStyle: CSSProperties = {
  background: "#24324a",
  border: "1px solid #4a7cff",
  borderRadius: 10,
  padding: 12,
  marginBottom: 16,
  lineHeight: 1.5,
};

const hintTextStyle: CSSProperties = {
  alignSelf: "center",
  color: "#b9c3d6",
};

const logGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 16,
};

const logListStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  maxHeight: 320,
  overflowY: "auto",
};

const logItemStyle: CSSProperties = {
  background: "#0f1724",
  borderRadius: 8,
  padding: "8px 10px",
  color: "#d9e2f2",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
};
