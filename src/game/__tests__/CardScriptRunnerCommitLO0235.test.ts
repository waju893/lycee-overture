import { beforeEach, describe, expect, it } from 'vitest';
import type { CardRef } from '../GameTypes';
import { createEmptyGameState } from '../GameEngine';
import { clearCardRegistry } from '../cards/CardRegistry';
import { registerRealCards } from '../cards/RealCardRegistration';
import { requireCardDefinition } from '../cards/CardEffectResolver';
import { runCardDefinitionInSandbox } from '../cards/sandbox/CardScriptRunner';
import { commitCardScriptIntents } from '../cards/sandbox/CardScriptCommit';

function makeDeckCard(instanceId: string, owner: 'P1' | 'P2', cost = 0): CardRef {
  return {
    instanceId,
    cardNo: instanceId,
    name: instanceId,
    owner,
    cardType: 'event',
    location: 'deck',
    revealed: false,
    cost,
    ap: 0,
    dp: 0,
    sp: 0,
    dmg: 0,
  } as CardRef;
}

describe('CardScriptRunner + CardScriptCommit / LO-0235', () => {
  beforeEach(() => {
    clearCardRegistry();
    registerRealCards();
  });

  it('runs LO-0235 through runner and commit, drawing 2 cards', () => {
    const state = createEmptyGameState();

    state.players.P1.deck = [
      makeDeckCard('P1_D1', 'P1'),
      makeDeckCard('P1_D2', 'P1'),
      makeDeckCard('P1_D3', 'P1'),
    ];
    state.players.P1.hand = [];

    const card = requireCardDefinition('LO-0235');

    const runResult = runCardDefinitionInSandbox({
      state,
      card,
      controller: 'P1',
      effectId: 'LO-0235_draw_2',
      sourceCardId: 'LO-0235_INSTANCE',
    });

    expect(runResult.intents).toEqual([
      {
        kind: 'draw',
        playerId: 'P1',
        count: 2,
        sourceCardId: 'LO-0235_INSTANCE',
        sourceEffectId: 'LO-0235_draw_2',
      },
    ]);

    const commitResult = commitCardScriptIntents(state, runResult.intents);

    expect(commitResult.appliedIntents).toHaveLength(1);
    expect(commitResult.skippedIntents).toHaveLength(0);

    expect(commitResult.state.players.P1.hand).toHaveLength(2);
    expect(commitResult.state.players.P1.hand[0]?.instanceId).toBe('P1_D1');
    expect(commitResult.state.players.P1.hand[1]?.instanceId).toBe('P1_D2');

    expect(commitResult.state.players.P1.deck).toHaveLength(1);
    expect(commitResult.state.players.P1.deck[0]?.instanceId).toBe('P1_D3');
  });
});
