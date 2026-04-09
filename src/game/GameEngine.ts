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
import {
  createBattleCause,
  createEffectCause,
  createRuleCause,
} from './effects/Cause';

function syncDeclarationStack(stack: DeclarationStackArray): DeclarationStackArray {
  stack.items = stack;
  return stack;
}

function appendLog(state: GameState, message: string): GameState {
  state.logs.push(message);
  state.log = state.logs;
  return state;
}

function pushEvent(state: GameState, event: EngineEvent): void {
  state.events.push(event);
}

function recordReplay(state: GameState, action: unknown): void {
  state.replayEvents.push({
    type: 'ACTION_RECORDED',
    payload: JSON.parse(JSON.stringify(action)),
  });
}

function nextLegacyDeclarationId(state: GameState): string {
  return `D-${state.declarationStack.length + 1}-${state.replayEvents.length + 1}`;
}

function nextDeclarationId(state: GameState): string {
  return `DECL-${state.declarationStack.length + 1}-${state.replayEvents.length + 1}`;
}

function moveDeckTopToHand(state: GameState, playerId: PlayerID, count: number, cause?: CauseDescriptor): void {
  const drawnIds: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const card = state.players[playerId].deck.shift();
    if (!card) break;
    card.location = 'hand';
    state.players[playerId].hand.push(card);
    drawnIds.push(card.instanceId);
    pushEvent(state, {
      type: 'CARD_MOVED',
      playerId,
      cardId: card.instanceId,
      affectedPlayerId: playerId,
      cause,
      operation: {
        kind: 'moveToHand',
        fromZone: 'deck',
        toZone: 'hand',
      },
    });
  }
  if (drawnIds.length > 0) {
    pushEvent(state, {
      type: 'CARD_DRAWN',
      playerId,
      affectedPlayerId: playerId,
      affectedCardIds: drawnIds,
      cause,
      operation: {
        kind: 'draw',
        fromZone: 'deck',
        toZone: 'hand',
        relatedCardIds: drawnIds,
      },
    });
  }
}

function untapField(state: GameState, playerId: PlayerID): void {
  const slots = Object.keys(state.players[playerId].field) as FieldSlot[];
  for (const slot of slots) {
    const card = state.players[playerId].field[slot].card;
    if (!card) continue;
    if (card.isTapped) {
      card.isTapped = false;
      pushEvent(state, {
        type: 'CARD_UNTAPPED',
        playerId,
        cardId: card.instanceId,
        affectedPlayerId: playerId,
        cause: createRuleCause({
          controllerPlayerId: playerId,
          affectedPlayerId: playerId,
          declarationKind: 'startTurn',
        }),
        operation: {
          kind: 'untap',
          fromZone: 'field',
          toZone: 'field',
        },
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
  moveDeckTopToHand(
    state,
    playerId,
    drawCount,
    createRuleCause({
      controllerPlayerId: playerId,
      affectedPlayerId: playerId,
      declarationKind: 'warmupDraw',
    }),
  );
}

function millFromDeckToDiscard(
  state: GameState,
  playerId: PlayerID,
  count: number,
  cause?: CauseDescriptor,
): void {
  const milledIds: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const card = state.players[playerId].deck.shift();
    if (!card) break;
    card.location = 'discard';
    state.players[playerId].discard.push(card);
    milledIds.push(card.instanceId);
    pushEvent(state, {
      type: 'CARD_MOVED',
      playerId,
      cardId: card.instanceId,
      affectedPlayerId: playerId,
      cause,
      operation: {
        kind: 'moveToDiscard',
        fromZone: 'deck',
        toZone: 'discard',
      },
    });
  }
  if (milledIds.length > 0) {
    pushEvent(state, {
      type: 'CARDS_MILLED',
      playerId,
      affectedPlayerId: playerId,
      affectedCardIds: milledIds,
      cause,
      operation: {
        kind: 'mill',
        fromZone: 'deck',
        toZone: 'discard',
        relatedCardIds: milledIds,
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

function fieldHasSameName(state: GameState, playerId: PlayerID, sameNameKey?: string): boolean {
  if (!sameNameKey) return false;
  const slots = Object.keys(state.players[playerId].field) as FieldSlot[];
  return slots.some((slot) => state.players[playerId].field[slot].card?.sameNameKey === sameNameKey);
}

function removeFieldCardAndRecord(
  state: GameState,
  owner: PlayerID,
  cardId: string,
  cause: CauseDescriptor,
): void {
  const removed = removeCardFromAllZones(state.players[owner], cardId);
  if (!removed) return;
  pushEvent(state, {
    type: 'CARD_DESTROYED',
    playerId: cause.controllerPlayerId,
    cardId: removed.instanceId,
    affectedPlayerId: owner,
    cause,
    operation: {
      kind: 'destroy',
      fromZone: 'field',
    },
  });
  pushEvent(state, {
    type: 'CARD_LEFT_FIELD',
    playerId: cause.controllerPlayerId,
    cardId: removed.instanceId,
    affectedPlayerId: owner,
    cause,
    operation: {
      kind: 'leaveField',
      fromZone: 'field',
    },
  });
}

function resolveUseCharacter(state: GameState, declaration: any): void {
  const slot = declaration.targetSlots?.[0] as FieldSlot | undefined;
  const playerId = declaration.playerId as PlayerID;
  const card = removeCardFromHand(state, playerId, declaration.sourceCardId);
  if (!card || !slot) return;
  placeCharacterOnField(state, playerId, slot, { ...card, location: 'field', isTapped: false });
  pushEvent(state, {
    type: 'CARD_ENTERED_FIELD',
    playerId,
    cardId: card.instanceId,
    affectedPlayerId: playerId,
    cause: createRuleCause({
      controllerPlayerId: playerId,
      affectedPlayerId: playerId,
      declarationKind: 'useCharacter',
    }),
    operation: {
      kind: 'enterFieldByRule',
      fromZone: 'hand',
      toZone: 'field',
    },
    metadata: {
      slot,
    },
  });
  appendLog(state, '등장 선언 해결');
}

function resolveUseAbility(state: GameState, declaration: any): void {
  const playerId = declaration.playerId as PlayerID;
  pushEvent(state, {
    type: 'ABILITY_USED',
    playerId,
    cardId: declaration.sourceCardId,
    affectedPlayerId: playerId,
    cause: createEffectCause({
      controllerPlayerId: playerId,
      affectedPlayerId: playerId,
      sourceKind: 'character',
      sourceCardId: declaration.sourceCardId,
      sourceEffectId: declaration.sourceEffectId,
      declarationKind: 'useAbility',
    }),
    operation: {
      kind: 'abilityUse',
      fromZone: 'field',
      toZone: 'field',
    },
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
  const cause = createRuleCause({
    controllerPlayerId: owner,
    affectedPlayerId: owner,
    declarationKind: 'chargeCharacter',
  });

  for (let i = 0; i < deckCount; i += 1) {
    const card = state.players[owner].deck.shift();
    if (!card) break;
    const moved = { ...card, location: 'charge' };
    charged.push(moved);
    pushEvent(state, {
      type: 'CARD_MOVED',
      playerId: owner,
      cardId: moved.instanceId,
      affectedPlayerId: owner,
      cause,
      operation: {
        kind: 'moveToCharge',
        fromZone: 'deck',
        toZone: 'charge',
      },
    });
  }
  for (const chargeId of discardCardIds) {
    const idx = state.players[owner].discard.findIndex((card) => card.instanceId === chargeId);
    if (idx >= 0) {
      const [card] = state.players[owner].discard.splice(idx, 1);
      const moved = { ...card, location: 'charge' };
      charged.push(moved);
      pushEvent(state, {
        type: 'CARD_MOVED',
        playerId: owner,
        cardId: moved.instanceId,
        affectedPlayerId: owner,
        cause,
        operation: {
          kind: 'moveToCharge',
          fromZone: 'discard',
          toZone: 'charge',
        },
      });
    }
  }
  found.card.chargeCards = [...(found.card.chargeCards ?? []), ...charged];
  if (charged.length > 0) {
    pushEvent(state, {
      type: 'CARD_CHARGED',
      playerId: owner,
      cardId: found.card.instanceId,
      affectedPlayerId: owner,
      affectedCardIds: charged.map((card) => card.instanceId),
      cause,
      operation: {
        kind: 'charge',
        fromZone: 'deck',
        toZone: 'charge',
        relatedCardIds: charged.map((card) => card.instanceId),
      },
    });
  }
  appendLog(state, '차지 해결');
}

function resolveAttack(state: GameState, declaration: any): void {
  const attackerInfo = findCardOwnerOnField(state, declaration.sourceCardId);
  if (!attackerInfo) return;
  const attacker = attackerInfo.card;
  const defenderPlayerId = getOpponent(attackerInfo.playerId);
  const column = getAttackColumnFromSlot(attackerInfo.slot);
  const defenderSlot = getMatchingDefenderSlotForColumn(column);
  const defender = state.players[defenderPlayerId].field[defenderSlot].card;
  const battleCause = createBattleCause({
    controllerPlayerId: attackerInfo.playerId,
    affectedPlayerId: defenderPlayerId,
    sourceCardId: attacker.instanceId,
    declarationKind: 'attack',
  });

  if (defender && !defender.isTapped) {
    state.battle = {
      isActive: true,
      attackerCardId: attacker.instanceId,
      attackerPlayerId: attackerInfo.playerId,
      defenderPlayerId,
      attackColumn: column,
      awaitingDefenderSelection: true,
    };
    appendLog(state, '방어자 선택 대기');
    pushEvent(state, {
      type: 'BATTLE_DEFENDER_SELECTION_REQUIRED',
      playerId: attackerInfo.playerId,
      cardId: attacker.instanceId,
      affectedPlayerId: defenderPlayerId,
      cause: battleCause,
      metadata: {
        defenderSlot,
      },
    });
    return;
  }

  const dmg = attacker.dmg ?? attacker.damage ?? 1;
  attacker.isTapped = true;
  pushEvent(state, {
    type: 'CARD_TAPPED',
    playerId: attackerInfo.playerId,
    cardId: attacker.instanceId,
    affectedPlayerId: attackerInfo.playerId,
    cause: battleCause,
    operation: {
      kind: 'tap',
      fromZone: 'field',
      toZone: 'field',
    },
  });
  millFromDeckToDiscard(state, defenderPlayerId, dmg, battleCause);
  state.battle = {
    isActive: false,
    awaitingDefenderSelection: false,
  };
  appendLog(state, '직접 공격 처리');
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
  state.turn.priorityPlayer = state.turn.activePlayer;
}

function validateDeclareAction(state: GameState, action: Extract<GameAction, { type: 'DECLARE_ACTION' }>): string | null {
  if (state.turn.phase !== 'main') {
    return 'TIMING_INVALID';
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
        moveDeckTopToHand(
          next,
          playerId,
          6,
          createRuleCause({
            controllerPlayerId: playerId,
            affectedPlayerId: playerId,
            declarationKind: 'startupDraw',
          }),
        );
      } else {
        moveDeckTopToHand(
          next,
          playerId,
          7,
          createRuleCause({
            controllerPlayerId: playerId,
            affectedPlayerId: playerId,
            declarationKind: 'startupDraw',
          }),
        );
      }
    }
  } else {
    moveDeckTopToHand(
      next,
      'P1',
      7,
      createRuleCause({
        controllerPlayerId: 'P1',
        affectedPlayerId: 'P1',
        declarationKind: 'startupDraw',
      }),
    );
    moveDeckTopToHand(
      next,
      'P2',
      7,
      createRuleCause({
        controllerPlayerId: 'P2',
        affectedPlayerId: 'P2',
        declarationKind: 'startupDraw',
      }),
    );
  }
  appendLog(next, 'START_GAME');
  return next;
}

function handlePassPriority(state: GameState, action: Extract<GameAction, { type: 'PASS_PRIORITY' }>): GameState {
  if (state.declarationStack.length > 0) {
    if (state.turn.priorityPlayer === action.playerId) {
      resolveLatestLegacyDeclaration(state);
    }
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
    battle: { ...state.battle },
    declarationStack: syncDeclarationStack([...state.declarationStack] as unknown as DeclarationStackArray),
    triggerQueue: { pendingGroups: [...state.triggerQueue.pendingGroups] },
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
        moveDeckTopToHand(
          next,
          nextPlayer,
          drawCount,
          createRuleCause({
            controllerPlayerId: nextPlayer,
            affectedPlayerId: nextPlayer,
            declarationKind: 'warmupDraw',
          }),
        );
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
      next.turn.priorityPlayer = getOpponentPlayerId(action.playerId);
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
        next.battle = { isActive: false, awaitingDefenderSelection: false };
        return next;
      }
      const defenderPlayerId = next.battle.defenderPlayerId ?? getOpponentPlayerId(attackerInfo.playerId);
      const dmg = attackerInfo.card.dmg ?? attackerInfo.card.damage ?? 1;
      const battleCause = createBattleCause({
        controllerPlayerId: attackerInfo.playerId,
        affectedPlayerId: defenderPlayerId,
        sourceCardId: attackerInfo.card.instanceId,
        declarationKind: 'attack',
      });
      if (action.defenderCardId) {
        const found = findCardOwnerOnField(next, action.defenderCardId);
        if (found && found.playerId === defenderPlayerId) {
          next.battle.defenderCardId = action.defenderCardId;
          attackerInfo.card.isTapped = true;
          pushEvent(next, {
            type: 'CARD_TAPPED',
            playerId: attackerInfo.playerId,
            cardId: attackerInfo.card.instanceId,
            affectedPlayerId: attackerInfo.playerId,
            cause: battleCause,
            operation: {
              kind: 'tap',
              fromZone: 'field',
              toZone: 'field',
            },
          });
          if ((attackerInfo.card.ap ?? attackerInfo.card.power ?? 0) > (found.card.dp ?? found.card.hp ?? 0)) {
            removeFieldCardAndRecord(next, defenderPlayerId, found.card.instanceId, battleCause);
          }
          if ((found.card.ap ?? found.card.power ?? 0) > (attackerInfo.card.dp ?? attackerInfo.card.hp ?? 0)) {
            removeFieldCardAndRecord(next, attackerInfo.playerId, attackerInfo.card.instanceId, battleCause);
          }
          next.battle = { isActive: false, awaitingDefenderSelection: false };
          return next;
        }
      }
      attackerInfo.card.isTapped = true;
      pushEvent(next, {
        type: 'CARD_TAPPED',
        playerId: attackerInfo.playerId,
        cardId: attackerInfo.card.instanceId,
        affectedPlayerId: attackerInfo.playerId,
        cause: battleCause,
        operation: {
          kind: 'tap',
          fromZone: 'field',
          toZone: 'field',
        },
      });
      millFromDeckToDiscard(next, defenderPlayerId, dmg, battleCause);
      next.battle = { isActive: false, awaitingDefenderSelection: false };
      appendLog(next, '직접 공격 처리');
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
    ? (previousEntry?.playerId ?? getOpponentPlayerId(declaration.declaredBy))
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
