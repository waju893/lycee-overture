import type { PlayerID } from '../GameTypes';

export type EffectDSLTargetScope =
  | 'self'
  | 'opponent'
  | 'either'
  | 'self_character'
  | 'opponent_character'
  | 'any_character';

export type EffectDSLTargetTiming = 'declareTime' | 'resolutionTime' | 'none';

export type EffectDSLStep =
  | {
      type: 'draw';
      player: 'self' | 'opponent';
      count: number;
    }
  | {
      type: 'destroy';
      target: EffectDSLTargetScope;
      count: number;
      targetTiming: Exclude<EffectDSLTargetTiming, 'none'>;
      isDown?: false;
    }
  | {
      type: 'battleDestroy';
      target: EffectDSLTargetScope;
      count: number;
      targetTiming: Exclude<EffectDSLTargetTiming, 'none'>;
      isDown: true;
    }
  | {
      type: 'discard';
      player: 'self' | 'opponent';
      count: number;
      targetTiming: Exclude<EffectDSLTargetTiming, 'none'>;
    }
  | {
      type: 'moveToHand';
      target: EffectDSLTargetScope;
      count: number;
      targetTiming: Exclude<EffectDSLTargetTiming, 'none'>;
    }
  | {
      type: 'charge';
      player: 'self' | 'opponent';
      count: number;
      from: 'deckTop' | 'discard';
    }
  | {
      type: 'log';
      message: string;
    };

export interface EffectDSLDefinition {
  id: string;
  text?: string;
  optional?: boolean;
  triggerTiming?: 'manual' | 'turnStart' | 'turnEnd' | 'onDestroyed' | 'onDowned' | 'onEnterField';
  steps: EffectDSLStep[];
}

export interface EffectDSLValidationResult {
  ok: boolean;
  errors: string[];
}

export interface EffectDSLExecutionContext {
  controller: PlayerID;
  opponent: PlayerID;
  sourceCardId?: string;
  sourceEffectId?: string;
  declaredTargetCardIds?: string[];
}

export interface EffectDSLCompiled {
  definition: EffectDSLDefinition;
  normalizedSteps: EffectDSLStep[];
}
