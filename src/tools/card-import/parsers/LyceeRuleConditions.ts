import type { Rule } from "./LyceeRuleRegistry.ts";

const ruleBattleConditionStat: Rule = (body, recurse) => {
  const match = body.match(/^このキャラが参加しているバトル中、?(.+)$/);
  if (!match) return null;
  const nested = recurse(match[1].trim());
  if (nested.actions.length === 0) return null;
  return { ruleId: "condition:inBattle", actions: nested.actions };
};

const ruleSelfTurnCondition: Rule = (body, recurse) => {
  const match = body.match(/^自ターン中、?(.+)$/);
  if (!match) return null;
  const nested = recurse(match[1].trim());
  if (nested.actions.length === 0) return null;
  return { ruleId: "condition:selfTurn", actions: nested.actions };
};

const ruleOpponentTurnCondition: Rule = (body, recurse) => {
  const match = body.match(/^相手ターン中、?(.+)$/);
  if (!match) return null;
  const nested = recurse(match[1].trim());
  if (nested.actions.length === 0) return null;
  return { ruleId: "condition:opponentTurn", actions: nested.actions };
};

export const conditionRules: Rule[] = [
  ruleBattleConditionStat,
  ruleSelfTurnCondition,
  ruleOpponentTurnCondition,
];
