import type { CardDefinition } from './CardDefinition';
import type { CardScriptBuildResult, RawCardSource } from './CardSourceTypes';
import { findMappedEffectDefinition } from './CardTextMap';

export function buildCardDefinitionFromSource(card: RawCardSource): CardScriptBuildResult {
  const mappedEffect = findMappedEffectDefinition(card);

  if (!mappedEffect) {
    return {
      ok: false,
      cardId: card.cardNo,
      unsupportedReason: `No CardTextMap rule matched: ${card.cardNo}`,
    };
  }

  const definition: CardDefinition = {
    cardId: card.cardNo,
    name: card.name,
    cardType: card.cardType,
    text: card.text,
    tags: card.tags ?? ['auto-generated'],
    effects: [
      {
        id: mappedEffect.id,
        definition: mappedEffect,
      },
    ],
  };

  return {
    ok: true,
    cardId: card.cardNo,
    cardDefinition: definition,
  };
}

export function requireCardDefinitionFromSource(card: RawCardSource): CardDefinition {
  const result = buildCardDefinitionFromSource(card);
  if (!result.ok || !result.cardDefinition) {
    throw new Error(result.unsupportedReason ?? `Failed to build card definition: ${card.cardNo}`);
  }
  return result.cardDefinition;
}
