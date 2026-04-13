import type { CardType, TriggerTemplate } from '../GameTypes';
import type { EffectDSLDefinition } from '../effects/EffectDSL';
import type { StorageEffectStep } from '../effects/StorageEffectStepTypes';

export interface CardScriptEffectBinding {
  id: string;
  definition: EffectDSLDefinition;
}

export interface CardScriptStorageBinding {
  id: string;
  steps: StorageEffectStep[];
}

export interface CardDefinition {
  cardId: string;
  name: string;
  cardType: CardType;
  text?: string;
  tags?: string[];
  effects?: CardScriptEffectBinding[];
  storageEffects?: CardScriptStorageBinding[];
  triggerTemplates?: TriggerTemplate[];
}

export type CardDefinitionMap = Record<string, CardDefinition>;
