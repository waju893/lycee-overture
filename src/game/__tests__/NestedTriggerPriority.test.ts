import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../GameRules';
import type { CardRef } from '../GameTypes';
import { enqueueTriggerCandidates } from '../triggers/TriggerQueue';
import { resolveNextTriggerGroup } from '../triggers/TriggerResolver';
import { resolveTriggeredEffect } from '../effects/EffectEngine';

function makeTriggerCard(
  instanceId: string,
  owner: 'P1' | 'P2',
  effectId: string,
  targetEventType = 'CARD_DESTROYED',
): CardRef {
  return {
    instanceId,
    cardNo: instanceId,
    name: instanceId,
    owner,
    cardType: 'character',
    location: 'field',
    triggerTemplates: [
      {
        id: `${instanceId}_TRIGGER`,
        condition: { eventType: targetEventType },
        effectId,
      },
    ],
  };
}

describe('NestedTriggerPriority', () => {
  it('nested trigger group is inserted to queue head before older waiting groups', () => {
    const state = createInitialGameState({ p1Deck: [], p2Deck: [], leaderEnabled: false });
    state.turn.activePlayer = 'P1';

    // Older group that was already waiting
    state.triggerQueue.pendingGroups.push([
      {
        triggerId: 'OLDER_TRIGGER',
        sourceCardId: 'OLDER_CARD',
        controller: 'P2',
        condition: { eventType: 'CARD_DESTROYED' },
        sourceEventType: 'CARD_DESTROYED',
        sourceEventIndex: 0,
        effectId: 'noop',
      },
    ]);

    // We are already in trigger resolution, and a currently resolving trigger causes a new event.
    state.players.P1.field.AF_LEFT.card = makeTriggerCard('NESTED_SOURCE', 'P1', 'noop');
    state.triggerQueue.isResolving = true;
    state.events.push({
      type: 'CARD_DESTROYED',
      playerId: 'P2',
      affectedPlayerId: 'P2',
      cardId: 'ANY_TARGET',
      metadata: { destroyReason: 'effect' },
    });
    enqueueTriggerCandidates(state, state.events[state.events.length - 1]);

    expect(state.triggerQueue.pendingGroups.length).toBe(2);
    expect(state.triggerQueue.pendingGroups[0][0].sourceCardId).toBe('NESTED_SOURCE');
    expect(state.triggerQueue.pendingGroups[1][0].sourceCardId).toBe('OLDER_CARD');
  });

  it('resolver returns the simultaneous group as-is so the engine can choose one trigger at a time', () => {
    const state = createInitialGameState({ p1Deck: [], p2Deck: [], leaderEnabled: false });
    state.turn.activePlayer = 'P1';

    state.triggerQueue.pendingGroups.push([
      {
        triggerId: 'A',
        sourceCardId: 'A_CARD',
        controller: 'P1',
        condition: { eventType: 'CARD_DESTROYED' },
        sourceEventType: 'CARD_DESTROYED',
        sourceEventIndex: 0,
        effectId: 'noop',
      },
      {
        triggerId: 'C',
        sourceCardId: 'C_CARD',
        controller: 'P2',
        condition: { eventType: 'CARD_DESTROYED' },
        sourceEventType: 'CARD_DESTROYED',
        sourceEventIndex: 0,
        effectId: 'noop',
      },
      {
        triggerId: 'B',
        sourceCardId: 'B_CARD',
        controller: 'P1',
        condition: { eventType: 'CARD_DESTROYED' },
        sourceEventType: 'CARD_DESTROYED',
        sourceEventIndex: 0,
        effectId: 'noop',
      },
      {
        triggerId: 'D',
        sourceCardId: 'D_CARD',
        controller: 'P2',
        condition: { eventType: 'CARD_DESTROYED' },
        sourceEventType: 'CARD_DESTROYED',
        sourceEventIndex: 0,
        effectId: 'noop',
      },
    ]);

    const group = resolveNextTriggerGroup(state);
    expect(group.map((item) => item.triggerId)).toEqual(['A', 'C', 'B', 'D']);
  });
});
