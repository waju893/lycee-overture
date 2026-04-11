import { describe, expect, it } from "vitest";
import { reduceGameState } from "../GameEngine";
import { createInitialGameState } from "../GameRules";
import type { CardRef, GameState, PlayerID } from "../GameTypes";

function makeCharacter(
  instanceId: string,
  owner: PlayerID,
  name: string,
  power = 3,
  isLeader = false,
): CardRef {
  return {
    instanceId,
    cardNo: instanceId,
    name,
    owner,
    cardType: "character",
    sameNameKey: instanceId,
    power,
    damage: power,
    isTapped: false,
    canAttack: true,
    canBlock: true,
    revealed: false,
    location: "deck",
    isLeader,
  };
}

function makeDeck(owner: PlayerID, prefix: string): CardRef[] {
  const deck: CardRef[] = [];
  while (deck.length < 60) {
    const i = deck.length + 1;
    deck.push(makeCharacter(`${prefix}_${String(i).padStart(3, "0")}`, owner, `${prefix}_CHAR_${i}`, 3 + (i % 3)));
  }
  return deck;
}

function getFirstHandCharacterId(state: GameState, playerId: PlayerID): string {
  const card = state.players[playerId].hand.find((c) => c.cardType === "character");
  if (!card) throw new Error(`${playerId} hand has no character`);
  return card.instanceId;
}

function passCurrentMainPhaseToNextTurn(state: GameState): GameState {
  const state1 = reduceGameState(state, { type: "ADVANCE_PHASE" });
  const state2 = reduceGameState(state1, { type: "ADVANCE_PHASE" });
  const state3 = reduceGameState(state2, { type: "ADVANCE_PHASE" });
  return state3;
}

function buildReadyToMainState(firstPlayer: PlayerID = "P1"): GameState {
  const state0 = createInitialGameState({ p1Deck: makeDeck("P1", "P1"), p2Deck: makeDeck("P2", "P2"), leaderEnabled: false });
  const state1 = reduceGameState(state0, { type: "START_GAME", firstPlayer, leaderEnabled: false });
  const state2 = reduceGameState(state1, { type: "KEEP_STARTING_HAND", playerId: "P1" });
  const state3 = reduceGameState(state2, { type: "KEEP_STARTING_HAND", playerId: "P2" });
  const state4 = reduceGameState(state3, { type: "FINALIZE_STARTUP" });
  const state5 = reduceGameState(state4, { type: "START_TURN" });
  const state6 = reduceGameState(state5, { type: "ADVANCE_PHASE" });
  return state6;
}

function resolveLatestDeclarationByDoublePass(state: GameState): GameState {
  const state1 = reduceGameState(state, { type: "PASS_PRIORITY", playerId: state.turn.priorityPlayer });
  const state2 = reduceGameState(state1, { type: "PASS_PRIORITY", playerId: state1.turn.priorityPlayer });
  return state2;
}

function resolveAttackFlowByPasses(state: GameState): GameState {
  const s1 = reduceGameState(state, { type: "PASS_PRIORITY", playerId: state.battle.priorityPlayer ?? "P2" });
  const s2 = reduceGameState(s1, { type: "PASS_PRIORITY", playerId: s1.battle.priorityPlayer ?? "P1" });
  const s3 = reduceGameState(s2, { type: "PASS_PRIORITY", playerId: s2.battle.priorityPlayer ?? "P1" });
  const s4 = reduceGameState(s3, { type: "PASS_PRIORITY", playerId: s3.battle.priorityPlayer ?? "P2" });
  return s4;
}

describe("MinimalPlayableEngine", () => {
  it("직접 공격까지 끝난 캐릭터는 턴이 돌아오면 untap 된다", () => {
    const state6 = buildReadyToMainState("P1");
    const charId = getFirstHandCharacterId(state6, "P1");

    const state7 = reduceGameState(state6, {
      type: "DECLARE_ACTION",
      playerId: "P1",
      kind: "useCharacter",
      sourceCardId: charId,
      targetSlots: ["AF_LEFT"],
      targetingMode: "declareTime",
    });

    const state9 = resolveLatestDeclarationByDoublePass(state7);

    const state10 = reduceGameState(state9, {
      type: "DECLARE_ACTION",
      playerId: "P1",
      kind: "attack",
      sourceCardId: charId,
    });

    expect(state10.battle.phase).toBe("awaitingDefenderSelection");

    const state14 = resolveAttackFlowByPasses(state10);

    expect(state14.players.P1.field.AF_LEFT.card?.isTapped).toBe(true);

    const state15 = passCurrentMainPhaseToNextTurn(state14);
    const state16 = passCurrentMainPhaseToNextTurn(state15);

    expect(state16.players.P1.field.AF_LEFT.card?.isTapped).toBe(false);
  });
});
