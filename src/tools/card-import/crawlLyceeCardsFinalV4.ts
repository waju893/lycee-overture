/**
 * Lycee crawler V4
 *
 * Notes:
 * - Parses card detail pages with cheerio
 * - Decodes response by charset, with mojibake fallback
 * - Saves textKr as the original Japanese text initially
 * - Use translateLyceeTextKrWithPapago.ts later to replace textKr with Korean
 *
 * Requirements:
 *   npm install cheerio iconv-lite
 *
 * Usage:
 *   npx ts-node src/tools/card-import/crawlLyceeCardsFinalV4.ts <saveDir> [startPage] [delayMs] [concurrency]
 *
 * Example:
 *   npx ts-node src/tools/card-import/crawlLyceeCardsFinalV4.ts "C:/Users/DESKTOP/Desktop/lycee-overture/public/cards" 1 350 1
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
  textKr: string;
  sourceUrl: string;
};

type FailedCard = {
  cardNo: string;
  reason: string;
};

const REQUEST_TIMEOUT_MS = 30000;
const PAGE_FETCH_RETRY = 3;
const DETAIL_FETCH_RETRY = 3;
const LIST_LIMIT = 200;
const EMPTY_PAGE_STREAK_TO_STOP = 2;
const ALLOWED_SUFFIXES = new Set(["", "-A", "-B", "-C", "-D", "-K", "-S", "-V"]);

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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeInputCardNo(cardNo: string): string {
  return cardNo.trim().replace(/-([a-z])$/, (_, s: string) => `-${s.toUpperCase()}`);
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function parseNumber(value: string): number | null {
  const v = value.trim();
  return /^\d+$/.test(v) ? Number.parseInt(v, 10) : null;
}

function mapAttributeSymbols(input: string, dedupe: boolean): string[] {
  const out: string[] = [];
  for (const ch of input.trim()) {
    const mapped = ATTRIBUTE_MAP[ch];
    if (mapped) out.push(mapped);
  }
  return dedupe ? Array.from(new Set(out)) : out;
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

function isAllowedCardNo(cardNo: string): boolean {
  const match = cardNo.match(/^(LO-\d{4})(?:-([A-Za-z]))?$/);
  if (!match) return false;
  const suffix = match[2] ? `-${match[2].toUpperCase()}` : "";
  return ALLOWED_SUFFIXES.has(suffix);
}

function maybeLooksLikeMojibake(text: string): boolean {
  const badMarkers = ["繧", "縺", "鬨", "螳", "譌", "蛻", "繝"];
  return badMarkers.some((marker) => text.includes(marker));
}

async function fetchDecodedHtml(url: string): Promise<string> {
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

    const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
    const buffer = Buffer.from(await response.arrayBuffer());

    if (contentType.includes("shift_jis") || contentType.includes("shift-jis") || contentType.includes("sjis")) {
      return iconv.decode(buffer, "Shift_JIS");
    }

    const utf8Text = buffer.toString("utf8");
    if (maybeLooksLikeMojibake(utf8Text)) {
      const sjisText = iconv.decode(buffer, "Shift_JIS");
      if (!maybeLooksLikeMojibake(sjisText)) {
        return sjisText;
      }
    }

    return utf8Text;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchHtmlWithRetry(url: string, attempts: number, backoffMs: number): Promise<string> {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fetchDecodedHtml(url);
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await sleep(backoffMs * attempt);
      }
    }
  }
  throw lastError;
}

function decodeCellHtmlToLines(cellHtml: string): string[] {
  if (!cellHtml) return [];
  return cellHtml
    .split(/<br\s*\/?>/i)
    .map((part) => cheerio.load(`<div>${part}</div>`)("div").text())
    .map(normalizeText)
    .filter(Boolean);
}

function parseDetailHtml(html: string, requestedCardNo: string, sourceUrl: string): ParsedCardDetail | null {
  if (html.includes("カードが見つかりません")) {
    return null;
  }

  const $ = cheerio.load(html, { decodeEntities: false });
  const tables = $("#contents table").toArray();

  const cardTable = tables.find((table) => {
    const flatTexts = $(table).find("td").toArray().map((td) => normalizeText($(td).text()));
    return flatTexts.includes(requestedCardNo);
  });

  if (!cardTable) {
    return null;
  }

  const rows = $(cardTable).find("tr").toArray().map((tr) =>
    $(tr).find("td").toArray().map((td) => ({
      text: normalizeText($(td).text()),
      html: $(td).html() ?? "",
    }))
  );

  const row1 = rows[0] ?? [];
  const row3 = rows[2] ?? [];
  const row4 = rows[3] ?? [];

  const cardNoCellIndex = row1.findIndex((cell) => cell.text === requestedCardNo);
  if (cardNoCellIndex === -1) {
    return null;
  }

  const nameCell = row1[cardNoCellIndex + 1];
  const typeCell = row1[cardNoCellIndex + 2];
  const rarityCell = row1[cardNoCellIndex + 3];

  if (!nameCell || !typeCell || !rarityCell) {
    return null;
  }

  const nameLines = decodeCellHtmlToLines(nameCell.html);
  const title = nameLines[0] ?? nameCell.text;
  const subName = nameLines[1] ?? "";

  const rawTypeJa = typeCell.text;
  const rarity = rarityCell.text;

  const attributesRaw = row3[0]?.text ?? "";
  const exRaw = row3[1]?.text ?? "";
  const costRaw = row3[2]?.text ?? "";
  const restrictionRaw = row3[3]?.text ?? "";
  const apRaw = row3[4]?.text ?? "";
  const dpRaw = row3[5]?.text ?? "";
  const spRaw = row3[6]?.text ?? "";
  const dmgRaw = row3[7]?.text ?? "";
  const typeTagsRaw = row3[8]?.text ?? "";

  let text = "";
  if (row4.length > 0) {
    const effectCell = row4[row4.length - 1];
    const effectLines = decodeCellHtmlToLines(effectCell.html)
      .map((line) => line.replace(/\[このカードを使用したデッキを検索する\]/g, "").trim())
      .filter(Boolean)
      .filter((line) => line.startsWith("[") || line.startsWith("※"));
    text = effectLines.join("\n").trim();
  }

  const typeInfo = extractTypeInfo(rawTypeJa);

  return {
    cardNo: requestedCardNo,
    title,
    subName,
    name: [title, subName].filter(Boolean).join(" ").trim(),
    rawTypeJa: typeInfo.rawTypeJa,
    rawTypeKr: typeInfo.rawTypeKr,
    type: typeInfo.type,
    rarity,
    attributes: mapAttributeSymbols(attributesRaw, true),
    useTarget: mapAttributeSymbols(costRaw, false),
    ap: parseNumber(apRaw),
    dp: parseNumber(dpRaw),
    sp: parseNumber(spRaw),
    dmg: parseNumber(dmgRaw),
    ex: parseNumber(exRaw),
    costRaw,
    restrictionRaw,
    typeTagsRaw,
    text,
    textKr: text,
    sourceUrl,
  };
}

function discoverCardNosFromListHtml(html: string): string[] {
  const matches = html.match(/LO-\d{4}(?:-[A-Za-z])?/g) ?? [];
  return Array.from(new Set(matches.map((value) => normalizeInputCardNo(value)).filter((value) => isAllowedCardNo(value)))).sort();
}

async function discoverAllCardNos(startPage: number, delayMs: number): Promise<string[]> {
  const found = new Set<string>();
  let emptyStreak = 0;
  let page = startPage;

  while (emptyStreak < EMPTY_PAGE_STREAK_TO_STOP) {
    const url =
      `https://lycee-tcg.com/card/?deck=&smenu=&recommend=&word=&f_parallel=1&f_title=1` +
      `&cost_min=0&cost_max=&ex_min=&ex_max=&ap_min=&ap_max=&dp_min=&dp_max=&sp_min=&sp_max=` +
      `&dmg_min=&dmg_max=&sort=&limit=${LIST_LIMIT}&output=&view=&page=${page}`;

    try {
      const html = await fetchHtmlWithRetry(url, PAGE_FETCH_RETRY, 1200);
      const cardNos = discoverCardNosFromListHtml(html);

      if (cardNos.length > 0) {
        emptyStreak = 0;
        for (const cardNo of cardNos) found.add(cardNo);
        console.log(`DISCOVER page=${page} cards=${cardNos.length} total=${found.size}`);
      } else {
        emptyStreak += 1;
        console.log(`DISCOVER_EMPTY page=${page}`);
      }
    } catch (error) {
      emptyStreak += 1;
      console.log(`DISCOVER_FAIL page=${page} ${String(error)}`);
    }

    if (delayMs > 0) await sleep(delayMs);
    page += 1;
  }

  return Array.from(found).sort();
}

async function saveCard(saveDir: string, card: ParsedCardDetail): Promise<void> {
  const filePath = path.join(saveDir, `${card.cardNo}.json`);
  await fs.writeFile(filePath, `${JSON.stringify(card, null, 2)}\n`, "utf-8");
}

async function writeJson(saveDir: string, filename: string, value: unknown): Promise<void> {
  const filePath = path.join(saveDir, filename);
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf-8");
}

async function runPool<T>(items: T[], concurrency: number, worker: (item: T, index: number) => Promise<void>): Promise<void> {
  let cursor = 0;
  const runners = Array.from({ length: concurrency }, async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      await worker(items[index], index);
    }
  });
  await Promise.all(runners);
}

async function main(): Promise<void> {
  const saveDir = process.argv[2] ?? "C:/Users/DESKTOP/Desktop/lycee-overture/public/cards";
  const startPage = Number.parseInt(process.argv[3] ?? "1", 10);
  const delayMs = Number.parseInt(process.argv[4] ?? "300", 10);
  const concurrency = Number.parseInt(process.argv[5] ?? "1", 10);

  if (!Number.isInteger(startPage) || startPage < 1) throw new Error("startPage must be a positive integer.");
  if (!Number.isInteger(delayMs) || delayMs < 0) throw new Error("delayMs must be a non-negative integer.");
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 4) throw new Error("concurrency must be an integer between 1 and 4.");

  await fs.mkdir(saveDir, { recursive: true });

  console.log(`DISCOVER_START startPage=${startPage}`);
  const discovered = await discoverAllCardNos(startPage, delayMs);
  console.log(`DISCOVER_DONE total=${discovered.length}`);

  let saved = 0;
  let failed = 0;
  const failedCards: FailedCard[] = [];

  await runPool(discovered, concurrency, async (cardNo, index) => {
    const url = `https://lycee-tcg.com/card/card_detail.pl?cardno=${encodeURIComponent(cardNo)}`;
    try {
      const html = await fetchHtmlWithRetry(url, DETAIL_FETCH_RETRY, 1500);
      const parsed = parseDetailHtml(html, cardNo, url);

      if (!parsed) {
        failed += 1;
        failedCards.push({ cardNo, reason: "parse_fail" });
        console.log(`[${index + 1}/${discovered.length}] FAIL ${cardNo} parse_fail`);
      } else {
        await saveCard(saveDir, parsed);
        saved += 1;
        console.log(`[${index + 1}/${discovered.length}] SAVE ${cardNo} ${parsed.name}`);
      }
    } catch (error) {
      failed += 1;
      failedCards.push({ cardNo, reason: String(error) });
      console.log(`[${index + 1}/${discovered.length}] FAIL ${cardNo} ${String(error)}`);
    }

    if (delayMs > 0) await sleep(delayMs);
  });

  await writeJson(saveDir, "_failed_cards_final_v4.json", failedCards);
  await writeJson(saveDir, "_crawler_final_v4_summary.json", {
    mode: "lycee_final_parser_v4",
    startPage,
    delayMs,
    concurrency,
    discovered: discovered.length,
    saved,
    failed,
    allowedSuffixes: Array.from(ALLOWED_SUFFIXES.values()),
  });

  console.log(`DONE discovered=${discovered.length} saved=${saved} failed=${failed}`);
}

void main();
