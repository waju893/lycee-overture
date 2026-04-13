import type { GameState, PlayerID } from '../../GameTypes';
import type { CardDefinition } from '../CardDefinition';
import type { CardScriptIntent } from './CardScriptIntent';
import {
  buildSimpleIntentFromStep,
  createRevealTopCardIntent,
  type CardScriptIntentBuildContext,
} from './CardScriptIntent';
import {
  createCardScriptSnapshot,
  getTopDeckCardForPlayer,
  type CardScriptSnapshot,
} from './CardScriptSnapshot';
import { isEvenCostCard } from './CardScriptParity';
import {
  createEmptyCardScriptUsageTracker,
  hasCardScriptUsage,
  markCardScriptUsage,
  type CardScriptUsageTrackerState,
} from './CardScriptUsageTracker';

export interface CardScriptRunnerContext extends CardScriptIntentBuildContext {
  turnNumber: number;
}

export interface CardScriptRunnerResult {
  snapshot: CardScriptSnapshot;
  intents: CardScriptIntent[];
  usage: CardScriptUsageTrackerState;
}

export interface RunCardDefinitionParams {
  state: GameState;
  card: CardDefinition;
  controller: PlayerID;
  effectId?: string;
  sourceCardId?: string;
  usage?: CardScriptUsageTrackerState;
}

function buildRunnerContext(params: RunCardDefinitionParams): CardScriptRunnerContext {
  return {
    controller: params.controller,
    opponent: params.controller === 'P1' ? 'P2' : 'P1',
    sourceCardId: params.sourceCardId ?? params.card.cardId,
    sourceEffectId: params.effectId,
    turnNumber: params.state.turn.turnNumber,
  };
}

function runPlainEffectDSL(
  card: CardDefinition,
  context: CardScriptRunnerContext,
): CardScriptIntent[] {
  const effects = card.effects ?? [];
  const binding =
    context.sourceEffectId !== undefined
      ? effects.find((item) => item.id === context.sourceEffectId)
      : effects[0];

  if (!binding) {
    return [];
  }

  const intents: CardScriptIntent[] = [];
  for (const step of binding.definition.steps) {
    intents.push(...buildSimpleIntentFromStep(step, context));
  }
  return intents;
}

function runQuizSandbox(
  snapshot: CardScriptSnapshot,
  context: CardScriptRunnerContext,
): CardScriptIntent[] {
  const intents: CardScriptIntent[] = [];

  intents.push(
    createRevealTopCardIntent({
      playerId: context.controller,
      count: 1,
      sourceCardId: context.sourceCardId,
      sourceEffectId: context.sourceEffectId,
    }),
  );

  const topCard = getTopDeckCardForPlayer(snapshot, context.controller);
  if (isEvenCostCard(topCard)) {
    intents.push({
      kind: 'draw',
      playerId: context.controller,
      count: 2,
      sourceCardId: context.sourceCardId,
      sourceEffectId: context.sourceEffectId,
    });
  }

  return intents;
}

function needsQuizSandbox(card: CardDefinition): boolean {
  return card.cardId === 'LO-3795';
}

export function runCardDefinitionInSandbox(
  params: RunCardDefinitionParams,
): CardScriptRunnerResult {
  const snapshot = createCardScriptSnapshot(params.state);
  const usage = params.usage ?? createEmptyCardScriptUsageTracker();
  const context = buildRunnerContext(params);

  const usageKey = {
    playerId: context.controller,
    cardId: params.card.cardId,
    effectId: context.sourceEffectId,
    turnNumber: context.turnNumber,
  };

  if (hasCardScriptUsage(usage, usageKey)) {
    return {
      snapshot,
      intents: [
        {
          kind: 'log',
          message: `usage blocked: ${params.card.cardId}`,
          sourceCardId: context.sourceCardId,
          sourceEffectId: context.sourceEffectId,
        },
      ],
      usage,
    };
  }

  const intents = needsQuizSandbox(params.card)
    ? runQuizSandbox(snapshot, context)
    : runPlainEffectDSL(params.card, context);

  const nextUsage = markCardScriptUsage(usage, usageKey);

  return {
    snapshot,
    intents,
    usage: nextUsage,
  };
}
