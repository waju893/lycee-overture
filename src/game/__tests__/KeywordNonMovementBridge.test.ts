import { describe, expect, it } from "vitest";
import {
  buildAutoChargeActionFromKeywordState,
  buildKeywordPassiveStateFromPlans,
  getSupportAmountFromCard,
  hasAggressiveKeywordState,
  hasAssistKeywordState,
} from "../effects/KeywordNonMovementBridge";

describe("KeywordNonMovementBridge", () => {
  it("builds passive state from non-movement keyword plans", () => {
    const state = buildKeywordPassiveStateFromPlans([
      { kind: "passive_state", keyword: "aggressive" },
      { kind: "passive_state", keyword: "assist" },
      { kind: "passive_state", keyword: "supporter", payload: { value: "花花" } },
      { kind: "onEnterField", keyword: "charge", payload: { count: 2 } },
    ]);

    expect(state).toEqual({
      aggressive: true,
      assist: true,
      supporterRaw: "花花",
      supporterValue: 2,
      chargeCount: 2,
    });
  });

  it("derives support amount from keyword supporter value when sp is absent", () => {
    const amount = getSupportAmountFromCard({
      keywordState: {
        supporterValue: 2,
      },
    });

    expect(amount).toBe(2);
  });

  it("prefers explicit sp over keyword-derived supporter value", () => {
    const amount = getSupportAmountFromCard({
      sp: 3,
      keywordState: {
        supporterValue: 2,
      },
    });

    expect(amount).toBe(3);
  });

  it("exposes aggressive and assist keyword state flags", () => {
    const card = {
      keywordState: {
        aggressive: true,
        assist: true,
      },
    };

    expect(hasAggressiveKeywordState(card)).toBe(true);
    expect(hasAssistKeywordState(card)).toBe(true);
  });

  it("builds an automatic chargeCharacter declaration from keyword charge state", () => {
    const action = buildAutoChargeActionFromKeywordState({
      playerId: "P1",
      sourceCardId: "P1_CHARGER",
      keywordState: {
        chargeCount: 2,
      },
    });

    expect(action).toEqual({
      type: "DECLARE_ACTION",
      playerId: "P1",
      kind: "chargeCharacter",
      sourceCardId: "P1_CHARGER",
      sourceEffectId: undefined,
      targetingMode: undefined,
      targetCardIds: undefined,
      targetSlots: undefined,
      payload: {
        deckCount: 2,
        source: "keywordTag",
        auto: true,
      },
      responseToDeclarationId: undefined,
    });
  });

  it("returns null when there is no keyword charge count", () => {
    const action = buildAutoChargeActionFromKeywordState({
      playerId: "P1",
      sourceCardId: "P1_CHARGER",
      keywordState: {},
    });

    expect(action).toBeNull();
  });
});
