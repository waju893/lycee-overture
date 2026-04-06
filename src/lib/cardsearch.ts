import { CARD_META, type CardMeta } from "./cards";

export interface CardSearchOptions {
  type?: CardMeta["type"];
  attribute?: CardMeta["attribute"];
  minEx?: number;
  minAp?: number;
  minDp?: number;
  minSp?: number;
  minDmg?: number;
  keyeffect?: number;
  query?: string;
}

export function searchCards(options: CardSearchOptions): CardMeta[] {
  const q = options.query?.trim().toLowerCase();

  return CARD_META.filter((card) => {
    if (options.type && card.type !== options.type) return false;
    if (options.attribute && card.attribute !== options.attribute) return false;

    if (options.minEx != null && (card.ex ?? -999) < options.minEx) return false;
    if (options.minAp != null && (card.ap ?? -999) < options.minAp) return false;
    if (options.minDp != null && (card.dp ?? -999) < options.minDp) return false;
    if (options.minSp != null && (card.sp ?? -999) < options.minSp) return false;
    if (options.minDmg != null && (card.dmg ?? -999) < options.minDmg) return false;

    if (
      options.keyeffect != null &&
      !(card.keyEffects ?? card.keyeffects ?? []).includes(options.keyeffect)
    ) {
      return false;
    }

    if (q) {
      const text = [
        card.code,
        card.number,
        card.name,
        card.kana,
        card.attribute,
        card.color,
        card.type,
        card.useTarget,
        card.text,
        card.flavor,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (!text.includes(q)) return false;
    }

    return true;
  });
}

export function sortByAp(cards: CardMeta[]): CardMeta[] {
  return [...cards].sort((a, b) => (b.ap ?? -999) - (a.ap ?? -999));
}

export function sortByEx(cards: CardMeta[]): CardMeta[] {
  return [...cards].sort((a, b) => (b.ex ?? -999) - (a.ex ?? -999));
}

export function sortByDp(cards: CardMeta[]): CardMeta[] {
  return [...cards].sort((a, b) => (b.dp ?? -999) - (a.dp ?? -999));
}

export function sortByNo(cards: CardMeta[]): CardMeta[] {
  return [...cards].sort((a, b) => (b.no ?? -999999) - (a.no ?? -999999));
}