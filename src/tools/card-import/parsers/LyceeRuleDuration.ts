import type { Rule } from "./LyceeRuleRegistry.ts";

const ruleDurationStat: Rule = (body) => {
  const m = body.match(/ターン終了時まで(AP|DP|SP)([+-]\d+)/);
  return m ? {
    ruleId: "modifyStat:endOfTurn",
    actions: [{
      type: "modifyStat",
      stat: m[1].toLowerCase() as "ap" | "dp" | "sp",
      amount: Number(m[2]),
      duration: "endOfTurn",
    }],
  } : null;
};

export const durationRules: Rule[] = [ruleDurationStat];
