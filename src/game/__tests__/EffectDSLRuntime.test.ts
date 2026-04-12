import { describe, it, expect } from 'vitest';
import { createInitialGameState } from '../GameRules';
import { executeEffectDSLDefinition } from '../effects/EffectExecutor';
import type { EffectDSLDefinition } from '../effects/EffectDSL';

describe('EffectDSLRuntime A structure', () => {

  it('runs step -> normalize -> trigger order', () => {
    const state = createInitialGameState({ p1Deck: [], p2Deck: [], leaderEnabled: false });

    const order: string[] = [];

    const definition: EffectDSLDefinition = {
      id: 'a_structure_test',
      steps: [
        { type: 'draw', player: 'self', count: 1 },
        { type: 'destroy', target: 'opponent_character', count: 1, targetTiming: 'resolutionTime' }
      ]
    };

    executeEffectDSLDefinition(
      state,
      definition,
      { controller: 'P1', opponent: 'P2' },
      {
        executeStep: (_s, step) => order.push('step:' + step.type),
        runStateNormalization: () => order.push('normalize'),
        flushTriggers: () => order.push('flush')
      }
    );

    expect(order).toEqual([
      'step:draw',
      'normalize',
      'flush',
      'step:destroy',
      'normalize',
      'flush'
    ]);
  });

  it('does not allow B structure', () => {
    const state = createInitialGameState({ p1Deck: [], p2Deck: [], leaderEnabled: false });

    const order: string[] = [];

    const definition: EffectDSLDefinition = {
      id: 'b_structure_test',
      steps: [
        { type: 'log', message: 'first' },
        { type: 'log', message: 'second' }
      ]
    };

    executeEffectDSLDefinition(
      state,
      definition,
      { controller: 'P1', opponent: 'P2' },
      {
        executeStep: (_s, step) => {
          if (step.type === 'log') order.push(step.message);
        },
        runStateNormalization: () => order.push('normalize'),
        flushTriggers: () => order.push('flush')
      }
    );

    expect(order).toEqual([
      'first',
      'normalize',
      'flush',
      'second',
      'normalize',
      'flush'
    ]);
  });

});
