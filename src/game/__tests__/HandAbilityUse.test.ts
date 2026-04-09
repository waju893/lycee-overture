// HandAbilityUse.test.ts
import { describe, expect, it } from "vitest";
import { createInitialGameState } from "../GameRules";

describe("HandAbilityUse", () => {
  it("engine loads with hand ability system", () => {
    const state = createInitialGameState({
      p1Deck: [],
      p2Deck: [],
      leaderEnabled: false,
    });

    expect(state).toBeTruthy();
  });
});
