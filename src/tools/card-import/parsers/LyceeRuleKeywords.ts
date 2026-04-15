import type { ParsedAction, RuleMatch } from "../LyceeEffectParserTypes.ts";
import type { Rule } from "./LyceeRuleRegistry.ts";

function splitBracketTagSequence(text: string): string[] {
  const parts: string[] = [];
  let i = 0;

  while (i < text.length) {
    if (text[i] !== "[") {
      i += 1;
      continue;
    }

    let depth = 0;
    const start = i;
    let end = -1;

    for (let j = i; j < text.length; j += 1) {
      const ch = text[j];
      if (ch === "[") {
        depth += 1;
      } else if (ch === "]") {
        depth -= 1;
        if (depth === 0) {
          end = j;
          break;
        }
      }
    }

    if (end >= 0) {
      parts.push(text.slice(start, end + 1));
      i = end + 1;
    } else {
      break;
    }
  }

  return parts;
}

function parseSingleTag(tag: string, recurse: (body: string) => RuleMatch): ParsedAction | null {
  if (!tag.startsWith("[") || !tag.endsWith("]")) return null;
  const inner = tag.slice(1, -1).trim();

  const exactMap: Record<string, ParsedAction> = {
    "アシスト": { type: "keywordTag", keyword: "assist" },
    "アグレッシブ": { type: "keywordTag", keyword: "aggressive" },
    "エンゲージ": { type: "keywordTag", keyword: "engage" },
    "リーダー": { type: "keywordTag", keyword: "leader" },
    "プリンシパル": { type: "keywordTag", keyword: "principal" },
  };
  if (exactMap[inner]) return exactMap[inner];

  const movementMatch = inner.match(/^(ステップ|サイドステップ|ジャンプ|オーダーステップ|オーダーチェンジ):\[(.+)\]$/);
  if (movementMatch) {
    const keyword =
      movementMatch[1] === "ステップ"
        ? "step"
        : movementMatch[1] === "サイドステップ"
          ? "sidestep"
          : movementMatch[1] === "ジャンプ"
            ? "jump"
            : movementMatch[1] === "オーダーステップ"
              ? "orderstep"
              : "orderchange";

    return {
      type: "keywordTag",
      keyword,
      value: movementMatch[2],
    };
  }

  const chargeMatch = inner.match(/^チャージ:(\d+)$/);
  if (chargeMatch) {
    return {
      type: "keywordTag",
      keyword: "charge",
      value: Number(chargeMatch[1]),
    };
  }

  const supporterMatch = inner.match(/^サポーター:\[(.+)\]$/);
  if (supporterMatch) {
    return {
      type: "keywordTag",
      keyword: "supporter",
      value: supporterMatch[1],
    };
  }

  const nestedMatch = inner.match(/^(ペナルティ|リカバリー|ボーナス|ターンリカバリー|エンゲージ):\[(.+)\]$/);
  if (nestedMatch) {
    const keyword =
      nestedMatch[1] === "ペナルティ"
        ? "penalty"
        : nestedMatch[1] === "リカバリー"
          ? "recovery"
          : nestedMatch[1] === "ボーナス"
            ? "bonus"
            : nestedMatch[1] === "ターンリカバリー"
              ? "turnRecovery"
              : "engage";

    const nested = recurse(nestedMatch[2].trim());
    return {
      type: "keywordTag",
      keyword,
      nestedActions: nested.actions,
    };
  }

  return null;
}

function ruleBracketTagSequence(body: string, recurse: (body: string) => RuleMatch): RuleMatch | null {
  const raw = body.trim();

  if (!raw.includes("[") || !raw.includes("]")) return null;

  const tags = splitBracketTagSequence(raw);
  if (tags.length === 0) return null;

  const reconstructed = tags.join("").replace(/\s+/g, "");
  const normalizedRaw = raw.replace(/\s+/g, "");
  if (reconstructed !== normalizedRaw) return null;

  const actions: ParsedAction[] = [];
  for (const tag of tags) {
    const parsed = parseSingleTag(tag, recurse);
    if (!parsed) return null;
    actions.push(parsed);
  }

  return {
    ruleId: "keywordTagSequence",
    actions,
  };
}

export const keywordRules: Rule[] = [ruleBracketTagSequence];
