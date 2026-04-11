import { useMemo, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import PracticeBoardView from "../components/PracticeBoard";
import { reduceGameState } from "../game/GameEngine";
import { createInitialGameState, getMatchingDefenderSlotForColumn } from "../game/GameRules";
import type { GameAction } from "../game/GameActions";
import type { CardRef, FieldSlot, GameState, PlayerID } from "../game/GameTypes";

const ALL_SLOTS: FieldSlot[] = [
  "AF_LEFT",
  "AF_CENTER",
  "AF_RIGHT",
  "DF_LEFT",
  "DF_CENTER",
  "DF_RIGHT",
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
        { ap: 2 + (i % 4), dp: 2 + (i % 3), dmg: 1 + (i % 2) },
      ),
    );
  }
  return deck;
}

function shuffleCards<T>(cards: T[]): T[] {
  const next = [...cards];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function createPracticeState(): GameState {
  return createInitialGameState({
    p1Deck: shuffleCards(makeDeck("P1", "P1")),
    p2Deck: shuffleCards(makeDeck("P2", "P2")),
    leaderEnabled: false,
  });
}

function findFirstEmptySlot(state: GameState, playerId: PlayerID): FieldSlot | null {
  for (const slot of ALL_SLOTS) {
    if (!state.players[playerId].field[slot].card) return slot;
  }
  return null;
}

function findCardInHand(state: GameState, playerId: PlayerID, cardId: string): CardRef | undefined {
  return state.players[playerId].hand.find((card) => card.instanceId === cardId);
}

function getPendingDeclarationSummary(state: GameState): string | null {
  const top = state.declarationStack[state.declarationStack.length - 1];
  if (!top) return null;
  if (top.kind === "useCharacter") return `${top.playerId} 캐릭터 등장 선언 대기`;
  if (top.kind === "attack") return `${top.playerId} 공격 선언 대기`;
  if (top.kind === "useAbility") return `${top.playerId} 능력 사용 선언 대기`;
  if (top.kind === "chargeCharacter") return `${top.playerId} 차지 선언 대기`;
  return `${top.playerId} 선언 대기`;
}

export default function PracticeBoardPage() {
  const [state, setState] = useState<GameState>(() => createPracticeState());
  const [perspective, setPerspective] = useState<PlayerID>("P1");
  const [selectedHandCardId, setSelectedHandCardId] = useState<string | null>(null);
  const [selectedFieldSlot, setSelectedFieldSlot] = useState<FieldSlot | null>(null);

  const opponent = perspective === "P1" ? "P2" : "P1";
  const currentPriority = state.battle.isActive
    ? state.battle.priorityPlayer ?? state.turn.priorityPlayer
    : state.turn.priorityPlayer;
  const pendingSummary = getPendingDeclarationSummary(state);

  const battleDefenderCandidate = useMemo(() => {
    if (!state.battle.isActive || !state.battle.attackerPlayerId || state.battle.defenderCardId) {
      return null;
    }
    const defenderPlayerId = state.battle.defenderPlayerId;
    const column = state.battle.attackColumn;
    if (!defenderPlayerId || typeof column !== "number") return null;

    const slot = getMatchingDefenderSlotForColumn(column);
    const card = state.players[defenderPlayerId].field[slot].card;
    if (!card || card.isTapped) return null;

    return {
      playerId: defenderPlayerId,
      slot,
      cardId: card.instanceId,
      name: card.name,
    };
  }, [state]);

  function dispatch(action: GameAction) {
    setState((prev) => reduceGameState(prev, action));
  }

  function resetPractice() {
    const next = createPracticeState();
    setState(next);
    setSelectedHandCardId(null);
    setSelectedFieldSlot(null);
  }

  function handleHandCardClick(playerId: PlayerID, cardId: string) {
    setPerspective(playerId);
    setSelectedFieldSlot(null);
    setSelectedHandCardId((prev) => (prev === cardId ? null : cardId));
  }

  function handleFieldCellClick(playerId: PlayerID, slot: FieldSlot) {
    setPerspective(playerId);
    setSelectedFieldSlot((prev) => (prev === slot ? null : slot));
    setSelectedHandCardId(null);
  }

  function handleStartGame() {
    dispatch({ type: "START_GAME", firstPlayer: "P1", leaderEnabled: false });
  }

  function handleStartTurn() {
    dispatch({ type: "START_TURN" });
  }

  function handleAdvancePhase() {
    dispatch({ type: "ADVANCE_PHASE" });
  }

  function handlePassPriority() {
    dispatch({ type: "PASS_PRIORITY", playerId: currentPriority });
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

  function handleSpawnSelectedHandCard() {
    if (!selectedHandCardId) return;
    const playerId = perspective;
    const card = findCardInHand(state, playerId, selectedHandCardId);
    if (!card || card.cardType !== "character") return;
    const emptySlot = findFirstEmptySlot(state, playerId);
    if (!emptySlot) return;

    dispatch({
      type: "DECLARE_ACTION",
      playerId,
      kind: "useCharacter",
      sourceCardId: selectedHandCardId,
      targetSlots: [emptySlot],
      targetingMode: "declareTime",
    });
    setSelectedHandCardId(null);
  }

  function handleAttackSelectedFieldCard() {
    if (!selectedFieldSlot) return;
    const playerId = perspective;
    const card = state.players[playerId].field[selectedFieldSlot].card;
    if (!card) return;
    if (!selectedFieldSlot.startsWith("AF")) return;

    dispatch({
      type: "DECLARE_ACTION",
      playerId,
      kind: "attack",
      sourceCardId: card.instanceId,
    });
    setSelectedFieldSlot(null);
  }

  function handleChooseDefender() {
    if (!battleDefenderCandidate) return;
    dispatch({
      type: "SET_DEFENDER",
      playerId: battleDefenderCandidate.playerId,
      defenderCardId: battleDefenderCandidate.cardId,
    });
  }

  function handleDeclineDefender() {
    if (!battleDefenderCandidate) return;
    dispatch({
      type: "SET_DEFENDER",
      playerId: battleDefenderCandidate.playerId,
    });
  }

  return (
    <div style={pageStyle}>
      <div style={pageInnerStyle}>
        <div style={headerRowStyle}>
          <div>
            <div style={pageTitleStyle}>연습 모드</div>
            <div style={pageSubTitleStyle}>
              PracticeBoard ↔ GameEngine 연결 버전
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
            PASS_PRIORITY ({currentPriority})
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
          <div style={hintTextStyle}>현재 조작 시점: {perspective}</div>
        </div>

        {selectedHandCardId ? (
          <div style={noticeStyle}>
            선택한 손패: {selectedHandCardId}
            <div style={buttonRowStyle}>
              <button type="button" style={primaryButtonStyle} onClick={handleSpawnSelectedHandCard}>
                선택 카드 등장 선언
              </button>
              <button type="button" style={secondaryButtonStyle} onClick={() => setSelectedHandCardId(null)}>
                선택 해제
              </button>
            </div>
          </div>
        ) : null}

        {selectedFieldSlot ? (
          <div style={noticeStyle}>
            선택한 필드 칸: {selectedFieldSlot}
            <div style={buttonRowStyle}>
              <button type="button" style={primaryButtonStyle} onClick={handleAttackSelectedFieldCard}>
                선택 캐릭터 공격 선언
              </button>
              <button type="button" style={secondaryButtonStyle} onClick={() => setSelectedFieldSlot(null)}>
                선택 해제
              </button>
            </div>
          </div>
        ) : null}

        {state.battle.isActive ? (
          <div style={battleNoticeStyle}>
            <div style={battleTitleStyle}>배틀 중 상태</div>
            <div>attacker: {state.battle.attackerCardId ?? "-"}</div>
            <div>defender: {state.battle.defenderCardId ?? "없음"}</div>
            <div>priority: {state.battle.priorityPlayer ?? "-"}</div>

            {battleDefenderCandidate ? (
              <div style={{ marginTop: 10 }}>
                <div style={{ marginBottom: 8 }}>
                  {battleDefenderCandidate.playerId}는 {battleDefenderCandidate.slot}의 {battleDefenderCandidate.name}로 방어할 수 있습니다.
                </div>
                <div style={buttonRowStyle}>
                  <button type="button" style={primaryButtonStyle} onClick={handleChooseDefender}>
                    방어 선택
                  </button>
                  <button type="button" style={secondaryButtonStyle} onClick={handleDeclineDefender}>
                    방어 안 함
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {pendingSummary ? (
          <div style={noticeStyle}>
            선언 스택 존재: {pendingSummary}
          </div>
        ) : null}

        <PracticeBoardView
          state={state}
          perspective={perspective}
          selectedHandCardId={selectedHandCardId}
          selectedFieldSlot={selectedFieldSlot}
          onHandCardClick={handleHandCardClick}
          onFieldCellClick={handleFieldCellClick}
        />

        <div style={logGridStyle}>
          <div style={panelStyle}>
            <div style={panelTitleStyle}>최근 로그</div>
            <div style={logListStyle}>
              {[...state.logs].reverse().map((log, index) => (
                <div key={`${log}-${index}`} style={logItemStyle}>
                  {log}
                </div>
              ))}
            </div>
          </div>

          <div style={panelStyle}>
            <div style={panelTitleStyle}>최근 이벤트</div>
            <div style={logListStyle}>
              {[...state.events].reverse().map((event, index) => (
                <div key={`${event.type}-${event.cardId ?? "none"}-${index}`} style={logItemStyle}>
                  {event.type}
                  {event.playerId ? ` / ${event.playerId}` : ""}
                  {event.cardId ? ` / ${event.cardId}` : ""}
                </div>
              ))}
            </div>
          </div>
        </div>
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
  marginTop: 16,
};

const panelTitleStyle: CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  marginBottom: 10,
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

const battleNoticeStyle: CSSProperties = {
  background: "#3b1d1d",
  border: "1px solid #f87171",
  borderRadius: 10,
  padding: 12,
  marginBottom: 16,
  lineHeight: 1.6,
};

const battleTitleStyle: CSSProperties = {
  fontSize: 17,
  fontWeight: 800,
  marginBottom: 8,
};

const hintTextStyle: CSSProperties = {
  alignSelf: "center",
  color: "#b9c3d6",
};

const buttonRowStyle: CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  marginTop: 10,
};

const logGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 16,
  marginTop: 16,
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
