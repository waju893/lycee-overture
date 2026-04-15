import type { ParsedAction, RuleMatch } from "../LyceeEffectParserTypes.ts";
import { extractQuotedName, splitTopLevelChoice } from "./LyceeRuleHelpers.ts";
import { metaRules } from "./LyceeRuleMeta.ts";
import { keywordRules } from "./LyceeRuleKeywords.ts";
import { durationRules } from "./LyceeRuleDuration.ts";
import { targetRules } from "./LyceeRuleTargets.ts";
import { moveRules } from "./LyceeRuleMoves.ts";
import { costRules } from "./LyceeRuleCosts.ts";

export type Rule = (body: string, recurse: (body: string) => RuleMatch) => RuleMatch | null;

function parseSuffixActions(body: string): {
  strippedBody: string;
  suffixActions: ParsedAction[];
  suffixRuleIds: string[];
} {
  let working = body.trim();
  const suffixActions: ParsedAction[] = [];
  const suffixRuleIds: string[] = [];

  const usagePatterns: Array<[RegExp, "game" | "turn", "use" | "choose" | "process" | "unknown"]> = [
    [/\(ゲーム中(\d+)回まで使用可能\)\s*$/, "game", "use"],
    [/\(ゲーム中(\d+)回まで選択可能\)\s*$/, "game", "choose"],
    [/\(ゲーム中(\d+)回まで処理可能\)\s*$/, "game", "process"],
    [/\((\d+)ターンに(\d+)回まで処理可能\)\s*$/, "turn", "process"],
  ];

  for (const [pattern, scope, appliesTo] of usagePatterns) {
    const m = working.match(pattern);
    if (!m) continue;
    const count = scope === "turn" ? Number(m[2]) : Number(m[1]);
    suffixActions.push({
      type: "usageLimit",
      scope,
      count,
      appliesTo,
    });
    suffixRuleIds.push("suffix:usageLimit");
    working = working.replace(pattern, "").trim();
    break;
  }

  const losePattern = /この能力は失われる。?\s*$/;
  if (losePattern.test(working)) {
    suffixActions.push({ type: "loseThisAbility" });
    suffixRuleIds.push("suffix:loseThisAbility");
    working = working.replace(losePattern, "").trim();
  }

  return { strippedBody: working, suffixActions, suffixRuleIds };
}

const ruleDraw: Rule = (body) => {
  const m = body.match(/^(\d+)枚ドロー(?:する)?。?$/);
  if (!m) return null;
  return { ruleId: "draw", actions: [{ type: "draw", amount: Number(m[1]) }] };
};

const ruleSimpleStat: Rule = (body) => {
  const m = body.match(/^(AP|DP|SP)([+-]\d+)(?:する)?。?$/);
  if (!m) return null;
  return {
    ruleId: "modifyStat:simple",
    actions: [{
      type: "modifyStat",
      stat: m[1].toLowerCase() as "ap" | "dp" | "sp",
      amount: Number(m[2]),
    }],
  };
};

const ruleChoiceIntro: Rule = (body) => {
  if (!/^以下から1つを選び処理する。?$/.test(body)) return null;
  return {
    ruleId: "choice:intro",
    actions: [{ type: "choiceIntro", prompt: "selectOneAndResolve" }],
  };
};

const ruleSelfTrashThisCardFreeUse: Rule = (body) => {
  const patterns: Array<{ regex: RegExp; useKind: "character" | "event" | "item" | "area" }> = [
    { regex: /^(?:自分の)?ゴミ箱のこのキャラを無償で登場(?:できる|する)。?$/, useKind: "character" },
    { regex: /^(?:自分の)?ゴミ箱のこのキャラを登場(?:できる|する)。?$/, useKind: "character" },
    { regex: /^(?:自分の)?ゴミ箱のこのエリアを無償で配置(?:できる|する)。?$/, useKind: "area" },
    { regex: /^(?:自分の)?ゴミ箱のこのイベントを無償で使用(?:できる|する)。?$/, useKind: "event" },
    { regex: /^(?:自分の)?ゴミ箱のこのアイテムを無償で装備(?:できる|する)。?$/, useKind: "item" },
  ];
  for (const { regex, useKind } of patterns) {
    if (!regex.test(body)) continue;
    return {
      ruleId: `freeUse:thisCardFromTrash:${useKind}`,
      actions: [{
        type: "freeUse",
        sourceRef: "thisCardInTrash",
        sourceZone: "trash",
        sourceSubject: "thisCard",
        useKind,
        ignoreCost: true,
      }],
    };
  }
  return null;
};

const ruleSearchAndFreeUse: Rule = (body) => {
  const m = body.match(/^自分の(.+?)から[「『]([^」』]+)[」』](\d+)枚を探し無償で(登場|配置|装備|使用)する。?$/);
  if (!m) return null;

  const zoneText = m[1];
  const zones: Array<"trash" | "deck" | "hand"> = [];
  if (zoneText.includes("ゴミ箱")) zones.push("trash");
  if (zoneText.includes("デッキ")) zones.push("deck");
  if (zoneText.includes("手札")) zones.push("hand");
  if (zones.length === 0) return null;

  const useKind =
    m[4] === "登場" ? "character" :
    m[4] === "配置" ? "area" :
    m[4] === "装備" ? "item" : "event";

  return {
    ruleId: "searchCard:freeUse",
    actions: [
      {
        type: "searchCard",
        owner: "self",
        zones,
        match: { exactName: m[2] },
        min: Number(m[3]),
        max: Number(m[3]),
        storeAs: "searchedCard",
        shuffleAfterSearch: zones.includes("deck"),
      },
      {
        type: "freeUse",
        sourceRef: "searchedCard",
        sourceSubject: "searchedCard",
        useKind,
        ignoreCost: true,
      },
    ],
  };
};

const ruleChooseOne: Rule = (body, recurse) => {
  const parts = splitTopLevelChoice(body);
  if (parts.length !== 2) return null;

  const choices = parts.map((part) => {
    const nested = recurse(part);
    return nested.actions.length > 0 ? { actions: nested.actions } : null;
  });

  if (choices.some((choice) => choice == null)) return null;

  return {
    ruleId: "chooseOne",
    actions: [{
      type: "chooseOne",
      prompt: "하나를 선택한다",
      choices: choices as Array<{ actions: ParsedAction[] }>,
    }],
  };
};

const baseRules: Rule[] = [
  ...metaRules,
  ...keywordRules,
  ...durationRules,
  ...targetRules,
  ...moveRules,
  ...costRules,
  ruleChoiceIntro,
  ruleSearchAndFreeUse,
  ruleSelfTrashThisCardFreeUse,
  ruleDraw,
  ruleSimpleStat,
];

export function parseEffectBody(body: string): { actions: ParsedAction[]; matchedRuleIds: string[] } {
  const trimmed = body.trim();
  if (!trimmed) return { actions: [], matchedRuleIds: [] };

  const { strippedBody, suffixActions, suffixRuleIds } = parseSuffixActions(trimmed);

  const recurse = (nextBody: string): RuleMatch => {
    const nested = parseEffectBody(nextBody);
    return {
      ruleId: nested.matchedRuleIds[0] ?? "composite",
      actions: nested.actions,
    };
  };

  for (const rule of baseRules) {
    const match = rule(strippedBody, recurse);
    if (!match) continue;
    return {
      actions: [...match.actions, ...suffixActions],
      matchedRuleIds: [match.ruleId, ...suffixRuleIds],
    };
  }

  if (suffixActions.length > 0) {
    return {
      actions: suffixActions,
      matchedRuleIds: suffixRuleIds,
    };
  }

  return { actions: [], matchedRuleIds: [] };
}
