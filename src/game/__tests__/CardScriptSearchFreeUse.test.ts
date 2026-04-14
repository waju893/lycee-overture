import { describe, expect, it } from 'vitest';
import { createEmptyGameState } from '../GameEngine';
import type { CardRef } from '../GameTypes';
import { businessPartnerEntryEffect } from '../cards/examples/BusinessPartner';
import { CardScriptRunner, type RunnerContext, type RunnerStateView, type RunnerTargetRef } from '../cards/CardScriptRunner';
import type { PlayerRef, TargetSelector } from '../cards/CardScriptTypes';
import {
  buildPromptCommitPlan,
  resolvePromptAndCommit,
} from '../cards/sandbox/CardScriptPromptCommitPipeline';

function makeCard(
  instanceId: string,
  owner: 'P1' | 'P2',
  cardType: 'character' | 'event' | 'item' | 'area',
  location: string,
  name = instanceId,
): CardRef {
  return {
    instanceId,
    cardNo: instanceId,
    name,
    owner,
    cardType,
    location,
    revealed: false,
    cost: 0,
    ap: 0,
    dp: 0,
    sp: 0,
    dmg: 0,
  } as CardRef;
}

function makeStateView(): RunnerStateView {
  return {
    currentTurnPlayerId: 'P1',
    currentNonTurnPlayerId: 'P2',
    resolvePlayer(ref: PlayerRef, context: RunnerContext): string {
      switch (ref) {
        case 'self':
          return context.actingPlayerId;
        case 'opponent':
          return context.actingPlayerId === 'P1' ? 'P2' : 'P1';
        case 'turnPlayer':
          return context.turnPlayerId;
        case 'nonTurnPlayer':
          return context.turnPlayerId === 'P1' ? 'P2' : 'P1';
      }
    },
    resolveTargets(selector: TargetSelector, context: RunnerContext): RunnerTargetRef[] {
      if (selector.kind === 'source') {
        return [{ kind: 'card', id: context.sourceCard.id }];
      }
      return [];
    },
  };
}

function makeContext(): RunnerContext {
  return {
    timing: 'onEnter',
    sourceCard: {
      id: 'SRC_BP',
      cardNo: 'LO-DEMO-BP',
      ownerId: 'P1',
      controllerId: 'P1',
      zone: 'field',
      name: 'Business Partner Demo',
    },
    actingPlayerId: 'P1',
    turnPlayerId: 'P1',
    chosenTargets: [],
    lookedCardIds: [],
    metadata: {},
  };
}

describe('CardScript search + freeUse', () => {
  it('resolves chooseOne -> searchCard -> freeUse(area)', () => {
    const runner = new CardScriptRunner();
    const runResult = runner.run([businessPartnerEntryEffect], makeStateView(), makeContext());

    expect(runResult.ok).toBe(true);
    expect(runResult.errors).toEqual([]);
    expect(runResult.intents).toHaveLength(1);
    expect(runResult.intents[0]?.kind).toBe('prompt');

    const state = createEmptyGameState();
    state.players.P1.deck = [
      makeCard('BP_AREA_1', 'P1', 'area', 'deck', 'ビジネスパートナー'),
      makeCard('OTHER_1', 'P1', 'event', 'deck', 'Other'),
    ];

    const plan = buildPromptCommitPlan(runResult.intents, { actingPlayerId: 'P1' });
    expect(plan.prompts).toHaveLength(1);

    const prompt = plan.prompts[0];
    if (!prompt || prompt.kind !== 'chooseOne') {
      throw new Error('Expected chooseOne prompt');
    }

    const result = resolvePromptAndCommit(state, prompt, {
      promptId: prompt.promptId,
      kind: 'chooseOne',
      choiceIndex: 1,
    });

    expect(result.unsupportedResolvedIntents).toHaveLength(0);
    expect(result.appliedIntents).toHaveLength(2);
    expect(state.players.P1.deck).toHaveLength(2);
    expect(result.state.players.P1.deck).toHaveLength(1);
    expect((result.state.players.P1.field.AF_LEFT as any).area?.instanceId).toBe('BP_AREA_1');
    expect(result.state.logs.some((line) => line.includes('free area use BP_AREA_1'))).toBe(true);
  });
});
