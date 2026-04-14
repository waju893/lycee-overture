import fs from "node:fs";
import path from "node:path";

function main(): void {
  const targetDir = process.argv[2];
  if (!targetDir) throw new Error("Usage: npx ts-node src/tools/card-import/reportUnresolvedLyceeParses.ts <cards-dir>");
  const files = fs.readdirSync(targetDir).filter((name) => /^LO-\d+\.json$/i.test(name));
  const counts = new Map<string, number>();
  for (const file of files) {
    const json = JSON.parse(fs.readFileSync(path.join(targetDir, file), "utf-8"));
    const unresolved = Array.isArray(json.unresolvedTextLines) ? json.unresolvedTextLines : [];
    for (const entry of unresolved) {
      const line = typeof entry?.line === "string" ? entry.line : "";
      if (!line) continue;
      counts.set(line, (counts.get(line) ?? 0) + 1);
    }
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 100).map(([line, count]) => ({ line, count }));
  const reportPath = path.join(targetDir, "_unresolved_parse_report.json");
  fs.writeFileSync(reportPath, JSON.stringify(top, null, 2) + "\n", "utf-8");
  console.log(`WROTE ${reportPath} entries=${top.length}`);
}
main();
