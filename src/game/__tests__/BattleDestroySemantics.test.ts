import { describe, expect, it } from 'vitest';
import { reduceGameState } from '../GameEngine';
import { createInitialGameState } from '../GameRules';
import type { CardRef, GameState, PlayerID } from '../GameTypes';

function makeCharacter(
  instanceId: string,
  owner: PlayerID,
  name: string,
  power = 3,
): CardRef {
  return {
    instanceId,
    cardNo: instanceId,
    name,
    owner,
    cardType: 'character',
    sameNameKey: instanceId,
    ap: power,
    dp: power,
    dmg: power,
    power,
    damage: power,
    isTapped: false,
    canAttack: true,
    canBlock: true,
    revealed: false,
    location: 'deck',
  };
}

function makeDeck(owner: PlayerID, prefix: string): CardRef[] {
  const deck: CardRef[] = [];
  while (deck.length < 60) {
    const i = deck.length + 1;
    deck.push(makeCharacter(`${prefix}_${String(i).padStart(3, '0')}`, owner, `${prefix}_CHAR_${i}`, 2 + (i % 3)));
  }
  return deck;
}

function buildReadyToMainState(firstPlayer: PlayerID = 'P1'): GameState {
  const state0 = createInitialGameState({ p1Deck: makeDeck('P1', 'P1'), p2Deck: makeDeck('P2', 'P2'), leaderEnabled: false });
  const state1 = reduceGameState(state0, { type: 'START_GAME', firstPlayer, leaderEnabled: false });
  const state2 = reduceGameState(state1, { type: 'KEEP_STARTING_HAND', playerId: 'P1' });
  const state3 = reduceGameState(state2, { type: 'KEEP_STARTING_HAND', playerId: 'P2' });
  const state4 = reduceGameState(state3, { type: 'FINALIZE_STARTUP' });
  const state5 = reduceGameState(state4, { type: 'START_TURN' });
  const state6 = reduceGameState(state5, { type: 'ADVANCE_PHASE' });
  return state6;
}

function resolveLatestDeclarationByDoublePass(state: GameState): GameState {
  const state1 = reduceGameState(state, { type: 'PASS_PRIORITY', playerId: state.turn.priorityPlayer });
  const state2 = reduceGameState(state1, { type: 'PASS_PRIORITY', playerId: state1.turn.priorityPlayer });
  return state2;
}

describe('BattleDestroySemantics', () => {
  it('battle destroy emits down + destroy + left field and moves defender to discard', () => {
    let state = buildReadyToMainState('P1');

    const attacker = makeCharacter('ATTACKER', 'P1', 'ATTACKER', 5);
    const defender = makeCharacter('DEFENDER', 'P2', 'DEFENDER', 2);

    state.players.P1.hand.unshift({ ...attacker, location: 'hand' });
    state.players.P2.hand.unshift({ ...defender, location: 'hand' });

    state = reduceGameState(state, {
      type: 'DECLARE_ACTION',
      playerId: 'P1',
      kind: 'useCharacter',
      sourceCardId: 'ATTACKER',
      targetSlots: ['AF_LEFT'],
      targetingMode: 'declareTime',
    });
    state = resolveLatestDeclarationByDoublePass(state);

    state.turn.priorityPlayer = 'P2';
    state.turn.activePlayer = 'P2';

    state = reduceGameState(state, {
      type: 'DECLARE_ACTION',
      playerId: 'P2',
      kind: 'useCharacter',
      sourceCardId: 'DEFENDER',
      targetSlots: ['DF_LEFT'],
      targetingMode: 'declareTime',
    });
    state = resolveLatestDeclarationByDoublePass(state);

    state.turn.priorityPlayer = 'P1';
    state.turn.activePlayer = 'P1';

    state = reduceGameState(state, {
      type: 'DECLARE_ACTION',
      playerId: 'P1',
      kind: 'attack',
      sourceCardId: 'ATTACKER',
    });

    state = reduceGameState(state, { type: 'PASS_PRIORITY', playerId: state.battle.priorityPlayer ?? 'P2' });
    state = reduceGameState(state, { type: 'PASS_PRIORITY', playerId: state.battle.priorityPlayer ?? 'P1' });

    state = reduceGameState(state, { type: 'SET_DEFENDER', playerId: 'P2', defenderCardId: 'DEFENDER' });

    state = reduceGameState(state, { type: 'PASS_PRIORITY', playerId: state.battle.priorityPlayer ?? 'P1' });
    state = reduceGameState(state, { type: 'PASS_PRIORITY', playerId: state.battle.priorityPlayer ?? 'P2' });

    expect(state.players.P2.field.DF_LEFT.card).toBeNull();
    expect(state.players.P2.discard.some((card) => card.instanceId === 'DEFENDER')).toBe(true);

    const downed = state.events.filter((event) => event.type === 'CARD_DOWNED' && event.cardId === 'DEFENDER');
    const destroyed = state.events.filter((event) => event.type === 'CARD_DESTROYED' && event.cardId === 'DEFENDER');
    const leftField = state.events.filter((event) => event.type === 'CARD_LEFT_FIELD' && event.cardId === 'DEFENDER');

    expect(downed.length).toBeGreaterThan(0);
    expect(destroyed.length).toBeGreaterThan(0);
    expect(leftField.length).toBeGreaterThan(0);
    expect(String(destroyed[0]?.metadata?.destroyReason ?? '')).toBe('battle');
  });
});
