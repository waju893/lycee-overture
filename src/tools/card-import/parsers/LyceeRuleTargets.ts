import type { ParsedAction } from "../LyceeEffectParserTypes.ts";
import type { Rule } from "./LyceeRuleRegistry.ts";

function buildTargetedStatActions(
  owner: "self" | "opponent",
  stat: "ap" | "dp" | "sp",
  amount: number,
): ParsedAction[] {
  return [
    {
      type: "chooseTarget",
      selector: {
        owner,
        kind: "character",
        count: 1,
      },
      storeAs: "selectedTarget",
      prompt: owner === "self" ? "자기 캐릭터 1체를 선택한다" : "상대 캐릭터 1체를 선택한다",
    },
    {
      type: "modifyStat",
      stat,
      amount,
      targetRef: "selectedTarget",
    },
  ];
}

const ruleOpponentCharacterOneStat: Rule = (body) => {
  const match = body.match(/^相手(?:の)?キャラ1体.*?(AP|DP|SP)([+-]\d+)/);
  if (!match) return null;
  return {
    ruleId: "selector:opponentCharacterOne",
    actions: buildTargetedStatActions("opponent", match[1].toLowerCase() as "ap" | "dp" | "sp", Number(match[2])),
  };
};

const ruleSelfCharacterOneStat: Rule = (body) => {
  const match = body.match(/^(?:自分|味方)(?:の)?キャラ1体.*?(AP|DP|SP)([+-]\d+)/);
  if (!match) return null;
  return {
    ruleId: "selector:selfCharacterOne",
    actions: buildTargetedStatActions("self", match[1].toLowerCase() as "ap" | "dp" | "sp", Number(match[2])),
  };
};

const ruleOpponentCharacterOneTap: Rule = (body) => {
  if (!/^相手(?:の)?キャラ1体.*行動済み状態にする/.test(body)) return null;
  return {
    ruleId: "selector:opponentCharacterOne",
    actions: [
      {
        type: "chooseTarget",
        selector: { owner: "opponent", kind: "character", count: 1 },
        storeAs: "selectedTarget",
        prompt: "상대 캐릭터 1체를 선택한다",
      },
      { type: "applyState", state: "tap", target: "selectedTarget" },
    ],
  };
};

const ruleSelfCharacterOneUntap: Rule = (body) => {
  if (!/^(?:自分|味方)(?:の)?キャラ1体.*未行動状態にする/.test(body)) return null;
  return {
    ruleId: "selector:selfCharacterOne",
    actions: [
      {
        type: "chooseTarget",
        selector: { owner: "self", kind: "character", count: 1 },
        storeAs: "selectedTarget",
        prompt: "자기 캐릭터 1체를 선택한다",
      },
      { type: "applyState", state: "untap", target: "selectedTarget" },
    ],
  };
};

export const targetRules: Rule[] = [
  ruleOpponentCharacterOneStat,
  ruleSelfCharacterOneStat,
  ruleOpponentCharacterOneTap,
  ruleSelfCharacterOneUntap,
];
