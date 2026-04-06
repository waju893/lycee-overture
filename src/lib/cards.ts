import { CARD_META, CARD_META_BY_CODE } from "../data/cardMeta";
import type { CardMeta, CardAttribute, CardType } from "../types/card";

export { CARD_META, CARD_META_BY_CODE };
export type { CardMeta, CardAttribute, CardType };

export const CARD_TYPES: CardType[] = Array.from(
  new Set(CARD_META.map((card) => card.type).filter(Boolean))
) as CardType[];

export const CARD_ATTRIBUTES: CardAttribute[] = Array.from(
  new Set(CARD_META.map((card) => card.attribute).filter(Boolean))
) as CardAttribute[];

export function getCardByCode(code: string): CardMeta | undefined {
  return CARD_META_BY_CODE[code.trim().toUpperCase()];
}

export function hasCard(code: string): boolean {
  return Boolean(getCardByCode(code));
}

export function getCardsByType(type: CardType): CardMeta[] {
  return CARD_META.filter((card) => card.type === type);
}

export function getCardsByAttribute(attribute: CardAttribute): CardMeta[] {
  return CARD_META.filter((card) => card.attribute === attribute);
}

export function getCardsWithKeyeffect(keyeffect: number): CardMeta[] {
  return CARD_META.filter((card) =>
    (card.keyEffects ?? card.keyeffects ?? []).includes(keyeffect)
  );
}

export function isLeaderCard(code: string): boolean {
  return Boolean(getCardByCode(code)?.leader);
}

export function sortCardsByNoDesc(cards: CardMeta[]): CardMeta[] {
  return [...cards].sort((a, b) => (b.no ?? -999999) - (a.no ?? -999999));
}

export function sortCardsByNoAsc(cards: CardMeta[]): CardMeta[] {
  return [...cards].sort((a, b) => (a.no ?? 999999) - (b.no ?? 999999));
}

export function sortCardsByCodeAsc(cards: CardMeta[]): CardMeta[] {
  return [...cards].sort((a, b) => a.code.localeCompare(b.code));
}