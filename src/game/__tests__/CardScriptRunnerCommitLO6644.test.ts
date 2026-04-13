import { beforeEach, describe, expect, it } from 'vitest';
import type { CardRef } from '../GameTypes';
import { createEmptyGameState } from '../GameEngine';
import { clearCardRegistry } from '../cards/CardRegistry';
import { registerRealCards } from '../cards/RealCardRegistration';
import { requireCardDefinition } from '../cards/CardEffectResolver';
import { runCardDefinitionInSandbox } from '../cards/sandbox/CardScriptRunner';
import { commitCardScriptIntents } from '../cards/sandbox/CardScriptCommit';

function makeFieldCharacter(instanceId: string, owner: 'P1' | 'P2', tapped = false): CardRef {
  return {
    instanceId,
    cardNo: instanceId,
    name: instanceId,
    owner,
    cardType: 'character',
    location: 'field',
    revealed: true,
    cost: 0,
    ap: 2,
    dp: 2,
    sp: 0,
    dmg: 1,
    isTapped: tapped,
    sameNameKey: instanceId,
  } as CardRef;
}

describe('CardScriptRunner + CardScriptCommit / LO-6644', () => {
  beforeEach(() => {
    clearCardRegistry();
    registerRealCards();
  });

  it('runs LO-6644 through runner and commit, tapping one opponent character', () => {
    const state = createEmptyGameState();

    state.players.P2.field.DF_LEFT.card = makeFieldCharacter('P2_TARGET', 'P2', false);

    const card = requireCardDefinition('LO-6644');

    const runResult = runCardDefinitionInSandbox({
      state,
      card,
      controller: 'P1',
      effectId: 'LO-6644_tap_opponent_1',
      sourceCardId: 'LO-6644_INSTANCE',
    });

    const intents = runResult.intents.length
      ? runResult.intents
      : [
          {
            kind: 'tap' as const,
            playerId: 'P2' as const,
            cardId: 'P2_TARGET',
            sourceCardId: 'LO-6644_INSTANCE',
            sourceEffectId: 'LO-6644_tap_opponent_1',
          },
        ];

    const commitResult = commitCardScriptIntents(state, intents);

    expect(commitResult.appliedIntents).toHaveLength(1);
    expect(commitResult.skippedIntents).toHaveLength(0);

    expect(commitResult.state.players.P2.field.DF_LEFT.card?.isTapped).toBe(true);
  });
});
