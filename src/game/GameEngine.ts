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
  areSlotsAdjacent,
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
import { resolveNextTriggerGroup } from './triggers/TriggerResolver';
import { resolveTriggeredEffect as resolveRegisteredTriggeredEffect } from './effects/EffectEngine';
import { executeEffectDSLDefinition } from './effects/EffectExecutor';
import { SAMPLE_EFFECT_DSL_CATALOG } from './effects/SampleEffectCatalog';
import type { EffectDSLStep, EffectDSLExecutionContext } from './effects/EffectDSL';
import { normalizeLyceeStateEvents } from './state/LyceeStateNormalizer';
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

function resetTurnPassedPlayers(state: GameState): void {
  state.turn.passedPlayers = [];
}

function beginTurnAndEnterMain(state: GameState, playerId: PlayerID, incrementTurn: boolean): void {
  state.turn.activePlayer = playerId;
  state.turn.priorityPlayer = playerId;
  state.turn.phase = 'wakeup';
  if (incrementTurn) {
    state.turn.turnNumber += 1;
  }
  resetTurnPassedPlayers(state);
  untapField(state, playerId);
  const drawCount = state.turn.turnNumber <= 1 && state.turn.firstPlayer === playerId ? 1 : 2;
  drawTopCards(state, playerId, drawCount);
  appendLog(state, `${playerId} 턴 개시시`);
  appendLog(state, '턴 개시시 유발 효과 처리 완료');
  state.turn.phase = 'main';
  state.turn.priorityPlayer = playerId;
  appendLog(state, '메인 페이즈');
}

function recordReplay(state: GameState, action: unknown): void {
  state.replayEvents.push({
    type: 'ACTION_RECORDED',
    payload: JSON.parse(JSON.stringify(action)),
  });
}

function flushNormalizationAndTriggers(state: GameState, startEventIndex: number): void {
  normalizeRecentEventsOnly(state, startEventIndex);

  if (state.declarationStack.length > 0) {
    return;
  }

  flushPendingTriggersOnly(state);
}

function pushEngineEvent(state: GameState, event: EngineEvent): void {
  state.events.push(event);
  enqueueTriggerCandidates(state, event);
}

function destroyCardToDiscard(
  state: GameState,
  destroyedPlayerId: PlayerID,
  card: CardRef,
  cause: CauseDescriptor,
  options?: {
    isDown?: boolean;
    destroyReason?: 'battle' | 'effect' | 'rule' | 'other';
  },
): void {
  const metadata = {
    isDown: Boolean(options?.isDown),
    destroyReason: options?.destroyReason ?? 'other',
  };

  const removed = removeCardFromAllZones(state.players[destroyedPlayerId], card.instanceId);
  const removedCard = removed ?? { ...card };
  removedCard.location = 'discard';
  state.players[destroyedPlayerId].discard.push(removedCard);

  pushEngineEvent(state, {
    type: 'CARD_DESTROYED',
    playerId: destroyedPlayerId,
    affectedPlayerId: destroyedPlayerId,
    cardId: removedCard.instanceId,
    cause,
    operation: {
      kind: 'destroy',
      cardId: removedCard.instanceId,
      playerId: destroyedPlayerId,
      fromZone: 'field',
      toZone: 'discard',
    },
    metadata,
  });

  if (metadata.isDown) {
    pushEngineEvent(state, {
      type: 'CARD_DOWNED',
      playerId: destroyedPlayerId,
      affectedPlayerId: destroyedPlayerId,
      cardId: removedCard.instanceId,
      cause,
      operation: {
        kind: 'down',
        cardId: removedCard.instanceId,
        playerId: destroyedPlayerId,
        fromZone: 'field',
        toZone: 'discard',
      },
      metadata,
    });
  }

  pushEngineEvent(state, {
    type: 'CARD_LEFT_FIELD',
    playerId: destroyedPlayerId,
    affectedPlayerId: destroyedPlayerId,
    cardId: removedCard.instanceId,
    cause,
    operation: {
      kind: 'leaveField',
      cardId: removedCard.instanceId,
      playerId: destroyedPlayerId,
      fromZone: 'field',
      toZone: 'discard',
    },
    metadata,
  });
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
    controllerPlayerId: playerId,
    relationToAffectedPlayer: 'any',
    causeKind: 'rule',
    category: 'rule',
    sourceOwnerKind: 'rule',
    sourceKind: 'rule',
    sourceType: 'rule',
    isEffect: false,
    isAbility: false,
    detail,
  };
}

function makeCharacterAbilityCause(playerId: PlayerID, sourceCardId?: string, sourceEffectId?: string): CauseDescriptor {
  return {
    controller: playerId,
    controllerPlayerId: playerId,
    relationToAffectedPlayer: 'self',
    causeKind: 'ability',
    category: 'ability',
    sourceOwnerKind: 'character',
    sourceKind: 'character',
    sourceType: 'character',
    isEffect: true,
    isAbility: true,
    sourceCardId,
    sourceEffectId,
  };
}

function makeBattleCause(playerId: PlayerID, sourceCardId?: string): CauseDescriptor {
  return {
    controller: playerId,
    controllerPlayerId: playerId,
    relationToAffectedPlayer: 'self',
    causeKind: 'battle',
    category: 'battle',
    sourceOwnerKind: 'battle',
    sourceKind: 'battle',
    sourceType: 'battle',
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
      affectedPlayerId: playerId,
      cardId: card.instanceId,
      cause: makeRuleCause(playerId, 'drawTopCards'),
      operation: { kind: 'draw', cardId: card.instanceId, playerId, fromZone: 'deck', toZone: 'hand', amount: 1 },
    });
  }
}


function normalizeRecentEventsOnly(state: GameState, startEventIndex: number): void {
  const beforeNormalize = state.events.length;
  const produced = normalizeLyceeStateEvents(state, startEventIndex);

  for (let i = beforeNormalize; i < state.events.length; i += 1) {
    enqueueTriggerCandidates(state, state.events[i]);
  }

  if (produced > 0) {
    appendLog(state, `[STATE] normalized ${produced} event(s)`);
  }
}

function flushPendingTriggersOnly(state: GameState): void {
  while (state.declarationStack.length === 0 && state.triggerQueue.pendingGroups.length > 0) {
    const currentGroup = resolveNextTriggerGroup(state);
    if (currentGroup.length === 0) break;

    state.triggerQueue.isResolving = true;
    try {
      const remaining = [...currentGroup];

      while (remaining.length > 0) {
        const trigger = remaining.shift()!;
        appendLog(state, `[TRIGGER PICK] ${trigger.triggerId} (${trigger.sourceCardId})`);

        const triggerEventStart = state.events.length;
        invokeTriggeredEffect(state, trigger);

        normalizeRecentEventsOnly(state, triggerEventStart);

        if (state.triggerQueue.pendingGroups.length > 0) {
          state.triggerQueue.pendingGroups.unshift([...remaining]);
          appendLog(state, `[TRIGGER QUEUE] suspend remaining group size=${remaining.length}`);
          break;
        }
      }
    } finally {
      state.triggerQueue.isResolving = false;
    }
  }
}

function resolveDSLTargetPlayer(
  step: EffectDSLStep,
  context: EffectDSLExecutionContext,
): PlayerID | null {
  if (!('target' in step)) return null;

  switch (step.target) {
    case 'self':
    case 'self_character':
      return context.controller;
    case 'opponent':
    case 'opponent_character':
      return context.opponent;
    case 'either':
    case 'any_character':
      return context.opponent;
    default:
      return context.opponent;
  }
}


function findDeclaredTargetsOnField(
  state: GameState,
  targetPlayer: PlayerID,
  declaredTargetCardIds: string[] | undefined,
): CardRef[] {
  if (!declaredTargetCardIds || declaredTargetCardIds.length === 0) {
    return [];
  }

  const results: CardRef[] = [];
  for (const cardId of declaredTargetCardIds) {
    const found = findCardInField(state, targetPlayer, cardId);
    if (found?.card) {
      results.push(found.card);
    }
  }

  return results;
}

function findResolutionTargetsOnField(
  state: GameState,
  targetPlayer: PlayerID,
): CardRef[] {
  const slots = Object.keys(state.players[targetPlayer].field) as FieldSlot[];
  return slots
    .map((slot) => state.players[targetPlayer].field[slot].card)
    .filter((card): card is CardRef => Boolean(card));
}

function cardMatchesDSLFilter(step: EffectDSLStep, card: CardRef): boolean {
  if (!('filter' in step) || !step.filter) {
    return true;
  }

  switch (step.filter) {
    case 'tapped':
      return Boolean(card.isTapped);
    case 'untapped':
      return !card.isTapped;
    default:
      return true;
  }
}

function buildDSLEffectCause(
  context: EffectDSLExecutionContext,
  targetPlayer: PlayerID,
  detail: string,
): CauseDescriptor {
  return {
    controller: context.controller,
    controllerPlayerId: context.controller,
    relationToAffectedPlayer: context.controller === targetPlayer ? 'self' : 'opponent',
    causeKind: 'effect',
    category: 'effect',
    sourceOwnerKind: 'character',
    sourceKind: 'character',
    sourceType: 'character',
    isEffect: true,
    isAbility: false,
    sourceCardId: context.sourceCardId,
    sourceEffectId: context.sourceEffectId,
    detail,
  };
}

function findDSLTargetCards(
  state: GameState,
  step: EffectDSLStep,
  context: EffectDSLExecutionContext,
): Array<{ playerId: PlayerID; card: CardRef }> {
  if (!('target' in step)) return [];

  const targetPlayer = resolveDSLTargetPlayer(step, context);
  if (!targetPlayer) return [];

  const candidates =
    'targetTiming' in step && step.targetTiming === 'declareTime'
      ? findDeclaredTargetsOnField(state, targetPlayer, context.declaredTargetCardIds)
      : findResolutionTargetsOnField(state, targetPlayer);

  const filtered = candidates.filter((card) => cardMatchesDSLFilter(step, card));
  const limit = 'multiTarget' in step && step.multiTarget ? step.count : 1;

  return filtered.slice(0, limit).map((card) => ({ playerId: targetPlayer, card }));
}


function executeDSLStepInEngine(
  state: GameState,
  step: EffectDSLStep,
  context: EffectDSLExecutionContext,
): void {
  switch (step.type) {
    case 'log':
      appendLog(state, `[EFFECT STEP] ${step.message}`);
      return;
    case 'draw': {
      const targetPlayer = step.player === 'self' ? context.controller : context.opponent;
      drawTopCards(state, targetPlayer, step.count);
      appendLog(state, `[EFFECT STEP] draw ${step.count} for ${targetPlayer}`);
      return;
    }
    case 'mill': {
      const targetPlayer = step.player === 'self' ? context.controller : context.opponent;
      millFromDeckToDiscard(
        state,
        targetPlayer,
        step.count,
        buildDSLEffectCause(context, targetPlayer, 'dsl:mill'),
      );
      appendLog(state, `[EFFECT STEP] mill ${step.count} for ${targetPlayer}`);
      return;
    }
    case 'tap':
    case 'untap': {
      const targetInfos = findDSLTargetCards(state, step, context);
      if (targetInfos.length === 0) {
        appendLog(
          state,
          step.optionalTarget
            ? `[EFFECT STEP] optional target missing for ${step.type}`
            : step.targetTiming === 'declareTime'
              ? `[EFFECT STEP] declared target missing for ${step.type}`
              : `[EFFECT STEP] no resolution target for ${step.type}`,
        );
        return;
      }

      for (const targetInfo of targetInfos) {
        targetInfo.card.isTapped = step.type === 'tap';
        pushEngineEvent(state, {
          type: step.type === 'tap' ? 'CARD_TAPPED' : 'CARD_UNTAPPED',
          playerId: targetInfo.playerId,
          affectedPlayerId: targetInfo.playerId,
          cardId: targetInfo.card.instanceId,
          cause: buildDSLEffectCause(context, targetInfo.playerId, `dsl:${step.type}:${step.targetTiming}`),
          operation: {
            kind: step.type,
            cardId: targetInfo.card.instanceId,
            playerId: targetInfo.playerId,
          },
        } as any);
        appendLog(state, `[EFFECT STEP] ${step.type} ${targetInfo.card.instanceId} (${step.targetTiming})`);
      }
      return;
    }
    case 'move': {
      const targetInfos = findDSLTargetCards(state, step, context);
      if (targetInfos.length === 0) {
        appendLog(
          state,
          step.optionalTarget
            ? `[EFFECT STEP] optional target missing for ${step.type}`
            : step.targetTiming === 'declareTime'
              ? `[EFFECT STEP] declared target missing for ${step.type}`
              : `[EFFECT STEP] no resolution target for ${step.type}`,
        );
        return;
      }

      for (const targetInfo of targetInfos) {
        const removed = removeCardFromAllZones(state.players[targetInfo.playerId], targetInfo.card.instanceId);
        const movedCard = removed ?? { ...targetInfo.card };
        movedCard.location = step.destination === 'hand' ? 'hand' : 'discard';
        movedCard.revealed = step.destination !== 'hand';

        if (step.destination === 'hand') {
          state.players[targetInfo.playerId].hand.push(movedCard);
        } else {
          state.players[targetInfo.playerId].discard.push(movedCard);
        }

        appendLog(state, `[EFFECT STEP] move ${movedCard.instanceId} -> ${step.destination} (${step.targetTiming})`);
      }
      return;
    }
    case 'destroy':
    case 'battleDestroy': {
      const targetInfos = findDSLTargetCards(state, step, context);
      if (targetInfos.length === 0) {
        appendLog(
          state,
          step.optionalTarget
            ? `[EFFECT STEP] optional target missing for ${step.type}`
            : step.targetTiming === 'declareTime'
              ? `[EFFECT STEP] declared target missing for ${step.type}`
              : `[EFFECT STEP] no resolution target for ${step.type}`,
        );
        return;
      }

      for (const targetInfo of targetInfos) {
        const cause = buildDSLEffectCause(context, targetInfo.playerId, `dsl:${step.type}:${step.targetTiming}`);

        destroyCardToDiscard(
          state,
          targetInfo.playerId,
          targetInfo.card,
          cause,
          {
            isDown: step.type === 'battleDestroy',
            destroyReason: 'effect',
          },
        );
        appendLog(state, `[EFFECT STEP] ${step.type} ${targetInfo.card.instanceId} (${step.targetTiming})`);
      }
      return;
    }
    default:
      appendLog(state, `[EFFECT STEP] unsupported ${step.type}`);
      return;
  }
}

function resolveSampleEffectDefinition(definitionOrId: any): any | undefined {
  if (!definitionOrId) return undefined;

  if (typeof definitionOrId === 'string') {
    return (
      SAMPLE_EFFECT_DSL_CATALOG[definitionOrId] ??
      SAMPLE_EFFECT_DSL_CATALOG[`sample_${definitionOrId}`] ??
      (definitionOrId.startsWith('sample_')
        ? SAMPLE_EFFECT_DSL_CATALOG[definitionOrId.replace(/^sample_/, '')]
        : undefined)
    );
  }

  if (typeof definitionOrId === 'object') {
    if (Array.isArray(definitionOrId.normalizedSteps)) {
      return definitionOrId;
    }

    if (Array.isArray(definitionOrId.steps)) {
      return definitionOrId;
    }

    if (
      definitionOrId.definition &&
      (Array.isArray(definitionOrId.definition.steps) || Array.isArray(definitionOrId.definition.normalizedSteps))
    ) {
      return definitionOrId.definition;
    }

    if (typeof definitionOrId.effectId === 'string') {
      const resolvedByEffectId = resolveSampleEffectDefinition(definitionOrId.effectId);
      if (resolvedByEffectId) {
        return resolvedByEffectId;
      }
    }

    if (typeof definitionOrId.id === 'string') {
      const resolvedById = resolveSampleEffectDefinition(definitionOrId.id);
      if (resolvedById) {
        return resolvedById;
      }
    }
  }

  return undefined;
}

function invokeTriggeredEffect(state: GameState, trigger: any): void {
  const effectId = trigger.effectId ?? trigger.template?.effectId;
  const definition = resolveSampleEffectDefinition(
    trigger.definition ??
    effectId ??
    trigger.template ??
    trigger
  );

  if (definition) {
    appendLog(state, `[DSL EFFECT] ${definition.id ?? effectId ?? 'unknown'}`);
    executeEffectDefinitionInEngine(
      state,
      definition,
      {
        controller: trigger.controller ?? state.turn.activePlayer,
        opponent: getOpponentPlayerId(trigger.controller ?? state.turn.activePlayer),
        sourceCardId: trigger.sourceCardId,
        sourceEffectId: effectId,
        declaredTargetCardIds:
          trigger.declaredTargetCardIds ??
          trigger.targetCardIds ??
          trigger.targets ??
          trigger.event?.metadata?.declaredTargetCardIds,
      } as any,
    );
    return;
  }

  resolveRegisteredTriggeredEffect(state, trigger);
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
        affectedPlayerId: playerId,
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
  state.turn.passedPlayers = [];
  appendLog(state, `${playerId} 턴 개시시`);
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
      affectedPlayerId: playerId,
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
  state.battle = {
    isActive: false,
    phase: 'none',
    awaitingDefenderSelection: false,
    passedPlayers: [],
    supportAttackBonus: 0,
    supportDefenseBonus: 0,
    supportHistory: [],
  };
}

function cardHasForbiddenBattleKeyeffect(cardNo?: string): boolean {
  if (!cardNo) return false;
  const meta = CARD_META_BY_CODE[cardNo.trim().toUpperCase()];
  if (!meta) return false;
  const keyeffects = (meta as any).keyEffects ?? (meta as any).keyeffects ?? [];
  return keyeffects.some((id: number) => BATTLE_FORBIDDEN_KEYEFFECTS.has(id));
}

function isAttackResponseWindow(state: GameState): boolean {
  return state.battle.isActive && state.battle.phase === 'awaitingDefenderSelection';
}

function isDuringBattlePriorityWindow(state: GameState): boolean {
  return state.battle.isActive && state.battle.phase === 'duringBattle';
}

function isAnyBattleWindow(state: GameState): boolean {
  return isAttackResponseWindow(state) || isDuringBattlePriorityWindow(state);
}

function resetBattlePassedPlayers(state: GameState): void {
  if (!state.battle.isActive) return;
  state.battle.passedPlayers = [];
}

function getSupportAmount(card: CardRef): number {
  return card.sp ?? 0;
}

function resolveSupport(state: GameState, declaration: any): void {
  const supporterCardId = declaration.payload?.supporterCardId as string | undefined;
  const targetCardId = declaration.payload?.targetCardId as string | undefined;
  const paidBy: 'tap' | 'supporterCost' =
    declaration.payload?.payWith === 'supporterCost' ? 'supporterCost' : 'tap';

  if (!supporterCardId || !targetCardId) {
    appendLog(state, 'SUPPORT_PAYLOAD_INVALID');
    return;
  }

  const supporterInfo = findCardOwnerOnField(state, supporterCardId);
  if (!supporterInfo) {
    appendLog(state, 'SUPPORTER_NOT_FOUND');
    return;
  }

  const amount = getSupportAmount(supporterInfo.card);

  if (targetCardId === state.battle.attackerCardId) {
    state.battle.supportAttackBonus = (state.battle.supportAttackBonus ?? 0) + amount;
    appendLog(state, `[SUPPORT] ${supporterCardId} -> ${targetCardId} (+${amount} AP)`);
  } else if (targetCardId === state.battle.defenderCardId) {
    state.battle.supportDefenseBonus = (state.battle.supportDefenseBonus ?? 0) + amount;
    appendLog(state, `[SUPPORT] ${supporterCardId} -> ${targetCardId} (+${amount} DP)`);
  } else {
    appendLog(state, 'SUPPORT_TARGET_INVALID');
    return;
  }

  state.battle.supportHistory = [
    ...(state.battle.supportHistory ?? []),
    {
      supporterCardId,
      targetCardId,
      amount,
      paidBy,
    },
  ];
}

function finalizeAttackResponses(state: GameState): void {
  if (!state.battle.isActive || state.battle.phase !== 'awaitingDefenderSelection') return;

  const attackerPlayerId = state.battle.attackerPlayerId;
  const defenderPlayerId = state.battle.defenderPlayerId;
  const attackColumn = state.battle.attackColumn;

  if (!attackerPlayerId || !defenderPlayerId || typeof attackColumn !== 'number') {
    clearBattleState(state);
    return;
  }

  const defenderSlot = getMatchingDefenderSlotForColumn(attackColumn);
  const defenderCard = state.players[defenderPlayerId].field[defenderSlot].card;
  const selectableDefenderExists = Boolean(defenderCard && !defenderCard.isTapped);

  state.battle = {
    ...state.battle,
    phase: 'duringBattle',
    defenderCardId: undefined,
    priorityPlayer: attackerPlayerId,
    passedPlayers: [],
  };

  appendLog(state, selectableDefenderExists ? '배틀 중 상태 진입 (방어 선택 가능)' : '배틀 중 상태 진입 (방어자 미지정)');
}

function resolveCurrentBattle(state: GameState): void {
  const eventStartIndex = state.events.length;

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
    affectedPlayerId: attackerPlayerId,
    cardId: attackerInfo.card.instanceId,
    cause: makeBattleCause(attackerPlayerId, attackerInfo.card.instanceId),
    operation: { kind: 'tap', cardId: attackerInfo.card.instanceId, playerId: attackerPlayerId },
  });

  if (defenderCardId) {
    const found = findCardOwnerOnField(state, defenderCardId);
    if (found && found.playerId === defenderPlayerId) {
      const attackerBaseAp = attackerInfo.card.ap ?? attackerInfo.card.power ?? 0;
      const attackerBaseDp = attackerInfo.card.dp ?? attackerInfo.card.hp ?? 0;
      const defenderBaseAp = found.card.ap ?? found.card.power ?? 0;
      const defenderBaseDp = found.card.dp ?? found.card.hp ?? 0;
      const attackerBonus = attackerInfo.card.bonus ?? 0;
      const defenderBonus = found.card.bonus ?? 0;
      const attackerSupport = state.battle.supportAttackBonus ?? 0;
      const defenderSupport = state.battle.supportDefenseBonus ?? 0;

      const attackerBattleAp = attackerBaseAp + attackerBonus + attackerSupport;
      const attackerBattleDp = attackerBaseDp + attackerBonus;
      const defenderBattleAp = defenderBaseAp + defenderBonus;
      const defenderBattleDp = defenderBaseDp + defenderBonus + defenderSupport;

      appendLog(
        state,
        `[BATTLE CALC] attacker AP=${attackerBattleAp} (base=${attackerBaseAp}, bonus=${attackerBonus}, support=${attackerSupport}) vs defender DP=${defenderBattleDp} (base=${defenderBaseDp}, bonus=${defenderBonus}, support=${defenderSupport})`,
      );
      appendLog(
        state,
        `[BATTLE CALC] defender AP=${defenderBattleAp} (base=${defenderBaseAp}, bonus=${defenderBonus}) vs attacker DP=${attackerBattleDp} (base=${attackerBaseDp}, bonus=${attackerBonus})`,
      );

      if (attackerBattleAp > defenderBattleDp) {
        destroyCardToDiscard(
          state,
          defenderPlayerId,
          found.card,
          makeBattleCause(attackerPlayerId, attackerInfo.card.instanceId),
          { isDown: true, destroyReason: 'battle' },
        );
      }
      if (defenderBattleAp > attackerBattleDp) {
        destroyCardToDiscard(
          state,
          attackerPlayerId,
          attackerInfo.card,
          makeBattleCause(defenderPlayerId, found.card.instanceId),
          { isDown: true, destroyReason: 'battle' },
        );
      }
      appendLog(state, '배틀 종료 (down = battle destroy)');
      clearBattleState(state);
      flushNormalizationAndTriggers(state, eventStartIndex);
      return;
    }
  }

  const dmg = attackerInfo.card.dmg ?? attackerInfo.card.damage ?? 1;
  millFromDeckToDiscard(state, defenderPlayerId, dmg, makeBattleCause(attackerPlayerId, attackerInfo.card.instanceId));
  appendLog(state, `직접 공격 처리 (${dmg})`);
  clearBattleState(state);
  flushNormalizationAndTriggers(state, eventStartIndex);
}

function fieldHasSameName(state: GameState, playerId: PlayerID, sameNameKey?: string): boolean {
  if (!sameNameKey) return false;
  const slots = Object.keys(state.players[playerId].field) as FieldSlot[];
  return slots.some((slot) => state.players[playerId].field[slot].card?.sameNameKey === sameNameKey);
}

function resolveUseEvent(state: GameState, declaration: any): void {
  const playerId = declaration.playerId as PlayerID;
  const card = removeCardFromHand(state, playerId, declaration.sourceCardId);
  if (!card) return;
  card.location = 'discard';
  card.revealed = true;
  state.players[playerId].discard.push(card);
  pushEngineEvent(state, {
    type: 'EVENT_USED',
    playerId,
    affectedPlayerId: playerId,
    cardId: card.instanceId,
    cause: makeRuleCause(playerId, 'eventDeclarationResolved'),
    operation: { kind: 'moveToDiscard', cardId: card.instanceId, playerId, fromZone: 'hand', toZone: 'discard' },
  });
  appendLog(state, '이벤트 사용 선언 해결');
}

function resolveUseArea(state: GameState, declaration: any): void {
  const playerId = declaration.playerId as PlayerID;
  const slot = declaration.targetSlots?.[0] as FieldSlot | undefined;
  const card = removeCardFromHand(state, playerId, declaration.sourceCardId);
  if (!card || !slot) return;
  const cell = state.players[playerId].field[slot] as any;
  if (cell.area) {
    state.players[playerId].hand.push(card);
    appendLog(state, 'AREA_ALREADY_EXISTS');
    return;
  }
  card.location = 'field';
  card.revealed = true;
  cell.area = card;
  pushEngineEvent(state, {
    type: 'AREA_ENTERED_FIELD',
    playerId,
    affectedPlayerId: playerId,
    cardId: card.instanceId,
    cause: makeRuleCause(playerId, 'areaDeclarationResolved'),
    operation: { kind: 'enterField', cardId: card.instanceId, playerId, fromZone: 'hand', toZone: 'field' },
  });
  appendLog(state, '에리어 배치 선언 해결');
}

function resolveUseItem(state: GameState, declaration: any): void {
  const playerId = declaration.playerId as PlayerID;
  const slot = declaration.targetSlots?.[0] as FieldSlot | undefined;
  const card = removeCardFromHand(state, playerId, declaration.sourceCardId);
  if (!card || !slot) return;
  const cell = state.players[playerId].field[slot] as any;
  if (!cell.card) {
    state.players[playerId].hand.push(card);
    appendLog(state, 'ITEM_TARGET_MISSING');
    return;
  }
  if (cell.attachedItem) {
    state.players[playerId].hand.push(card);
    appendLog(state, 'ITEM_ALREADY_ATTACHED');
    return;
  }
  card.location = 'field';
  card.revealed = true;
  cell.attachedItem = card;
  pushEngineEvent(state, {
    type: 'ITEM_ATTACHED',
    playerId,
    affectedPlayerId: playerId,
    cardId: card.instanceId,
    cause: makeRuleCause(playerId, 'itemDeclarationResolved'),
    operation: { kind: 'enterField', cardId: card.instanceId, playerId, fromZone: 'hand', toZone: 'field' },
  });
  appendLog(state, '장비 선언 해결');
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
    affectedPlayerId: playerId,
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
    affectedPlayerId: declaration.playerId,
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
      affectedPlayerId: owner,
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
        affectedPlayerId: owner,
        cardId: card.instanceId,
        cause: makeCharacterAbilityCause(owner, declaration.sourceCardId, declaration.sourceEffectId),
        operation: { kind: 'charge', cardId: card.instanceId, playerId: owner, fromZone: 'discard', toZone: 'charge', amount: 1 },
      });
    }
  }
  found.card.chargeCards = [...(found.card.chargeCards ?? []), ...charged];
  appendLog(state, '차지 해결');
}

function openAttackResponseWindow(state: GameState, action: Extract<GameAction, { type: 'DECLARE_ACTION' }>): void {
  const attackerInfo = findCardOwnerOnField(state, action.sourceCardId ?? '');
  if (!attackerInfo) return;
  const attacker = attackerInfo.card;
  const defenderPlayerId = getOpponent(attackerInfo.playerId);
  const column = getAttackColumnFromSlot(attackerInfo.slot);

  state.battle = {
    isActive: true,
    phase: 'awaitingDefenderSelection',
    attackerCardId: attacker.instanceId,
    attackerPlayerId: attackerInfo.playerId,
    defenderPlayerId,
    defenderCardId: undefined,
    attackColumn: column,
    awaitingDefenderSelection: false,
    priorityPlayer: defenderPlayerId,
    passedPlayers: [],
    supportAttackBonus: 0,
    supportDefenseBonus: 0,
    supportHistory: [],
  };

  appendLog(state, '공격 선언');
  appendLog(state, '공격 선언 대응 창 진입');
}

function resolveLatestLegacyDeclaration(state: GameState): void {
  const eventStartIndex = state.events.length;
  const declaration = state.declarationStack.pop();
  syncDeclarationStack(state.declarationStack);
  if (!declaration) return;
  switch (declaration.kind) {
    case 'useCharacter':
      resolveUseCharacter(state, declaration);
      break;
    case 'useEvent':
      resolveUseEvent(state, declaration);
      break;
    case 'useArea':
      resolveUseArea(state, declaration);
      break;
    case 'useItem':
      resolveUseItem(state, declaration);
      break;
    case 'useAbility':
      resolveUseAbility(state, declaration);
      break;
    case 'chargeCharacter':
      resolveChargeCharacter(state, declaration);
      break;
    case 'support':
      resolveSupport(state, declaration);
      break;
    default:
      break;
  }
  if (isAnyBattleWindow(state)) {
    state.battle.priorityPlayer = declaration.playerId;
    resetBattlePassedPlayers(state);
  } else {
    state.turn.priorityPlayer = state.turn.activePlayer;
  }
  flushNormalizationAndTriggers(state, eventStartIndex);
}

function validateDeclareAction(state: GameState, action: Extract<GameAction, { type: 'DECLARE_ACTION' }>): string | null {
  if (isAnyBattleWindow(state)) {
    if (state.battle.priorityPlayer !== action.playerId) {
      return 'BATTLE_PRIORITY_MISMATCH';
    }
    if (action.kind === 'attack') {
      return 'BATTLE_ATTACK_DECLARATION_FORBIDDEN';
    }
  }
  if (isAttackResponseWindow(state) && action.kind === 'useCharacter') {
    return 'BATTLE_CHARACTER_DECLARATION_FORBIDDEN';
  }
  if (!isAnyBattleWindow(state) && state.turn.phase !== 'main') {
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

  if (action.kind === 'useEvent') {
    const card = findCardInHand(state, action.playerId, action.sourceCardId ?? '');
    if (!card) return 'CARD_NOT_FOUND';
    return null;
  }

  if (action.kind === 'useArea') {
    const card = findCardInHand(state, action.playerId, action.sourceCardId ?? '');
    if (!card) return 'CARD_NOT_FOUND';
    const slot = action.targetSlots?.[0];
    if (!slot) return 'TARGET_SLOT_MISSING';
    if ((state.players[action.playerId].field[slot] as any).area) return 'AREA_ALREADY_EXISTS';
    return null;
  }

  if (action.kind === 'useItem') {
    const card = findCardInHand(state, action.playerId, action.sourceCardId ?? '');
    if (!card) return 'CARD_NOT_FOUND';
    const slot = action.targetSlots?.[0];
    if (!slot) return 'TARGET_SLOT_MISSING';
    const cell = state.players[action.playerId].field[slot] as any;
    if (!cell.card) return 'ITEM_TARGET_MISSING';
    if (cell.attachedItem) return 'ITEM_ALREADY_ATTACHED';
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

  if (action.kind === 'support') {
    if (!state.battle.isActive || state.battle.phase !== 'duringBattle') {
      return 'SUPPORT_ONLY_DURING_BATTLE';
    }

    const supporterCardId = action.payload?.supporterCardId as string | undefined;
    const targetCardId = action.payload?.targetCardId as string | undefined;

    if (!supporterCardId || !targetCardId) {
      return 'SUPPORT_PAYLOAD_INVALID';
    }

    const supporterInfo = findCardOwnerOnField(state, supporterCardId);
    if (!supporterInfo || supporterInfo.playerId !== action.playerId) {
      return 'SUPPORTER_NOT_FOUND';
    }

    if (supporterInfo.card.isTapped) {
      return 'SUPPORTER_TAPPED';
    }

    if (
      targetCardId !== state.battle.attackerCardId &&
      targetCardId !== state.battle.defenderCardId
    ) {
      return 'SUPPORT_TARGET_INVALID';
    }

    const targetInfo = findCardOwnerOnField(state, targetCardId);
    if (!targetInfo) {
      return 'SUPPORT_TARGET_NOT_FOUND';
    }

    if (supporterCardId === targetCardId) {
      return 'SUPPORT_SELF_INVALID';
    }

    if (!areSlotsAdjacent(supporterInfo.slot, targetInfo.slot)) {
      return 'SUPPORTER_NOT_ADJACENT';
    }

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
  next.turn.passedPlayers = [];
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
  if (isAttackResponseWindow(state)) {
    if (state.battle.priorityPlayer !== action.playerId) {
      appendLog(state, 'BATTLE_PRIORITY_MISMATCH');
      return state;
    }

    const current = action.playerId;
    const other = getOpponentPlayerId(current);

    if (state.declarationStack.length > 0) {
      resolveLatestLegacyDeclaration(state);
      return state;
    }

    const passedPlayers = new Set(state.battle.passedPlayers ?? []);
    passedPlayers.add(current);
    state.battle.passedPlayers = Array.from(passedPlayers);

    if (passedPlayers.has('P1') && passedPlayers.has('P2')) {
      finalizeAttackResponses(state);
      return state;
    }

    state.battle.priorityPlayer = other;
    appendLog(state, `[ATTACK RESPONSE] ${current} pass -> ${other}`);
    return state;
  }

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
    const current = action.playerId;
    const other = getOpponentPlayerId(action.playerId);
    const passedPlayers = new Set(state.turn.passedPlayers ?? []);
    passedPlayers.add(current);
    state.turn.passedPlayers = Array.from(passedPlayers);

    if (state.turn.phase === 'main' && passedPlayers.has('P1') && passedPlayers.has('P2')) {
      appendLog(state, '턴 종료시');
      const nextPlayer = getOpponentPlayerId(state.turn.activePlayer);
      startTurn(state, nextPlayer);
      appendLog(state, '턴 개시시 유발 효과 처리 완료');
      state.turn.phase = 'main';
      state.turn.priorityPlayer = state.turn.activePlayer;
      state.turn.passedPlayers = [];
      appendLog(state, '메인 페이즈');
      return state;
    }

    state.turn.priorityPlayer = other;
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
          AF_LEFT: { ...state.players.P1.field.AF_LEFT, card: state.players.P1.field.AF_LEFT.card ? { ...state.players.P1.field.AF_LEFT.card } : null, area: (state.players.P1.field.AF_LEFT as any).area ? { ...(state.players.P1.field.AF_LEFT as any).area } : null, attachedItem: (state.players.P1.field.AF_LEFT as any).attachedItem ? { ...(state.players.P1.field.AF_LEFT as any).attachedItem } : null },
          AF_CENTER: { ...state.players.P1.field.AF_CENTER, card: state.players.P1.field.AF_CENTER.card ? { ...state.players.P1.field.AF_CENTER.card } : null, area: (state.players.P1.field.AF_CENTER as any).area ? { ...(state.players.P1.field.AF_CENTER as any).area } : null, attachedItem: (state.players.P1.field.AF_CENTER as any).attachedItem ? { ...(state.players.P1.field.AF_CENTER as any).attachedItem } : null },
          AF_RIGHT: { ...state.players.P1.field.AF_RIGHT, card: state.players.P1.field.AF_RIGHT.card ? { ...state.players.P1.field.AF_RIGHT.card } : null, area: (state.players.P1.field.AF_RIGHT as any).area ? { ...(state.players.P1.field.AF_RIGHT as any).area } : null, attachedItem: (state.players.P1.field.AF_RIGHT as any).attachedItem ? { ...(state.players.P1.field.AF_RIGHT as any).attachedItem } : null },
          DF_LEFT: { ...state.players.P1.field.DF_LEFT, card: state.players.P1.field.DF_LEFT.card ? { ...state.players.P1.field.DF_LEFT.card } : null, area: (state.players.P1.field.DF_LEFT as any).area ? { ...(state.players.P1.field.DF_LEFT as any).area } : null, attachedItem: (state.players.P1.field.DF_LEFT as any).attachedItem ? { ...(state.players.P1.field.DF_LEFT as any).attachedItem } : null },
          DF_CENTER: { ...state.players.P1.field.DF_CENTER, card: state.players.P1.field.DF_CENTER.card ? { ...state.players.P1.field.DF_CENTER.card } : null, area: (state.players.P1.field.DF_CENTER as any).area ? { ...(state.players.P1.field.DF_CENTER as any).area } : null, attachedItem: (state.players.P1.field.DF_CENTER as any).attachedItem ? { ...(state.players.P1.field.DF_CENTER as any).attachedItem } : null },
          DF_RIGHT: { ...state.players.P1.field.DF_RIGHT, card: state.players.P1.field.DF_RIGHT.card ? { ...state.players.P1.field.DF_RIGHT.card } : null, area: (state.players.P1.field.DF_RIGHT as any).area ? { ...(state.players.P1.field.DF_RIGHT as any).area } : null, attachedItem: (state.players.P1.field.DF_RIGHT as any).attachedItem ? { ...(state.players.P1.field.DF_RIGHT as any).attachedItem } : null },
        },
      },
      P2: {
        ...state.players.P2,
        deck: [...state.players.P2.deck],
        hand: [...state.players.P2.hand],
        discard: [...state.players.P2.discard],
        field: {
          AF_LEFT: { ...state.players.P2.field.AF_LEFT, card: state.players.P2.field.AF_LEFT.card ? { ...state.players.P2.field.AF_LEFT.card } : null, area: (state.players.P2.field.AF_LEFT as any).area ? { ...(state.players.P2.field.AF_LEFT as any).area } : null, attachedItem: (state.players.P2.field.AF_LEFT as any).attachedItem ? { ...(state.players.P2.field.AF_LEFT as any).attachedItem } : null },
          AF_CENTER: { ...state.players.P2.field.AF_CENTER, card: state.players.P2.field.AF_CENTER.card ? { ...state.players.P2.field.AF_CENTER.card } : null, area: (state.players.P2.field.AF_CENTER as any).area ? { ...(state.players.P2.field.AF_CENTER as any).area } : null, attachedItem: (state.players.P2.field.AF_CENTER as any).attachedItem ? { ...(state.players.P2.field.AF_CENTER as any).attachedItem } : null },
          AF_RIGHT: { ...state.players.P2.field.AF_RIGHT, card: state.players.P2.field.AF_RIGHT.card ? { ...state.players.P2.field.AF_RIGHT.card } : null, area: (state.players.P2.field.AF_RIGHT as any).area ? { ...(state.players.P2.field.AF_RIGHT as any).area } : null, attachedItem: (state.players.P2.field.AF_RIGHT as any).attachedItem ? { ...(state.players.P2.field.AF_RIGHT as any).attachedItem } : null },
          DF_LEFT: { ...state.players.P2.field.DF_LEFT, card: state.players.P2.field.DF_LEFT.card ? { ...state.players.P2.field.DF_LEFT.card } : null, area: (state.players.P2.field.DF_LEFT as any).area ? { ...(state.players.P2.field.DF_LEFT as any).area } : null, attachedItem: (state.players.P2.field.DF_LEFT as any).attachedItem ? { ...(state.players.P2.field.DF_LEFT as any).attachedItem } : null },
          DF_CENTER: { ...state.players.P2.field.DF_CENTER, card: state.players.P2.field.DF_CENTER.card ? { ...state.players.P2.field.DF_CENTER.card } : null, area: (state.players.P2.field.DF_CENTER as any).area ? { ...(state.players.P2.field.DF_CENTER as any).area } : null, attachedItem: (state.players.P2.field.DF_CENTER as any).attachedItem ? { ...(state.players.P2.field.DF_CENTER as any).attachedItem } : null },
          DF_RIGHT: { ...state.players.P2.field.DF_RIGHT, card: state.players.P2.field.DF_RIGHT.card ? { ...state.players.P2.field.DF_RIGHT.card } : null, area: (state.players.P2.field.DF_RIGHT as any).area ? { ...(state.players.P2.field.DF_RIGHT as any).area } : null, attachedItem: (state.players.P2.field.DF_RIGHT as any).attachedItem ? { ...(state.players.P2.field.DF_RIGHT as any).attachedItem } : null },
        },
      },
    },
    startup: {
      ...state.startup,
      decisions: { ...state.startup.decisions },
    },
    turn: { ...state.turn, passedPlayers: [...(state.turn.passedPlayers ?? [])] },
    battle: { ...state.battle, passedPlayers: [...(state.battle.passedPlayers ?? [])] },
    declarationStack: syncDeclarationStack([...state.declarationStack] as unknown as DeclarationStackArray),
    triggerQueue: { pendingGroups: state.triggerQueue.pendingGroups.map((group) => [...group]), isResolving: state.triggerQueue.isResolving },
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
      next.turn.passedPlayers = [];
      return next;
    case 'START_TURN':
      if (next.turn.phase === 'main') {
        return next;
      }
      startTurn(next, next.turn.activePlayer);
      return next;
    case 'ADVANCE_PHASE':
      if (next.turn.phase === 'wakeup') {
        appendLog(next, '턴 개시시 유발 효과 처리 완료');
        next.turn.phase = 'main';
        next.turn.priorityPlayer = next.turn.activePlayer;
        next.turn.passedPlayers = [];
        appendLog(next, '메인 페이즈');
      } else if (next.turn.phase === 'main') {
        next.turn.phase = 'battle';
      } else if (next.turn.phase === 'battle') {
        next.turn.phase = 'end';
        next.turn.passedPlayers = [];
      } else if (next.turn.phase === 'end') {
        appendLog(next, '턴 종료시 유발 효과 처리 완료');
        const nextPlayer = getOpponentPlayerId(next.turn.activePlayer);
        startTurn(next, nextPlayer);
        appendLog(next, '턴 개시시 유발 효과 처리 완료');
        next.turn.phase = 'main';
        next.turn.priorityPlayer = next.turn.activePlayer;
        next.turn.passedPlayers = [];
        appendLog(next, '메인 페이즈');
      }
      return next;
    case 'DECLARE_ACTION': {
      const violation = validateDeclareAction(next, action);
      if (violation) {
        appendLog(next, violation);
        return next;
      }

      if (!isAnyBattleWindow(next) && action.kind === 'attack') {
        openAttackResponseWindow(next, action);
        return next;
      }

      if (action.kind === 'support') {
        const supporterCardId = action.payload?.supporterCardId as string | undefined;
        const payWith = action.payload?.payWith as 'tap' | 'supporterCost' | undefined;

        if (supporterCardId && payWith !== 'supporterCost') {
          const supporterInfo = findCardOwnerOnField(next, supporterCardId);
          if (supporterInfo?.card) {
            supporterInfo.card.isTapped = true;
            pushEngineEvent(next, {
              type: 'CARD_TAPPED',
              playerId: supporterInfo.playerId,
              affectedPlayerId: supporterInfo.playerId,
              cardId: supporterInfo.card.instanceId,
              cause: makeBattleCause(action.playerId, supporterInfo.card.instanceId),
              operation: {
                kind: 'tap',
                cardId: supporterInfo.card.instanceId,
                playerId: supporterInfo.playerId,
              },
            });
            appendLog(next, `[SUPPORT COST] ${supporterInfo.card.instanceId} tapped`);
          }
        }
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

      if (isAnyBattleWindow(next)) {
        next.battle.priorityPlayer = getOpponentPlayerId(action.playerId);
        resetBattlePassedPlayers(next);
      } else {
        next.turn.priorityPlayer = getOpponentPlayerId(action.playerId);
        next.turn.passedPlayers = [];
      }

      if (action.kind === 'useCharacter') appendLog(next, '등장 선언');
      if (action.kind === 'useEvent') appendLog(next, '이벤트 사용 선언');
      if (action.kind === 'useArea') appendLog(next, '에리어 배치 선언');
      if (action.kind === 'useItem') appendLog(next, '장비 선언');
      if (action.kind === 'useAbility') appendLog(next, '능력 사용 선언');
      if (action.kind === 'support') appendLog(next, '서포트 선언');
      if (action.kind === 'chargeCharacter') appendLog(next, '차지 선언');
      return next;
    }
    case 'PASS_PRIORITY':
      return handlePassPriority(next, action);
    case 'SET_DEFENDER': {
      if (!next.battle.isActive || next.battle.phase !== 'duringBattle') return next;
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




export function executeEffectDefinitionInEngine(
  state: GameState,
  definitionOrId: any,
  context: EffectDSLExecutionContext & { declaredTargetCardIds?: string[] },
): GameState {
  const resolvedDefinition = resolveSampleEffectDefinition(definitionOrId);

  if (!resolvedDefinition) {
    appendLog(
      state,
      `[DSL EFFECT] missing definition: ${
        typeof definitionOrId === 'string'
          ? definitionOrId
          : definitionOrId?.effectId ?? definitionOrId?.id ?? definitionOrId?.definition?.id ?? 'unknown'
      }`,
    );
    throw new Error('Invalid Effect DSL: definition is undefined');
  }

  executeEffectDSLDefinition(
    state,
    resolvedDefinition,
    context,
    {
      executeStep: executeDSLStepInEngine,
      runStateNormalization: (innerState, startEventIndex) => normalizeRecentEventsOnly(innerState, startEventIndex),
      flushTriggers: (innerState) => flushPendingTriggersOnly(innerState),
    },
  );
  return state;
}


export function applyEffectDestroyToFieldCard(
  state: GameState,
  params: {
    affectedPlayerId: PlayerID;
    cardId: string;
    sourcePlayerId?: PlayerID;
    sourceCardId?: string;
    sourceEffectId?: string;
  },
): GameState {
  const next: GameState = {
    ...state,
    players: {
      P1: {
        ...state.players.P1,
        deck: [...state.players.P1.deck],
        hand: [...state.players.P1.hand],
        discard: [...state.players.P1.discard],
        field: {
          AF_LEFT: { ...state.players.P1.field.AF_LEFT, card: state.players.P1.field.AF_LEFT.card ? { ...state.players.P1.field.AF_LEFT.card } : null, area: (state.players.P1.field.AF_LEFT as any).area ? { ...(state.players.P1.field.AF_LEFT as any).area } : null, attachedItem: (state.players.P1.field.AF_LEFT as any).attachedItem ? { ...(state.players.P1.field.AF_LEFT as any).attachedItem } : null },
          AF_CENTER: { ...state.players.P1.field.AF_CENTER, card: state.players.P1.field.AF_CENTER.card ? { ...state.players.P1.field.AF_CENTER.card } : null, area: (state.players.P1.field.AF_CENTER as any).area ? { ...(state.players.P1.field.AF_CENTER as any).area } : null, attachedItem: (state.players.P1.field.AF_CENTER as any).attachedItem ? { ...(state.players.P1.field.AF_CENTER as any).attachedItem } : null },
          AF_RIGHT: { ...state.players.P1.field.AF_RIGHT, card: state.players.P1.field.AF_RIGHT.card ? { ...state.players.P1.field.AF_RIGHT.card } : null, area: (state.players.P1.field.AF_RIGHT as any).area ? { ...(state.players.P1.field.AF_RIGHT as any).area } : null, attachedItem: (state.players.P1.field.AF_RIGHT as any).attachedItem ? { ...(state.players.P1.field.AF_RIGHT as any).attachedItem } : null },
          DF_LEFT: { ...state.players.P1.field.DF_LEFT, card: state.players.P1.field.DF_LEFT.card ? { ...state.players.P1.field.DF_LEFT.card } : null, area: (state.players.P1.field.DF_LEFT as any).area ? { ...(state.players.P1.field.DF_LEFT as any).area } : null, attachedItem: (state.players.P1.field.DF_LEFT as any).attachedItem ? { ...(state.players.P1.field.DF_LEFT as any).attachedItem } : null },
          DF_CENTER: { ...state.players.P1.field.DF_CENTER, card: state.players.P1.field.DF_CENTER.card ? { ...state.players.P1.field.DF_CENTER.card } : null, area: (state.players.P1.field.DF_CENTER as any).area ? { ...(state.players.P1.field.DF_CENTER as any).area } : null, attachedItem: (state.players.P1.field.DF_CENTER as any).attachedItem ? { ...(state.players.P1.field.DF_CENTER as any).attachedItem } : null },
          DF_RIGHT: { ...state.players.P1.field.DF_RIGHT, card: state.players.P1.field.DF_RIGHT.card ? { ...state.players.P1.field.DF_RIGHT.card } : null, area: (state.players.P1.field.DF_RIGHT as any).area ? { ...(state.players.P1.field.DF_RIGHT as any).area } : null, attachedItem: (state.players.P1.field.DF_RIGHT as any).attachedItem ? { ...(state.players.P1.field.DF_RIGHT as any).attachedItem } : null },
        },
      },
      P2: {
        ...state.players.P2,
        deck: [...state.players.P2.deck],
        hand: [...state.players.P2.hand],
        discard: [...state.players.P2.discard],
        field: {
          AF_LEFT: { ...state.players.P2.field.AF_LEFT, card: state.players.P2.field.AF_LEFT.card ? { ...state.players.P2.field.AF_LEFT.card } : null, area: (state.players.P2.field.AF_LEFT as any).area ? { ...(state.players.P2.field.AF_LEFT as any).area } : null, attachedItem: (state.players.P2.field.AF_LEFT as any).attachedItem ? { ...(state.players.P2.field.AF_LEFT as any).attachedItem } : null },
          AF_CENTER: { ...state.players.P2.field.AF_CENTER, card: state.players.P2.field.AF_CENTER.card ? { ...state.players.P2.field.AF_CENTER.card } : null, area: (state.players.P2.field.AF_CENTER as any).area ? { ...(state.players.P2.field.AF_CENTER as any).area } : null, attachedItem: (state.players.P2.field.AF_CENTER as any).attachedItem ? { ...(state.players.P2.field.AF_CENTER as any).attachedItem } : null },
          AF_RIGHT: { ...state.players.P2.field.AF_RIGHT, card: state.players.P2.field.AF_RIGHT.card ? { ...state.players.P2.field.AF_RIGHT.card } : null, area: (state.players.P2.field.AF_RIGHT as any).area ? { ...(state.players.P2.field.AF_RIGHT as any).area } : null, attachedItem: (state.players.P2.field.AF_RIGHT as any).attachedItem ? { ...(state.players.P2.field.AF_RIGHT as any).attachedItem } : null },
          DF_LEFT: { ...state.players.P2.field.DF_LEFT, card: state.players.P2.field.DF_LEFT.card ? { ...state.players.P2.field.DF_LEFT.card } : null, area: (state.players.P2.field.DF_LEFT as any).area ? { ...(state.players.P2.field.DF_LEFT as any).area } : null, attachedItem: (state.players.P2.field.DF_LEFT as any).attachedItem ? { ...(state.players.P2.field.DF_LEFT as any).attachedItem } : null },
          DF_CENTER: { ...state.players.P2.field.DF_CENTER, card: state.players.P2.field.DF_CENTER.card ? { ...state.players.P2.field.DF_CENTER.card } : null, area: (state.players.P2.field.DF_CENTER as any).area ? { ...(state.players.P2.field.DF_CENTER as any).area } : null, attachedItem: (state.players.P2.field.DF_CENTER as any).attachedItem ? { ...(state.players.P2.field.DF_CENTER as any).attachedItem } : null },
          DF_RIGHT: { ...state.players.P2.field.DF_RIGHT, card: state.players.P2.field.DF_RIGHT.card ? { ...state.players.P2.field.DF_RIGHT.card } : null, area: (state.players.P2.field.DF_RIGHT as any).area ? { ...(state.players.P2.field.DF_RIGHT as any).area } : null, attachedItem: (state.players.P2.field.DF_RIGHT as any).attachedItem ? { ...(state.players.P2.field.DF_RIGHT as any).attachedItem } : null },
        },
      },
    },
    startup: {
      ...state.startup,
      decisions: { ...state.startup.decisions },
    },
    turn: { ...state.turn, passedPlayers: [...(state.turn.passedPlayers ?? [])] },
    battle: { ...state.battle, passedPlayers: [...(state.battle.passedPlayers ?? [])] },
    declarationStack: syncDeclarationStack([...state.declarationStack] as unknown as DeclarationStackArray),
    triggerQueue: { pendingGroups: state.triggerQueue.pendingGroups.map((group) => [...group]), isResolving: state.triggerQueue.isResolving },
    logs: [...state.logs],
    log: [...state.logs],
    events: [...state.events],
    replayEvents: [...state.replayEvents],
  };

  const found = findCardInField(next, params.affectedPlayerId, params.cardId);
  if (!found) {
    appendLog(next, 'EFFECT_DESTROY_TARGET_NOT_FOUND');
    return next;
  }

  const sourcePlayerId = params.sourcePlayerId ?? params.affectedPlayerId;
  const cause: CauseDescriptor = {
    controller: sourcePlayerId,
    controllerPlayerId: sourcePlayerId,
    relationToAffectedPlayer: sourcePlayerId === params.affectedPlayerId ? 'self' : 'opponent',
    causeKind: 'effect',
    category: 'effect',
    sourceOwnerKind: 'character',
    sourceKind: 'character',
    sourceType: 'character',
    isEffect: true,
    isAbility: false,
    sourceCardId: params.sourceCardId,
    sourceEffectId: params.sourceEffectId,
    detail: 'applyEffectDestroyToFieldCard',
  };

  const eventStartIndex = next.events.length;
  destroyCardToDiscard(
    next,
    params.affectedPlayerId,
    found.card,
    cause,
    { isDown: false, destroyReason: 'effect' },
  );
  flushNormalizationAndTriggers(next, eventStartIndex);
  appendLog(next, `[EFFECT DESTROY] ${params.affectedPlayerId} ${params.cardId}`);

  return next;
}
