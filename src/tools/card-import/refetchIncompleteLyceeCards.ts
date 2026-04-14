/**
 * Refetch incomplete Lycee card JSON files.
 *
 * Purpose:
 * - Re-fetch only incomplete cards in public/cards
 * - Fix cards with missing text/textKr/name/cardNo/sourceUrl
 * - Overwrite broken stub JSONs with full detail JSONs
 *
 * Usage:
 *   npx ts-node src/tools/card-import/refetchIncompleteLyceeCards.ts <saveDir> [delayMs] [concurrency]
 *
 * Example:
 *   npx ts-node src/tools/card-import/refetchIncompleteLyceeCards.ts "C:/Users/DESKTOP/Desktop/lycee-overture/public/cards" 350 1
 */

import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  fetchHtmlWithRetry,
  isAllowedCardNo,
  normalizeInputCardNo,
  parseDetailHtml,
  saveCard,
  writeJson,
} from "./crawlLyceeCardsFinalV4.ts";

type IncompleteReason =
  | "missing_cardNo"
  | "missing_name"
  | "missing_type"
  | "missing_text_key"
  | "empty_text"
  | "missing_textKr_key"
  | "empty_textKr"
  | "missing_sourceUrl"
  | "invalid_cardNo"
  | "invalid_json";

type IncompleteEntry = {
  file: string;
  cardNo: string;
  reasons: IncompleteReason[];
};

const DETAIL_FETCH_RETRY = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hasOwn(obj: unknown, key: string): boolean {
  return !!obj && typeof obj === "object" && Object.prototype.hasOwnProperty.call(obj, key);
}

function isNonEmptyString(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function collectReasons(filename: string, raw: unknown): IncompleteEntry | null {
  const fileCardNo = normalizeInputCardNo(path.basename(filename, ".json"));
  const reasons: IncompleteReason[] = [];

  if (!raw || typeof raw !== "object") {
    return { file: filename, cardNo: fileCardNo, reasons: ["invalid_json"] };
  }

  const record = raw as Record<string, unknown>;
  const cardNo = isNonEmptyString(record.cardNo) ? normalizeInputCardNo(String(record.cardNo)) : fileCardNo;

  if (!hasOwn(record, "cardNo") || !isNonEmptyString(record.cardNo)) reasons.push("missing_cardNo");
  if (!hasOwn(record, "name") || !isNonEmptyString(record.name)) reasons.push("missing_name");
  if (!hasOwn(record, "type") || !isNonEmptyString(record.type)) reasons.push("missing_type");
  if (!hasOwn(record, "text")) reasons.push("missing_text_key");
  if (hasOwn(record, "text") && !isNonEmptyString(record.text)) reasons.push("empty_text");
  if (!hasOwn(record, "textKr")) reasons.push("missing_textKr_key");
  if (hasOwn(record, "textKr") && !isNonEmptyString(record.textKr)) reasons.push("empty_textKr");
  if (!hasOwn(record, "sourceUrl") || !isNonEmptyString(record.sourceUrl)) reasons.push("missing_sourceUrl");
  if (!isAllowedCardNo(cardNo)) reasons.push("invalid_cardNo");

  if (reasons.length === 0) return null;
  return { file: filename, cardNo, reasons: Array.from(new Set(reasons)) };
}

async function findIncompleteCards(saveDir: string): Promise<IncompleteEntry[]> {
  const entries = await fs.readdir(saveDir, { withFileTypes: true });
  const out: IncompleteEntry[] = [];

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!/^LO-\d{4}(?:-[A-Za-z])?\.json$/i.test(entry.name)) continue;

    const fullPath = path.join(saveDir, entry.name);
    try {
      const rawText = await fs.readFile(fullPath, "utf-8");
      const parsed = JSON.parse(rawText) as unknown;
      const incomplete = collectReasons(entry.name, parsed);
      if (incomplete) out.push(incomplete);
    } catch {
      out.push({
        file: entry.name,
        cardNo: normalizeInputCardNo(path.basename(entry.name, ".json")),
        reasons: ["invalid_json"],
      });
    }
  }

  return out.sort((a, b) => a.cardNo.localeCompare(b.cardNo));
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
  const delayMs = Number.parseInt(process.argv[3] ?? "350", 10);
  const concurrency = Number.parseInt(process.argv[4] ?? "1", 10);

  if (!Number.isInteger(delayMs) || delayMs < 0) throw new Error("delayMs must be a non-negative integer.");
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 4) throw new Error("concurrency must be an integer between 1 and 4.");

  const incomplete = await findIncompleteCards(saveDir);
  console.log(`INCOMPLETE_FOUND total=${incomplete.length}`);

  const failed: Array<{ cardNo: string; reason: string }> = [];
  const saved: string[] = [];

  await runPool(incomplete, concurrency, async (entry, index) => {
    const url = `https://lycee-tcg.com/card/card_detail.pl?cardno=${encodeURIComponent(entry.cardNo)}`;

    try {
      const html = await fetchHtmlWithRetry(url, DETAIL_FETCH_RETRY, 1500);
      const parsed = parseDetailHtml(html, entry.cardNo, url);

      if (!parsed) {
        failed.push({ cardNo: entry.cardNo, reason: "parse_fail" });
        console.log(`[${index + 1}/${incomplete.length}] FAIL ${entry.cardNo} parse_fail`);
      } else {
        await saveCard(saveDir, parsed);
        saved.push(entry.cardNo);
        console.log(`[${index + 1}/${incomplete.length}] SAVE ${entry.cardNo} ${parsed.name}`);
      }
    } catch (error) {
      failed.push({ cardNo: entry.cardNo, reason: String(error) });
      console.log(`[${index + 1}/${incomplete.length}] FAIL ${entry.cardNo} ${String(error)}`);
    }

    if (delayMs > 0) {
      await sleep(delayMs);
    }
  });

  await writeJson(saveDir, "_refetch_incomplete_candidates.json", incomplete);
  await writeJson(saveDir, "_refetch_incomplete_summary.json", {
    mode: "refetch_incomplete_lycee_cards",
    totalCandidates: incomplete.length,
    saved: saved.length,
    failed: failed.length,
    savedCardNos: saved,
    failedCards: failed,
  });

  console.log(`DONE candidates=${incomplete.length} saved=${saved.length} failed=${failed.length}`);
}

function isMainModule(metaUrl: string): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  return pathToFileURL(entry).href === metaUrl;
}

if (isMainModule(import.meta.url)) {
  void main();
}
