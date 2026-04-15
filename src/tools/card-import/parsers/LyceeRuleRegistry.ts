import type { ParsedAction } from "../LyceeEffectParserTypes.ts";
import { splitTopLevelChoice } from "./LyceeRuleHelpers.ts";
import { parseEffectBody as originalParseEffectBody } from "./LyceeRuleRegistry_original.ts";
export type { Rule } from "./LyceeRuleRegistry_original.ts";

export function parseEffectBody(body: string): { actions: ParsedAction[]; matchedRuleIds: string[] } {
  const parts = splitTopLevelChoice(body);
  const base = originalParseEffectBody(body);

  if (parts.length >= 2) {
    const choices = parts.map((part) => {
      const sub = originalParseEffectBody(part.trim());
      return {
        actions: sub.actions ?? [],
      };
    });

    return {
      actions: [
        {
          type: "chooseOne",
          prompt: "하나를 선택한다",
          choices,
        },
        ...base.actions,
      ],
      matchedRuleIds: [...base.matchedRuleIds, "chooseOne.multi"],
    };
  }

  return base;
}
