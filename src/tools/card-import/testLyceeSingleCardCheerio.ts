/**
 * Lycee single-card parser using cheerio
 *
 * Requirements:
 *   npm install cheerio iconv-lite
 *
 * Usage:
 *   npx ts-node src/tools/card-import/testLyceeSingleCardCheerio.ts <cardNo> [saveDir]
 *
 * Examples:
 *   npx ts-node src/tools/card-import/testLyceeSingleCardCheerio.ts LO-0001
 *   npx ts-node src/tools/card-import/testLyceeSingleCardCheerio.ts LO-6629
 *   npx ts-node src/tools/card-import/testLyceeSingleCardCheerio.ts LO-3369-A
 */

import fs from "node:fs/promises";
import path from "node:path";
import iconv from "iconv-lite";
import * as cheerio from "cheerio";

type CardType = "character" | "item" | "event" | "area" | "unknown";

type ParsedCardDetail = {
  cardNo: string;
  title: string;
  subName: string;
  name: string;
  rawTypeJa: string;
  rawTypeKr: string;
  type: CardType;
  rarity: string;
  attributes: string[];
  useTarget: string[];
  ap: number | null;
  dp: number | null;
  sp: number | null;
  dmg: number | null;
  ex: number | null;
  costRaw: string;
  restrictionRaw: string;
  typeTagsRaw: string;
  text: string;
  sourceUrl: string;
  debug: {
    tableCount: number;
    firstTableRowTexts: string[][];
  };
};

const REQUEST_TIMEOUT_MS = 30000;

const TYPE_MAP: Record<string, { en: CardType; kr: string }> = {
  "キャラクター": { en: "character", kr: "캐릭터" },
  "イベント": { en: "event", kr: "이벤트" },
  "アイテム": { en: "item", kr: "아이템" },
  "エリア": { en: "area", kr: "에리어" },
};

const ATTRIBUTE_MAP: Record<string, string> = {
  "雪": "snow",
  "月": "moon",
  "花": "flower",
  "宙": "cosmos",
  "日": "sun",
  "無": "star",
};

function normalizeInputCardNo(cardNo: string): string {
  return cardNo.trim().replace(/-([a-z])$/, (_, s: string) => `-${s.toUpperCase()}`);
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function mapAttributeSymbols(input: string): string[] {
  const out: string[] = [];
  for (const ch of input.trim()) {
    const mapped = ATTRIBUTE_MAP[ch];
    if (mapped) out.push(mapped);
  }
  return Array.from(new Set(out));
}

function parseNumber(value: string): number | null {
  const v = value.trim();
  return /^\d+$/.test(v) ? Number.parseInt(v, 10) : null;
}

function extractTypeInfo(rawTypeJa: string): {
  rawTypeJa: string;
  rawTypeKr: string;
  type: CardType;
} {
  const v = rawTypeJa.trim();
  const mapped = TYPE_MAP[v];
  if (!mapped) {
    return {
      rawTypeJa: v || "unknown",
      rawTypeKr: "알수없음",
      type: "unknown",
    };
  }
  return {
    rawTypeJa: v,
    rawTypeKr: mapped.kr,
    type: mapped.en,
  };
}

async function fetchHtmlShiftJis(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36",
        "Accept":
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "ja,en-US;q=0.9,en;q=0.8,ko;q=0.7",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
        "Referer": "https://lycee-tcg.com/card/",
      },
      redirect: "follow",
    });

    if (response.status === 404) {
      throw new Error("HTTP 404");
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const buffer = await response.arrayBuffer();
    return iconv.decode(Buffer.from(buffer), "Shift_JIS");
  } finally {
    clearTimeout(timer);
  }
}

function parseDetailHtml(html: string, requestedCardNo: string, sourceUrl: string): ParsedCardDetail | null {
  if (html.includes("カードが見つかりません")) {
    return null;
  }

  const $ = cheerio.load(html, { decodeEntities: false });

  const tables = $("#contents table").toArray();
  const rowMatrix: string[][] = tables.map((table) =>
    $(table)
      .find("tr")
      .toArray()
      .map((tr) =>
        $(tr)
          .find("td")
          .toArray()
          .map((td) => normalizeText($(td).text()))
          .filter(Boolean)
      )
      .filter((row) => row.length > 0)
  );

  const firstCardTableRows = rowMatrix.find((rows) =>
    rows.some((row) => row.includes(requestedCardNo))
  );

  if (!firstCardTableRows) {
    return null;
  }

  const row1 = firstCardTableRows[0] ?? [];
  const row3 = firstCardTableRows[2] ?? [];
  const row4 = firstCardTableRows[3] ?? [];

  // Expected row1:
  // [LO-0001, 騎士王 セイバー／アルトリア・ペンドラゴン, キャラクター, R]
  // or sometimes title/subName may have separator spacing
  const cardNo = row1[0] ?? "";
  if (cardNo !== requestedCardNo) {
    return null;
  }

  const titleAndSub = row1[1] ?? "";
  const rawTypeJa = row1[2] ?? "unknown";
  const rarity = row1[3] ?? "";

  // Prefer split by full-width slash if present in subname structure,
  // but for this site title and subname are stacked with <br>, so text is often joined with a space.
  let title = "";
  let subName = "";

  const row1Html = $(tables.find((table) =>
    $(table).find("tr").first().find("td").toArray().some((td) => normalizeText($(td).text()) === requestedCardNo)
  )!).find("tr").eq(0).find("td").eq(2).html() ?? "";

  const partsFromHtml = row1Html
    .split(/<br\s*\/?>/i)
    .map((part) => cheerio.load(`<div>${part}</div>`)("div").text())
    .map(normalizeText)
    .filter(Boolean);

  if (partsFromHtml.length >= 2) {
    title = partsFromHtml[0];
    subName = partsFromHtml[1];
  } else {
    const words = titleAndSub.split(/\s+/).filter(Boolean);
    if (words.length >= 2) {
      title = words[0];
      subName = words.slice(1).join(" ");
    } else {
      title = titleAndSub;
      subName = "";
    }
  }

  // Expected row3:
  // [宙, 2, 宙宙宙, 3, 3, 1, 3, サーヴァント]
  const attributesRaw = row3[0] ?? "";
  const exRaw = row3[1] ?? "";
  const costRaw = row3[2] ?? "";
  const restrictionRaw = row3[3] ?? "";
  const apRaw = row3[4] ?? "";
  const dpRaw = row3[5] ?? "";
  const spRaw = row3[6] ?? "";
  const dmgRaw = row3[7] ?? "";
  const typeTagsRaw = row3[8] ?? "";

  // Expected row4 first cell text contains effect and deck-search text
  let text = "";
  const effectCellHtml = $(tables.find((table) =>
    $(table).find("tr").first().find("td").toArray().some((td) => normalizeText($(td).text()) === requestedCardNo)
  )!).find("tr").eq(3).find("td").last().html() ?? "";

  const effectParts = effectCellHtml
    .split(/<br\s*\/?>/i)
    .map((part) => cheerio.load(`<div>${part}</div>`)("div").text())
    .map(normalizeText)
    .filter(Boolean)
    .filter((line) => line !== "[このカードを使用したデッキを検索する]");

  text = effectParts.filter((line) => line.startsWith("[") || line.startsWith("※")).join("\n").trim();

  const typeInfo = extractTypeInfo(rawTypeJa);

  return {
    cardNo,
    title,
    subName,
    name: [title, subName].filter(Boolean).join(" ").trim(),
    rawTypeJa: typeInfo.rawTypeJa,
    rawTypeKr: typeInfo.rawTypeKr,
    type: typeInfo.type,
    rarity,
    attributes: mapAttributeSymbols(attributesRaw),
    useTarget: mapAttributeSymbols(costRaw),
    ap: parseNumber(apRaw),
    dp: parseNumber(dpRaw),
    sp: parseNumber(spRaw),
    dmg: parseNumber(dmgRaw),
    ex: parseNumber(exRaw),
    costRaw,
    restrictionRaw,
    typeTagsRaw,
    text,
    sourceUrl,
    debug: {
      tableCount: tables.length,
      firstTableRowTexts: firstCardTableRows,
    },
  };
}

async function main(): Promise<void> {
  const rawCardNo = process.argv[2];
  const saveDir = process.argv[3];

  if (!rawCardNo) {
    throw new Error(
      "Usage: npx ts-node src/tools/card-import/testLyceeSingleCardCheerio.ts <cardNo> [saveDir]"
    );
  }

  const cardNo = normalizeInputCardNo(rawCardNo);
  const sourceUrl = `https://lycee-tcg.com/card/card_detail.pl?cardno=${encodeURIComponent(cardNo)}`;
  const html = await fetchHtmlShiftJis(sourceUrl);
  const parsed = parseDetailHtml(html, cardNo, sourceUrl);

  if (!parsed) {
    console.log("NOT_FOUND_OR_PARSE_FAIL", cardNo);
    return;
  }

  console.log(JSON.stringify(parsed, null, 2));

  if (saveDir) {
    await fs.mkdir(saveDir, { recursive: true });
    const filePath = path.join(saveDir, `${parsed.cardNo}.json`);
    await fs.writeFile(filePath, `${JSON.stringify(parsed, null, 2)}\n`, "utf-8");
    console.log("SAVED", filePath);
  }
}

void main();
