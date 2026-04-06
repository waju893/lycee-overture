import { CARD_META_BY_CODE } from "./cards";

export interface DeckEntry {
  code: string;
  qty: number;
}

export interface DeckSummary {
  totalCards: number;
  totalEx: number;
  averageAp: number;
  averageDp: number;
  averageSp: number;
  averageDmg: number;
  byType: Record<string, number>;
  byAttribute: Record<string, number>;
}

export function normalizeCardCode(code: string): string {
  return code.trim().toUpperCase();
}

export function safeQty(qty: number): number {
  if (!Number.isFinite(qty)) return 0;
  return Math.max(0, Math.floor(qty));
}

export function summarizeDeck(entries: DeckEntry[]): DeckSummary {
  let totalCards = 0;
  let totalEx = 0;
  let totalAp = 0;
  let totalDp = 0;
  let totalSp = 0;
  let totalDmg = 0;

  const byType: Record<string, number> = {};
  const byAttribute: Record<string, number> = {};

  for (const entry of entries) {
    const code = normalizeCardCode(entry.code);
    const qty = safeQty(entry.qty);
    if (!qty) continue;

    const card = CARD_META_BY_CODE[code];
    if (!card) continue;

    totalCards += qty;
    totalEx += (card.ex ?? 0) * qty;
    totalAp += (card.ap ?? 0) * qty;
    totalDp += (card.dp ?? 0) * qty;
    totalSp += (card.sp ?? 0) * qty;
    totalDmg += (card.dmg ?? 0) * qty;

    const typeKey = card.type ?? "Unknown";
    const attributeKey = card.attribute ?? "None";

    byType[typeKey] = (byType[typeKey] ?? 0) + qty;
    byAttribute[attributeKey] = (byAttribute[attributeKey] ?? 0) + qty;
  }

  return {
    totalCards,
    totalEx,
    averageAp: totalCards ? totalAp / totalCards : 0,
    averageDp: totalCards ? totalDp / totalCards : 0,
    averageSp: totalCards ? totalSp / totalCards : 0,
    averageDmg: totalCards ? totalDmg / totalCards : 0,
    byType,
    byAttribute,
  };
}

export function mergeDeckEntries(entries: DeckEntry[]): DeckEntry[] {
  const merged = new Map<string, number>();

  for (const entry of entries) {
    const code = normalizeCardCode(entry.code);
    const qty = safeQty(entry.qty);
    if (!code || qty <= 0) continue;

    merged.set(code, (merged.get(code) ?? 0) + qty);
  }

  return Array.from(merged.entries()).map(([code, qty]) => ({ code, qty }));
}

export function addCardToDeck(entries: DeckEntry[], code: string, qty = 1): DeckEntry[] {
  return mergeDeckEntries([
    ...entries,
    { code: normalizeCardCode(code), qty: safeQty(qty) },
  ]);
}

export function removeCardFromDeck(entries: DeckEntry[], code: string, qty = 1): DeckEntry[] {
  const normalized = normalizeCardCode(code);
  const removeQty = safeQty(qty);

  return entries
    .map((entry) =>
      normalizeCardCode(entry.code) === normalized
        ? { code: normalized, qty: safeQty(entry.qty) - removeQty }
        : { code: normalizeCardCode(entry.code), qty: safeQty(entry.qty) }
    )
    .filter((entry) => entry.qty > 0);
}