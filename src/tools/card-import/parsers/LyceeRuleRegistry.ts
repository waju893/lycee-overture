import type { ParsedAction, RuleMatch } from "../LyceeEffectParserTypes.ts";
import { extractQuotedName, parseNumber, splitTopLevelChoice } from "./LyceeRuleHelpers.ts";
import { durationRules } from "./LyceeRuleDuration.ts";
import { conditionRules } from "./LyceeRuleConditions.ts";
import { costRules } from "./LyceeRuleCosts.ts";
import { targetRules } from "./LyceeRuleTargets.ts";
import { moveRules } from "./LyceeRuleMoves.ts";

export type Rule = (body: string, recurse: (body: string) => RuleMatch) => RuleMatch | null;

function parseSingleEffectBody(body: string): RuleMatch {
  for (const rule of orderedRules) {
    const result = rule(body, parseSingleEffectBody);
    if (result) return result;
  }
  return { ruleId: "unresolved", actions: [] };
}

function ruleChooseOne(body: string, recurse: (body: string) => RuleMatch): RuleMatch | null {
  const parts = splitTopLevelChoice(body);
  if (parts.length < 2) return null;
  const choices = parts.map((part, index) => {
    const nested = recurse(part);
    return { label: index === 0 ? "A" : "B", actions: nested.actions };
  });
  if (choices.some((choice) => choice.actions.length === 0)) return null;
  return {
    ruleId: "chooseOne",
    actions: [{ type: "chooseOne", prompt: "하나를 선택한다", choices }],
  };
}

function ruleOptionalElse(body: string, recurse: (body: string) => RuleMatch): RuleMatch | null {
  const match = body.match(/(.+?)できる。?そうしない場合、?(.+)$/);
  if (!match) return null;
  const optionalResult = recurse(match[1].trim());
  const elseResult = recurse(match[2].trim());
  if (optionalResult.actions.length === 0 || elseResult.actions.length === 0) return null;
  return {
    ruleId: "optionalElse",
    actions: [{
      type: "optionalElse",
      prompt: match[1].trim(),
      optionalActions: optionalResult.actions,
      elseActions: elseResult.actions,
    }],
  };
}

function ruleSearchAndFreeUse(body: string): RuleMatch | null {
  if (!/探し/.test(body) || !/無償で(登場|配置|装備|使用)/.test(body)) return null;
  const name = extractQuotedName(body);
  const count = parseNumber(body) ?? 1;
  const zones: Array<"deck" | "trash" | "hand"> = [];
  if (/デッキ/.test(body)) zones.push("deck");
  if (/ゴミ箱/.test(body)) zones.push("trash");
  if (/手札/.test(body)) zones.push("hand");
  if (zones.length === 0) return null;
  const useKind: "character" | "event" | "item" | "area" =
    /配置/.test(body) ? "area" :
    /装備/.test(body) ? "item" :
    /使用/.test(body) ? "event" :
    "character";
  return {
    ruleId: "searchCard+freeUse",
    actions: [
      {
        type: "searchCard",
        owner: /相手/.test(body) ? "opponent" : "self",
        zones,
        match: {
          exactName: name,
          kind:
            useKind === "character" ? "character" :
            useKind === "event" ? "event" :
            useKind === "item" ? "item" :
            "area",
        },
        min: 0,
        max: count,
        storeAs: "lastSearchResult",
        shuffleAfterSearch: zones.includes("deck"),
      },
      { type: "freeUse", sourceRef: "lastSearchResult", useKind, ignoreCost: true },
    ],
  };
}

function ruleSearch(body: string): RuleMatch | null {
  if (!/探し/.test(body)) return null;
  const name = extractQuotedName(body);
  const count = parseNumber(body) ?? 1;
  const zones: Array<"deck" | "trash" | "hand"> = [];
  if (/デッキ/.test(body)) zones.push("deck");
  if (/ゴミ箱/.test(body)) zones.push("trash");
  if (/手札/.test(body)) zones.push("hand");
  if (zones.length === 0) return null;
  return {
    ruleId: "searchCard",
    actions: [{
      type: "searchCard",
      owner: /相手/.test(body) ? "opponent" : "self",
      zones,
      match: { exactName: name },
      min: 0,
      max: count,
      storeAs: "lastSearchResult",
      shuffleAfterSearch: zones.includes("deck"),
    }],
  };
}

function ruleDraw(body: string): RuleMatch | null {
  const m = body.match(/(\d+)枚ドロー/);
  return m ? { ruleId: "draw", actions: [{ type: "draw", amount: Number(m[1]) }] } : null;
}

function ruleStat(body: string): RuleMatch | null {
  const m = body.match(/(AP|DP|SP)([+-]\d+)/);
  return m ? {
    ruleId: "modifyStat",
    actions: [{ type: "modifyStat", stat: m[1].toLowerCase() as "ap" | "dp" | "sp", amount: Number(m[2]) }],
  } : null;
}

function ruleCharge(body: string): RuleMatch | null {
  const m = body.match(/(\d+)枚チャージ/);
  return m ? { ruleId: "charge", actions: [{ type: "charge", amount: Number(m[1]), target: "self" }] } : null;
}

function ruleUntap(body: string): RuleMatch | null {
  return /未行動状態にする/.test(body)
    ? { ruleId: "untap", actions: [{ type: "applyState", state: "untap", target: "self" }] }
    : null;
}

function ruleTap(body: string): RuleMatch | null {
  return /行動済み状態にする/.test(body)
    ? { ruleId: "tap", actions: [{ type: "applyState", state: "tap", target: "self" }] }
    : null;
}

function ruleReveal(body: string): RuleMatch | null {
  const m = body.match(/デッキの上?から?(\d+)枚.*公開/);
  return m ? {
    ruleId: "reveal",
    actions: [{ type: "reveal", owner: /相手/.test(body) ? "opponent" : "self", zone: "deck", count: Number(m[1]) }],
  } : null;
}

function ruleShuffle(body: string): RuleMatch | null {
  return /シャッフル/.test(body)
    ? { ruleId: "shuffle", actions: [{ type: "shuffle", owner: /相手/.test(body) ? "opponent" : "self" }] }
    : null;
}

const orderedRules: Rule[] = [
  ruleChooseOne,
  ruleOptionalElse,
  ...costRules,
  ...targetRules,
  ...conditionRules,
  ...durationRules,
  ruleSearchAndFreeUse,
  ruleSearch,
  ruleDraw,
  ruleStat,
  ruleCharge,
  ruleUntap,
  ruleTap,
  ...moveRules,
  ruleReveal,
  ruleShuffle,
];

export function parseEffectBody(body: string): { actions: ParsedAction[]; matchedRuleIds: string[] } {
  const result = parseSingleEffectBody(body);
  return {
    actions: result.actions,
    matchedRuleIds: result.actions.length > 0 ? [result.ruleId] : [],
  };
}

export const LYCEE_RULE_IDS = [
  "draw",
  "modifyStat",
  "modifyStat:endOfTurn",
  "chooseOne",
  "optionalElse",
  "searchCard",
  "searchCard+freeUse",
  "freeUse:character",
  "freeUse:area",
  "freeUse:item",
  "freeUse:event",
  "charge",
  "selector:selfCharacterOne",
  "selector:opponentCharacterOne",
  "state:tap",
  "state:untap",
  "moveCard:toHand",
  "moveCard:toTrash",
  "moveCard:toDeckBottom",
  "moveCard:toDeckTop",
  "reveal",
  "shuffle",
  "condition:inBattle",
  "condition:selfTurn",
  "condition:opponentTurn",
  "usageLimit:perTurn",
  "costBlock",
] as const;
