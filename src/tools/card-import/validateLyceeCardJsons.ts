/**
 * Validate Lycee card JSON files and report incomplete cards.
 *
 * Usage:
 *   npx ts-node src/tools/card-import/validateLyceeCardJsons.ts <saveDir>
 *
 * Example:
 *   npx ts-node src/tools/card-import/validateLyceeCardJsons.ts "C:/Users/DESKTOP/Desktop/lycee-overture/public/cards"
 */

import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { normalizeInputCardNo, writeJson } from "./crawlLyceeCardsFinalV4.ts";

type ValidationReason =
  | "invalid_json"
  | "missing_cardNo"
  | "missing_name"
  | "missing_type"
  | "missing_text_key"
  | "empty_text"
  | "missing_textKr_key"
  | "empty_textKr"
  | "missing_sourceUrl"
  | "filename_cardNo_mismatch";

type InvalidCard = {
  file: string;
  cardNo: string;
  reasons: ValidationReason[];
  type?: string;
};

function hasOwn(obj: unknown, key: string): boolean {
  return !!obj && typeof obj === "object" && Object.prototype.hasOwnProperty.call(obj, key);
}

function isNonEmptyString(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function addCount(map: Record<string, number>, key: string): void {
  map[key] = (map[key] ?? 0) + 1;
}

async function main(): Promise<void> {
  const saveDir = process.argv[2] ?? "C:/Users/DESKTOP/Desktop/lycee-overture/public/cards";
  const entries = await fs.readdir(saveDir, { withFileTypes: true });

  const invalidCards: InvalidCard[] = [];
  const invalidByReason: Record<string, number> = {};
  const invalidByType: Record<string, number> = {};
  let total = 0;

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!/^LO-\d{4}(?:-[A-Za-z])?\.json$/i.test(entry.name)) continue;

    total += 1;
    const fullPath = path.join(saveDir, entry.name);
    const fileCardNo = normalizeInputCardNo(path.basename(entry.name, ".json"));

    try {
      const rawText = await fs.readFile(fullPath, "utf-8");
      const parsed = JSON.parse(rawText) as unknown;
      if (!parsed || typeof parsed !== "object") {
        invalidCards.push({ file: entry.name, cardNo: fileCardNo, reasons: ["invalid_json"] });
        addCount(invalidByReason, "invalid_json");
        addCount(invalidByType, "unknown");
        continue;
      }

      const record = parsed as Record<string, unknown>;
      const reasons: ValidationReason[] = [];
      const cardNo = isNonEmptyString(record.cardNo) ? normalizeInputCardNo(String(record.cardNo)) : fileCardNo;
      const type = isNonEmptyString(record.type) ? String(record.type) : "unknown";

      if (!hasOwn(record, "cardNo") || !isNonEmptyString(record.cardNo)) reasons.push("missing_cardNo");
      if (!hasOwn(record, "name") || !isNonEmptyString(record.name)) reasons.push("missing_name");
      if (!hasOwn(record, "type") || !isNonEmptyString(record.type)) reasons.push("missing_type");
      if (!hasOwn(record, "text")) reasons.push("missing_text_key");
      if (hasOwn(record, "text") && !isNonEmptyString(record.text)) reasons.push("empty_text");
      if (!hasOwn(record, "textKr")) reasons.push("missing_textKr_key");
      if (hasOwn(record, "textKr") && !isNonEmptyString(record.textKr)) reasons.push("empty_textKr");
      if (!hasOwn(record, "sourceUrl") || !isNonEmptyString(record.sourceUrl)) reasons.push("missing_sourceUrl");
      if (hasOwn(record, "cardNo") && isNonEmptyString(record.cardNo) && cardNo !== fileCardNo) {
        reasons.push("filename_cardNo_mismatch");
      }

      if (reasons.length > 0) {
        invalidCards.push({
          file: entry.name,
          cardNo,
          reasons,
          type,
        });
        for (const reason of reasons) addCount(invalidByReason, reason);
        addCount(invalidByType, type);
      }
    } catch {
      invalidCards.push({ file: entry.name, cardNo: fileCardNo, reasons: ["invalid_json"] });
      addCount(invalidByReason, "invalid_json");
      addCount(invalidByType, "unknown");
    }
  }

  invalidCards.sort((a, b) => a.cardNo.localeCompare(b.cardNo));

  await writeJson(saveDir, "_validate_lycee_cards_invalid.json", invalidCards);
  await writeJson(saveDir, "_validate_lycee_cards_summary.json", {
    mode: "validate_lycee_card_jsons",
    totalCards: total,
    invalidCards: invalidCards.length,
    invalidByReason,
    invalidByType,
  });

  console.log(`VALIDATE total=${total} invalid=${invalidCards.length}`);
}

function isMainModule(metaUrl: string): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  return pathToFileURL(entry).href === metaUrl;
}

if (isMainModule(import.meta.url)) {
  void main();
}
