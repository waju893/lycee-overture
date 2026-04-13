import type { GameState, PlayerID } from '../GameTypes';
import type { EffectDSLExecutionContext } from '../effects/EffectDSL';
import { executeEffectDSLDefinition } from '../effects/EffectExecutor';
import { runStorageEffectSteps } from '../effects/StorageEffectStepRunner';
import type { StorageRunnerContext } from '../effects/StorageEffectStepTypes';
import {
  requireCardEffectDefinition,
  requireCardStorageEffect,
} from './CardEffectResolver';

export interface ExecuteBoundCardEffectParams {
  cardId: string;
  effectId?: string;
  context: EffectDSLExecutionContext;
  deps: {
    runStateNormalization: (state: GameState, startEventIndex: number) => void;
    flushTriggers: (state: GameState) => void;
    executeStep?: (
      state: GameState,
      step: any,
      context: EffectDSLExecutionContext,
    ) => void;
  };
}

export interface ExecuteBoundStorageEffectParams {
  cardId: string;
  storageEffectId?: string;
  state: GameState;
  context: StorageRunnerContext;
}

export function executeBoundCardEffect(
  state: GameState,
  params: ExecuteBoundCardEffectParams,
): GameState {
  const resolved = requireCardEffectDefinition(params.cardId, params.effectId);

  return executeEffectDSLDefinition(
    state,
    resolved.definition,
    params.context,
    params.deps,
  );
}

export function executeBoundStorageEffect(
  state: GameState,
  params: ExecuteBoundStorageEffectParams,
): GameState {
  const resolved = requireCardStorageEffect(params.cardId, params.storageEffectId);

  const result = runStorageEffectSteps(
    state as any,
    resolved.steps,
    params.context,
  );

  return result.state as GameState;
}

export function buildDefaultEffectExecutionContext(params: {
  controller: PlayerID;
  sourceCardId?: string;
  sourceEffectId?: string;
  declaredTargetCardIds?: string[];
}): EffectDSLExecutionContext {
  return {
    controller: params.controller,
    opponent: params.controller === 'P1' ? 'P2' : 'P1',
    sourceCardId: params.sourceCardId,
    sourceEffectId: params.sourceEffectId,
    declaredTargetCardIds: params.declaredTargetCardIds,
  };
}

export function buildDefaultStorageRunnerContext(params: {
  selfPlayerId: PlayerID;
  thisCardId?: string;
  targetCardId?: string;
  chosenCardId?: string;
}): StorageRunnerContext {
  return {
    selfPlayerId: params.selfPlayerId,
    opponentPlayerId: params.selfPlayerId === 'P1' ? 'P2' : 'P1',
    ownerPlayerId: params.selfPlayerId,
    controllerPlayerId: params.selfPlayerId,
    thisCardId: params.thisCardId,
    targetCardId: params.targetCardId,
    chosenCardId: params.chosenCardId,
  };
}
