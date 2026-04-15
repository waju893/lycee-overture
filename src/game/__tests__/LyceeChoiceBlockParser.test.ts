import { describe, expect, it } from "vitest";
import { parseLyceeEffectText } from "../../tools/card-import/parseLyceeEffectText.ts";

describe("Lycee multiline choice block parser", () => {
  it("assembles a choiceIntro line and following bullet lines into chooseOne", () => {
    const text = [
      "[誘発] このキャラが登場したとき、以下から1つを選び処理する。",
      "・1枚ドローする。",
      "・自分の手札1枚をデッキの下に置く。",
    ].join("\n");

    const result = parseLyceeEffectText(text);

    expect(result.unresolvedTextLines).toHaveLength(0);
    expect(result.parsedEffectsDraft).toHaveLength(1);

    const action = result.parsedEffectsDraft[0]?.actions?.[0] as any;
    expect(action?.type).toBe("chooseOne");
    expect(action?.choices).toHaveLength(2);
    expect(action?.choices?.[0]?.actions?.[0]).toEqual({ type: "draw", amount: 1 });
    expect(action?.choices?.[1]?.actions?.[0]).toEqual({
      type: "moveCard",
      owner: "self",
      from: "hand",
      to: "deckBottom",
      count: 1,
    });
  });
});
