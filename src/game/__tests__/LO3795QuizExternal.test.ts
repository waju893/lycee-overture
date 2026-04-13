import { beforeEach, describe, expect, it } from 'vitest';
import { clearCardRegistry } from '../cards/CardRegistry';
import { registerRealCards } from '../cards/RealCardRegistration';
import { createEmptyGameState } from '../GameEngine';
import type { CardRef } from '../GameTypes';
import { createCardScriptSnapshot, getTopDeckCardForPlayer } from '../cards/sandbox/CardScriptSnapshot';
import { isEvenCostCard } from '../cards/sandbox/CardScriptParity';
import {
  createEmptyCardScriptUsageTracker,
  hasCardScriptUsage,
  markCardScriptUsage,
} from '../cards/sandbox/CardScriptUsageTracker';

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

function revealAndResolveQuizDraw(state: ReturnType<typeof createEmptyGameState>): number {
  const snapshot = createCardScriptSnapshot(state);
  const topCard = getTopDeckCardForPlayer(snapshot, 'P1');

  if (!isEvenCostCard(topCard)) {
    return 0;
  }

  let drawn = 0;
  for (let i = 0; i < 2; i += 1) {
    const card = state.players.P1.deck.shift();
    if (!card) break;
    card.location = 'hand';
    state.players.P1.hand.push(card);
    drawn += 1;
  }

  return drawn;
}

describe('LO-3795 external sandbox flow', () => {
  beforeEach(() => {
    clearCardRegistry();
    registerRealCards();
  });

  it('reveals top deck card and draws 2 when its cost is even', () => {
    const state = createEmptyGameState();
    state.turn.turnNumber = 3;
    state.players.P1.deck = [
      makeDeckCard('QUIZ_TOP', 'P1', 2),
      makeDeckCard('DRAW_1', 'P1', 1),
      makeDeckCard('DRAW_2', 'P1', 3),
      makeDeckCard('REST', 'P1', 5),
    ];
    state.players.P1.hand = [];

    const drawn = revealAndResolveQuizDraw(state);

    expect(drawn).toBe(2);
    expect(state.players.P1.hand).toHaveLength(2);
    expect(state.players.P1.hand[0]?.instanceId).toBe('QUIZ_TOP');
    expect(state.players.P1.hand[1]?.instanceId).toBe('DRAW_1');
  });

  it('tracks once-per-turn usage metadata independently from GameEngine', () => {
    const tracker0 = createEmptyCardScriptUsageTracker();
    const key = {
      playerId: 'P1' as const,
      cardId: 'LO-3795',
      effectId: 'LO-3795_quiz',
      turnNumber: 4,
    };

    expect(hasCardScriptUsage(tracker0, key)).toBe(false);

    const tracker1 = markCardScriptUsage(tracker0, key);

    expect(hasCardScriptUsage(tracker1, key)).toBe(true);
  });
});
