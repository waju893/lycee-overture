import { describe, expect, it } from 'vitest';
import { enqueueTriggerCandidates } from '../triggers/TriggerQueue';
import type { CardRef, EngineEvent, GameState, TriggerTemplate } from '../GameTypes';
import { createInitialGameState, placeCharacterOnField } from '../GameRules';

function makeCharacter(instanceId: string, owner: 'P1' | 'P2', triggerTemplates?: TriggerTemplate[]): CardRef {
  return {
    instanceId,
    cardNo: instanceId,
    name: instanceId,
    owner,
    cardType: 'character',
    sameNameKey: instanceId,
    isTapped: false,
    triggerTemplates,
  };
}

describe('TriggerQueue integration', () => {
  it('상대의 능력으로 파기되면 트리거 후보를 쌓는다', () => {
    const state: GameState = createInitialGameState({ p1Deck: [], p2Deck: [], leaderEnabled: false });
    state.startup.active = false;
    state.startup.startupFinished = true;

    const triggerOwner = makeCharacter('P1_TRIGGER', 'P1', [
      {
        id: 'draw-on-opponent-ability-destroy',
        description: '상대의 능력으로 파기되었을 때',
        condition: {
          eventType: 'CARD_LEFT_FIELD',
          cause: {
            relationToAffectedPlayer: 'opponent',
            causeKind: 'ability',
            sourceOwnerKind: 'character',
            requireAbility: true,
          },
        },
      },
    ]);

    placeCharacterOnField(state, 'P1', 'AF_LEFT', triggerOwner);

    const event: EngineEvent = {
      type: 'CARD_LEFT_FIELD',
      playerId: 'P1',
      cardId: 'P1_TRIGGER',
      cause: {
        controller: 'P2',
        relationToAffectedPlayer: 'opponent',
        causeKind: 'ability',
        sourceOwnerKind: 'character',
        isEffect: true,
        isAbility: true,
        sourceCardId: 'P2_ATTACKER',
      },
      operation: {
        kind: 'leaveField',
        cardId: 'P1_TRIGGER',
        playerId: 'P1',
        fromZone: 'field',
        toZone: 'discard',
      },
    };

    enqueueTriggerCandidates(state, event);

    expect(state.triggerQueue.pendingGroups).toHaveLength(1);
    expect(state.triggerQueue.pendingGroups[0]).toHaveLength(1);
    expect(state.triggerQueue.pendingGroups[0][0].triggerId).toBe('draw-on-opponent-ability-destroy');
  });
});
