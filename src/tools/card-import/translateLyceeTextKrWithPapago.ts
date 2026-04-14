/**
 * Papago post-translation updater for Lycee JSON files
 *
 * What it does
 * - Reads JSON files in the target directory
 * - Uses `text` as Japanese source
 * - Rewrites `textKr` with Papago Korean translation
 * - If translation fails, keeps existing `textKr`
 *
 * Requirements:
 *   - Node.js 18+
 *   - PAPAGO_CLIENT_ID environment variable
 *   - PAPAGO_CLIENT_SECRET environment variable
 *
 * Usage:
 *   set PAPAGO_CLIENT_ID=your_id
 *   set PAPAGO_CLIENT_SECRET=your_secret
 *   npx ts-node src/tools/card-import/translateLyceeTextKrWithPapago.ts <cardsDir> [delayMs] [limit]
 *
 * Example:
 *   set PAPAGO_CLIENT_ID=...
 *   set PAPAGO_CLIENT_SECRET=...
 *   npx ts-node src/tools/card-import/translateLyceeTextKrWithPapago.ts "C:/Users/DESKTOP/Desktop/lycee-overture/public/cards" 250 100
 */

import fs from "node:fs/promises";
import path from "node:path";

type CardJson = {
  cardNo?: string;
  text?: string;
  textKr?: string;
  [key: string]: unknown;
};

type FailedItem = {
  filename: string;
  reason: string;
};

const PAPAGO_URL = "https://papago.apigw.ntruss.com/nmt/v1/translation";
const REQUEST_TIMEOUT_MS = 30000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function looksLikeKorean(text: string): boolean {
  return /[가-힣]/.test(text);
}

async function translateWithPapago(text: string, clientId: string, clientSecret: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const body = new URLSearchParams({
      source: "ja",
      target: "ko",
      text,
    });

    const response = await fetch(PAPAGO_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-NCP-APIGW-API-KEY-ID": clientId,
        "X-NCP-APIGW-API-KEY": clientSecret,
      },
      body: body.toString(),
    });

    const raw = await response.text();

    if (!response.ok) {
      throw new Error(`Papago HTTP ${response.status}: ${raw}`);
    }

    const json = JSON.parse(raw) as {
      message?: {
        result?: {
          translatedText?: string;
        };
      };
    };

    const translated = json.message?.result?.translatedText?.trim();
    if (!translated) {
      throw new Error("Papago response missing translatedText");
    }

    return translated;
  } finally {
    clearTimeout(timer);
  }
}

async function main(): Promise<void> {
  const cardsDir = process.argv[2] ?? "C:/Users/DESKTOP/Desktop/lycee-overture/public/cards";
  const delayMs = Number.parseInt(process.argv[3] ?? "250", 10);
  const limit = Number.parseInt(process.argv[4] ?? "0", 10);

  const clientId = process.env.PAPAGO_CLIENT_ID?.trim() ?? "";
  const clientSecret = process.env.PAPAGO_CLIENT_SECRET?.trim() ?? "";

  if (!clientId || !clientSecret) {
    throw new Error("Set PAPAGO_CLIENT_ID and PAPAGO_CLIENT_SECRET environment variables first.");
  }

  if (!Number.isInteger(delayMs) || delayMs < 0) {
    throw new Error("delayMs must be a non-negative integer.");
  }

  if (!Number.isInteger(limit) || limit < 0) {
    throw new Error("limit must be a non-negative integer.");
  }

  const files = (await fs.readdir(cardsDir))
    .filter((name) => /^LO-\d{4}(?:-[A-Za-z])?\.json$/i.test(name))
    .sort();

  const targets = limit > 0 ? files.slice(0, limit) : files;

  let updated = 0;
  let skipped = 0;
  const failed: FailedItem[] = [];

  for (let i = 0; i < targets.length; i += 1) {
    const filename = targets[i];
    const filePath = path.join(cardsDir, filename);

    try {
      const raw = await fs.readFile(filePath, "utf-8");
      const json = JSON.parse(raw) as CardJson;

      const text = typeof json.text === "string" ? json.text.trim() : "";
      const textKr = typeof json.textKr === "string" ? json.textKr.trim() : "";

      if (!text) {
        skipped += 1;
        console.log(`[${i + 1}/${targets.length}] SKIP ${filename} empty_text`);
        continue;
      }

      if (textKr && looksLikeKorean(textKr)) {
        skipped += 1;
        console.log(`[${i + 1}/${targets.length}] SKIP ${filename} already_korean`);
        continue;
      }

      const translated = await translateWithPapago(text, clientId, clientSecret);
      json.textKr = translated;

      await fs.writeFile(filePath, `${JSON.stringify(json, null, 2)}\n`, "utf-8");
      updated += 1;
      console.log(`[${i + 1}/${targets.length}] UPDATE ${filename}`);
    } catch (error) {
      failed.push({ filename, reason: String(error) });
      console.log(`[${i + 1}/${targets.length}] FAIL ${filename} ${String(error)}`);
    }

    if (delayMs > 0) {
      await sleep(delayMs);
    }
  }

  await fs.writeFile(
    path.join(cardsDir, "_papago_translate_failures.json"),
    `${JSON.stringify(failed, null, 2)}\n`,
    "utf-8"
  );

  console.log(`DONE updated=${updated} skipped=${skipped} failed=${failed.length}`);
}

void main();
