import { describe, expect, it } from 'vitest';
import type { CardRef } from '../GameTypes';
import { createEmptyGameState } from '../GameEngine';
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

describe('CardScriptCommit', () => {
  it('commits draw, tap, untap, revealTopCard, and log intents', () => {
    const state = createEmptyGameState();
    state.players.P1.deck = [
      makeDeckCard('TOP_1', 'P1', 2),
      makeDeckCard('TOP_2', 'P1', 3),
    ];
    state.players.P1.hand = [];
    state.players.P1.field.AF_LEFT.card = makeFieldCharacter('ALLY_1', 'P1', true);
    state.players.P2.field.DF_LEFT.card = makeFieldCharacter('ENEMY_1', 'P2', false);

    const result = commitCardScriptIntents(state, [
      { kind: 'revealTopCard', playerId: 'P1', count: 1, sourceCardId: 'LO-3795' },
      { kind: 'draw', playerId: 'P1', count: 1, sourceCardId: 'LO-0235' },
      { kind: 'tap', playerId: 'P2', cardId: 'ENEMY_1', sourceCardId: 'LO-6644' },
      { kind: 'untap', playerId: 'P1', cardId: 'ALLY_1', sourceCardId: 'LO-0094' },
      { kind: 'log', message: 'commit complete', sourceCardId: 'TEST' },
    ]);

    expect(result.appliedIntents).toHaveLength(5);
    expect(result.skippedIntents).toHaveLength(0);

    expect(result.state.players.P1.hand).toHaveLength(1);
    expect(result.state.players.P1.hand[0]?.instanceId).toBe('TOP_1');
    expect(result.state.players.P1.deck).toHaveLength(1);
    expect(result.state.players.P1.deck[0]?.instanceId).toBe('TOP_2');

    expect(result.state.players.P2.field.DF_LEFT.card?.isTapped).toBe(true);
    expect(result.state.players.P1.field.AF_LEFT.card?.isTapped).toBe(false);

    expect(result.state.logs.some((line) => line.includes('reveal top P1: TOP_1'))).toBe(true);
    expect(result.state.logs.some((line) => line.includes('draw 1 for P1'))).toBe(true);
    expect(result.state.logs.some((line) => line.includes('tap ENEMY_1'))).toBe(true);
    expect(result.state.logs.some((line) => line.includes('untap ALLY_1'))).toBe(true);
    expect(result.state.logs.some((line) => line.includes('commit complete'))).toBe(true);
  });

  it('skips intents that cannot be committed safely', () => {
    const state = createEmptyGameState();

    const result = commitCardScriptIntents(state, [
      { kind: 'revealTopCard', playerId: 'P1', count: 1 },
      { kind: 'tap', playerId: 'P2', cardId: 'MISSING' },
      { kind: 'untap', playerId: 'P1', cardId: 'MISSING' },
      { kind: 'draw', playerId: 'P1', count: 1 },
    ]);

    expect(result.appliedIntents).toHaveLength(0);
    expect(result.skippedIntents).toHaveLength(4);
  });
});
