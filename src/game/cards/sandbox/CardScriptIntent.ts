import type { PlayerID } from '../../GameTypes';
import type { EffectDSLStep } from '../../effects/EffectDSL';

export type CardScriptIntent =
  | {
      kind: 'draw';
      playerId: PlayerID;
      count: number;
      sourceCardId?: string;
      sourceEffectId?: string;
    }
  | {
      kind: 'tap';
      playerId: PlayerID;
      cardId: string;
      sourceCardId?: string;
      sourceEffectId?: string;
    }
  | {
      kind: 'untap';
      playerId: PlayerID;
      cardId: string;
      sourceCardId?: string;
      sourceEffectId?: string;
    }
  | {
      kind: 'revealTopCard';
      playerId: PlayerID;
      count: number;
      sourceCardId?: string;
      sourceEffectId?: string;
    }
  | {
      kind: 'log';
      message: string;
      sourceCardId?: string;
      sourceEffectId?: string;
    };

export interface CardScriptIntentBuildContext {
  controller: PlayerID;
  opponent: PlayerID;
  sourceCardId?: string;
  sourceEffectId?: string;
}

export interface RevealTopCardIntentParams {
  playerId: PlayerID;
  count?: number;
  sourceCardId?: string;
  sourceEffectId?: string;
}

export function createRevealTopCardIntent(
  params: RevealTopCardIntentParams,
): CardScriptIntent {
  return {
    kind: 'revealTopCard',
    playerId: params.playerId,
    count: params.count ?? 1,
    sourceCardId: params.sourceCardId,
    sourceEffectId: params.sourceEffectId,
  };
}

export function buildSimpleIntentFromStep(
  step: EffectDSLStep,
  context: CardScriptIntentBuildContext,
): CardScriptIntent[] {
  switch (step.type) {
    case 'draw':
      return [
        {
          kind: 'draw',
          playerId: step.player === 'self' ? context.controller : context.opponent,
          count: step.count,
          sourceCardId: context.sourceCardId,
          sourceEffectId: context.sourceEffectId,
        },
      ];

    case 'log':
      return [
        {
          kind: 'log',
          message: step.message,
          sourceCardId: context.sourceCardId,
          sourceEffectId: context.sourceEffectId,
        },
      ];

    default:
      return [];
  }
}
