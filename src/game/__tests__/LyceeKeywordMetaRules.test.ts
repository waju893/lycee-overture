import { describe, expect, it } from "vitest";
import { parseLyceeEffectText } from "../../tools/card-import/parseLyceeEffectText.ts";

describe("Lycee keyword/meta rules", () => {
  it("ignores construction restriction lines as meta", () => {
    const result = parseLyceeEffectText("構築制限:[NEX]");
    expect(result.unresolvedTextLines).toHaveLength(0);
    expect(result.parsedEffectsDraft[0]?.actions[0]).toEqual({
      type: "metaIgnore",
      text: "構築制限:[NEX]",
    });
  });

  it("parses a single movement keyword tag", () => {
    const result = parseLyceeEffectText("[ジャンプ:[0]]");
    expect(result.unresolvedTextLines).toHaveLength(0);
    expect(result.parsedEffectsDraft[0]?.actions[0]).toEqual({
      type: "keywordTag",
      keyword: "jump",
      value: "0",
    });
  });

  it("parses a supporter tag", () => {
    const result = parseLyceeEffectText("[サポーター:[花花]]");
    expect(result.unresolvedTextLines).toHaveLength(0);
    expect(result.parsedEffectsDraft[0]?.actions[0]).toEqual({
      type: "keywordTag",
      keyword: "supporter",
      value: "花花",
    });
  });

  it("parses nested engage effect tag", () => {
    const result = parseLyceeEffectText("[エンゲージ:[1枚ドローする。]]");
    expect(result.unresolvedTextLines).toHaveLength(0);
    const action = result.parsedEffectsDraft[0]?.actions[0] as any;
    expect(action?.type).toBe("keywordTag");
    expect(action?.keyword).toBe("engage");
    expect(action?.nestedActions?.[0]).toEqual({ type: "draw", amount: 1 });
  });

  it("parses combined keyword tags in sequence", () => {
    const result = parseLyceeEffectText("[ジャンプ:[0]][チャージ:1]");
    expect(result.unresolvedTextLines).toHaveLength(0);
    expect(result.parsedEffectsDraft[0]?.actions).toEqual([
      { type: "keywordTag", keyword: "jump", value: "0" },
      { type: "keywordTag", keyword: "charge", value: 1 },
    ]);
  });

  it("ignores campaign note lines as meta", () => {
    const result = parseLyceeEffectText("※このカードは能力を持たないキャラとしてゲームで使用できます。");
    expect(result.unresolvedTextLines).toHaveLength(0);
    expect(result.parsedEffectsDraft[0]?.actions[0]?.type).toBe("metaIgnore");
  });
});
