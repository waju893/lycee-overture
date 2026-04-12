import { describe, expect, it } from 'vitest';
import { executeEffectDefinitionInEngine } from '../GameEngine';
import { createInitialGameState, placeCharacterOnField } from '../GameRules';
import { SAMPLE_EFFECT_DSL_CATALOG } from '../effects/SampleEffectCatalog';
import type { CardRef, PlayerID } from '../GameTypes';

function makeCharacter(instanceId: string, owner: PlayerID, power = 2): CardRef {
  return {
    instanceId,
    cardNo: instanceId,
    name: instanceId,
    owner,
    cardType: 'character',
    sameNameKey: instanceId,
    ap: power,
    dp: power,
    dmg: 1,
    power,
    damage: 1,
    isTapped: false,
    canAttack: true,
    canBlock: true,
    revealed: false,
    location: 'field',
  };
}

describe('EffectDSLExtendedSteps', () => {
  it('mills the opponent deck top', () => {
    const state = createInitialGameState({
      p1Deck: [makeCharacter('P1_A', 'P1'), makeCharacter('P1_B', 'P1')],
      p2Deck: [makeCharacter('P2_A', 'P2'), makeCharacter('P2_B', 'P2'), makeCharacter('P2_C', 'P2')],
      leaderEnabled: false,
    });

    executeEffectDefinitionInEngine(state, SAMPLE_EFFECT_DSL_CATALOG.sample_mill_opponent_two, {
      controller: 'P1',
      opponent: 'P2',
      sourceCardId: 'SRC',
      sourceEffectId: 'sample_mill_opponent_two',
    });

    expect(state.players.P2.deck.length).toBe(1);
    expect(state.players.P2.discard.length).toBe(2);
  });

  it('taps and untaps a current legal target', () => {
    const state = createInitialGameState({ p1Deck: [], p2Deck: [], leaderEnabled: false });
    placeCharacterOnField(state, 'P2', 'DF_LEFT', makeCharacter('TARGET', 'P2'));

    executeEffectDefinitionInEngine(state, SAMPLE_EFFECT_DSL_CATALOG.sample_tap_opponent_character, {
      controller: 'P1',
      opponent: 'P2',
      sourceCardId: 'SRC',
      sourceEffectId: 'sample_tap_opponent_character',
    });
    expect(state.players.P2.field.DF_LEFT.card?.isTapped).toBe(true);

    executeEffectDefinitionInEngine(state, SAMPLE_EFFECT_DSL_CATALOG.sample_untap_opponent_character, {
      controller: 'P1',
      opponent: 'P2',
      sourceCardId: 'SRC',
      sourceEffectId: 'sample_untap_opponent_character',
    });
    expect(state.players.P2.field.DF_LEFT.card?.isTapped).toBe(false);
  });

  it('moves a target from field to hand', () => {
    const state = createInitialGameState({ p1Deck: [], p2Deck: [], leaderEnabled: false });
    placeCharacterOnField(state, 'P2', 'DF_LEFT', makeCharacter('TARGET_MOVE', 'P2'));

    executeEffectDefinitionInEngine(state, SAMPLE_EFFECT_DSL_CATALOG.sample_move_opponent_to_hand, {
      controller: 'P1',
      opponent: 'P2',
      sourceCardId: 'SRC',
      sourceEffectId: 'sample_move_opponent_to_hand',
    });

    expect(state.players.P2.field.DF_LEFT.card).toBeNull();
    expect(state.players.P2.hand.some((card) => card.instanceId === 'TARGET_MOVE')).toBe(true);
  });
});
