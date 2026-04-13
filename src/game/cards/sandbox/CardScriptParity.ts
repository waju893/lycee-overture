import type { CardRef } from '../../GameTypes';

export function getCardCost(card: CardRef | undefined): number | undefined {
  if (!card) return undefined;
  const value = (card as any).cost;
  return typeof value === 'number' ? value : undefined;
}

export function isEvenCostCard(card: CardRef | undefined): boolean {
  const cost = getCardCost(card);
  if (typeof cost !== 'number') {
    return false;
  }
  return cost % 2 === 0;
}

export function isOddCostCard(card: CardRef | undefined): boolean {
  const cost = getCardCost(card);
  if (typeof cost !== 'number') {
    return false;
  }
  return cost % 2 === 1;
}
