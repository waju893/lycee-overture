/**
 * CardScriptIntegration.test.ts
 *
 * Purpose:
 * End-to-end pipeline test:
 *
 * Card JSON (LO6556)
 *   ↓
 * CardScriptValidator
 *   ↓
 * CardScriptRunner
 *   ↓
 * Engine Intent output
 *
 * Suggested path:
 *   src/game/__tests__/CardScriptIntegration.test.ts
 */

import { describe, it, expect } from "vitest"

import { CardScriptValidator } from "../cards/CardScriptValidator"
import { CardScriptRunner } from "../cards/CardScriptRunner"

import { LO_6556 } from "../cards/examples/LO6556"

import type {
  RunnerContext,
  RunnerStateView,
  RunnerTargetRef
} from "../cards/CardScriptRunner"

import type {
  PlayerRef,
  TargetSelector
} from "../cards/CardScriptTypes"


/**
 * Minimal fake state view
 * Only the pieces Runner actually needs.
 */
function makeState(): RunnerStateView {
  return {
    currentTurnPlayerId: "P1",
    currentNonTurnPlayerId: "P2",

    resolvePlayer(ref: PlayerRef, ctx: RunnerContext): string {
      switch (ref) {
        case "self":
          return ctx.actingPlayerId
        case "opponent":
          return ctx.actingPlayerId === "P1" ? "P2" : "P1"
        case "turnPlayer":
          return ctx.turnPlayerId
        case "nonTurnPlayer":
          return ctx.turnPlayerId === "P1" ? "P2" : "P1"
      }
    },

    resolveTargets(selector: TargetSelector, ctx: RunnerContext): RunnerTargetRef[] {

      if (selector.kind === "source") {
        return [{ kind: "card", id: ctx.sourceCard.id }]
      }

      if (selector.kind === "character") {
        if (selector.side === "self") {
          return [{ kind: "card", id: "ALLY_CHAR_1" }]
        }
        if (selector.side === "opponent") {
          return [{ kind: "card", id: "OPP_CHAR_1" }]
        }
      }

      if (selector.kind === "card") {
        if (selector.zone === "hand") {
          return [{ kind: "card", id: "OPP_HAND_1" }]
        }
      }

      return []
    },

    getDeckCount() {
      return 10
    },

    didSourceEnterFromHand() {
      return true
    }
  }
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
      zone: "field"
    },

    chosenTargets: [],
    lookedCardIds: [],
    metadata: {}
  }
}


describe("CardScriptIntegration - LO6556", () => {

  it("validator passes LO6556 parsedEffects", () => {

    const validator = new CardScriptValidator()

    const result = validator.validateScripts(LO_6556.parsedEffects)

    expect(result.ok).toBe(true)
    expect(result.errors).toEqual([])

  })


  it("runner produces intents for onUse effect", () => {

    const runner = new CardScriptRunner()

    const result = runner.run(
      LO_6556.parsedEffects,
      makeState(),
      makeContext("onUse")
    )

    expect(result.ok).toBe(true)
    expect(result.intents.length).toBeGreaterThan(0)

  })


  it("runner produces intents for onEnterFromHand trigger", () => {

    const runner = new CardScriptRunner()

    const result = runner.run(
      LO_6556.parsedEffects,
      makeState(),
      makeContext("onEnterFromHand")
    )

    expect(result.ok).toBe(true)

  })


  it("runner produces intents for onTurnStart trigger", () => {

    const runner = new CardScriptRunner()

    const result = runner.run(
      LO_6556.parsedEffects,
      makeState(),
      makeContext("onTurnStart")
    )

    expect(result.ok).toBe(true)

  })

})
