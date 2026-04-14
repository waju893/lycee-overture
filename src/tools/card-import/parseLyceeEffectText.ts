import type { ParseResult, ParsedEffectDraft, ParsedLineResult } from "./LyceeEffectParserTypes.ts";
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
  const { header, body } = extractHeader(line);
  const strippedTrigger = stripLeadingTriggerClause(body);
  const strippedCondition = stripLeadingConditionClause(strippedTrigger.effectBody);
  const parsed = parseEffectBody(strippedCondition.effectBody);
  if (parsed.actions.length === 0) {
    return { unresolved: { line, reason: "no parser rule matched" }, matchedRuleIds: [] };
  }
  const effect: ParsedEffectDraft = {
    header,
    timing: inferTiming(header, body),
    triggerText: strippedTrigger.triggerText,
    conditionText: strippedCondition.conditionText,
    conditions: strippedCondition.conditions,
    originalLine: line,
    actions: parsed.actions,
  };
  return { effect, matchedRuleIds: parsed.matchedRuleIds };
}

export function parseLyceeEffectText(text: string): ParseResult {
  const normalizedText = normalizeLyceeText(text);
  const lines = splitNormalizedLines(normalizedText);
  const parsedEffectsDraft: ParsedEffectDraft[] = [];
  const unresolvedTextLines: ParseResult["unresolvedTextLines"] = [];
  const matchedRuleIds: string[] = [];
  for (const line of lines) {
    const result = parseLine(line);
    if (result.effect) parsedEffectsDraft.push(result.effect);
    if (result.unresolved) unresolvedTextLines.push(result.unresolved);
    matchedRuleIds.push(...result.matchedRuleIds);
  }
  return {
    parsedEffectsDraft,
    unresolvedTextLines,
    parseMeta: { originalText: text, normalizedText, lines, matchedRuleIds },
  };
}
