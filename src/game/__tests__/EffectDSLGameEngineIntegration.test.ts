import { describe, expect, it } from 'vitest';
import { reduceGameState } from '../GameEngine';
import { createInitialGameState } from '../GameRules';
import type { CardRef, GameState, PlayerID, TriggerTemplate } from '../GameTypes';

function makeCharacter(
  instanceId: string,
  owner: PlayerID,
  name: string,
  power = 3,
  triggerTemplates?: TriggerTemplate[],
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
    triggerTemplates,
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

describe('EffectDSLGameEngineIntegration', () => {
  it('runs sample DSL effect through GameEngine and destroys opponent character', () => {
    let state = buildReadyToMainState('P1');

    const triggerSource = makeCharacter(
      'TRIGGER_SOURCE',
      'P1',
      'TRIGGER_SOURCE',
      3,
      [{ id: 'TRIGGER_SOURCE_ENTER', condition: { eventType: 'CARD_ENTERED_FIELD' }, effectId: 'sample_draw_then_destroy' }],
    );
    const summoner = makeCharacter('SUMMONER', 'P1', 'SUMMONER', 2);
    const victim = makeCharacter('VICTIM', 'P2', 'VICTIM', 2);

    state.players.P1.field.AF_LEFT.card = { ...triggerSource, location: 'field' };
    state.players.P1.hand.unshift({ ...summoner, location: 'hand' });
    state.players.P2.field.DF_LEFT.card = { ...victim, location: 'field' };

    const handBefore = state.players.P1.hand.length;
    const deckBefore = state.players.P1.deck.length;

    state = reduceGameState(state, {
      type: 'DECLARE_ACTION',
      playerId: 'P1',
      kind: 'useCharacter',
      sourceCardId: 'SUMMONER',
      targetSlots: ['AF_CENTER'],
      targetingMode: 'declareTime',
    });
    state = resolveLatestDeclarationByDoublePass(state);

    expect(state.players.P2.field.DF_LEFT.card).toBeNull();
    expect(state.players.P2.discard.some((card) => card.instanceId === 'VICTIM')).toBe(true);
    expect(state.players.P1.hand.length).toBe(handBefore); // summon -1, draw +1
    expect(state.players.P1.deck.length).toBe(deckBefore - 1);

    const destroyed = state.events.filter((event) => event.type === 'CARD_DESTROYED' && event.cardId === 'VICTIM');
    expect(destroyed.length).toBeGreaterThan(0);
    expect(String(destroyed[0]?.metadata?.destroyReason ?? '')).toBe('effect');
  });
});
