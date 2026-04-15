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

  const mover = makeCharacter("P1_JUMPER", "P1", "P1_JUMPER");
  const tapped = makeCharacter("P1_TAPPED", "P1", "P1_TAPPED");
  tapped.isTapped = true;
  const enemy = makeCharacter("P2_ENEMY", "P2", "P2_ENEMY");

  state.players.P1.field.AF_LEFT.card = mover;
  state.players.P1.field.AF_CENTER.card = tapped;
  state.players.P2.field.AF_LEFT.card = enemy;

  return state;
}

describe("PlayableActionGenerator", () => {
  it("generates useAbility candidates for active player's untapped movement keyword cards", () => {
    const state = buildMainPhaseState();

    const result = generatePlayableKeywordActions({
      state,
      keywordPlansByCardId: {
        P1_JUMPER: [
          {
            kind: "declaration_candidate",
            keyword: "jump",
          },
        ],
        P1_TAPPED: [
          {
            kind: "declaration_candidate",
            keyword: "step",
          },
        ],
        P2_ENEMY: [
          {
            kind: "declaration_candidate",
            keyword: "orderchange",
          },
        ],
      },
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      cardId: "P1_JUMPER",
      slot: "AF_LEFT",
      keyword: "jump",
      action: {
        type: "DECLARE_ACTION",
        playerId: "P1",
        kind: "useAbility",
        sourceCardId: "P1_JUMPER",
      },
    });
    expect((result[0].action as any).payload).toEqual({
      keyword: "jump",
      source: "keywordTag",
    });
  });

  it("returns no candidates outside the active player's main phase", () => {
    const state = buildMainPhaseState();
    state.turn.phase = "battle";

    const result = generatePlayableKeywordActions({
      state,
      keywordPlansByCardId: {
        P1_JUMPER: [
          {
            kind: "declaration_candidate",
            keyword: "jump",
          },
        ],
      },
    });

    expect(result).toHaveLength(0);
  });
});
