import { describe, expect, it } from 'vitest';
import { createInitialGameState, placeCharacterOnField } from '../GameRules';
import { executeEffectDefinitionInEngine } from '../GameEngine';
import { SAMPLE_EFFECT_DSL_CATALOG } from '../effects/SampleEffectCatalog';
import { compileEffectDSL, validateEffectDSL } from '../effects/EffectDSLCompiler';
import type { CardRef, PlayerID } from '../GameTypes';

function makeCharacter(instanceId: string, owner: PlayerID, tapped = false): CardRef {
  return {
    instanceId,
    cardNo: instanceId,
    name: instanceId,
    owner,
    cardType: 'character',
    sameNameKey: instanceId,
    ap: 2,
    dp: 2,
    dmg: 1,
    power: 2,
    damage: 1,
    isTapped: tapped,
    canAttack: true,
    canBlock: true,
    revealed: false,
    location: 'field',
  };
}

describe('EffectDSLTargetSystemExtended', () => {
  it('allows optional target steps to resolve with no legal target', () => {
    const state = createInitialGameState({ p1Deck: [], p2Deck: [], leaderEnabled: false });

    executeEffectDefinitionInEngine(
      state,
      SAMPLE_EFFECT_DSL_CATALOG.sample_optional_destroy_opponent,
      {
        controller: 'P1',
        opponent: 'P2',
        sourceCardId: 'SRC',
        sourceEffectId: 'sample_optional_destroy_opponent',
      },
    );

    expect(state.logs.some((line) => line.includes('optional target missing'))).toBe(true);
    expect(state.players.P2.discard.length).toBe(0);
  });

  it('supports multi target destroy up to count', () => {
    const state = createInitialGameState({ p1Deck: [], p2Deck: [], leaderEnabled: false });
    placeCharacterOnField(state, 'P2', 'DF_LEFT', makeCharacter('TARGET_1', 'P2'));
    placeCharacterOnField(state, 'P2', 'DF_CENTER', makeCharacter('TARGET_2', 'P2'));
    placeCharacterOnField(state, 'P2', 'DF_RIGHT', makeCharacter('TARGET_3', 'P2'));

    executeEffectDefinitionInEngine(
      state,
      SAMPLE_EFFECT_DSL_CATALOG.sample_multi_destroy_two_opponents,
      {
        controller: 'P1',
        opponent: 'P2',
        sourceCardId: 'SRC',
        sourceEffectId: 'sample_multi_destroy_two_opponents',
      },
    );

    expect(state.players.P2.discard.some((card) => card.instanceId === 'TARGET_1')).toBe(true);
    expect(state.players.P2.discard.some((card) => card.instanceId === 'TARGET_2')).toBe(true);
    expect(state.players.P2.field.DF_RIGHT.card?.instanceId).toBe('TARGET_3');
  });

  it('applies target filter before selecting a target', () => {
    const state = createInitialGameState({ p1Deck: [], p2Deck: [], leaderEnabled: false });
    placeCharacterOnField(state, 'P2', 'DF_LEFT', makeCharacter('TAPPED_TARGET', 'P2', true));
    placeCharacterOnField(state, 'P2', 'DF_CENTER', makeCharacter('UNTAPPED_TARGET', 'P2', false));

    executeEffectDefinitionInEngine(
      state,
      SAMPLE_EFFECT_DSL_CATALOG.sample_filter_untapped_tap,
      {
        controller: 'P1',
        opponent: 'P2',
        sourceCardId: 'SRC',
        sourceEffectId: 'sample_filter_untapped_tap',
      },
    );

    expect(state.players.P2.field.DF_LEFT.card?.isTapped).toBe(true);
    expect(state.players.P2.field.DF_CENTER.card?.isTapped).toBe(true);
    expect(state.logs.some((line) => line.includes('tap UNTAPPED_TARGET'))).toBe(true);
  });

  it('validates multi target configuration', () => {
    const result = validateEffectDSL({
      id: 'bad_multi_target',
      steps: [
        {
          type: 'destroy',
          target: 'opponent_character',
          count: 1,
          targetTiming: 'resolutionTime',
          multiTarget: true,
        },
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.errors.some((error) => error.includes('multiTarget'))).toBe(true);
  });

  it('compiles optional and filtered target steps', () => {
    const compiled = compileEffectDSL(SAMPLE_EFFECT_DSL_CATALOG.sample_filter_untapped_tap);
    expect(compiled.normalizedSteps[0].type).toBe('tap');
    expect((compiled.normalizedSteps[0] as any).filter).toBe('untapped');
  });
});
