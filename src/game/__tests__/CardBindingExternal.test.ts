import { beforeEach, describe, expect, it } from 'vitest';
import { clearCardRegistry } from '../cards/CardRegistry';
import { registerRealCards } from '../cards/RealCardRegistration';
import { executeBoundCardEffect, buildDefaultEffectExecutionContext } from '../cards/CardBinding';
import { createEmptyGameState } from '../GameEngine';
import type { CardRef, GameState } from '../GameTypes';

function makeDeckCard(instanceId: string, owner: 'P1' | 'P2'): CardRef {
  return {
    instanceId,
    cardNo: instanceId,
    name: instanceId,
    owner,
    cardType: 'event',
    revealed: false,
    location: 'deck',
    cost: 0,
    ap: 0,
    dp: 0,
    sp: 0,
    dmg: 0,
  } as CardRef;
}

function executeCardLayerStep(state: GameState, step: any, context: any): void {
  switch (step.type) {
    case 'draw': {
      const targetPlayer = step.player === 'self' ? context.controller : context.opponent;
      for (let i = 0; i < step.count; i += 1) {
        const card = state.players[targetPlayer].deck.shift();
        if (!card) break;
        card.location = 'hand';
        state.players[targetPlayer].hand.push(card);
      }
      return;
    }
    case 'log':
      state.logs.push(`[CARD LAYER] ${step.message}`);
      return;
    default:
      state.logs.push(`[CARD LAYER] unsupported ${step.type}`);
  }
}

describe('CardBinding external card-layer execution', () => {
  beforeEach(() => {
    clearCardRegistry();
    registerRealCards();
  });

  it('executes LO-0235 through CardBinding without patching GameEngine', () => {
    const state = createEmptyGameState();
    state.players.P1.deck = [
      makeDeckCard('P1_D1', 'P1'),
      makeDeckCard('P1_D2', 'P1'),
      makeDeckCard('P1_D3', 'P1'),
    ];
    state.players.P1.hand = [];
    state.players.P2.deck = [];
    state.players.P2.hand = [];

    const next = executeBoundCardEffect(state, {
      cardId: 'LO-0235',
      effectId: 'LO-0235_draw_2',
      context: buildDefaultEffectExecutionContext({
        controller: 'P1',
        sourceCardId: 'LO-0235_INSTANCE',
        sourceEffectId: 'LO-0235_draw_2',
      }),
      deps: {
        runStateNormalization: () => {},
        flushTriggers: () => {},
        executeStep: executeCardLayerStep,
      },
    });

    expect(next.players.P1.hand).toHaveLength(2);
    expect(next.players.P1.hand[0]?.instanceId).toBe('P1_D1');
    expect(next.players.P1.hand[1]?.instanceId).toBe('P1_D2');
    expect(next.players.P1.deck).toHaveLength(1);
    expect(next.players.P1.deck[0]?.instanceId).toBe('P1_D3');
  });
});
