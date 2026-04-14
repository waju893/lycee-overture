import { describe, expect, it } from 'vitest';
import { createEmptyGameState } from '../GameEngine';
import type { CardRef } from '../GameTypes';
import type { RunnerIntent } from '../cards/CardScriptRunner';
import {
  buildPromptCommitPlan,
  commitRunnerIntentsWithPrompts,
  resolvePromptAndCommit,
} from '../cards/sandbox/CardScriptPromptCommitPipeline';

function makeDeckCard(instanceId: string, owner: 'P1' | 'P2'): CardRef {
  return {
    instanceId,
    cardNo: instanceId,
    name: instanceId,
    owner,
    cardType: 'event',
    location: 'deck',
    revealed: false,
    cost: 0,
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

describe('CardScriptPromptCommitPipeline', () => {
  it('commits immediate draw intents and keeps prompts pending', () => {
    const state = createEmptyGameState();
    state.players.P1.deck = [makeDeckCard('P1_D1', 'P1'), makeDeckCard('P1_D2', 'P1')];

    const intents: RunnerIntent[] = [
      {
        kind: 'draw',
        sourceCardId: 'SRC_1',
        sourceCardNo: 'LO-TEST',
        timing: 'onUse',
        playerId: 'P1',
        amount: 1,
      },
      {
        kind: 'prompt',
        sourceCardId: 'SRC_1',
        sourceCardNo: 'LO-6556',
        timing: 'onEnterFromHand',
        prompt: '2장 차지할 수 있다. 하지 않으면 ...',
        optionalIntents: [
          {
            kind: 'charge',
            sourceCardId: 'SRC_1',
            sourceCardNo: 'LO-6556',
            timing: 'onEnterFromHand',
            targetIds: ['SRC_1'],
            amount: 2,
          },
        ],
        elseIntents: [
          {
            kind: 'draw',
            sourceCardId: 'SRC_1',
            sourceCardNo: 'LO-6556',
            timing: 'onEnterFromHand',
            playerId: 'P2',
            amount: 1,
          },
        ],
      },
    ];

    const result = commitRunnerIntentsWithPrompts(state, intents, { actingPlayerId: 'P1' });

    expect(result.appliedIntents).toHaveLength(1);
    expect(result.prompts).toHaveLength(1);
    expect(result.unsupportedImmediateIntents).toHaveLength(0);
    expect(result.state.players.P1.hand[0]?.instanceId).toBe('P1_D1');
  });

  it('resolves else branch prompt and commits converted draw intent', () => {
    const state = createEmptyGameState();
    state.players.P2.deck = [makeDeckCard('P2_D1', 'P2')];

    const plan = buildPromptCommitPlan(
      [
        {
          kind: 'prompt',
          sourceCardId: 'SRC_1',
          sourceCardNo: 'LO-6556',
          timing: 'onEnterFromHand',
          prompt: '2장 차지할 수 있다. 하지 않으면 ...',
          optionalIntents: [
            {
              kind: 'charge',
              sourceCardId: 'SRC_1',
              sourceCardNo: 'LO-6556',
              timing: 'onEnterFromHand',
              targetIds: ['SRC_1'],
              amount: 2,
            },
          ],
          elseIntents: [
            {
              kind: 'draw',
              sourceCardId: 'SRC_1',
              sourceCardNo: 'LO-6556',
              timing: 'onEnterFromHand',
              playerId: 'P2',
              amount: 1,
            },
          ],
        },
      ],
      { actingPlayerId: 'P1' },
    );

    const prompt = plan.prompts[0];
    if (!prompt || prompt.kind !== 'optionalBranch') {
      throw new Error('Expected optionalBranch prompt');
    }

    const result = resolvePromptAndCommit(state, prompt, {
      promptId: prompt.promptId,
      kind: 'optionalBranch',
      choose: 'else',
    });

    expect(result.resolvedRunnerIntents).toHaveLength(1);
    expect(result.resolvedCommitIntents).toHaveLength(1);
    expect(result.unsupportedResolvedIntents).toHaveLength(0);
    expect(result.state.players.P2.hand[0]?.instanceId).toBe('P2_D1');
  });

  it('converts applyState tap into sandbox tap commit intents', () => {
    const state = createEmptyGameState();
    state.players.P2.field.DF_LEFT.card = makeFieldCharacter('ENEMY_1', 'P2', false);

    const result = commitRunnerIntentsWithPrompts(
      state,
      [
        {
          kind: 'applyState',
          sourceCardId: 'SRC_2',
          sourceCardNo: 'LO-TAP',
          timing: 'onUse',
          targetIds: ['ENEMY_1'],
          state: 'tap',
        },
      ],
      { actingPlayerId: 'P1' },
    );

    expect(result.appliedIntents).toHaveLength(1);
    expect(result.state.players.P2.field.DF_LEFT.card?.isTapped).toBe(true);
  });
});
