import { describe, expect, it } from 'vitest';
import { createEmptyGameState } from '../GameEngine';
import type { CardRef } from '../GameTypes';
import { createCardScriptSnapshot, getTopDeckCardForPlayer } from '../cards/sandbox/CardScriptSnapshot';
import { createRevealTopCardIntent } from '../cards/sandbox/CardScriptIntent';

function makeDeckCard(instanceId: string, owner: 'P1' | 'P2', cost: number): CardRef {
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

describe('RevealTopCard external sandbox helper', () => {
  it('reads top deck card and builds reveal intent without patching GameEngine', () => {
    const state = createEmptyGameState();
    state.players.P1.deck = [
      makeDeckCard('TOP_1', 'P1', 2),
      makeDeckCard('TOP_2', 'P1', 3),
    ];

    const snapshot = createCardScriptSnapshot(state);
    const topCard = getTopDeckCardForPlayer(snapshot, 'P1');
    const intent = createRevealTopCardIntent({
      playerId: 'P1',
      sourceCardId: 'LO-3795_INSTANCE',
      sourceEffectId: 'LO-3795_quiz',
    });

    expect(topCard?.instanceId).toBe('TOP_1');
    expect(topCard?.cost).toBe(2);
    expect(intent.kind).toBe('revealTopCard');
    expect(intent.playerId).toBe('P1');
    expect(intent.count).toBe(1);
  });
});
