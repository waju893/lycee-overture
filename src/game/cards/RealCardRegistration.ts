import type { CardDefinition } from './CardDefinition';
import { registerCardDefinitions } from './CardRegistry';
import { buildCardDefinitionFromSource } from './CardScriptFactory';
import { REAL_CARD_SOURCES } from './RealCardSources';

export function buildRealCardDefinitions(): CardDefinition[] {
  const results: CardDefinition[] = [];

  for (const source of REAL_CARD_SOURCES) {
    const built = buildCardDefinitionFromSource(source);
    if (built.ok && built.cardDefinition) {
      results.push(built.cardDefinition);
    }
  }

  return results;
}

export function registerRealCards(): CardDefinition[] {
  const definitions = buildRealCardDefinitions();
  registerCardDefinitions(definitions);
  return definitions;
}
