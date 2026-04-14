import { describe, expect, it } from "vitest";
import { parseLyceeEffectText } from "../../tools/card-import/parseLyceeEffectText.ts";

describe("LyceeEffectParser", () => {
  it("parses chooseOne -> searchCard -> freeUse(area)", () => {
    const text =
      "[誘発] このキャラが登場したとき、1枚ドローまたは自分のゴミ箱またはデッキから「ビジネスパートナー」1枚を探し無償で配置する";
    const result = parseLyceeEffectText(text);

    expect(result.unresolvedTextLines).toHaveLength(0);

    const effect = result.parsedEffectsDraft[0];
    expect(effect).toBeTruthy();
    expect(effect?.actions).toHaveLength(1);

    const chooseOne = effect?.actions[0] as any;
    expect(chooseOne?.type).toBe("chooseOne");
    expect(chooseOne?.choices?.[0]?.actions?.[0]).toEqual({ type: "draw", amount: 1 });
    expect(chooseOne?.choices?.[1]?.actions?.[0]?.type).toBe("searchCard");
    expect(chooseOne?.choices?.[1]?.actions?.[1]?.type).toBe("freeUse");
    expect(chooseOne?.choices?.[1]?.actions?.[1]?.useKind).toBe("area");
  });

  it("parses simple stat modification with explicit target selection", () => {
    const text = "[宣言] 相手キャラ1体にAP-2する";
    const result = parseLyceeEffectText(text);

    expect(result.unresolvedTextLines).toHaveLength(0);

    const effect = result.parsedEffectsDraft[0];
    expect(effect).toBeTruthy();
    expect(effect?.actions).toHaveLength(2);

    expect(effect?.actions?.[0]).toEqual({
      type: "chooseTarget",
      prompt: "상대 캐릭터 1체를 선택한다",
      selector: {
        owner: "opponent",
        kind: "character",
        count: 1,
      },
      storeAs: "selectedTarget",
    });

    expect(effect?.actions?.[1]).toEqual({
      type: "modifyStat",
      stat: "ap",
      amount: -2,
      targetRef: "selectedTarget",
    });
  });

  it("parses end-of-turn duration stat modification", () => {
    const text = "[宣言] ターン終了時までAP+2する";
    const result = parseLyceeEffectText(text);

    expect(result.unresolvedTextLines).toHaveLength(0);
    expect(result.parsedEffectsDraft[0]?.actions?.[0]).toEqual({
      type: "modifyStat",
      stat: "ap",
      amount: 2,
      duration: "endOfTurn",
    });
  });

  it("parses battle condition into effect conditions", () => {
    const text = "[常時] このキャラが参加しているバトル中、AP+2する";
    const result = parseLyceeEffectText(text);

    expect(result.unresolvedTextLines).toHaveLength(0);
    expect(result.parsedEffectsDraft[0]?.conditions).toEqual([
      { type: "inBattle", target: "self" },
    ]);
    expect(result.parsedEffectsDraft[0]?.actions?.[0]).toEqual({
      type: "modifyStat",
      stat: "ap",
      amount: 2,
    });
  });

  it("parses opponent character one target selector with stat modification", () => {
    const text = "[宣言] 相手キャラ1体にDP-2する";
    const result = parseLyceeEffectText(text);

    expect(result.unresolvedTextLines).toHaveLength(0);

    const effect = result.parsedEffectsDraft[0];
    expect(effect).toBeTruthy();
    expect(effect?.actions).toHaveLength(2);

    expect(effect?.actions?.[0]).toEqual({
      type: "chooseTarget",
      prompt: "상대 캐릭터 1체를 선택한다",
      selector: {
        owner: "opponent",
        kind: "character",
        count: 1,
      },
      storeAs: "selectedTarget",
    });

    expect(effect?.actions?.[1]).toEqual({
      type: "modifyStat",
      stat: "dp",
      amount: -2,
      targetRef: "selectedTarget",
    });
  });

  it("parses move to deck bottom", () => {
    const text = "[宣言] 手札1枚をデッキの下に置く";
    const result = parseLyceeEffectText(text);

    expect(result.unresolvedTextLines).toHaveLength(0);
    expect(result.parsedEffectsDraft[0]?.actions?.[0]).toEqual({
      type: "moveCard",
      owner: "self",
      from: "hand",
      to: "deckBottom",
      count: 1,
    });
  });

  it("keeps unknown text unresolved instead of crashing", () => {
    const text = "[誘発] これはまだ未対応の特殊効果である";
    const result = parseLyceeEffectText(text);

    expect(result.parsedEffectsDraft).toHaveLength(0);
    expect(result.unresolvedTextLines).toHaveLength(1);

    const unresolved = result.unresolvedTextLines[0] as any;
    const unresolvedText =
      typeof unresolved === "string"
        ? unresolved
        : unresolved?.text ?? unresolved?.body ?? unresolved?.originalText ?? JSON.stringify(unresolved);

    expect(unresolvedText).toContain("未対応");
  });
});
