import type { EffectDSLDefinition } from '../effects/EffectDSL';
import type { StorageEffectStep } from '../effects/StorageEffectStepTypes';
import type { CardDefinition, CardScriptEffectBinding, CardScriptStorageBinding } from './CardDefinition';
import { getCardDefinition } from './CardRegistry';

export interface ResolvedCardEffect {
  card: CardDefinition;
  binding: CardScriptEffectBinding;
  definition: EffectDSLDefinition;
}

export interface ResolvedCardStorageEffect {
  card: CardDefinition;
  binding: CardScriptStorageBinding;
  steps: StorageEffectStep[];
}

export function resolveCardDefinition(cardId: string): CardDefinition | undefined {
  return getCardDefinition(cardId);
}

export function requireCardDefinition(cardId: string): CardDefinition {
  const card = resolveCardDefinition(cardId);
  if (!card) {
    throw new Error(`CardDefinition not found: ${cardId}`);
  }
  return card;
}

export function listCardEffectBindings(cardId: string): CardScriptEffectBinding[] {
  return requireCardDefinition(cardId).effects ?? [];
}

export function listCardStorageBindings(cardId: string): CardScriptStorageBinding[] {
  return requireCardDefinition(cardId).storageEffects ?? [];
}

export function resolveCardEffectDefinition(
  cardId: string,
  effectId?: string,
): ResolvedCardEffect | undefined {
  const card = resolveCardDefinition(cardId);
  if (!card || !card.effects || card.effects.length === 0) {
    return undefined;
  }

  const binding =
    effectId !== undefined
      ? card.effects.find((item) => item.id === effectId)
      : card.effects[0];

  if (!binding) {
    return undefined;
  }

  return {
    card,
    binding,
    definition: binding.definition,
  };
}

export function requireCardEffectDefinition(
  cardId: string,
  effectId?: string,
): ResolvedCardEffect {
  const resolved = resolveCardEffectDefinition(cardId, effectId);
  if (!resolved) {
    throw new Error(
      effectId
        ? `Card effect not found: ${cardId} / ${effectId}`
        : `Card effect not found: ${cardId}`,
    );
  }
  return resolved;
}

export function resolveCardStorageEffect(
  cardId: string,
  storageEffectId?: string,
): ResolvedCardStorageEffect | undefined {
  const card = resolveCardDefinition(cardId);
  if (!card || !card.storageEffects || card.storageEffects.length === 0) {
    return undefined;
  }

  const binding =
    storageEffectId !== undefined
      ? card.storageEffects.find((item) => item.id === storageEffectId)
      : card.storageEffects[0];

  if (!binding) {
    return undefined;
  }

  return {
    card,
    binding,
    steps: binding.steps,
  };
}

export function requireCardStorageEffect(
  cardId: string,
  storageEffectId?: string,
): ResolvedCardStorageEffect {
  const resolved = resolveCardStorageEffect(cardId, storageEffectId);
  if (!resolved) {
    throw new Error(
      storageEffectId
        ? `Card storage effect not found: ${cardId} / ${storageEffectId}`
        : `Card storage effect not found: ${cardId}`,
    );
  }
  return resolved;
}
