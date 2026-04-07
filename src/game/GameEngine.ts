// src/game/GameEngine.ts

import type { GameAction } from "./GameActions";
import type {
  FieldSlot,
  GameState,
  PlayerID,
  RuleViolation,
  CardRef,
  FieldCell,
  PlayerState,
} from "./GameTypes";
import {
  applyStateBasedRules,
  canFinalizeStartup,
  canResolvePendingTriggers,
  checkWinner,
  clearBattleState,
  createDeclaration,
  createDeclaredTargets,
  drawCards,
  extractLeaderToHand,
  finalizeStartupState,
  findEligibleDefenders,
  findAttackableCharacters,
  getWarmupDrawCount,
  performMulligan,
  performStartupDraw,
  resolveBattleCore,
  resolveDeclarationCore,
  rollFirstPlayer,
  validateAttackDeclaration,
  validateCharacterEntry,
  validateDefenderSelection,
  validateKeepOrMulligan,
} from "./GameRules";

// --------------------------------------------------
// Local utilities
// --------------------------------------------------

export function getOpponent(playerId: PlayerID): PlayerID {
  return playerId === "P1" ? "P2" : "P1";
}

export function fail(
  message: string,
  code = "RULE_VIOLATION",
  playerId?: PlayerID,
  cardId?: string,
): RuleViolation[] {
  return [{ code, message, playerId, cardId }];
}

export function getCardCurrentSlot(
  state: GameState,
  cardId: string,
): FieldSlot | null {
  for (const playerId of ["P1", "P2"] as const) {
    for (const slot of [
      "AF_LEFT",
      "AF_CENTER",
      "AF_RIGHT",
      "DF_LEFT",
      "DF_CENTER",
      "DF_RIGHT",
    ] as const) {
      const cell = state.players[playerId].field[slot];
      if (cell.card?.instanceId === cardId) return slot;
      if (cell.attachedItem?.instanceId === cardId) return slot;
      if (cell.area?.instanceId === cardId) return slot;
    }
  }

  return null;
}

// --------------------------------------------------
// Deep clone helpers
// --------------------------------------------------

function cloneCard(card: CardRef): CardRef {
  return {
    ...card,
    cost: card.cost ? [...card.cost] : undefined,
    basicAbilities: card.basicAbilities ? [...card.basicAbilities] : undefined,
    effectTypes: card.effectTypes ? [...card.effectTypes] : undefined,
  };
}

function cloneCardArray(cards: CardRef[]): CardRef[] {
  return cards.map(cloneCard);
}

function cloneFieldCell(cell: FieldCell): FieldCell {
  return {
    ...cell,
    card: cell.card ? cloneCard(cell.card) : null,
    attachedItem: cell.attachedItem ? cloneCard(cell.attachedItem) : null,
    area: cell.area ? cloneCard(cell.area) : null,
  };
}

function clonePlayerState(player: PlayerState): PlayerState {
  return {
    ...player,
    deck: cloneCardArray(player.deck),
    hand: cloneCardArray(player.hand),
    discard: cloneCardArray(player.discard),
    leaderZone: cloneCardArray(player.leaderZone),
    limbo: cloneCardArray(player.limbo),
    declaredZone: cloneCardArray(player.declaredZone),
    field: {
      AF_LEFT: cloneFieldCell(player.field.AF_LEFT),
      AF_CENTER: cloneFieldCell(player.field.AF_CENTER),
      AF_RIGHT: cloneFieldCell(player.field.AF_RIGHT),
      DF_LEFT: cloneFieldCell(player.field.DF_LEFT),
      DF_CENTER: cloneFieldCell(player.field.DF_CENTER),
      DF_RIGHT: cloneFieldCell(player.field.DF_RIGHT),
    },
  };
}

function cloneState(state: GameState): GameState {
  return {
    ...state,
    players: {
      P1: clonePlayerState(state.players.P1),
      P2: clonePlayerState(state.players.P2),
    },
    turn: {
      ...state.turn,
    },
    startup: {
      ...state.startup,
      mulliganUsed: { ...state.startup.mulliganUsed },
      keepDecided: { ...state.startup.keepDecided },
      leaderRevealed: { ...state.startup.leaderRevealed },
    },
    battle: {
      ...state.battle,
      supportAttackers: [...state.battle.supportAttackers],
      supportDefenders: [...state.battle.supportDefenders],
    },
    declarationStack: state.declarationStack.map((d) => ({
      ...d,
      declaredTargets: d.declaredTargets.map((t) => ({ ...t })),
      payload: d.payload ? { ...d.payload } : undefined,
    })),
    pendingTriggers: state.pendingTriggers.map((t) => ({
      ...t,
      payload: t.payload ? { ...t.payload } : undefined,
    })),
    resolvingTriggerIds: [...state.resolvingTriggerIds],
    usageCounters: state.usageCounters.map((u) => ({ ...u })),
    logs: [...state.logs],
    events: state.events.map((e) => ({
      ...e,
      payload: e.payload ? { ...e.payload } : undefined,
    })),
    rulingOverrides: state.rulingOverrides.map((r) => ({ ...r })),
  };
}

function nextDeclarationId(state: GameState): string {
  return `decl_${state.turn.turnNumber}_${state.declarationStack.length + 1}_${Date.now()}`;
}

function logViolations(next: GameState, violations: RuleViolation[]): void {
  for (const v of violations) {
    next.logs.push(`[RULE] ${v.code}: ${v.message}`);
  }
}

function resetPassState(next: GameState): void {
  next.turn.passedInRow = 0;
}

function switchPriority(next: GameState): void {
  next.turn.priorityPlayer = getOpponent(next.turn.priorityPlayer);
}

function markAllActivePlayerCharactersUntapped(next: GameState): void {
  const activePlayer = next.turn.activePlayer;
  const field = next.players[activePlayer].field;

  for (const slot of [
    "AF_LEFT",
    "AF_CENTER",
    "AF_RIGHT",
    "DF_LEFT",
    "DF_CENTER",
    "DF_RIGHT",
  ] as const) {
    const card = field[slot].card;
    if (card) {
      card.isTapped = false;
    }
  }
}

function startNextTurn(next: GameState): void {
  next.turn.activePlayer = getOpponent(next.turn.activePlayer);
  next.turn.turnNumber += 1;
  next.turn.phase = "wakeup";
  next.turn.priorityPlayer = next.turn.activePlayer;
  next.turn.passedInRow = 0;
  markAllActivePlayerCharactersUntapped(next);
  next.logs.push(`[TURN] 턴 시작: ${next.turn.turnNumber} / ${next.turn.activePlayer}`);
}

function advancePhaseInternal(next: GameState): void {
  if (next.turn.phase === "wakeup") {
    next.turn.phase = "warmup";
    next.turn.priorityPlayer = next.turn.activePlayer;
    next.turn.passedInRow = 0;
    next.logs.push(`[PHASE] warmup`);
    return;
  }

  if (next.turn.phase === "warmup") {
    next.turn.phase = "main";
    next.turn.priorityPlayer = next.turn.activePlayer;
    next.turn.passedInRow = 0;
    next.logs.push(`[PHASE] main`);
    return;
  }

  if (next.turn.phase === "main") {
    next.turn.phase = "end";
    next.turn.priorityPlayer = next.turn.activePlayer;
    next.turn.passedInRow = 0;
    next.logs.push(`[PHASE] end`);
    return;
  }

  if (next.turn.phase === "end") {
    startNextTurn(next);
  }
}

function resolveTopDeclarationInternal(next: GameState): void {
  const declaration = next.declarationStack.pop();
  if (!declaration) return;

  resolveDeclarationCore(next, declaration);
  next.lastResolvedDeclarationId = declaration.id;

  // 선언 해결 후 기본적으로 우선권은 현재 턴 플레이어에게 되돌린다.
  // 최소 엔진 기준에서는 이게 가장 테스트/플레이 흐름과 잘 맞는다.
  next.turn.priorityPlayer = next.turn.activePlayer;

  resetPassState(next);
  applyStateBasedRules(next);
  checkWinner(next);

  if (next.battle.isActive && next.battle.attackerCardId) {
    tryAutoResolveForcedDefender(next);
  }
}
function maybeAutoResolveAfterDoublePass(next: GameState): void {
  if (next.turn.passedInRow < 2) return;

  if (next.declarationStack.length > 0) {
    resolveTopDeclarationInternal(next);

    return;
  }

  if (next.battle.isActive && next.battle.attackerCardId) {
    next.battle.battleEndedByBothPass = true;
    next.logs.push(`[BATTLE] 양측 패스로 배틀 선언 타이밍 종료`);
    resetPassState(next);
    return;
  }

  if (canResolvePendingTriggers(next)) {
    const trigger = next.pendingTriggers.shift();
    if (trigger) {
      next.logs.push(`[TRIGGER] ${trigger.label} 해결`);
      next.resolvingTriggerIds.push(trigger.id);
      resetPassState(next);
    }
  }
}

function tryAutoResolveForcedDefender(next: GameState): void {
  if (!next.battle.isActive || !next.battle.attackerCardId || !next.battle.defenderPlayerId) {
    return;
  }

  const eligibleDefenders = findEligibleDefenders(
    next,
    next.battle.defenderPlayerId,
    next.battle.attackerCardId,
  );

  if (eligibleDefenders.length === 0) {
    next.battle.defenderCardId = null;
    next.logs.push(`[BATTLE] 방어 가능 DF 없음 -> 직접 공격 처리`);
    resolveBattleCore(next);
    applyStateBasedRules(next);
    checkWinner(next);
    return;
  }

  if (eligibleDefenders.length === 1) {
    next.battle.defenderCardId = eligibleDefenders[0];
    next.logs.push(`[BATTLE] 방어자 자동 지정: ${eligibleDefenders[0]}`);
    resolveBattleCore(next);
    applyStateBasedRules(next);
    checkWinner(next);
    return;
  }

  next.logs.push(`[BATTLE] 방어자 선택 대기`);
}

function validateDeclareActionTiming(
  next: GameState,
  playerId: PlayerID,
): RuleViolation[] {
  const violations: RuleViolation[] = [];

  if (next.winner) {
    violations.push(...fail("이미 게임이 종료되었습니다.", "GAME_ENDED", playerId));
  }

  if (next.startup.active) {
    violations.push(
      ...fail("스타트업 중에는 일반 선언을 할 수 없습니다.", "STARTUP_ACTIVE", playerId),
    );
  }

  if (next.turn.priorityPlayer !== playerId) {
    violations.push(
      ...fail("현재 우선권을 가진 플레이어만 선언할 수 있습니다.", "NO_PRIORITY", playerId),
    );
  }

  return violations;
}

function handleDeclareAction(
  next: GameState,
  action: Extract<GameAction, { type: "DECLARE_ACTION" }>,
): void {
  const timingViolations = validateDeclareActionTiming(next, action.playerId);
  if (timingViolations.length > 0) {
    logViolations(next, timingViolations);
    return;
  }

  if (action.kind === "useCharacter") {
    if (!action.sourceCardId) {
      logViolations(next, fail("등장 선언 카드가 필요합니다.", "CARD_REQUIRED", action.playerId));
      return;
    }

    const slot = action.targetSlots?.[0];
    if (!slot) {
      logViolations(next, fail("등장 위치가 필요합니다.", "TARGET_SLOT_REQUIRED", action.playerId));
      return;
    }

    const card = next.players[action.playerId].hand.find(
      (c) => c.instanceId === action.sourceCardId,
    );

    if (!card) {
      logViolations(next, fail("손패에 해당 카드가 없습니다.", "CARD_NOT_IN_HAND", action.playerId));
      return;
    }

    const violations = validateCharacterEntry(next, action.playerId, card, slot);
    if (violations.length > 0) {
      logViolations(next, violations);
      return;
    }

    const declaration = createDeclaration({
      id: nextDeclarationId(next),
      playerId: action.playerId,
      kind: "useCharacter",
      sourceCardId: action.sourceCardId,
      sourceEffectId: action.sourceEffectId,
      targetingMode: action.targetingMode ?? "declareTime",
      declaredTargets: createDeclaredTargets({
        targetSlots: [slot],
      }),
      payload: action.payload,
      responseToDeclarationId: action.responseToDeclarationId,
    });

    next.declarationStack.push(declaration);
    next.turn.priorityPlayer = getOpponent(action.playerId);
    resetPassState(next);
    next.logs.push(
      `[DECLARE] ${action.playerId} 캐릭터 등장 선언: ${card.name} -> ${slot}`,
    );
    return;
  }

  if (action.kind === "attack") {
    if (!action.sourceCardId) {
      logViolations(next, fail("공격 캐릭터가 필요합니다.", "ATTACKER_REQUIRED", action.playerId));
      return;
    }

    const violations = validateAttackDeclaration(
      next,
      action.playerId,
      action.sourceCardId,
    );

    if (violations.length > 0) {
      logViolations(next, violations);
      return;
    }

    const declaration = createDeclaration({
      id: nextDeclarationId(next),
      playerId: action.playerId,
      kind: "attack",
      sourceCardId: action.sourceCardId,
      sourceEffectId: action.sourceEffectId,
      targetingMode: action.targetingMode ?? "none",
      declaredTargets: createDeclaredTargets({}),
      payload: action.payload,
      responseToDeclarationId: action.responseToDeclarationId,
    });

    next.declarationStack.push(declaration);
    next.turn.priorityPlayer = getOpponent(action.playerId);
    resetPassState(next);
    next.logs.push(
      `[DECLARE] ${action.playerId} 공격 선언: ${action.sourceCardId}`,
    );
    return;
  }

  next.logs.push(`[DECLARE] 아직 미구현 선언: ${action.kind}`);
}

function handleSetDefender(
  next: GameState,
  action: Extract<GameAction, { type: "SET_DEFENDER" }>,
): void {
  if (!next.battle.isActive || !next.battle.attackerCardId) {
    next.logs.push(`[RULE] NO_BATTLE: 현재 배틀 중이 아닙니다.`);
    return;
  }

  if (next.battle.defenderPlayerId !== action.playerId) {
    next.logs.push(`[RULE] NOT_DEFENDER_PLAYER: 방어측 플레이어만 방어자를 정할 수 있습니다.`);
    return;
  }

  if (!action.defenderCardId) {
    next.battle.defenderCardId = null;
    next.logs.push(`[BATTLE] ${action.playerId} 방어자 미선택`);
    resolveBattleCore(next);
    applyStateBasedRules(next);
    checkWinner(next);
    return;
  }

  const violations = validateDefenderSelection(
    next,
    action.playerId,
    action.defenderCardId,
  );

  if (violations.length > 0) {
    logViolations(next, violations);
    return;
  }

  next.battle.defenderCardId = action.defenderCardId;
  next.logs.push(`[BATTLE] ${action.playerId} 방어자 지정: ${action.defenderCardId}`);
  resolveBattleCore(next);
  applyStateBasedRules(next);
  checkWinner(next);
}

function handleWarmupDraw(next: GameState): void {
  const drawCount = getWarmupDrawCount(next);
  const activePlayer = next.turn.activePlayer;

  drawCards(next, activePlayer, drawCount, "warmup");

  if (
    next.turn.turnNumber === 1 &&
    next.turn.activePlayer === next.startup.firstPlayer &&
    !next.turn.firstPlayerDrawFixed
  ) {
    next.turn.firstPlayerDrawFixed = true;
  }

  next.logs.push(`[WARMUP] ${activePlayer} ${drawCount}장 드로우`);
  applyStateBasedRules(next);
  checkWinner(next);
}

function handleStartGame(
  next: GameState,
  action: Extract<GameAction, { type: "START_GAME" }>,
): void {
  const rolled = rollFirstPlayer(action.firstPlayer);

  next.startup.firstPlayer = rolled.firstPlayer;
  next.startup.secondPlayer = rolled.secondPlayer;
  next.startup.leaderEnabled = action.leaderEnabled ?? true;
  next.startup.rerollCount = rolled.rerollCount;

  next.turn.activePlayer = rolled.firstPlayer;
  next.turn.priorityPlayer = rolled.firstPlayer;
  next.turn.phase = "startup";
  next.turn.turnNumber = 1;
  next.turn.passedInRow = 0;
  next.turn.firstPlayerDrawFixed = false;

  extractLeaderToHand(next, "P1");
  extractLeaderToHand(next, "P2");
  performStartupDraw(next);

  next.logs.push(
    `[START_GAME] 선공 ${rolled.firstPlayer}, 후공 ${rolled.secondPlayer} (reroll=${rolled.rerollCount})`,
  );
}

function handleFinalizeStartup(next: GameState): void {
  if (!canFinalizeStartup(next)) {
    next.logs.push(`[RULE] STARTUP_NOT_READY: 양 플레이어의 시작 패 결정이 완료되지 않았습니다.`);
    return;
  }

  finalizeStartupState(next);
  next.logs.push(`[STARTUP] 실제 게임 시작 준비 완료`);
}

function handleMulligan(
  next: GameState,
  action: Extract<GameAction, { type: "MULLIGAN" }>,
): void {
  const pre = validateKeepOrMulligan(next, action.playerId);
  if (pre.length > 0) {
    logViolations(next, pre);
    return;
  }

  const violations = performMulligan(next, action.playerId);
  if (violations.length > 0) {
    logViolations(next, violations);
    return;
  }

  if (canFinalizeStartup(next)) {
    next.logs.push(`[STARTUP] 양 플레이어 결정 완료. FINALIZE_STARTUP 가능`);
  }
}

function handleKeepStartingHand(
  next: GameState,
  action: Extract<GameAction, { type: "KEEP_STARTING_HAND" }>,
): void {
  const violations = validateKeepOrMulligan(next, action.playerId);
  if (violations.length > 0) {
    logViolations(next, violations);
    return;
  }

  next.startup.keepDecided[action.playerId] = true;
  next.logs.push(`[STARTUP] ${action.playerId} 시작 패 유지`);

  if (canFinalizeStartup(next)) {
    next.logs.push(`[STARTUP] 양 플레이어 결정 완료. FINALIZE_STARTUP 가능`);
  }
}

function handleStartTurn(next: GameState): void {
  if (next.startup.active) {
    next.logs.push(`[RULE] STARTUP_ACTIVE: 스타트업이 끝나기 전에는 턴을 시작할 수 없습니다.`);
    return;
  }

  next.turn.phase = "wakeup";
  next.turn.priorityPlayer = next.turn.activePlayer;
  next.turn.passedInRow = 0;
  markAllActivePlayerCharactersUntapped(next);
  next.logs.push(`[TURN] ${next.turn.turnNumber}턴 ${next.turn.activePlayer} 시작`);
}

function handleAdvancePhase(next: GameState): void {
  if (next.startup.active) {
    next.logs.push(`[RULE] STARTUP_ACTIVE: 스타트업 중에는 페이즈를 진행할 수 없습니다.`);
    return;
  }

  const currentPhase = next.turn.phase;
  advancePhaseInternal(next);

  if (currentPhase === "wakeup" && next.turn.phase === "warmup") {
    handleWarmupDraw(next);
    advancePhaseInternal(next);
  }
}

function handlePassPriority(
  next: GameState,
  action: Extract<GameAction, { type: "PASS_PRIORITY" }>,
): void {
  if (next.turn.priorityPlayer !== action.playerId) {
    next.logs.push(`[RULE] NO_PRIORITY: 현재 우선권이 없습니다.`);
    return;
  }

  // Lycee 기준: 선언한 플레이어는 자신의 선언에 대응할 수 없다.
  // 따라서 선언 스택이 있을 때 현재 우선권 플레이어(상대)가 패스하면
  // 즉시 해당 선언을 해결한다.
  if (next.declarationStack.length > 0) {
    next.logs.push(`[PRIORITY] ${action.playerId} 대응 안 함 -> 선언 즉시 해결`);
    resolveTopDeclarationInternal(next);
    return;
  }

  next.turn.passedInRow += 1;
  next.logs.push(
    `[PRIORITY] ${action.playerId} 패스 (${next.turn.passedInRow}회 연속)`,
  );
  switchPriority(next);
  maybeAutoResolveAfterDoublePass(next);
}

function handleResolveTopDeclaration(next: GameState): void {
  if (next.declarationStack.length === 0) {
    next.logs.push(`[RULE] EMPTY_STACK: 해결할 선언이 없습니다.`);
    return;
  }

  resolveTopDeclarationInternal(next);
}

function handleEndBattle(next: GameState): void {
  if (!next.battle.isActive) {
    next.logs.push(`[RULE] NO_BATTLE: 종료할 배틀이 없습니다.`);
    return;
  }

  resolveBattleCore(next);
  applyStateBasedRules(next);
  checkWinner(next);
}

function handleConcede(
  next: GameState,
  action: Extract<GameAction, { type: "CONCEDE" }>,
): void {
  if (next.winner) return;

  next.winner = getOpponent(action.playerId);
  next.logs.push(`[WIN] ${action.playerId} 항복으로 ${next.winner} 승리`);
}

function handleCheckStateBasedRules(next: GameState): void {
  applyStateBasedRules(next);
  checkWinner(next);
}

// --------------------------------------------------
// Public helpers
// --------------------------------------------------

export function canPlayerDeclareCharacter(
  state: GameState,
  playerId: PlayerID,
): boolean {
  if (state.startup.active) return false;
  if (state.turn.phase !== "main") return false;
  if (state.turn.activePlayer !== playerId) return false;
  if (state.turn.priorityPlayer !== playerId) return false;
  return true;
}

export function canPlayerAttack(
  state: GameState,
  playerId: PlayerID,
): boolean {
  if (state.startup.active) return false;
  if (state.turn.phase !== "main") return false;
  if (state.turn.activePlayer !== playerId) return false;
  if (state.turn.priorityPlayer !== playerId) return false;
  if (state.battle.isActive) return false;

  return findAttackableCharacters(state, playerId).length > 0;
}

export function getAvailableAttackers(
  state: GameState,
  playerId: PlayerID,
): string[] {
  return findAttackableCharacters(state, playerId);
}

export function getAvailableDefenders(
  state: GameState,
  playerId: PlayerID,
): string[] {
  if (!state.battle.attackerCardId) return [];
  return findEligibleDefenders(state, playerId, state.battle.attackerCardId);
}

// --------------------------------------------------
// Main reducer
// --------------------------------------------------

export function reduceGameState(state: GameState, action: GameAction): GameState {
  const next = cloneState(state);

  switch (action.type) {
    case "START_GAME": {
      handleStartGame(next, action);
      break;
    }

    case "FINALIZE_STARTUP": {
      handleFinalizeStartup(next);
      break;
    }

    case "MULLIGAN": {
      handleMulligan(next, action);
      break;
    }

    case "KEEP_STARTING_HAND": {
      handleKeepStartingHand(next, action);
      break;
    }

    case "START_TURN": {
      handleStartTurn(next);
      break;
    }

    case "ADVANCE_PHASE": {
      handleAdvancePhase(next);
      break;
    }

    case "WARMUP_DRAW": {
      handleWarmupDraw(next);
      break;
    }

    case "DECLARE_ACTION": {
      handleDeclareAction(next, action);
      break;
    }

    case "PASS_PRIORITY": {
      handlePassPriority(next, action);
      break;
    }

    case "RESOLVE_TOP_DECLARATION": {
      handleResolveTopDeclaration(next);
      break;
    }

    case "RESOLVE_PENDING_TRIGGER": {
      const triggerIndex = next.pendingTriggers.findIndex(
        (t) => t.id === action.triggerId,
      );

      if (triggerIndex >= 0) {
        const [trigger] = next.pendingTriggers.splice(triggerIndex, 1);
        next.logs.push(`[TRIGGER] 해결: ${trigger.label}`);
        next.resolvingTriggerIds.push(trigger.id);
      } else {
        next.logs.push(`[RULE] TRIGGER_NOT_FOUND: ${action.triggerId}`);
      }
      break;
    }

    case "CHOOSE_TRIGGER_ORDER": {
      const ordered = action.orderedTriggerIds
        .map((id) => next.pendingTriggers.find((t) => t.id === id))
        .filter(Boolean);

      if (ordered.length !== action.orderedTriggerIds.length) {
        next.logs.push(`[RULE] INVALID_TRIGGER_ORDER: 일부 트리거를 찾을 수 없습니다.`);
        break;
      }

      next.pendingTriggers = ordered as typeof next.pendingTriggers;
      next.logs.push(`[TRIGGER] ${action.playerId} 트리거 순서 결정`);
      break;
    }

    case "SET_DEFENDER": {
      handleSetDefender(next, action);
      break;
    }

    case "END_BATTLE_DECLARATION_TIMING": {
      if (!next.battle.isActive) {
        next.logs.push(`[RULE] NO_BATTLE: 현재 배틀 중이 아닙니다.`);
        break;
      }

      next.battle.battleEndedByBothPass = true;
      next.logs.push(`[BATTLE] 선언 타이밍 종료`);
      break;
    }

    case "END_BATTLE": {
      handleEndBattle(next);
      break;
    }

    case "CHECK_STATE_BASED_RULES": {
      handleCheckStateBasedRules(next);
      break;
    }

    case "CONCEDE": {
      handleConcede(next, action);
      break;
    }

    default: {
      const neverAction: never = action;
      return neverAction;
    }
  }

  return next;
}

export const gameReducer = reduceGameState;

// --------------------------------------------------
// Optional convenience helpers for UI/tests
// --------------------------------------------------

export function isGameEnded(state: GameState): boolean {
  return state.winner !== null;
}

export function isStartupFinished(state: GameState): boolean {
  return state.startup.startupFinished;
}

export function isWaitingForDefenderSelection(state: GameState): boolean {
  return (
    state.battle.isActive &&
    !!state.battle.attackerCardId &&
    state.battle.defenderCardId === undefined
  );
}

export function getCurrentPriorityPlayer(state: GameState): PlayerID {
  return state.turn.priorityPlayer;
}

export function forceClearBattle(state: GameState): GameState {
  const next = cloneState(state);
  clearBattleState(next);
  return next;
}