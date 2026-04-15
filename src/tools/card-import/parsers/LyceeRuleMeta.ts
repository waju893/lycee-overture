import type { RuleMatch } from "../LyceeEffectParserTypes.ts";

function ignore(body: string, ruleId: string): RuleMatch {
  return {
    ruleId,
    actions: [{ type: "metaIgnore", text: body }],
  };
}

function ruleConstructionRestriction(body: string): RuleMatch | null {
  if (!body.startsWith("構築制限:")) return null;
  return ignore(body, "meta:constructionRestriction");
}

function ruleAsteriskMeta(body: string): RuleMatch | null {
  if (!body.startsWith("※")) return null;
  return ignore(body, "meta:asterisk");
}

function ruleInitialRelease(body: string): RuleMatch | null {
  if (!/^初出\s*[:：]/.test(body)) return null;
  return ignore(body, "meta:initialRelease");
}

function ruleDash(body: string): RuleMatch | null {
  if (body !== "-") return null;
  return ignore(body, "meta:dash");
}

export const metaRules = [
  ruleConstructionRestriction,
  ruleAsteriskMeta,
  ruleInitialRelease,
  ruleDash,
];
