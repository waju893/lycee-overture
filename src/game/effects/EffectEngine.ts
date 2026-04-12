import type { GameState, TriggerCandidate } from '../GameTypes';

export type EffectResolver = (state: GameState, trigger: TriggerCandidate) => void;

const registry = new Map<string, EffectResolver>();

export function registerEffectResolver(effectId: string, resolver: EffectResolver): void {
  registry.set(effectId, resolver);
}

export function resolveTriggeredEffect(state: GameState, trigger: TriggerCandidate): void {
  const effectId = trigger.effectId ?? (trigger as any).template?.effectId;
  if (!effectId) {
    state.logs.push(`[EFFECT] missing effectId for trigger ${trigger.triggerId}`);
    state.log = state.logs;
    return;
  }

  const resolver = registry.get(effectId);
  if (!resolver) {
    state.logs.push(`[EFFECT] no resolver registered for ${effectId}`);
    state.log = state.logs;
    return;
  }

  resolver(state, trigger);
  state.logs.push(`[EFFECT] resolved ${effectId}`);
  state.log = state.logs;
}

/**
 * Example no-op resolver to keep the pipeline test-safe before real card text
 * implementations land.
 */
registerEffectResolver('noop', (state) => {
  state.logs.push('[EFFECT] noop');
  state.log = state.logs;
});
