import type {
  LyceeHeader,
  LyceeTiming,
  ParsedCondition,
} from "../LyceeEffectParserTypes.ts";

export function toHalfWidth(input: string): string {
  return input.replace(/[！-～]/g, (c) =>
    String.fromCharCode(c.charCodeAt(0) - 0xFEE0)
  );
}

export function normalizeText(input: string): string {
  return toHalfWidth(input)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
}

export function normalizeLyceeText(input: string): string {
  return normalizeText(input);
}

export function splitNormalizedLines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export function extractHeader(line: string): { header: LyceeHeader; body: string } {
  const match = line.match(/^\[([^\]]+)\]\s*(.*)$/);
  if (!match) {
    return { header: "unknown", body: line.trim() };
  }

  const raw = (match[1] ?? "").trim();
  const body = (match[2] ?? "").trim();

  const header: LyceeHeader =
    raw === "誘発" ||
    raw === "宣言" ||
    raw === "常時" ||
    raw === "手札宣言" ||
    raw === "使用代償"
      ? raw
      : "unknown";

  return { header, body };
}

export function inferTiming(header: LyceeHeader | undefined, body: string): LyceeTiming {
  if (/このキャラが手札から登場したとき/.test(body)) return "onEnterFromHand";
  if (/このキャラが登場したとき/.test(body)) return "onEnter";
  if (/自ターン開始時|相手ターン開始時|ターン開始時/.test(body)) return "onTurnStart";
  if (/ターン終了時/.test(body)) return "onTurnEnd";
  if (/攻撃宣言/.test(body)) return "onAttackDeclare";
  if (header === "常時") return "continuous";
  if (header === "宣言" || header === "手札宣言") return "onUse";
  return "unknown";
}

export function stripLeadingTriggerClause(body: string): {
  triggerText?: string;
  effectBody: string;
} {
  const trimmed = body.trim();

  const patterns = [
    /^(このキャラが手札から登場したとき)[、,]\s*(.+)$/,
    /^(このキャラが登場したとき)[、,]\s*(.+)$/,
    /^(自ターン開始時)[、,]\s*(.+)$/,
    /^(相手ターン開始時)[、,]\s*(.+)$/,
    /^(ターン開始時)[、,]\s*(.+)$/,
    /^(ターン終了時)[、,]\s*(.+)$/,
    /^(このキャラが破棄されたとき)[、,]\s*(.+)$/,
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match) {
      return {
        triggerText: match[1]?.trim(),
        effectBody: match[2]?.trim() ?? "",
      };
    }
  }

  return { effectBody: trimmed };
}

export function stripLeadingConditionClause(body: string): {
  conditionText?: string;
  effectBody: string;
  conditions?: ParsedCondition[];
} {
  const trimmed = body.trim();

  const patterns: Array<{
    pattern: RegExp;
    conditions: ParsedCondition[];
  }> = [
    {
      pattern: /^(このキャラが参加しているバトル中)[、,]\s*(.+)$/,
      conditions: [{ type: "inBattle", target: "self" }],
    },
    {
      pattern: /^(このキャラがバトルに参加している間)[、,]\s*(.+)$/,
      conditions: [{ type: "inBattle", target: "self" }],
    },
    {
      pattern: /^(自ターン中)[、,]\s*(.+)$/,
      conditions: [{ type: "turn", side: "self" }],
    },
    {
      pattern: /^(相手ターン中)[、,]\s*(.+)$/,
      conditions: [{ type: "turn", side: "opponent" }],
    },
  ];

  for (const { pattern, conditions } of patterns) {
    const match = trimmed.match(pattern);
    if (match) {
      return {
        conditionText: match[1]?.trim(),
        effectBody: match[2]?.trim() ?? "",
        conditions,
      };
    }
  }

  return { effectBody: trimmed };
}

export function containsJapanese(text: string): boolean {
  return /[ぁ-んァ-ン一-龯]/.test(text);
}

export function parseNumber(text: string): number | null {
  const match = text.match(/(\d+)/);
  return match ? Number(match[1]) : null;
}

export function extractQuotedName(text: string): string | undefined {
  const match = text.match(/[「『](.+?)[」』]/);
  return match?.[1]?.trim();
}

export function splitTopLevelChoice(text: string): string[] {
  const marker = "__LYCEE_OR__";

  const protectedText = text
    .replace(/ゴミ箱またはデッキ/g, `ゴミ箱${marker}デッキ`)
    .replace(/デッキまたはゴミ箱/g, `デッキ${marker}ゴミ箱`)
    .replace(/手札またはデッキ/g, `手札${marker}デッキ`)
    .replace(/デッキまたは手札/g, `デッキ${marker}手札`)
    .replace(/手札またはゴミ箱/g, `手札${marker}ゴミ箱`)
    .replace(/ゴミ箱または手札/g, `ゴミ箱${marker}手札`);

  if (!protectedText.includes("または")) {
    return [text.trim()];
  }

  const parts = protectedText
    .split("または")
    .map((part) => part.replace(new RegExp(marker, "g"), "または").trim())
    .filter(Boolean);

  if (parts.length <= 1) {
    return [text.trim()];
  }

  if (parts.length > 2) {
    return [parts[0], parts.slice(1).join("または")];
  }

  return parts;
}
