import type { GameState, TriggerCandidate } from '../GameTypes';

export type EffectResolver = (state: GameState, trigger: TriggerCandidate) => void;

const registry = new Map<string, EffectResolver>();

export function registerEffectResolver(effectId: string, resolver: EffectResolver): void {
  registry.set(effectId, resolver);
}

export function resolveTriggeredEffect(state: GameState, trigger: TriggerCandidate): void {
  const effectId = trigger.effectId ?? trigger.template?.effectId;
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

  state.logs.push(`[TRIGGER EFFECT] ${trigger.triggerId} -> ${effectId}`);
  state.log = state.logs;

  resolver(state, trigger);

  state.logs.push(`[EFFECT] resolved ${effectId}`);
  state.log = state.logs;
}

registerEffectResolver('noop', (state) => {
  state.logs.push('[EFFECT] noop');
  state.log = state.logs;
});

registerEffectResolver('emit_nested_destroy', (state) => {
  state.events.push({
    type: 'CARD_DESTROYED',
    playerId: 'P2',
    affectedPlayerId: 'P2',
    cardId: 'NESTED_VICTIM',
    metadata: {
      destroyReason: 'effect',
      synthetic: true,
    },
  });
  state.logs.push('[EFFECT] emit_nested_destroy');
  state.log = state.logs;
});
