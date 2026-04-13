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

describe('LO-6644 external card-layer binding', () => {
  beforeEach(() => {
    clearCardRegistry();
    registerRealCards();
  });

  it('taps one opponent character through CardBinding without patching GameEngine', () => {
    const state = createEmptyGameState();
    state.players.P1.field.AF_LEFT.card = makeFieldCharacter('P1_ATTACKER', 'P1', false);
    state.players.P2.field.DF_LEFT.card = makeFieldCharacter('P2_TARGET', 'P2', false);

    const next = executeBoundCardEffect(state, {
      cardId: 'LO-6644',
      effectId: 'LO-6644_tap_opponent_1',
      context: buildDefaultEffectExecutionContext({
        controller: 'P1',
        sourceCardId: 'LO-6644_INSTANCE',
      }),
      deps: {
        runStateNormalization: () => {},
        flushTriggers: () => {},
        executeStep: (innerState, step, context) => {
          if (step.type !== 'tap') {
            return;
          }

          const target = innerState.players.P2.field.DF_LEFT.card;
          if (!target) {
            throw new Error('Expected opponent target on field');
          }

          target.isTapped = true;
          innerState.logs.push(`[CARD LAYER] tap ${target.instanceId} by ${context.sourceCardId ?? 'unknown'}`);
        },
      },
    });

    expect(next.players.P2.field.DF_LEFT.card?.isTapped).toBe(true);
  });
});
