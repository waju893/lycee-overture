import type { RuleMatch } from "./LyceeRuleRegistryTypes.ts";
import { parseNumber } from "./LyceeRuleHelpers.ts";

/**
 * Real-card-oriented cost/move parsing.
 *
 * Removed the fake rule for:
 *   コストとして手札1枚破棄する
 * because the user confirmed this pattern does not exist in real Lycee cards.
 */

function ruleCosts(
  body: string,
  _recurse: (body: string) => RuleMatch,
): RuleMatch | null {
  const moveMatch = body.match(/手札(\d+)枚?をデッキの下に置く/);
  if (!moveMatch) return null;

  const count = parseNumber(moveMatch[1] ?? "1") ?? 1;

  return {
    ruleId: "move-hand-to-deck-bottom",
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
}

export const costRules = [ruleCosts];
