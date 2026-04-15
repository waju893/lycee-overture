import { parseNumber } from "./LyceeRuleHelpers.ts";
import type { Rule } from "./LyceeRuleRegistry.ts";

/**
 * Real-card-oriented cost/move parsing.
 *
 * Removed the fake rule for:
 *   コストとして手札1枚破棄する
 * because the user confirmed this pattern does not exist in real Lycee cards.
 */

const ruleCosts: Rule = (body) => {
  const moveMatch = body.match(/手札(\d+)枚?をデッキの下に置く/);
  if (!moveMatch) return null;

  const count = parseNumber(moveMatch[1] ?? "1") ?? 1;

  return {
    ruleId: "costBlock",
    actions: [
      {
        type: "moveCard",
        owner: "self",
        from: "hand",
        to: "deckBottom",
        count,
      },
    ],
  };
};

export const costRules = [ruleCosts];
