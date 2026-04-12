import { describe, expect, it } from 'vitest';
import { createInitialGameState } from '../GameRules';
import type { CardRef } from '../GameTypes';
import { enqueueTriggerCandidates } from '../triggers/TriggerQueue';

function makeCard(instanceId: string, owner: 'P1' | 'P2', effectId = 'noop'): CardRef {
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
        condition: { eventType: 'CARD_DESTROYED' },
        effectId,
      },
    ],
  };
}

describe('TriggerQueueOrder', () => {
  it('nested trigger groups are inserted before older pending groups while resolving', () => {
    const state = createInitialGameState({ p1Deck: [], p2Deck: [], leaderEnabled: false });
    state.players.P1.field.AF_LEFT.card = makeCard('A', 'P1');
    state.players.P2.field.AF_LEFT.card = makeCard('B', 'P2');

    state.triggerQueue.pendingGroups.push([
      {
        triggerId: 'older',
        sourceCardId: 'OLDER',
        controller: 'P2',
        condition: { eventType: 'CARD_DESTROYED' },
        sourceEventType: 'CARD_DESTROYED',
        sourceEventIndex: 0,
        effectId: 'noop',
      },
    ]);

    state.triggerQueue.isResolving = true;
    state.events.push({
      type: 'CARD_DESTROYED',
      playerId: 'P1',
      affectedPlayerId: 'P1',
      cardId: 'A',
      metadata: { destroyReason: 'effect' },
    });
    enqueueTriggerCandidates(state, state.events[state.events.length - 1]);

    expect(state.triggerQueue.pendingGroups.length).toBe(2);
    expect(state.triggerQueue.pendingGroups[0][0].sourceCardId).toBe('A');
  });
});
