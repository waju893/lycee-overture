import { describe, expect, it } from "vitest";
import { parseLyceeEffectText } from "../../tools/card-import/parseLyceeEffectText";
import {
  collectKeywordDrivenGameActions,
  resolveKeywordTagToGameActionPlan,
  resolveKeywordTagsToGameActionPlans,
} from "../effects/KeywordTagGameActionResolver";

describe("KeywordTagGameActionResolver", () => {
  it("converts a movement keyword into DECLARE_ACTION/useAbility candidate", () => {
    const parsed = parseLyceeEffectText("[ジャンプ:[0]]");
    const keyword = parsed.parsedEffectsDraft[0]?.actions[0] as any;

    const plan = resolveKeywordTagToGameActionPlan({
      playerId: "P1",
      sourceCardId: "card-1",
      action: keyword,
    });

    expect(plan.mode).toBe("manual_declare");
    expect(plan.actions).toEqual([
      {
        type: "DECLARE_ACTION",
        playerId: "P1",
        kind: "useAbility",
        sourceCardId: "card-1",
        sourceEffectId: undefined,
        targetingMode: undefined,
        targetCardIds: undefined,
        targetSlots: undefined,
        payload: {
          keywordAbility: "jump",
          movementValue: "0",
          movementCount: 0,
        },
        responseToDeclarationId: undefined,
      },
    ]);
  });

  it("keeps supporter as passive_state with no immediate action", () => {
    const parsed = parseLyceeEffectText("[サポーター:[花花]]");
    const keyword = parsed.parsedEffectsDraft[0]?.actions[0] as any;

    const plan = resolveKeywordTagToGameActionPlan({
      playerId: "P1",
      sourceCardId: "card-1",
      action: keyword,
    });

    expect(plan.mode).toBe("passive_state");
    expect(plan.actions).toEqual([]);
    expect(plan.payload).toEqual({ value: "花花" });
  });

  it("keeps charge as onEnterField hook instead of immediate GameAction", () => {
    const parsed = parseLyceeEffectText("[チャージ:2]");
    const keyword = parsed.parsedEffectsDraft[0]?.actions[0] as any;

    const plan = resolveKeywordTagToGameActionPlan({
      playerId: "P2",
      sourceCardId: "card-2",
      action: keyword,
    });

    expect(plan.mode).toBe("triggered_hook");
    expect(plan.hook).toBe("onEnterField");
    expect(plan.actions).toEqual([]);
    expect(plan.payload).toEqual({ amount: 2 });
  });

  it("collects only keyword-driven immediate GameActions from mixed parsed actions", () => {
    const parsed = parseLyceeEffectText("[ジャンプ:[0]]");
    const actions = collectKeywordDrivenGameActions({
      playerId: "P1",
      sourceCardId: "card-9",
      actions: parsed.parsedEffectsDraft[0]?.actions ?? [],
    });

    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({
      type: "DECLARE_ACTION",
      playerId: "P1",
      kind: "useAbility",
      sourceCardId: "card-9",
    });
  });

  it("resolves multiple keyword tags into separate plans", () => {
    const parsed = parseLyceeEffectText("[ジャンプ:[0]][チャージ:1]");
    const plans = resolveKeywordTagsToGameActionPlans({
      playerId: "P1",
      sourceCardId: "card-10",
      actions: parsed.parsedEffectsDraft[0]?.actions ?? [],
    });

    expect(plans).toHaveLength(2);
    expect(plans[0]?.keyword).toBe("jump");
    expect(plans[0]?.mode).toBe("manual_declare");
    expect(plans[1]?.keyword).toBe("charge");
    expect(plans[1]?.mode).toBe("triggered_hook");
  });
});
