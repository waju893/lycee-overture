import type { GameState } from '../GameTypes';
import type { EffectDSLCompiled, EffectDSLExecutionContext, EffectDSLStep } from './EffectDSL';

export interface EffectRuntimeDependencies {
  runStateNormalization: (state: GameState, startEventIndex: number) => void;
  flushTriggers: (state: GameState) => void;
  executeStep?: (state: GameState, step: EffectDSLStep, context: EffectDSLExecutionContext) => void;
}

/**
 * Lycee A-structure runtime:
 * step -> normalize -> trigger -> next step
 */
export function runEffectDSLCompiled(
  state: GameState,
  compiled: EffectDSLCompiled,
  context: EffectDSLExecutionContext,
  deps: EffectRuntimeDependencies
): GameState {
  for (let i = 0; i < compiled.normalizedSteps.length; i++) {
    const step = compiled.normalizedSteps[i];
    const stepStartEventIndex = state.events.length;

    if (deps.executeStep) {
      deps.executeStep(state, step, context);
    }

    deps.runStateNormalization(state, stepStartEventIndex);
    deps.flushTriggers(state);
  }

  return state;
}
