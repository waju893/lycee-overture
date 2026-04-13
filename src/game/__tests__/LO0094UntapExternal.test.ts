import { beforeEach, describe, expect, it } from 'vitest';
import { clearCardRegistry } from '../cards/CardRegistry';
import { registerRealCards } from '../cards/RealCardRegistration';
import { executeBoundCardEffect, buildDefaultEffectExecutionContext } from '../cards/CardBinding';
import { createEmptyGameState } from '../GameEngine';
import type { CardRef } from '../GameTypes';

function makeFieldCharacter(instanceId: string, owner: 'P1' | 'P2', tapped = false): CardRef {
  return {
    instanceId,
    cardNo: instanceId,
    name: instanceId,
    owner,
    cardType: 'character',
    revealed: true,
    location: 'field',
    cost: 0,
    ap: 2,
    dp: 2,
    sp: 0,
    dmg: 1,
    isTapped: tapped,
    sameNameKey: instanceId,
  } as CardRef;
}

describe('LO-0094 external card-layer binding', () => {
  beforeEach(() => {
    clearCardRegistry();
    registerRealCards();
  });

  it('untaps two ally characters through CardBinding without patching GameEngine', () => {
    const state = createEmptyGameState();
    state.players.P1.field.AF_LEFT.card = makeFieldCharacter('P1_A', 'P1', true);
    state.players.P1.field.AF_CENTER.card = makeFieldCharacter('P1_B', 'P1', true);
    state.players.P1.field.AF_RIGHT.card = makeFieldCharacter('P1_C', 'P1', false);

    const next = executeBoundCardEffect(state, {
      cardId: 'LO-0094',
      effectId: 'LO-0094_untap_self_2',
      context: buildDefaultEffectExecutionContext({
        controller: 'P1',
        sourceCardId: 'LO-0094_INSTANCE',
      }),
      deps: {
        runStateNormalization: () => {},
        flushTriggers: () => {},
        executeStep: (innerState, step) => {
          if (step.type !== 'untap') {
            return;
          }

          const candidates = [
            innerState.players.P1.field.AF_LEFT.card,
            innerState.players.P1.field.AF_CENTER.card,
            innerState.players.P1.field.AF_RIGHT.card,
          ].filter((card): card is CardRef => Boolean(card));

          let untapped = 0;
          for (const card of candidates) {
            if (card.isTapped && untapped < 2) {
              card.isTapped = false;
              untapped += 1;
            }
          }

          innerState.logs.push(`[CARD LAYER] untap ${untapped}`);
        },
      },
    });

    expect(next.players.P1.field.AF_LEFT.card?.isTapped).toBe(false);
    expect(next.players.P1.field.AF_CENTER.card?.isTapped).toBe(false);
    expect(next.players.P1.field.AF_RIGHT.card?.isTapped).toBe(false);
  });
});
