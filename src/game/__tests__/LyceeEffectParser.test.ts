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

  it("parses game-wide usage limit suffix without losing the base effect", () => {
    const text = "[誘発] このキャラが登場したとき、自分のゴミ箱のこのキャラを無償で登場できる。(ゲーム中1回まで使用可能)";
    const result = parseLyceeEffectText(text);

    expect(result.unresolvedTextLines).toHaveLength(0);

    const actions = result.parsedEffectsDraft[0]?.actions ?? [];
    expect(actions.some((action: any) => action.type === "freeUse")).toBe(true);
    expect(actions.at(-1)).toEqual({
      type: "usageLimit",
      scope: "game",
      count: 1,
      appliesTo: "use",
    });
  });

  it("parses lose-this-ability suffix without losing the base effect", () => {
    const text = "[誘発] このキャラが登場したとき、自分のゴミ箱のこのキャラを無償で登場できる。この能力は失われる。";
    const result = parseLyceeEffectText(text);

    expect(result.unresolvedTextLines).toHaveLength(0);

    const actions = result.parsedEffectsDraft[0]?.actions ?? [];
    expect(actions.some((action: any) => action.type === "freeUse")).toBe(true);
    expect(actions.some((action: any) => action.type === "loseThisAbility")).toBe(true);
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

  it("parses choice-intro lines without forcing fake choices", () => {
    const text = "[誘発] このキャラが登場したとき、以下から1つを選び処理する。";
    const result = parseLyceeEffectText(text);

    expect(result.unresolvedTextLines).toHaveLength(0);
    expect(result.parsedEffectsDraft[0]?.actions?.[0]).toEqual({
      type: "choiceIntro",
      prompt: "selectOneAndResolve",
    });
  });

  it("parses placing character cards into a named place", () => {
    const text = "[誘発] このキャラが登場したとき、自分のゴミ箱のキャラ2枚を自分の「契約」置き場に置ける。";
    const result = parseLyceeEffectText(text);

    expect(result.unresolvedTextLines).toHaveLength(0);
    expect(result.parsedEffectsDraft[0]?.actions?.[0]).toEqual({
      type: "placeCard",
      owner: "self",
      from: "trash",
      to: "namedPlace",
      count: 2,
      placeName: "契約",
    });
  });

  it("parses placing this character beside itself", () => {
    const text = "[宣言] [0]:このキャラを横に置く。";
    const result = parseLyceeEffectText(text);

    expect(result.unresolvedTextLines).toHaveLength(0);
    expect(result.parsedEffectsDraft[0]?.actions?.[0]).toEqual({
      type: "placeCard",
      owner: "self",
      from: "field",
      to: "besideThisCard",
      count: 1,
    });
  });

  it("parses placing a card as charge on this character", () => {
    const text = "[誘発] 自ターン開始時、自分のゴミ箱のカード1枚をこのキャラにチャージとして置く。";
    const result = parseLyceeEffectText(text);

    expect(result.unresolvedTextLines).toHaveLength(0);
    expect(result.parsedEffectsDraft[0]?.actions?.[0]).toEqual({
      type: "placeCard",
      owner: "self",
      from: "trash",
      to: "chargeOnThisCard",
      count: 1,
    });
  });
});
