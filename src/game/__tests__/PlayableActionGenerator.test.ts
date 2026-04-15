
import { describe, expect, it } from "vitest";
import { createInitialGameState } from "../GameRules";
import type { CardRef, GameState, PlayerID } from "../GameTypes";
import { generatePlayableKeywordActions } from "../PlayableActionGenerator";

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

describe("PlayableActionGenerator movement destinations", () => {
  it("includes only legal adjacent empty slots for step", () => {
    const state = buildMainPhaseState();
    const mover = makeCharacter("P1_STEPPER", "P1", "P1_STEPPER");
    const blocker = makeCharacter("P1_BLOCKER", "P1", "P1_BLOCKER");

    state.players.P1.field.AF_CENTER.card = mover;
    state.players.P1.field.AF_LEFT.card = blocker;

    const result = generatePlayableKeywordActions({
      state,
      keywordPlansByCardId: {
        P1_STEPPER: [{ kind: "declaration_candidate", keyword: "step" }],
      },
    });

    expect(result).toHaveLength(1);
    expect(result[0].destinationSlots).toEqual(["AF_RIGHT", "DF_CENTER"]);
    expect((result[0].action as any).payload.destinationSlots).toEqual(["AF_RIGHT", "DF_CENTER"]);
  });

  it("does not generate step candidate when no legal empty adjacent slot exists", () => {
    const state = buildMainPhaseState();
    const mover = makeCharacter("P1_STEPPER", "P1", "P1_STEPPER");
    state.players.P1.field.AF_CENTER.card = mover;
    state.players.P1.field.AF_LEFT.card = makeCharacter("P1_L", "P1", "P1_L");
    state.players.P1.field.AF_RIGHT.card = makeCharacter("P1_R", "P1", "P1_R");
    state.players.P1.field.DF_CENTER.card = makeCharacter("P1_D", "P1", "P1_D");

    const result = generatePlayableKeywordActions({
      state,
      keywordPlansByCardId: {
        P1_STEPPER: [{ kind: "declaration_candidate", keyword: "step" }],
      },
    });

    expect(result).toHaveLength(0);
  });

  it("generates jump candidate with all empty field slots as destinations", () => {
    const state = buildMainPhaseState();
    const jumper = makeCharacter("P1_JUMPER", "P1", "P1_JUMPER");
    state.players.P1.field.AF_LEFT.card = jumper;
    state.players.P1.field.DF_LEFT.card = makeCharacter("P1_BLOCK", "P1", "P1_BLOCK");

    const result = generatePlayableKeywordActions({
      state,
      keywordPlansByCardId: {
        P1_JUMPER: [{ kind: "declaration_candidate", keyword: "jump" }],
      },
    });

    expect(result).toHaveLength(1);
    expect(result[0].destinationSlots).toEqual([
      "AF_CENTER",
      "AF_RIGHT",
      "DF_CENTER",
      "DF_RIGHT",
    ]);
  });

  it("generates orderchange only when a vertical adjacent character exists", () => {
    const state = buildMainPhaseState();
    const changer = makeCharacter("P1_CHANGER", "P1", "P1_CHANGER");
    const target = makeCharacter("P1_TARGET", "P1", "P1_TARGET");
    state.players.P1.field.AF_CENTER.card = changer;
    state.players.P1.field.DF_CENTER.card = target;

    const result = generatePlayableKeywordActions({
      state,
      keywordPlansByCardId: {
        P1_CHANGER: [{ kind: "declaration_candidate", keyword: "orderchange" }],
      },
    });

    expect(result).toHaveLength(1);
    expect(result[0].swapTargetSlots).toEqual(["DF_CENTER"]);
    expect((result[0].action as any).payload.swapTargetSlots).toEqual(["DF_CENTER"]);
  });

  it("does not generate orderchange without a vertical adjacent character", () => {
    const state = buildMainPhaseState();
    const changer = makeCharacter("P1_CHANGER", "P1", "P1_CHANGER");
    state.players.P1.field.AF_CENTER.card = changer;

    const result = generatePlayableKeywordActions({
      state,
      keywordPlansByCardId: {
        P1_CHANGER: [{ kind: "declaration_candidate", keyword: "orderchange" }],
      },
    });

    expect(result).toHaveLength(0);
  });
});
