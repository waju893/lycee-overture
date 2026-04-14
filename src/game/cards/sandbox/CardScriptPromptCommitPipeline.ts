import type { GameState } from '../../GameTypes';
import { CardScriptPromptBuilder } from '../CardScriptPromptBuilder';
import type {
  CardScriptPrompt,
  CardScriptPromptSelection,
  PromptBuildContext,
} from '../CardScriptPromptTypes';
import type {
  ApplyStateIntent,
  FreeUseIntent,
  RevealIntent,
  RunnerIntent,
  SearchCardIntent,
} from '../CardScriptRunner';
import { commitCardScriptIntents, type CardScriptCommitResult } from './CardScriptCommit';
import type { CardScriptIntent } from './CardScriptIntent';

export interface RunnerIntentConversionFailure {
  intent: RunnerIntent;
  reason: string;
}

export interface PromptCommitPlan {
  immediateRunnerIntents: RunnerIntent[];
  immediateCommitIntents: CardScriptIntent[];
  prompts: CardScriptPrompt[];
  unsupportedImmediateIntents: RunnerIntentConversionFailure[];
}

export interface PromptedCommitResult extends CardScriptCommitResult {
  prompts: CardScriptPrompt[];
  unsupportedImmediateIntents: RunnerIntentConversionFailure[];
}

export interface ResolvedPromptCommitResult extends CardScriptCommitResult {
  resolvedRunnerIntents: RunnerIntent[];
  resolvedCommitIntents: CardScriptIntent[];
  unsupportedResolvedIntents: RunnerIntentConversionFailure[];
  selectedIds?: string[];
}

function toSandboxIntent(intent: RunnerIntent): CardScriptIntent[] {
  switch (intent.kind) {
    case 'draw':
      return [
        {
          kind: 'draw',
          playerId: intent.playerId as 'P1' | 'P2',
          count: intent.amount,
          sourceCardId: intent.sourceCardId,
          sourceEffectId: intent.timing,
        },
      ];

    case 'applyState':
      return convertApplyState(intent);

    case 'reveal':
      return convertReveal(intent);

    case 'searchCard':
      return convertSearchCard(intent);

    case 'freeUse':
      return convertFreeUse(intent);

    default:
      throw new Error(`Unsupported runner intent for sandbox commit: ${intent.kind}`);
  }
}

function convertApplyState(intent: ApplyStateIntent): CardScriptIntent[] {
  if (intent.state !== 'tap' && intent.state !== 'untap') {
    throw new Error(`Unsupported applyState for sandbox commit: ${intent.state}`);
  }

  return intent.targetIds.map((targetId) => ({
    kind: intent.state,
    playerId: 'P1',
    cardId: targetId,
    sourceCardId: intent.sourceCardId,
    sourceEffectId: intent.timing,
  }));
}

function convertReveal(intent: RevealIntent): CardScriptIntent[] {
  if (intent.zone !== 'deck') {
    throw new Error(`Unsupported reveal zone for sandbox commit: ${String(intent.zone)}`);
  }

  if (intent.targetIds.length !== 1) {
    throw new Error('Sandbox reveal commit expects exactly one target player');
  }

  const playerId = intent.targetIds[0];
  if (playerId !== 'P1' && playerId !== 'P2') {
    throw new Error(`Sandbox reveal commit expects player target, got: ${playerId}`);
  }

  return [
    {
      kind: 'revealTopCard',
      playerId,
      count: intent.amount ?? 1,
      sourceCardId: intent.sourceCardId,
      sourceEffectId: intent.timing,
    },
  ];
}

function convertSearchCard(intent: SearchCardIntent): CardScriptIntent[] {
  const playerId = intent.playerId;
  if (playerId !== 'P1' && playerId !== 'P2') {
    throw new Error(`Sandbox search commit expects player target, got: ${playerId}`);
  }

  return [
    {
      kind: 'searchCard',
      playerId,
      zones: [...intent.zones],
      count: intent.count,
      resultSlot: intent.resultSlot,
      match: { ...intent.match },
      revealToOpponent: intent.revealToOpponent,
      shuffleAfterSearch: intent.shuffleAfterSearch,
      sourceCardId: intent.sourceCardId,
      sourceEffectId: intent.timing,
    },
  ];
}

function convertFreeUse(intent: FreeUseIntent): CardScriptIntent[] {
  const playerId = intent.playerId;
  if (playerId !== 'P1' && playerId !== 'P2') {
    throw new Error(`Sandbox freeUse commit expects player target, got: ${playerId}`);
  }
  if (intent.source !== 'searchResult') {
    throw new Error(`Unsupported freeUse source for sandbox commit: ${intent.source}`);
  }
  if (intent.usageKind !== 'area') {
    throw new Error(`Sandbox freeUse commit only supports area, got: ${intent.usageKind}`);
  }

  return [
    {
      kind: 'freeUseAreaFromSearchResult',
      playerId,
      resultSlot: intent.resultSlot,
      ignoreCost: true,
      sourceCardId: intent.sourceCardId,
      sourceEffectId: intent.timing,
    },
  ];
}

function convertRunnerIntents(
  intents: RunnerIntent[],
): {
  commitIntents: CardScriptIntent[];
  failures: RunnerIntentConversionFailure[];
} {
  const commitIntents: CardScriptIntent[] = [];
  const failures: RunnerIntentConversionFailure[] = [];

  for (const intent of intents) {
    try {
      commitIntents.push(...toSandboxIntent(intent));
    } catch (error) {
      failures.push({
        intent,
        reason: error instanceof Error ? error.message : 'Unknown conversion failure',
      });
    }
  }

  return { commitIntents, failures };
}

export function buildPromptCommitPlan(
  intents: RunnerIntent[],
  context: PromptBuildContext,
): PromptCommitPlan {
  const builder = new CardScriptPromptBuilder();
  const built = builder.build(intents, context);
  const converted = convertRunnerIntents(built.immediateIntents);

  return {
    immediateRunnerIntents: built.immediateIntents,
    immediateCommitIntents: converted.commitIntents,
    prompts: built.prompts,
    unsupportedImmediateIntents: converted.failures,
  };
}

export function commitRunnerIntentsWithPrompts(
  state: GameState,
  intents: RunnerIntent[],
  context: PromptBuildContext,
): PromptedCommitResult {
  const plan = buildPromptCommitPlan(intents, context);
  const commitResult = commitCardScriptIntents(state, plan.immediateCommitIntents);

  return {
    ...commitResult,
    prompts: plan.prompts,
    unsupportedImmediateIntents: plan.unsupportedImmediateIntents,
  };
}

export function resolvePromptAndCommit(
  state: GameState,
  prompt: CardScriptPrompt,
  selection: CardScriptPromptSelection,
): ResolvedPromptCommitResult {
  const builder = new CardScriptPromptBuilder();
  const resolution = builder.resolvePrompt(prompt, selection);
  const converted = convertRunnerIntents(resolution.resolvedIntents);
  const commitResult = commitCardScriptIntents(state, converted.commitIntents);

  return {
    ...commitResult,
    resolvedRunnerIntents: resolution.resolvedIntents,
    resolvedCommitIntents: converted.commitIntents,
    unsupportedResolvedIntents: converted.failures,
    selectedIds: resolution.selectedIds,
  };
}
