/**
 * Lycee Papago postprocessor
 *
 * Purpose:
 *   Improve Papago-translated Korean text for Lycee card effects
 *   by applying rule-based terminology and phrasing corrections.
 *
 * Usage:
 *   npx ts-node src/tools/card-import/postprocessLyceePapagoText.ts <cardsDir> [limit]
 *
 * Example:
 *   npx ts-node src/tools/card-import/postprocessLyceePapagoText.ts "C:/Users/DESKTOP/Desktop/lycee-overture/public/cards" 100
 */

import fs from "node:fs/promises";
import path from "node:path";

type CardJson = {
  cardNo?: string;
  text?: string;
  textKr?: string;
  [key: string]: unknown;
};

function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function applyLyceePostprocess(text: string): string {
  let out = normalizeWhitespace(text);

  const replacements: Array<[RegExp, string]> = [
    [/\[유발\]/g, "[유발]"],
    [/\[선언\]/g, "[선언]"],
    [/\[상시\]/g, "[상시]"],
    [/\[코스트\]/g, "[코스트]"],
    [/\[패 선언\]/g, "[패 선언]"],
    [/\[비장\]/g, "[비장]"],

    [/\b캐라\b/g, "캐릭터"],
    [/\b캐릭터 카드\b/g, "캐릭터"],
    [/\b등장시\b/g, "등장 시"],
    [/\b등장했을때\b/g, "등장했을 때"],
    [/\b등장했을 때\b/g, "등장했을 때"],
    [/\b등장할때\b/g, "등장할 때"],
    [/\b공격선언\b/g, "공격 선언"],
    [/\b방어선언\b/g, "방어 선언"],
    [/\b선언하다\b/g, "선언한다"],
    [/\b행동 완료 상태\b/g, "행동완료 상태"],
    [/\b행동 완료상태\b/g, "행동완료 상태"],
    [/\b미 행동 상태\b/g, "미행동 상태"],
    [/\b행동 종료 상태\b/g, "행동완료 상태"],

    [/\b자신의 캐릭터\b/g, "자신 캐릭터"],
    [/\b상대의 캐릭터\b/g, "상대 캐릭터"],
    [/\b아군의 캐릭터\b/g, "아군 캐릭터"],
    [/\b자신의 덱\b/g, "자신 덱"],
    [/\b상대의 덱\b/g, "상대 덱"],
    [/\b자신의 패\b/g, "자신 패"],
    [/\b상대의 패\b/g, "상대 패"],

    [/\b1 체\b/g, "1체"],
    [/\b2 체\b/g, "2체"],
    [/\b3 체\b/g, "3체"],
    [/\b1 장\b/g, "1장"],
    [/\b2 장\b/g, "2장"],
    [/\b3 장\b/g, "3장"],
    [/\b20 장\b/g, "20장"],

    [/\b드로우 한다\b/g, "드로우한다"],
    [/\b셔플 한다\b/g, "셔플한다"],
    [/\b회복 한다\b/g, "회복한다"],
    [/\b공개 한다\b/g, "공개한다"],
    [/\b이동 한다\b/g, "이동한다"],
    [/\b파기 한다\b/g, "파기한다"],
    [/\b사용 한다\b/g, "사용한다"],
    [/\b할수 있다\b/g, "할 수 있다"],
    [/\b할 수있다\b/g, "할 수 있다"],

    [/\bAP \+ ?(\d+)/g, "AP+$1"],
    [/\bDP \+ ?(\d+)/g, "DP+$1"],
    [/\bSP \+ ?(\d+)/g, "SP+$1"],
    [/\bDMG \+ ?(\d+)/g, "DMG+$1"],
    [/\bAP - ?(\d+)/g, "AP-$1"],
    [/\bDP - ?(\d+)/g, "DP-$1"],
    [/\bSP - ?(\d+)/g, "SP-$1"],
    [/\bDMG - ?(\d+)/g, "DMG-$1"],

    [/\bA P\b/g, "AP"],
    [/\bD P\b/g, "DP"],
    [/\bS P\b/g, "SP"],
    [/\bD M G\b/g, "DMG"],

    [/\{ /g, "{"],
    [/ \}/g, "}"],
    [/\( /g, "("],
    [/ \)/g, ")"],

    [/\s+。/g, "。"],
    [/\s+,/g, ","],
    [/\s+\./g, "."],
  ];

  for (const [pattern, replacement] of replacements) {
    out = out.replace(pattern, replacement);
  }

  // Line-level cleanup for common Papago awkwardness in card text
  out = out
    .split("\n")
    .map((line) => line.trim())
    .map((line) => {
      let fixed = line;

      fixed = fixed.replace(/^이 카드가 손패에서 등장했을 때,/, "이 카드가 패에서 등장했을 때,");
      fixed = fixed.replace(/^이 카드가 손패로부터 등장했을 때,/, "이 카드가 패에서 등장했을 때,");
      fixed = fixed.replace(/상대 캐릭터 1체에 /g, "상대 캐릭터 1체에게 ");
      fixed = fixed.replace(/자신 덱을 무작위로 /g, "자신 덱을 무작위로 ");
      fixed = fixed.replace(/회복하고 셔플한다/g, "회복하고 셔플한다");
      fixed = fixed.replace(/대응・배틀 중을 제외한 /g, "대응·배틀 중을 제외한 ");
      fixed = fixed.replace(/대응・배틀 중을 제외하고 /g, "대응·배틀 중을 제외하고 ");

      return fixed;
    })
    .join("\n");

  return normalizeWhitespace(out);
}

async function main(): Promise<void> {
  const cardsDir = process.argv[2] ?? "C:/Users/DESKTOP/Desktop/lycee-overture/public/cards";
  const limit = Number.parseInt(process.argv[3] ?? "0", 10);

  if (!Number.isInteger(limit) || limit < 0) {
    throw new Error("limit must be a non-negative integer.");
  }

  const files = (await fs.readdir(cardsDir))
    .filter((name) => /^LO-\d{4}(?:-[A-Za-z])?\.json$/i.test(name))
    .sort();

  const targets = limit > 0 ? files.slice(0, limit) : files;

  let updated = 0;
  let skipped = 0;

  for (let i = 0; i < targets.length; i += 1) {
    const filename = targets[i];
    const filePath = path.join(cardsDir, filename);

    try {
      const raw = await fs.readFile(filePath, "utf-8");
      const json = JSON.parse(raw) as CardJson;

      const textKr = typeof json.textKr === "string" ? json.textKr : "";
      if (!textKr.trim()) {
        skipped += 1;
        console.log(`[${i + 1}/${targets.length}] SKIP ${filename} empty_textKr`);
        continue;
      }

      const processed = applyLyceePostprocess(textKr);

      if (processed === textKr) {
        skipped += 1;
        console.log(`[${i + 1}/${targets.length}] SKIP ${filename} unchanged`);
        continue;
      }

      json.textKr = processed;
      await fs.writeFile(filePath, `${JSON.stringify(json, null, 2)}\n`, "utf-8");

      updated += 1;
      console.log(`[${i + 1}/${targets.length}] UPDATE ${filename}`);
    } catch (error) {
      console.log(`[${i + 1}/${targets.length}] FAIL ${filename} ${String(error)}`);
    }
  }

  console.log(`DONE updated=${updated} skipped=${skipped}`);
}

void main();
