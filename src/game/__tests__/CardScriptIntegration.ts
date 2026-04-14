/**
 * CardScriptIntegration.test.ts
 *
 * Suggested path:
 *   src/game/__tests__/CardScriptIntegration.test.ts
 *
 * Important:
 * - Keep this file only under __tests__
 * - Delete accidental duplicate:
 *   src/game/cards/examples/CardScriptIntegration.test.ts
 */

import { describe, expect, it } from "vitest";
import { CardScriptValidator } from "../cards/CardScriptValidator";
import { CardScriptRunner, type RunnerContext, type RunnerStateView, type RunnerTargetRef } from "../cards/CardScriptRunner";
import type { PlayerRef, TargetSelector } from "../cards/CardScriptTypes";
import { LO_6556 } from "../cards/examples/LO6556";

function makeState(): RunnerStateView {
  return {
    currentTurnPlayerId: "P1",
    currentNonTurnPlayerId: "P2",

    resolvePlayer(ref: PlayerRef, ctx: RunnerContext): string {
      switch (ref) {
        case "self":
          return ctx.actingPlayerId;
        case "opponent":
          return ctx.actingPlayerId === "P1" ? "P2" : "P1";
        case "turnPlayer":
          return ctx.turnPlayerId;
        case "nonTurnPlayer":
          return ctx.turnPlayerId === "P1" ? "P2" : "P1";
      }
    },

    resolveTargets(selector: TargetSelector, ctx: RunnerContext): RunnerTargetRef[] {
      if (selector.kind === "source") {
        return [{ kind: "card", id: ctx.sourceCard.id }];
      }

      if (selector.kind === "character") {
        if (selector.side === "self") {
          return [{ kind: "card", id: "ALLY_SUN_CHAR_1" }];
        }
        if (selector.side === "opponent") {
          return [{ kind: "card", id: "OPP_CHAR_1" }];
        }
      }

      if (selector.kind === "card" && selector.zone === "hand") {
        // LO-6556 text:
        // opponent chooses 1 card from their own hand and puts it on bottom of deck.
        // This test only verifies runner intent generation, so we return one resolved hand card.
        return [{ kind: "card", id: "P2_HAND_1" }];
      }

      return [];
    },

    getDeckCount() {
      return 10;
    },

    didSourceEnterFromHand() {
      return true;
    },
  };
}

function makeContext(timing: RunnerContext["timing"]): RunnerContext {
  return {
    timing,
    actingPlayerId: "P1",
    turnPlayerId: "P1",
    sourceCard: {
      id: "SRC_6556",
      cardNo: "LO-6556",
      ownerId: "P1",
      controllerId: "P1",
      zone: "field",
      name: "LO-6556",
    },
    chosenTargets: [],
    lookedCardIds: [],
    metadata: {},
  };
}

describe("CardScriptIntegration - LO6556", () => {
  it("validator passes LO6556 parsedEffects", () => {
    const validator = new CardScriptValidator();
    const result = validator.validateScripts(LO_6556.parsedEffects as any);

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("runner produces intents for onUse effect", () => {
    const runner = new CardScriptRunner();

    const result = runner.run(
      LO_6556.parsedEffects as any,
      makeState(),
      makeContext("onUse"),
    );

    expect(result.ok).toBe(true);
    expect(result.intents.length).toBeGreaterThan(0);

    const sequenceOutputs = result.intents.filter((intent) => intent.kind === "modifyStat");
    expect(sequenceOutputs).toHaveLength(2);
  });

  it("runner produces prompt intent for onEnterFromHand trigger", () => {
    const runner = new CardScriptRunner();

    const result = runner.run(
      LO_6556.parsedEffects as any,
      makeState(),
      makeContext("onEnterFromHand"),
    );

    expect(result.ok).toBe(true);
    expect(result.intents).toHaveLength(1);

    const prompt = result.intents[0];
    expect(prompt.kind).toBe("prompt");

    if (prompt.kind === "prompt") {
      expect(prompt.optionalIntents.some((i) => i.kind === "charge")).toBe(true);
      expect(prompt.elseIntents.some((i) => i.kind === "moveCard")).toBe(true);
    }
  });

  it("runner produces charge intent for onTurnStart trigger", () => {
    const runner = new CardScriptRunner();

    const result = runner.run(
      LO_6556.parsedEffects as any,
      makeState(),
      makeContext("onTurnStart"),
    );

    expect(result.ok).toBe(true);
    expect(result.intents).toHaveLength(1);
    expect(result.intents[0].kind).toBe("charge");

    if (result.intents[0].kind === "charge") {
      expect(result.intents[0].targetIds).toEqual(["SRC_6556"]);
      expect(result.intents[0].amount).toBe(1);
    }
  });
});
