import type { CardDefinition, CardDefinitionMap } from './CardDefinition';

const registry: CardDefinitionMap = {};

export function registerCardDefinition(card: CardDefinition): void {
  registry[card.cardId] = card;
}

export function registerCardDefinitions(cards: CardDefinition[]): void {
  for (const card of cards) {
    registerCardDefinition(card);
  }
}

export function getCardDefinition(cardId: string): CardDefinition | undefined {
  return registry[cardId];
}

export function requireCardDefinition(cardId: string): CardDefinition {
  const card = getCardDefinition(cardId);
  if (!card) {
    throw new Error(`CardDefinition not found: ${cardId}`);
  }
  return card;
}

export function hasCardDefinition(cardId: string): boolean {
  return registry[cardId] !== undefined;
}

export function listRegisteredCardIds(): string[] {
  return Object.keys(registry).sort();
}

export function listRegisteredCards(): CardDefinition[] {
  return listRegisteredCardIds().map((cardId) => registry[cardId]);
}

export function clearCardRegistry(): void {
  for (const key of Object.keys(registry)) {
    delete registry[key];
  }
}
