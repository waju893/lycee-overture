import type { PlayerID } from '../GameTypes';

export type EffectDSLTargetScope =
  | 'self'
  | 'opponent'
  | 'either'
  | 'self_character'
  | 'opponent_character'
  | 'any_character';

export type EffectDSLTargetTiming = 'declareTime' | 'resolutionTime' | 'none';

export type EffectDSLTargetFilter = 'tapped' | 'untapped';

type CountedTargetStepBase = {
  target: EffectDSLTargetScope;
  count: number;
  targetTiming: Exclude<EffectDSLTargetTiming, 'none'>;
  optionalTarget?: boolean;
  multiTarget?: boolean;
  filter?: EffectDSLTargetFilter;
};

export type EffectDSLStep =
  | {
      type: 'draw';
      player: 'self' | 'opponent';
      count: number;
    }
  | {
      type: 'mill';
      player: 'self' | 'opponent';
      count: number;
    }
  | ({
      type: 'destroy';
      isDown?: false;
    } & CountedTargetStepBase)
  | ({
      type: 'battleDestroy';
      isDown: true;
    } & CountedTargetStepBase)
  | ({
      type: 'move';
      destination: 'hand' | 'discard';
    } & CountedTargetStepBase)
  | ({
      type: 'tap';
    } & CountedTargetStepBase)
  | ({
      type: 'untap';
    } & CountedTargetStepBase)
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
