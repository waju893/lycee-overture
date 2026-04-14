import fs from "node:fs";
import path from "node:path";
import { parseLyceeEffectText } from "./parseLyceeEffectText.ts";

function main(): void {
  const targetDir = process.argv[2];
  if (!targetDir) throw new Error("Usage: npx ts-node src/tools/card-import/buildParsedEffectsForAllCards.ts <cards-dir>");
  const files = fs.readdirSync(targetDir).filter((name) => /^LO-\d+\.json$/i.test(name));
  let parsed = 0;
  let unresolvedCards = 0;
  let unresolvedLines = 0;
  for (const file of files) {
    const fullPath = path.join(targetDir, file);
    const json = JSON.parse(fs.readFileSync(fullPath, "utf-8"));
    const result = parseLyceeEffectText(typeof json.text === "string" ? json.text : "");
    json.parsedEffectsDraft = result.parsedEffectsDraft;
    json.unresolvedTextLines = result.unresolvedTextLines;
    json.parseMeta = result.parseMeta;
    fs.writeFileSync(fullPath, JSON.stringify(json, null, 2) + "\n", "utf-8");
    parsed += 1;
    if (result.unresolvedTextLines.length > 0) {
      unresolvedCards += 1;
      unresolvedLines += result.unresolvedTextLines.length;
    }
  }
  console.log(`DONE parsed=${parsed} unresolvedCards=${unresolvedCards} unresolvedLines=${unresolvedLines}`);
}
main();
