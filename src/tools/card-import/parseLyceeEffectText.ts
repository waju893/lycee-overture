import type {
  ParseResult,
  ParsedEffectDraft,
  ParsedLineResult,
} from "./LyceeEffectParserTypes.ts";
import {
  extractHeader,
  inferTiming,
  normalizeLyceeText,
  splitNormalizedLines,
  stripLeadingConditionClause,
  stripLeadingTriggerClause,
} from "./parsers/LyceeRuleHelpers.ts";
import { parseEffectBody } from "./parsers/LyceeRuleRegistry.ts";

function parseLine(line: string): ParsedLineResult {
  const { header, body: headerBody } = extractHeader(line);

  const triggerResult = stripLeadingTriggerClause(headerBody);
  const bodyAfterTrigger = triggerResult.effectBody;

  const conditionResult = stripLeadingConditionClause(bodyAfterTrigger);
  const body = conditionResult.effectBody;

  const { actions, matchedRuleIds } = parseEffectBody(body);
  const timing = inferTiming(header, headerBody);

  if (actions.length > 0) {
    const effect: ParsedEffectDraft = {
      header,
      timing,
      triggerText: triggerResult.triggerText,
      conditionText: conditionResult.conditionText,
      conditions: conditionResult.conditions,
      originalLine: line,
      actions,
    };
    return { effect, matchedRuleIds };
  }

  return {
    unresolved: { line, reason: "no rule matched" },
    matchedRuleIds,
  };
}

export function parseLyceeEffectText(text: string): ParseResult {
  const normalizedText = normalizeLyceeText(text);
  const lines = splitNormalizedLines(normalizedText);

  const parsedEffectsDraft: ParsedEffectDraft[] = [];
  const unresolvedTextLines: ParseResult["unresolvedTextLines"] = [];
  const matchedRuleIds: string[] = [];

  for (const line of lines) {
    const parsed = parseLine(line);

    if (parsed.effect) parsedEffectsDraft.push(parsed.effect);
    if (parsed.unresolved) unresolvedTextLines.push(parsed.unresolved);
    if (parsed.matchedRuleIds.length > 0) {
      matchedRuleIds.push(...parsed.matchedRuleIds);
    }
  }

  return {
    parsedEffectsDraft,
    unresolvedTextLines,
    parseMeta: {
      originalText: text,
      normalizedText,
      lines,
      matchedRuleIds,
    },
  };
}
