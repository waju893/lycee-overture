import { describe, expect, it } from "vitest";
import { reduceGameState } from "../GameEngine";
import { createInitialGameState } from "../GameRules";
import type { CardRef, GameState, PlayerID } from "../GameTypes";

function makeCharacter(instanceId: string, owner: PlayerID, name: string): CardRef {
  return {
    instanceId,
    cardNo: instanceId,
    name,
    owner,
    cardType: "character",
    sameNameKey: instanceId,
    ap: 3,
    dp: 3,
    dmg: 1,
    power: 3,
    damage: 1,
    hp: 3,
    isTapped: false,
    canAttack: true,
    canBlock: true,
    revealed: false,
    location: "field",
  };
}

function buildMainPhaseState(): GameState {
  const state = createInitialGameState({
    p1Deck: [],
    p2Deck: [],
    leaderEnabled: false,
  });

  state.turn.activePlayer = "P1";
  state.turn.priorityPlayer = "P1";
  state.turn.phase = "main";
  return state;
}

function resolveLatestDeclarationByDoublePass(state: GameState): GameState {
  const state1 = reduceGameState(state, {
    type: "PASS_PRIORITY",
    playerId: state.turn.priorityPlayer,
  });

  const state2 = reduceGameState(state1, {
    type: "PASS_PRIORITY",
    playerId: state1.turn.priorityPlayer,
  });

  return state2;
}

describe("Movement keyword execution layer", () => {
  it("resolves jump/step-style useAbility into moving the card to the selected destination slot", () => {
    const state = buildMainPhaseState();
    state.players.P1.field.AF_LEFT.card = makeCharacter("P1_MOVER", "P1", "P1_MOVER");

    const declared = reduceGameState(state, {
      type: "DECLARE_ACTION",
      playerId: "P1",
      kind: "useAbility",
      sourceCardId: "P1_MOVER",
      sourceEffectId: "ability_jump_001",
      targetingMode: "declareTime",
      targetSlots: ["AF_CENTER"],
      payload: {
        keyword: "jump",
        source: "keywordTag",
        sourceSlot: "AF_LEFT",
        destinationSlots: ["AF_CENTER", "AF_RIGHT"],
      },
    });

    const resolved = resolveLatestDeclarationByDoublePass(declared);

    expect(resolved.players.P1.field.AF_LEFT.card).toBeNull();
    expect(resolved.players.P1.field.AF_CENTER.card?.instanceId).toBe("P1_MOVER");
    expect(
      resolved.events.some((event) => event.type === "CARD_MOVED_ON_FIELD" && event.cardId === "P1_MOVER"),
    ).toBe(true);
  });

  it("resolves orderchange useAbility into swapping two friendly field cards", () => {
    const state = buildMainPhaseState();
    state.players.P1.field.AF_LEFT.card = makeCharacter("P1_TOP", "P1", "P1_TOP");
    state.players.P1.field.DF_LEFT.card = makeCharacter("P1_BOTTOM", "P1", "P1_BOTTOM");

    const declared = reduceGameState(state, {
      type: "DECLARE_ACTION",
      playerId: "P1",
      kind: "useAbility",
      sourceCardId: "P1_TOP",
      sourceEffectId: "ability_orderchange_001",
      targetingMode: "declareTime",
      targetSlots: ["DF_LEFT"],
      payload: {
        keyword: "orderchange",
        source: "keywordTag",
        sourceSlot: "AF_LEFT",
        swapTargetSlots: ["DF_LEFT"],
      },
    });

    const resolved = resolveLatestDeclarationByDoublePass(declared);

    expect(resolved.players.P1.field.AF_LEFT.card?.instanceId).toBe("P1_BOTTOM");
    expect(resolved.players.P1.field.DF_LEFT.card?.instanceId).toBe("P1_TOP");
    expect(
      resolved.events.some((event) => event.type === "CARD_SWAPPED_ON_FIELD" && event.cardId === "P1_TOP"),
    ).toBe(true);
  });
});
