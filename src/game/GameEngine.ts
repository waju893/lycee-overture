import type { GameAction } from './GameActions';
import {
  type CardRef,
  type CauseDescriptor,
  type Declaration,
  type DeclareActionInput,
  type DeclarationStackArray,
  type EngineEvent,
  type FieldSlot,
  type GameState,
  type PlayerID,
  type PlayerId,
  getOpponentPlayerId,
} from './GameTypes';
import {
  canPlayerRespondToTopDeclaration,
  createInitialGameState as createInitialGameStateFromRules,
  findCardInField,
  getAttackColumnFromSlot,
  getMatchingDefenderSlotForColumn,
  getOpponent,
  placeCharacterOnField,
  removeCardFromAllZones,
  validateDeclarationStackLimit,
  validatePassResponse,
  validateResponseDeclarationOpportunity,
} from './GameRules';
import { enqueueTriggerCandidates } from './triggers/TriggerQueue';
import { BATTLE_FORBIDDEN_KEYEFFECTS } from './BattleRestrictions';
import { CARD_META_BY_CODE } from '../lib/cards';

function syncDeclarationStack(stack: DeclarationStackArray): DeclarationStackArray {
  Object.defineProperty(stack, 'items', {
    value: stack,
    writable: true,
    configurable: true,
    enumerable: false,
  });
  return stack;
}

function appendLog(state: GameState, message: string): GameState {
  state.logs.push(message);
  state.log = state.logs;
  return state;
}

function recordReplay(state: GameState, action: unknown): void {
  state.replayEvents.push({
    type: 'ACTION_RECORDED',
    payload: JSON.parse(JSON.stringify(action)),
  });
}

function pushEngineEvent(state: GameState, event: EngineEvent): void {
  state.events.push(event);
  enqueueTriggerCandidates(state, event);
}

function nextLegacyDeclarationId(state: GameState): string {
  return `D-${state.declarationStack.length + 1}-${state.replayEvents.length + 1}`;
}

function nextDeclarationId(state: GameState): string {
  return `DECL-${state.declarationStack.length + 1}-${state.replayEvents.length + 1}`;
}

function makeRuleCause(playerId?: PlayerID, detail?: string): CauseDescriptor {
  return {
    controller: playerId,
    relationToAffectedPlayer: 'any',
    causeKind: 'rule',
    sourceOwnerKind: 'rule',
    isEffect: false,
    isAbility: false,
    detail,
  };
}

function makeCharacterAbilityCause(playerId: PlayerID, sourceCardId?: string, sourceEffectId?: string): CauseDescriptor {
  return {
    controller: playerId,
    relationToAffectedPlayer: 'self',
    causeKind: 'ability',
    sourceOwnerKind: 'character',
    isEffect: true,
    isAbility: true,
    sourceCardId,
    sourceEffectId,
  };
}

function makeBattleCause(playerId: PlayerID, sourceCardId?: string): CauseDescriptor {
  return {
    controller: playerId,
    relationToAffectedPlayer: 'self',
    causeKind: 'battle',
    sourceOwnerKind: 'battle',
    isEffect: false,
    isAbility: false,
    sourceCardId,
  };
}

function drawTopCards(state: GameState, playerId: PlayerID, count: number): void {
  for (let i = 0; i < count; i += 1) {
    const card = state.players[playerId].deck.shift();
    if (!card) break;
    card.location = 'hand';
    state.players[playerId].hand.push(card);
    pushEngineEvent(state, {
      type: 'CARD_DRAWN',
      playerId,
      cardId: card.instanceId,
      cause: makeRuleCause(playerId, 'drawTopCards'),
      operation: { kind: 'draw', cardId: card.instanceId, playerId, fromZone: 'deck', toZone: 'hand', amount: 1 },
    });
  }
}

function untapField(state: GameState, playerId: PlayerID): void {
  const slots = Object.keys(state.players[playerId].field) as FieldSlot[];
  for (const slot of slots) {
    const card = state.players[playerId].field[slot].card;
    if (card && card.isTapped) {
      card.isTapped = false;
      pushEngineEvent(state, {
        type: 'CARD_UNTAPPED',
        playerId,
        cardId: card.instanceId,
        cause: makeRuleCause(playerId, 'turnStartUntap'),
        operation: { kind: 'untap', cardId: card.instanceId, playerId },
      });
    }
  }
}

function startTurn(state: GameState, playerId: PlayerID): void {
  state.turn.activePlayer = playerId;
  state.turn.priorityPlayer = playerId;
  state.turn.phase = 'wakeup';
  state.turn.turnNumber += 1;
  untapField(state, playerId);
  const drawCount = state.turn.turnNumber <= 1 && state.turn.firstPlayer === playerId ? 1 : 2;
  drawTopCards(state, playerId, drawCount);
}

function millFromDeckToDiscard(state: GameState, playerId: PlayerID, count: number, cause?: CauseDescriptor): void {
  for (let i = 0; i < count; i += 1) {
    const card = state.players[playerId].deck.shift();
    if (!card) break;
    card.location = 'discard';
    state.players[playerId].discard.push(card);
    pushEngineEvent(state, {
      type: 'CARD_MOVED_TO_DISCARD',
      playerId,
      cardId: card.instanceId,
      cause,
      operation: {
        kind: 'mill',
        cardId: card.instanceId,
        playerId,
        fromZone: 'deck',
        toZone: 'discard',
        amount: 1,
      },
    });
  }
}

function findCardInHand(state: GameState, playerId: PlayerID, cardId: string): CardRef | undefined {
  return state.players[playerId].hand.find((card) => card.instanceId === cardId);
}

function removeCardFromHand(state: GameState, playerId: PlayerID, cardId: string): CardRef | undefined {
  const idx = state.players[playerId].hand.findIndex((card) => card.instanceId === cardId);
  if (idx < 0) return undefined;
  const [card] = state.players[playerId].hand.splice(idx, 1);
  return card;
}

function findCardOwnerOnField(state: GameState, cardId: string): { playerId: PlayerID; slot: FieldSlot; card: CardRef } | null {
  for (const playerId of ['P1', 'P2'] as PlayerID[]) {
    const found = findCardInField(state, playerId, cardId);
    if (found) {
      return { playerId, slot: found.slot, card: found.card };
    }
  }
  return null;
}

function clearBattleState(state: GameState): void {
  state.battle = { isActive: false, phase: 'none', awaitingDefenderSelection: false, passedPlayers: [] };
}

function cardHasForbiddenBattleKeyeffect(cardNo?: string): boolean {
  if (!cardNo) return false;
  const meta = CARD_META_BY_CODE[cardNo.trim().toUpperCase()];
  if (!meta) return false;
  const keyeffects = meta.keyEffects ?? meta.keyeffects ?? [];
  return keyeffects.some((id: number) => BATTLE_FORBIDDEN_KEYEFFECTS.has(id));
}

function isDuringBattlePriorityWindow(state: GameState): boolean {
  return state.battle.isActive && state.battle.phase === 'duringBattle';
}

function resetBattlePassedPlayers(state: GameState): void {
  if (!state.battle.isActive) return;
  state.battle.passedPlayers = [];
}

function resolveCurrentBattle(state: GameState): void {
  if (!state.battle.isActive || !state.battle.attackerCardId || !state.battle.attackerPlayerId) {
    clearBattleState(state);
    return;
  }

  const attackerInfo = findCardOwnerOnField(state, state.battle.attackerCardId);
  if (!attackerInfo) {
    clearBattleState(state);
    return;
  }

  const attackerPlayerId = attackerInfo.playerId;
  const defenderPlayerId = state.battle.defenderPlayerId ?? getOpponentPlayerId(attackerPlayerId);
  const defenderCardId = state.battle.defenderCardId;

  attackerInfo.card.isTapped = true;
  pushEngineEvent(state, {
    type: 'CARD_TAPPED',
    playerId: attackerPlayerId,
    cardId: attackerInfo.card.instanceId,
    cause: makeBattleCause(attackerPlayerId, attackerInfo.card.instanceId),
    operation: { kind: 'tap', cardId: attackerInfo.card.instanceId, playerId: attackerPlayerId },
  });

  if (defenderCardId) {
    const found = findCardOwnerOnField(state, defenderCardId);
    if (found && found.playerId === defenderPlayerId) {
      if ((attackerInfo.card.ap ?? attackerInfo.card.power ?? 0) > (found.card.dp ?? found.card.hp ?? 0)) {
        removeCardFromAllZones(state.players[defenderPlayerId], found.card.instanceId);
        pushEngineEvent(state, {
          type: 'CARD_LEFT_FIELD',
          playerId: defenderPlayerId,
          cardId: found.card.instanceId,
          cause: makeBattleCause(attackerPlayerId, attackerInfo.card.instanceId),
          operation: { kind: 'leaveField', cardId: found.card.instanceId, playerId: defenderPlayerId, fromZone: 'field', toZone: 'discard' },
        });
      }
      if ((found.card.ap ?? found.card.power ?? 0) > (attackerInfo.card.dp ?? attackerInfo.card.hp ?? 0)) {
        removeCardFromAllZones(state.players[attackerPlayerId], attackerInfo.card.instanceId);
        pushEngineEvent(state, {
          type: 'CARD_LEFT_FIELD',
          playerId: attackerPlayerId,
          cardId: attackerInfo.card.instanceId,
          cause: makeBattleCause(defenderPlayerId, found.card.instanceId),
          operation: { kind: 'leaveField', cardId: attackerInfo.card.instanceId, playerId: attackerPlayerId, fromZone: 'field', toZone: 'discard' },
        });
      }
      appendLog(state, '배틀 종료');
      clearBattleState(state);
      return;
    }
  }

  const dmg = attackerInfo.card.dmg ?? attackerInfo.card.damage ?? 1;
  millFromDeckToDiscard(state, defenderPlayerId, dmg, makeBattleCause(attackerPlayerId, attackerInfo.card.instanceId));
  appendLog(state, `직접 공격 처리 (${dmg})`);
  clearBattleState(state);
}

function fieldHasSameName(state: GameState, playerId: PlayerID, sameNameKey?: string): boolean {
  if (!sameNameKey) return false;
  const slots = Object.keys(state.players[playerId].field) as FieldSlot[];
  return slots.some((slot) => state.players[playerId].field[slot].card?.sameNameKey === sameNameKey);
}

function resolveUseCharacter(state: GameState, declaration: any): void {
  const slot = declaration.targetSlots?.[0] as FieldSlot | undefined;
  const playerId = declaration.playerId as PlayerID;
  const card = removeCardFromHand(state, playerId, declaration.sourceCardId);
  if (!card || !slot) return;
  placeCharacterOnField(state, playerId, slot, { ...card, location: 'field', isTapped: false });
  pushEngineEvent(state, {
    type: 'CARD_ENTERED_FIELD',
    playerId,
    cardId: card.instanceId,
    cause: makeRuleCause(playerId, 'characterDeclarationResolved'),
    operation: { kind: 'enterField', cardId: card.instanceId, playerId, fromZone: 'hand', toZone: 'field' },
  });
  appendLog(state, '등장 선언 해결');
}

function resolveUseAbility(state: GameState, declaration: any): void {
  pushEngineEvent(state, {
    type: 'ABILITY_USED',
    playerId: declaration.playerId,
    cardId: declaration.sourceCardId,
    cause: makeCharacterAbilityCause(declaration.playerId, declaration.sourceCardId, declaration.sourceEffectId),
  });
  appendLog(state, '능력 사용 해결');
}

function resolveChargeCharacter(state: GameState, declaration: any): void {
  const owner = declaration.playerId as PlayerID;
  const found = findCardOwnerOnField(state, declaration.sourceCardId);
  if (!found || found.playerId !== owner) return;
  const payload = declaration.payload ?? {};
  const deckCount = Number(payload.deckCount ?? 0);
  const discardCardIds = Array.isArray(payload.discardCardIds) ? (payload.discardCardIds as string[]) : [];
  const charged: CardRef[] = [];
  for (let i = 0; i < deckCount; i += 1) {
    const card = state.players[owner].deck.shift();
    if (!card) break;
    charged.push({ ...card, location: 'charge' });
    pushEngineEvent(state, {
      type: 'CARD_MOVED_TO_CHARGE',
      playerId: owner,
      cardId: card.instanceId,
      cause: makeCharacterAbilityCause(owner, declaration.sourceCardId, declaration.sourceEffectId),
      operation: { kind: 'charge', cardId: card.instanceId, playerId: owner, fromZone: 'deck', toZone: 'charge', amount: 1 },
    });
  }
  for (const chargeId of discardCardIds) {
    const idx = state.players[owner].discard.findIndex((card) => card.instanceId === chargeId);
    if (idx >= 0) {
      const [card] = state.players[owner].discard.splice(idx, 1);
      charged.push({ ...card, location: 'charge' });
      pushEngineEvent(state, {
        type: 'CARD_MOVED_TO_CHARGE',
        playerId: owner,
        cardId: card.instanceId,
        cause: makeCharacterAbilityCause(owner, declaration.sourceCardId, declaration.sourceEffectId),
        operation: { kind: 'charge', cardId: card.instanceId, playerId: owner, fromZone: 'discard', toZone: 'charge', amount: 1 },
      });
    }
  }
  found.card.chargeCards = [...(found.card.chargeCards ?? []), ...charged];
  appendLog(state, '차지 해결');
}

function resolveAttack(state: GameState, declaration: any): void {
  const attackerInfo = findCardOwnerOnField(state, declaration.sourceCardId);
  if (!attackerInfo) return;
  const attacker = attackerInfo.card;
  const defenderPlayerId = getOpponent(attackerInfo.playerId);
  const column = getAttackColumnFromSlot(attackerInfo.slot);

  state.battle = {
    isActive: true,
    phase: 'duringBattle',
    attackerCardId: attacker.instanceId,
    attackerPlayerId: attackerInfo.playerId,
    defenderPlayerId,
    defenderCardId: undefined,
    attackColumn: column,
    awaitingDefenderSelection: false,
    priorityPlayer: attackerInfo.playerId,
    passedPlayers: [],
  };

  appendLog(state, '배틀 중 상태 진입 (방어자 미지정)');
}

function resolveLatestLegacyDeclaration(state: GameState): void {
  const declaration = state.declarationStack.pop();
  syncDeclarationStack(state.declarationStack);
  if (!declaration) return;
  switch (declaration.kind) {
    case 'useCharacter':
      resolveUseCharacter(state, declaration);
      break;
    case 'useAbility':
      resolveUseAbility(state, declaration);
      break;
    case 'attack':
      resolveAttack(state, declaration);
      break;
    case 'chargeCharacter':
      resolveChargeCharacter(state, declaration);
      break;
    default:
      break;
  }
  if (isDuringBattlePriorityWindow(state)) {
    state.battle.priorityPlayer = declaration.playerId;
    resetBattlePassedPlayers(state);
  } else {
    state.turn.priorityPlayer = state.turn.activePlayer;
  }
}

function validateDeclareAction(state: GameState, action: Extract<GameAction, { type: 'DECLARE_ACTION' }>): string | null {
  if (isDuringBattlePriorityWindow(state)) {
    if (state.battle.priorityPlayer !== action.playerId) {
      return 'BATTLE_PRIORITY_MISMATCH';
    }
    if (action.kind === 'useCharacter') {
      return 'BATTLE_CHARACTER_DECLARATION_FORBIDDEN';
    }
  } else if (state.turn.phase !== 'main') {
    return 'TIMING_INVALID';
  }

  if (state.battle.isActive && action.sourceCardId) {
    const fieldFound = findCardOwnerOnField(state, action.sourceCardId);
    const handFound = findCardInHand(state, action.playerId, action.sourceCardId);
    const card = fieldFound?.card ?? handFound;
    if (card && cardHasForbiddenBattleKeyeffect(card.cardNo)) {
      return 'BATTLE_KEYEFFECT_FORBIDDEN';
    }
  }

  if (action.kind === 'useCharacter') {
    const card = findCardInHand(state, action.playerId, action.sourceCardId ?? '');
    if (!card) return 'CARD_NOT_FOUND';
    const slot = action.targetSlots?.[0];
    if (!slot) return 'TARGET_SLOT_MISSING';
    if (state.players[action.playerId].field[slot].card) return 'FIELD_OCCUPIED';
    if (fieldHasSameName(state, action.playerId, card.sameNameKey)) return 'SAME_NAME_ON_FIELD';
    return null;
  }

  if (action.kind === 'useAbility') {
    const found = findCardOwnerOnField(state, action.sourceCardId ?? '');
    if (!found || found.playerId !== action.playerId) return 'CARD_NOT_FOUND';
    return null;
  }

  if (action.kind === 'attack') {
    const found = findCardOwnerOnField(state, action.sourceCardId ?? '');
    if (!found || found.playerId !== action.playerId) return 'CARD_NOT_FOUND';
    if (!found.slot.startsWith('AF')) return 'ATTACKER_NOT_AF';
    if (found.card.isTapped) return 'ATTACKER_TAPPED';
    return null;
  }

  if (action.kind === 'chargeCharacter') {
    const found = findCardOwnerOnField(state, action.sourceCardId ?? '');
    if (!found || found.playerId !== action.playerId) return 'CARD_NOT_FOUND';
    return null;
  }

  return null;
}

function handleStartGame(state: GameState, action: Extract<GameAction, { type: 'START_GAME' }>): GameState {
  const next = createInitialGameStateFromRules({
    p1Deck: state.players.P1.deck,
    p2Deck: state.players.P2.deck,
    leaderEnabled: action.leaderEnabled ?? false,
  });

  next.replayEvents = [...state.replayEvents];
  next.logs = [...state.logs];
  next.log = next.logs;
  next.events = [...state.events];

  next.startup.active = true;
  next.startup.leaderEnabled = action.leaderEnabled ?? false;
  next.startup.firstPlayer = action.firstPlayer ?? 'P1';
  next.turn.firstPlayer = action.firstPlayer ?? 'P1';
  next.turn.activePlayer = action.firstPlayer ?? 'P1';
  next.turn.priorityPlayer = action.firstPlayer ?? 'P1';
  if (action.leaderEnabled) {
    for (const playerId of ['P1', 'P2'] as PlayerID[]) {
      const leaderIndex = next.players[playerId].deck.findIndex((card) => card.isLeader);
      if (leaderIndex >= 0) {
        const [leader] = next.players[playerId].deck.splice(leaderIndex, 1);
        leader.location = 'hand';
        leader.revealed = true;
        next.players[playerId].hand.push(leader);
        drawTopCards(next, playerId, 6);
      } else {
        drawTopCards(next, playerId, 7);
      }
    }
  } else {
    drawTopCards(next, 'P1', 7);
    drawTopCards(next, 'P2', 7);
  }
  appendLog(next, 'START_GAME');
  return next;
}

function handlePassPriority(state: GameState, action: Extract<GameAction, { type: 'PASS_PRIORITY' }>): GameState {
  if (state.declarationStack.length > 0) {
    resolveLatestLegacyDeclaration(state);
    return state;
  }

  if (isDuringBattlePriorityWindow(state)) {
    if (state.battle.priorityPlayer !== action.playerId) {
      appendLog(state, 'BATTLE_PRIORITY_MISMATCH');
      return state;
    }
    const current = action.playerId;
    const other = getOpponentPlayerId(current);
    const passedPlayers = new Set(state.battle.passedPlayers ?? []);
    passedPlayers.add(current);
    state.battle.passedPlayers = Array.from(passedPlayers);

    if (passedPlayers.has('P1') && passedPlayers.has('P2')) {
      resolveCurrentBattle(state);
      return state;
    }

    state.battle.priorityPlayer = other;
    appendLog(state, `[BATTLE PRIORITY] ${current} pass -> ${other}`);
    return state;
  }

  if (state.turn.priorityPlayer === action.playerId) {
    state.turn.priorityPlayer = getOpponentPlayerId(action.playerId);
  }
  return state;
}

export function reduceGameState(state: GameState, action: GameAction): GameState {
  const next: GameState = {
    ...state,
    players: {
      P1: {
        ...state.players.P1,
        deck: [...state.players.P1.deck],
        hand: [...state.players.P1.hand],
        discard: [...state.players.P1.discard],
        field: {
          AF_LEFT: { card: state.players.P1.field.AF_LEFT.card ? { ...state.players.P1.field.AF_LEFT.card } : null },
          AF_CENTER: { card: state.players.P1.field.AF_CENTER.card ? { ...state.players.P1.field.AF_CENTER.card } : null },
          AF_RIGHT: { card: state.players.P1.field.AF_RIGHT.card ? { ...state.players.P1.field.AF_RIGHT.card } : null },
          DF_LEFT: { card: state.players.P1.field.DF_LEFT.card ? { ...state.players.P1.field.DF_LEFT.card } : null },
          DF_CENTER: { card: state.players.P1.field.DF_CENTER.card ? { ...state.players.P1.field.DF_CENTER.card } : null },
          DF_RIGHT: { card: state.players.P1.field.DF_RIGHT.card ? { ...state.players.P1.field.DF_RIGHT.card } : null },
        },
      },
      P2: {
        ...state.players.P2,
        deck: [...state.players.P2.deck],
        hand: [...state.players.P2.hand],
        discard: [...state.players.P2.discard],
        field: {
          AF_LEFT: { card: state.players.P2.field.AF_LEFT.card ? { ...state.players.P2.field.AF_LEFT.card } : null },
          AF_CENTER: { card: state.players.P2.field.AF_CENTER.card ? { ...state.players.P2.field.AF_CENTER.card } : null },
          AF_RIGHT: { card: state.players.P2.field.AF_RIGHT.card ? { ...state.players.P2.field.AF_RIGHT.card } : null },
          DF_LEFT: { card: state.players.P2.field.DF_LEFT.card ? { ...state.players.P2.field.DF_LEFT.card } : null },
          DF_CENTER: { card: state.players.P2.field.DF_CENTER.card ? { ...state.players.P2.field.DF_CENTER.card } : null },
          DF_RIGHT: { card: state.players.P2.field.DF_RIGHT.card ? { ...state.players.P2.field.DF_RIGHT.card } : null },
        },
      },
    },
    startup: {
      ...state.startup,
      decisions: { ...state.startup.decisions },
    },
    turn: { ...state.turn },
    battle: { ...state.battle, passedPlayers: [...(state.battle.passedPlayers ?? [])] },
    declarationStack: syncDeclarationStack([...state.declarationStack] as unknown as DeclarationStackArray),
    triggerQueue: { pendingGroups: state.triggerQueue.pendingGroups.map((group) => [...group]) },
    logs: [...state.logs],
    log: [...state.logs],
    events: [...state.events],
    replayEvents: [...state.replayEvents],
  };
  recordReplay(next, action);

  switch (action.type) {
    case 'START_GAME':
      return handleStartGame(next, action);
    case 'KEEP_STARTING_HAND':
      if (next.startup.decisions[action.playerId]) {
        appendLog(next, 'ALREADY_DECIDED');
      } else {
        next.startup.decisions[action.playerId] = 'KEEP';
      }
      return next;
    case 'MULLIGAN':
      if (next.startup.decisions[action.playerId]) {
        appendLog(next, 'ALREADY_DECIDED');
      } else {
        next.startup.decisions[action.playerId] = 'MULLIGAN';
      }
      return next;
    case 'FINALIZE_STARTUP':
      next.startup.active = false;
      next.startup.startupFinished = true;
      next.turn.firstPlayer = next.startup.firstPlayer ?? next.turn.firstPlayer ?? 'P1';
      next.turn.activePlayer = next.turn.firstPlayer;
      next.turn.priorityPlayer = next.turn.firstPlayer;
      next.turn.phase = 'wakeup';
      return next;
    case 'START_TURN':
      startTurn(next, next.turn.activePlayer);
      return next;
    case 'ADVANCE_PHASE':
      if (next.turn.phase === 'wakeup') {
        next.turn.phase = 'main';
      } else if (next.turn.phase === 'main') {
        next.turn.phase = 'battle';
      } else if (next.turn.phase === 'battle') {
        next.turn.phase = 'end';
      } else if (next.turn.phase === 'end') {
        const nextPlayer = getOpponentPlayerId(next.turn.activePlayer);
        next.turn.activePlayer = nextPlayer;
        next.turn.priorityPlayer = nextPlayer;
        next.turn.phase = 'main';
        next.turn.turnNumber += 1;
        untapField(next, nextPlayer);
        const drawCount = next.turn.turnNumber <= 1 && next.turn.firstPlayer === nextPlayer ? 1 : 2;
        drawTopCards(next, nextPlayer, drawCount);
      }
      return next;
    case 'DECLARE_ACTION': {
      const violation = validateDeclareAction(next, action);
      if (violation) {
        appendLog(next, violation);
        return next;
      }
      const declaration: any = {
        id: nextLegacyDeclarationId(next),
        playerId: action.playerId,
        kind: action.kind,
        sourceCardId: action.sourceCardId,
        sourceEffectId: action.sourceEffectId,
        targetSlots: action.targetSlots,
        targetCardIds: action.targetCardIds,
        targetingMode: action.targetingMode,
        payload: action.payload,
      };
      next.declarationStack.push(declaration);
      syncDeclarationStack(next.declarationStack);
      if (isDuringBattlePriorityWindow(next)) {
        next.battle.priorityPlayer = getOpponentPlayerId(action.playerId);
        resetBattlePassedPlayers(next);
      } else {
        next.turn.priorityPlayer = getOpponentPlayerId(action.playerId);
      }
      if (action.kind === 'useCharacter') appendLog(next, '등장 선언');
      if (action.kind === 'useAbility') appendLog(next, '능력 사용 선언');
      if (action.kind === 'attack') appendLog(next, '공격 선언');
      if (action.kind === 'chargeCharacter') appendLog(next, '차지 선언');
      return next;
    }
    case 'PASS_PRIORITY':
      return handlePassPriority(next, action);
    case 'SET_DEFENDER': {
      if (!next.battle.isActive) return next;
      if (!next.battle.attackerCardId || !next.battle.attackerPlayerId) return next;

      const attackerInfo = findCardOwnerOnField(next, next.battle.attackerCardId);
      if (!attackerInfo) {
        clearBattleState(next);
        return next;
      }

      const defenderPlayerId = next.battle.defenderPlayerId ?? getOpponentPlayerId(attackerInfo.playerId);
      let selectedDefenderId: string | undefined = undefined;

      if (action.playerId === attackerInfo.playerId) {
        appendLog(next, 'ATTACKER_CANNOT_SET_DEFENDER');
        return next;
      }

      if (action.defenderCardId) {
        const expectedSlot = getMatchingDefenderSlotForColumn(next.battle.attackColumn ?? getAttackColumnFromSlot(attackerInfo.slot));
        const found = findCardOwnerOnField(next, action.defenderCardId);
        if (
          found &&
          found.playerId === defenderPlayerId &&
          found.slot === expectedSlot &&
          !found.card.isTapped
        ) {
          selectedDefenderId = found.card.instanceId;
        } else {
          appendLog(next, 'INVALID_DEFENDER_SELECTION');
          return next;
        }
      }

      next.battle = {
        ...next.battle,
        isActive: true,
        phase: 'duringBattle',
        awaitingDefenderSelection: false,
        attackerCardId: attackerInfo.card.instanceId,
        attackerPlayerId: attackerInfo.playerId,
        defenderPlayerId,
        defenderCardId: selectedDefenderId,
        priorityPlayer: attackerInfo.playerId,
        passedPlayers: [],
      };
      appendLog(next, selectedDefenderId ? '배틀 중 상태 진입 (방어자 지정)' : '배틀 중 상태 유지 (방어 안 함)');
      return next;
    }
    default:
      return next;
  }
}

function makeDeclarationState(): GameState {
  const base = createInitialGameStateFromRules({
    p1Deck: [],
    p2Deck: [],
    leaderEnabled: false,
  });
  base.logs = [];
  base.log = base.logs;
  return base;
}

export function createEmptyGameState(): GameState {
  return makeDeclarationState();
}

function buildDeclaration(state: GameState, input: DeclareActionInput): Declaration {
  const isResponse = state.declarationStack.length > 0;
  const top = state.declarationStack[state.declarationStack.length - 1] as any;
  return {
    id: nextDeclarationId(state),
    type: input.type,
    declaredBy: input.declaredBy,
    status: 'awaitingResponse',
    isResponse,
    respondedToDeclarationId: top?.id,
    responseWindowOpen: true,
    canBeRespondedTo: true,
    createdAt: Date.now(),
    ...(input as any),
  };
}

export function declare(state: GameState, input: DeclareActionInput): GameState {
  const stack = syncDeclarationStack([...state.declarationStack] as unknown as DeclarationStackArray);
  stack.activeResponseWindow = state.declarationStack.activeResponseWindow;
  stack.limit = state.declarationStack.limit;

  const next = {
    ...state,
    declarationStack: stack,
    logs: [...state.logs],
    log: [...state.logs],
  };

  const hasOpenResponseWindow = Boolean(next.declarationStack.activeResponseWindow);
  const violations = hasOpenResponseWindow
    ? validateResponseDeclarationOpportunity(next, input.declaredBy)
    : validateDeclarationStackLimit(next);

  if (violations.length > 0) {
    appendLog(next, `[declare blocked] ${violations.map((v) => v.message).join(' | ')}`);
    return next;
  }

  const declaration = buildDeclaration(next, input) as any;
  next.declarationStack.push({
    id: declaration.id,
    playerId: declaration.declaredBy,
    kind: 'useAbility',
    sourceCardId: declaration.cardId,
  } as any);
  (next.declarationStack[next.declarationStack.length - 1] as any).__raw = declaration;
  syncDeclarationStack(next.declarationStack);

  const previousEntry = next.declarationStack[next.declarationStack.length - 2] as any | undefined;
  const responderPlayerId = declaration.isResponse
    ? previousEntry?.playerId ?? getOpponentPlayerId(declaration.declaredBy)
    : getOpponentPlayerId(declaration.declaredBy);

  next.declarationStack.activeResponseWindow = {
    topDeclarationId: declaration.id,
    responderPlayerId,
  };

  appendLog(
    next,
    declaration.isResponse
      ? `[declare] ${declaration.declaredBy} responded with ${declaration.type} (${declaration.id})`
      : `[declare] ${declaration.declaredBy} declared ${declaration.type} (${declaration.id})`,
  );
  return next;
}

export function passResponse(state: GameState, playerId: PlayerId): GameState {
  const stack = syncDeclarationStack([...state.declarationStack] as unknown as DeclarationStackArray);
  stack.activeResponseWindow = state.declarationStack.activeResponseWindow;
  stack.limit = state.declarationStack.limit;

  const next = {
    ...state,
    declarationStack: stack,
    logs: [...state.logs],
    log: [...state.logs],
  };
  const violations = validatePassResponse(next, playerId);
  if (violations.length > 0) {
    appendLog(next, `[pass blocked] ${violations.map((v) => v.message).join(' | ')}`);
    return next;
  }
  appendLog(next, `[pass] ${playerId} passed response`);
  while (next.declarationStack.length > 0) {
    const top = next.declarationStack.pop();
    appendLog(next, `[resolve start] ${(top as any)?.id ?? 'unknown'}`);
  }
  syncDeclarationStack(next.declarationStack);
  next.declarationStack.activeResponseWindow = undefined;
  return next;
}

export function canCurrentPlayerRespond(state: GameState, playerId: PlayerId): boolean {
  return canPlayerRespondToTopDeclaration(state, playerId);
}

export { createInitialGameStateFromRules as createInitialGameState };
