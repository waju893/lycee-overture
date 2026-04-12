import { describe, expect, it } from 'vitest';
import { createInitialGameState, placeCharacterOnField } from '../GameRules';
import { executeEffectDefinitionInEngine, applyEffectDestroyToFieldCard } from '../GameEngine';
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

describe('EffectDSLTargetTiming', () => {
  it('declareTime keeps the originally chosen target and does not retarget if it disappeared', () => {
    const state = createInitialGameState({ p1Deck: [], p2Deck: [], leaderEnabled: false });

    placeCharacterOnField(state, 'P2', 'DF_LEFT', makeCharacter('DECLARED_TARGET', 'P2'));
    placeCharacterOnField(state, 'P2', 'DF_CENTER', makeCharacter('OTHER_TARGET', 'P2'));

    const afterRemoval = applyEffectDestroyToFieldCard(state, {
      affectedPlayerId: 'P2',
      cardId: 'DECLARED_TARGET',
      sourcePlayerId: 'P1',
      sourceCardId: 'SRC',
      sourceEffectId: 'pre_remove',
    });

    executeEffectDefinitionInEngine(
      afterRemoval,
      SAMPLE_EFFECT_DSL_CATALOG.sample_destroy_declared_target,
      {
        controller: 'P1',
        opponent: 'P2',
        sourceCardId: 'SRC',
        sourceEffectId: 'sample_destroy_declared_target',
        declaredTargetCardIds: ['DECLARED_TARGET'],
      },
    );

    expect(afterRemoval.players.P2.field.DF_CENTER.card?.instanceId).toBe('OTHER_TARGET');
    expect(afterRemoval.logs.some((log) => log.includes('declared target missing'))).toBe(true);
  });

  it('resolutionTime chooses a current legal target at resolution', () => {
    const state = createInitialGameState({ p1Deck: [], p2Deck: [], leaderEnabled: false });

    placeCharacterOnField(state, 'P2', 'DF_LEFT', makeCharacter('TARGET_A', 'P2'));
    placeCharacterOnField(state, 'P2', 'DF_CENTER', makeCharacter('TARGET_B', 'P2'));

    const afterRemoval = applyEffectDestroyToFieldCard(state, {
      affectedPlayerId: 'P2',
      cardId: 'TARGET_A',
      sourcePlayerId: 'P1',
      sourceCardId: 'SRC',
      sourceEffectId: 'pre_remove',
    });

    executeEffectDefinitionInEngine(
      afterRemoval,
      SAMPLE_EFFECT_DSL_CATALOG.sample_destroy_resolution_target,
      {
        controller: 'P1',
        opponent: 'P2',
        sourceCardId: 'SRC',
        sourceEffectId: 'sample_destroy_resolution_target',
      },
    );

    expect(afterRemoval.players.P2.field.DF_CENTER.card).toBeNull();
    expect(afterRemoval.players.P2.discard.some((card) => card.instanceId === 'TARGET_B')).toBe(true);
  });
});
