import { getCardByCode, isLeaderCard } from "./cards";
import { mergeDeckEntries, normalizeCardCode, safeQty, type DeckEntry } from "./deck";

export const REQUIRED_DECK_SIZE = 60;
export const MAX_LEADER_CARDS = 1;
export const MAX_NON_LEADER_COPIES = 4;

export type DeckRuleCode =
  | "DECK_SIZE_UNDER"
  | "DECK_SIZE_OVER"
  | "LEADER_LIMIT_EXCEEDED"
  | "NON_LEADER_COPY_LIMIT_EXCEEDED"
  | "UNKNOWN_CARD_CODE";

export type DeckRuleIssue = {
  code: DeckRuleCode;
  message: string;
  cardCode?: string;
  actual?: number;
  limit?: number;
};

export type DeckValidationResult = {
  isValid: boolean;
  totalCards: number;
  totalLeaderCards: number;
  issues: DeckRuleIssue[];
};

export type CanAddCardResult = {
  ok: boolean;
  nextEntries: DeckEntry[];
  issues: DeckRuleIssue[];
};

function getEntryQty(entry: DeckEntry): number {
  return safeQty(entry.qty);
}

export function countDeckCards(entries: DeckEntry[]): number {
  return mergeDeckEntries(entries).reduce((sum, entry) => sum + getEntryQty(entry), 0);
}

export function countLeaderCards(entries: DeckEntry[]): number {
  return mergeDeckEntries(entries).reduce((sum, entry) => {
    return sum + (isLeaderCard(entry.code) ? getEntryQty(entry) : 0);
  }, 0);
}

export function validateDeck(entries: DeckEntry[]): DeckValidationResult {
  const normalizedEntries = mergeDeckEntries(entries);
  const issues: DeckRuleIssue[] = [];

  let totalCards = 0;
  let totalLeaderCards = 0;

  for (const entry of normalizedEntries) {
    const code = normalizeCardCode(entry.code);
    const qty = getEntryQty(entry);
    const card = getCardByCode(code);

    totalCards += qty;

    if (!card) {
      issues.push({
        code: "UNKNOWN_CARD_CODE",
        message: `존재하지 않는 카드 코드입니다: ${code}`,
        cardCode: code,
      });
      continue;
    }

    if (card.leader) {
      totalLeaderCards += qty;

      if (qty > MAX_LEADER_CARDS) {
        issues.push({
          code: "LEADER_LIMIT_EXCEEDED",
          message: `리더 카드는 덱 전체에서 최대 ${MAX_LEADER_CARDS}장까지 허용됩니다: ${code} x${qty}`,
          cardCode: code,
          actual: qty,
          limit: MAX_LEADER_CARDS,
        });
      }

      continue;
    }

    if (qty > MAX_NON_LEADER_COPIES) {
      issues.push({
        code: "NON_LEADER_COPY_LIMIT_EXCEEDED",
        message: `일반 카드는 동일 코드 기준 최대 ${MAX_NON_LEADER_COPIES}장까지 허용됩니다: ${code} x${qty}`,
        cardCode: code,
        actual: qty,
        limit: MAX_NON_LEADER_COPIES,
      });
    }
  }

  if (totalLeaderCards > MAX_LEADER_CARDS) {
    issues.push({
      code: "LEADER_LIMIT_EXCEEDED",
      message: `리더 카드는 덱 전체에서 최대 ${MAX_LEADER_CARDS}장까지 허용됩니다. 현재 ${totalLeaderCards}장입니다.`,
      actual: totalLeaderCards,
      limit: MAX_LEADER_CARDS,
    });
  }

  if (totalCards < REQUIRED_DECK_SIZE) {
    issues.push({
      code: "DECK_SIZE_UNDER",
      message: `덱은 반드시 ${REQUIRED_DECK_SIZE}장이어야 합니다. 현재 ${totalCards}장입니다.`,
      actual: totalCards,
      limit: REQUIRED_DECK_SIZE,
    });
  } else if (totalCards > REQUIRED_DECK_SIZE) {
    issues.push({
      code: "DECK_SIZE_OVER",
      message: `덱은 반드시 ${REQUIRED_DECK_SIZE}장이어야 합니다. 현재 ${totalCards}장입니다.`,
      actual: totalCards,
      limit: REQUIRED_DECK_SIZE,
    });
  }

  return {
    isValid: issues.length === 0,
    totalCards,
    totalLeaderCards,
    issues,
  };
}

export function canAddCard(entries: DeckEntry[], code: string, qty = 1): CanAddCardResult {
  const normalizedCode = normalizeCardCode(code);
  const addQty = safeQty(qty);
  const nextEntries = mergeDeckEntries([...entries, { code: normalizedCode, qty: addQty }]);

  const nextValidation = validateDeck(nextEntries);

  const blockingIssues = nextValidation.issues.filter((issue) => {
    if (issue.code === "DECK_SIZE_UNDER") return false;
    return true;
  });

  return {
    ok: blockingIssues.length === 0,
    nextEntries,
    issues: blockingIssues,
  };
}

export function getDeckRuleSummary(entries: DeckEntry[]): string[] {
  const result = validateDeck(entries);
  return result.issues.map((issue) => issue.message);
}
