import type {
  StorageEffectStep,
  StorageRunnerContext,
  StorageRunnerGameState,
  StorageStepExecutionResult,
  StorageStepPlayerScope,
  StorageCardReference,
} from './StorageEffectStepTypes';

import {
  isEnsureStorageEffectStep,
  isMoveFromStorageEffectStep,
  isMoveToRemovedFromGameEffectStep,
  isMoveToSetAsideEffectStep,
  isMoveToStorageEffectStep,
} from './StorageEffectStepGuards';

import {
  ensureSpecialZones,
  ensureCardStorage,
  createCardStorageIfNeededFromEffect,
  moveCardBetweenZones,
} from '../storage/CardStorageEngine';

function resolvePlayerId(scope: StorageStepPlayerScope, context: StorageRunnerContext): string {
  switch (scope) {
    case 'self':
      return context.selfPlayerId;
    case 'opponent':
      return context.opponentPlayerId;
    case 'owner':
      return context.ownerPlayerId ?? context.selfPlayerId;
    case 'controller':
      return context.controllerPlayerId ?? context.selfPlayerId;
    default:
      return context.selfPlayerId;
  }
}

function resolveCardId(ref: StorageCardReference | undefined, context: StorageRunnerContext): string | undefined {
  switch (ref) {
    case undefined:
      return undefined;
    case 'thisCard':
      return context.thisCardId;
    case 'targetCard':
      return context.targetCardId;
    case 'chosenCard':
      return context.chosenCardId;
    case 'chosenCardFromHand':
      return context.chosenCardFromHandId;
    case 'chosenCardFromDiscard':
      return context.chosenCardFromDiscardId;
    case 'chosenCardFromRemovedFromGame':
      return context.chosenCardFromRemovedFromGameId;
    case 'chosenCardFromSetAside':
      return context.chosenCardFromSetAsideId;
    default:
      return undefined;
  }
}

function getScopedStorageId(playerId: string, storageId: string): string {
  return storageId.includes(':') ? storageId : `${playerId}:${storageId}`;
}

function ensureContextSpecialZones(state: StorageRunnerGameState, context: StorageRunnerContext): void {
  const playerIds = new Set<string>([
    context.selfPlayerId,
    context.opponentPlayerId,
    context.ownerPlayerId ?? context.selfPlayerId,
    context.controllerPlayerId ?? context.selfPlayerId,
  ]);

  for (const playerId of playerIds) {
    if (playerId) {
      ensureSpecialZones(state as any, playerId as any);
    }
  }
}

export function runStorageEffectStep(
  state: StorageRunnerGameState,
  step: StorageEffectStep,
  context: StorageRunnerContext,
): StorageStepExecutionResult {
  let nextState = state as StorageRunnerGameState;
  const movedCardIds: string[] = [];
  const createdStorageIds: string[] = [];

  ensureContextSpecialZones(nextState, context);

  if (isEnsureStorageEffectStep(step)) {
    const playerId = resolvePlayerId(step.player, context);
    const scopedStorageId = getScopedStorageId(playerId, step.storageId);
    const storage = ensureCardStorage(nextState as any, playerId as any, scopedStorageId, {
      label: step.label,
      visibility: step.visibility ?? 'public',
    });
    createdStorageIds.push(storage.id);
    return { state: nextState, movedCardIds, createdStorageIds };
  }

  if (isMoveToStorageEffectStep(step)) {
    const playerId = resolvePlayerId(step.player, context);
    const scopedStorageId = getScopedStorageId(playerId, step.storageId);
    const storage = createCardStorageIfNeededFromEffect(nextState as any, {
      playerId,
      storageId: scopedStorageId,
      label: step.storageId,
      visibility: step.visibility ?? 'public',
    });
    createdStorageIds.push(storage.id);

    const resolvedCardId = resolveCardId(step.target, context);
    if (resolvedCardId) {
      moveCardBetweenZones(nextState as any, {
        cardId: resolvedCardId,
        to: { kind: 'storage', playerId, storageId: scopedStorageId },
      });
      movedCardIds.push(resolvedCardId);
    } else if (step.from) {
      moveCardBetweenZones(nextState as any, {
        from: { kind: step.from, playerId },
        to: { kind: 'storage', playerId, storageId: scopedStorageId },
        amount: step.amount ?? 1,
      });
    } else {
      throw new Error('moveToStorage requires either target or from');
    }

    return { state: nextState, movedCardIds, createdStorageIds };
  }

  if (isMoveFromStorageEffectStep(step)) {
    const playerId = resolvePlayerId(step.player, context);
    const scopedStorageId = getScopedStorageId(playerId, step.storageId);
    const resolvedCardId = resolveCardId(step.target, context);

    if (resolvedCardId) {
      moveCardBetweenZones(nextState as any, {
        cardId: resolvedCardId,
        from: { kind: 'storage', playerId, storageId: scopedStorageId },
        to: { kind: step.to, playerId },
      });
      movedCardIds.push(resolvedCardId);
    } else {
      moveCardBetweenZones(nextState as any, {
        from: { kind: 'storage', playerId, storageId: scopedStorageId },
        to: { kind: step.to, playerId },
        amount: step.amount ?? 1,
      });
    }

    return { state: nextState, movedCardIds, createdStorageIds };
  }

  if (isMoveToRemovedFromGameEffectStep(step)) {
    const resolvedCardId = resolveCardId(step.target, context);
    if (resolvedCardId) {
      moveCardBetweenZones(nextState as any, {
        cardId: resolvedCardId,
        to: { kind: 'removedFromGame', playerId: context.selfPlayerId },
      });
      movedCardIds.push(resolvedCardId);
    } else if (step.from) {
      moveCardBetweenZones(nextState as any, {
        from: { kind: step.from, playerId: context.selfPlayerId },
        to: { kind: 'removedFromGame', playerId: context.selfPlayerId },
        amount: step.amount ?? 1,
      });
    } else {
      throw new Error('moveToRemovedFromGame requires either target or from');
    }

    return { state: nextState, movedCardIds, createdStorageIds };
  }

  if (isMoveToSetAsideEffectStep(step)) {
    const resolvedCardId = resolveCardId(step.target, context);
    if (resolvedCardId) {
      moveCardBetweenZones(nextState as any, {
        cardId: resolvedCardId,
        to: { kind: 'setAside', playerId: context.selfPlayerId },
      });
      movedCardIds.push(resolvedCardId);
    } else if (step.from) {
      moveCardBetweenZones(nextState as any, {
        from: { kind: step.from, playerId: context.selfPlayerId },
        to: { kind: 'setAside', playerId: context.selfPlayerId },
        amount: step.amount ?? 1,
      });
    } else {
      throw new Error('moveToSetAside requires either target or from');
    }

    return { state: nextState, movedCardIds, createdStorageIds };
  }

  return { state: nextState, movedCardIds, createdStorageIds };
}

export function runStorageEffectSteps(
  state: StorageRunnerGameState,
  steps: StorageEffectStep[],
  context: StorageRunnerContext,
): StorageStepExecutionResult {
  let nextState = state;
  const movedCardIds: string[] = [];
  const createdStorageIds: string[] = [];

  for (const step of steps) {
    const result = runStorageEffectStep(nextState, step, context);
    nextState = result.state;
    if (result.movedCardIds) movedCardIds.push(...result.movedCardIds);
    if (result.createdStorageIds) createdStorageIds.push(...result.createdStorageIds);
  }

  return { state: nextState, movedCardIds, createdStorageIds };
}
