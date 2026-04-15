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

    return {
      effect,
      matchedRuleIds,
    };
  }

  return {
    unresolved: {
      line,
      reason: "no rule matched",
    },
    matchedRuleIds,
  };
}

function isChoiceIntroEffect(effect?: ParsedEffectDraft): boolean {
  return (effect?.actions ?? []).some((action) => action.type === "choiceIntro");
}

function stripChoiceBullet(line: string): string {
  return line.replace(/^[・●◦▪■◆◇\-]\s*/, "").trim();
}

function isChoiceBulletLine(line: string): boolean {
  return /^[・●◦▪■◆◇\-]\s*/.test(line.trim());
}

export function parseLyceeEffectText(text: string): ParseResult {
  const normalizedText = normalizeLyceeText(text);
  const lines = splitNormalizedLines(normalizedText);

  const parsedEffectsDraft: ParsedEffectDraft[] = [];
  const unresolvedTextLines: ParseResult["unresolvedTextLines"] = [];
  const matchedRuleIds: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const parsed = parseLine(line);

    if (
      parsed.effect &&
      isChoiceIntroEffect(parsed.effect)
    ) {
      const choices: Array<{ label: string; actions: ParsedEffectDraft["actions"] }> = [];
      const bulletMatchedRuleIds: string[] = [];
      const bulletOriginalLines: string[] = [];
      let cursor = index + 1;
      let allBulletsParsed = true;

      while (cursor < lines.length && isChoiceBulletLine(lines[cursor])) {
        const bulletLine = stripChoiceBullet(lines[cursor]);
        const bulletParsed = parseLine(bulletLine);

        if (!bulletParsed.effect || bulletParsed.effect.actions.length === 0) {
          allBulletsParsed = false;
          break;
        }

        bulletOriginalLines.push(lines[cursor]);
        choices.push({
          label: String.fromCharCode(65 + choices.length),
          actions: bulletParsed.effect.actions,
        });

        if (bulletParsed.matchedRuleIds.length > 0) {
          bulletMatchedRuleIds.push(...bulletParsed.matchedRuleIds);
        }

        cursor += 1;
      }

      if (allBulletsParsed && choices.length >= 2) {
        const effect: ParsedEffectDraft = {
          ...parsed.effect,
          originalLine: [parsed.effect.originalLine, ...bulletOriginalLines].join("\n"),
          actions: [
            {
              type: "chooseOne",
              prompt: "하나를 선택한다",
              choices,
            },
          ],
        };

        parsedEffectsDraft.push(effect);
        if (parsed.matchedRuleIds.length > 0) {
          matchedRuleIds.push(...parsed.matchedRuleIds);
        }
        if (bulletMatchedRuleIds.length > 0) {
          matchedRuleIds.push(...bulletMatchedRuleIds);
        }
        matchedRuleIds.push("choiceBlock.multiline");

        index = cursor - 1;
        continue;
      }
    }

    if (parsed.effect) {
      parsedEffectsDraft.push(parsed.effect);
    }
    if (parsed.unresolved) {
      unresolvedTextLines.push(parsed.unresolved);
    }
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
