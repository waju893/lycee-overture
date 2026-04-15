import fs from "node:fs";
import path from "node:path";
import { parseLyceeEffectText } from "./parseLyceeEffectText.ts";

type ReportEntry = {
  text: string;
  count: number;
  cardNos: string[];
};

type CardJson = {
  cardNo?: string;
  text?: string;
};

function readJson(filePath: string): CardJson | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return null;
  }
}

function collectUnresolvedTexts(entry: unknown): string[] {
  if (typeof entry === "string") {
    return [entry];
  }

  if (!entry || typeof entry !== "object") {
    return [];
  }

  const obj = entry as Record<string, unknown>;
  const candidates = [obj.text, obj.body, obj.originalText, obj.line];

  return candidates
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .map((v) => v.trim());
}

function main() {
  const cardsDir = process.argv[2];
  const outputPath =
    process.argv[3] ??
    path.join(cardsDir ?? "", "_unresolved_parse_report.json");

  if (!cardsDir) {
    console.error(
      'Usage: npx ts-node src/tools/card-import/generateUnresolvedReport.ts "C:/path/to/public/cards" [output-json-path]'
    );
    process.exit(1);
  }

  const files = fs
    .readdirSync(cardsDir)
    .filter((name) => /^LO-\d+\.json$/i.test(name))
    .sort();

  const counts = new Map<string, { count: number; cardNos: Set<string> }>();

  let parsedCards = 0;
  let skippedCards = 0;

  for (const fileName of files) {
    const filePath = path.join(cardsDir, fileName);
    const json = readJson(filePath);

    if (!json || typeof json.text !== "string" || json.text.trim().length === 0) {
      skippedCards += 1;
      continue;
    }

    parsedCards += 1;

    const result = parseLyceeEffectText(json.text);
    const cardNo = json.cardNo ?? fileName.replace(/\.json$/i, "");

    for (const unresolved of result.unresolvedTextLines ?? []) {
      const texts = collectUnresolvedTexts(unresolved);

      for (const text of texts) {
        const prev = counts.get(text);
        if (prev) {
          prev.count += 1;
          prev.cardNos.add(cardNo);
        } else {
          counts.set(text, {
            count: 1,
            cardNos: new Set([cardNo]),
          });
        }
      }
    }
  }

  const report: ReportEntry[] = [...counts.entries()]
    .map(([text, value]) => ({
      text,
      count: value.count,
      cardNos: [...value.cardNos].sort(),
    }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.text.localeCompare(b.text, "ja");
    });

  fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), "utf-8");

  console.log(
    `WROTE ${outputPath} entries=${report.length} parsedCards=${parsedCards} skippedCards=${skippedCards}`
  );
}

main();
