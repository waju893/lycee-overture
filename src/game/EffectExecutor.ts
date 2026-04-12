import type { GameState } from '../GameTypes';
import type { EffectDSLDefinition, EffectDSLExecutionContext, EffectDSLStep } from './EffectDSL';
import { compileEffectDSL } from './EffectDSLCompiler';
import { runEffectDSLCompiled } from './EffectDSLRuntime';

export interface EffectExecutorDependencies {
  runStateNormalization: (state: GameState, startEventIndex: number) => void;
  flushTriggers: (state: GameState) => void;
  executeStep?: (state: GameState, step: EffectDSLStep, context: EffectDSLExecutionContext) => void;
}

function defaultExecuteStep(
  state: GameState,
  step: EffectDSLStep,
  _context: EffectDSLExecutionContext
): void {
  if (!state.logs) state.logs = [];
  switch (step.type) {
    case 'log':
      state.logs.push(`[EFFECT] ${step.message}`);
      return;
    case 'draw':
      state.logs.push(`[EFFECT] draw ${step.count}`);
      return;
    case 'destroy':
      state.logs.push(`[EFFECT] destroy ${step.count}`);
      return;
    case 'battleDestroy':
      state.logs.push(`[EFFECT] battleDestroy ${step.count}`);
      return;
    default:
      state.logs.push(`[EFFECT] step ${step.type}`);
  }
}

export function executeEffectDSLDefinition(
  state: GameState,
  definition: EffectDSLDefinition,
  context: EffectDSLExecutionContext,
  deps: EffectExecutorDependencies
): GameState {
  const compiled = compileEffectDSL(definition);

  return runEffectDSLCompiled(
    state,
    compiled,
    context,
    {
      runStateNormalization: deps.runStateNormalization,
      flushTriggers: deps.flushTriggers,
      executeStep: deps.executeStep ?? defaultExecuteStep
    }
  );
}
