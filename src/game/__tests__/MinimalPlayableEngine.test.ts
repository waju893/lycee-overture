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

function makeDeck(
  owner: PlayerID,
  prefix: string,
  options?: { includeLeader?: boolean },
): CardRef[] {
  const deck: CardRef[] = [];
  const includeLeader = options?.includeLeader ?? false;

  if (includeLeader) {
    deck.push(
      makeCharacter(`${prefix}_LEADER`, owner, `${prefix}_LEADER`, 5, true),
    );
  }

  while (deck.length < 60) {
    const i = deck.length + 1;
    deck.push(
      makeCharacter(
        `${prefix}_${String(i).padStart(3, "0")}`,
        owner,
        `${prefix}_CHAR_${i}`,
        3 + (i % 3),
      ),
    );
  }

  return deck;
}

function getFirstHandCharacterId(state: GameState, playerId: PlayerID): string {
  const card = state.players[playerId].hand.find((c) => c.cardType === "character");
  if (!card) {
    throw new Error(`${playerId} hand has no character`);
  }
  return card.instanceId;
}

function passCurrentMainPhaseToNextTurn(state: GameState): GameState {
  const state1 = reduceGameState(state, { type: "ADVANCE_PHASE" });
  const state2 = reduceGameState(state1, { type: "ADVANCE_PHASE" });
  const state3 = reduceGameState(state2, { type: "ADVANCE_PHASE" });
  return state3;
}

function buildReadyToMainState(firstPlayer: PlayerID = "P1"): GameState {
  const state0 = createInitialGameState({
    p1Deck: makeDeck("P1", "P1"),
    p2Deck: makeDeck("P2", "P2"),
    leaderEnabled: false,
  });

  const state1 = reduceGameState(state0, {
    type: "START_GAME",
    firstPlayer,
    leaderEnabled: false,
  });

  const state2 = reduceGameState(state1, {
    type: "KEEP_STARTING_HAND",
    playerId: "P1",
  });

  const state3 = reduceGameState(state2, {
    type: "KEEP_STARTING_HAND",
    playerId: "P2",
  });

  const state4 = reduceGameState(state3, { type: "FINALIZE_STARTUP" });
  const state5 = reduceGameState(state4, { type: "START_TURN" });
  const state6 = reduceGameState(state5, { type: "ADVANCE_PHASE" });

  return state6;
}

describe("MinimalPlayableEngine", () => {
  it("START_GAME 후 스타트업 드로우가 정상 적용된다", () => {
    const state = createInitialGameState({
      p1Deck: makeDeck("P1", "P1"),
      p2Deck: makeDeck("P2", "P2"),
      leaderEnabled: false,
    });

    const next = reduceGameState(state, {
      type: "START_GAME",
      firstPlayer: "P1",
      leaderEnabled: false,
    });

    expect(next.startup.active).toBe(true);
    expect(next.players.P1.hand.length).toBe(7);
    expect(next.players.P2.hand.length).toBe(7);
  });

  it("양 플레이어 KEEP 후 FINALIZE_STARTUP 하면 턴 준비가 된다", () => {
    const state0 = createInitialGameState({
      p1Deck: makeDeck("P1", "P1"),
      p2Deck: makeDeck("P2", "P2"),
      leaderEnabled: false,
    });

    const state1 = reduceGameState(state0, {
      type: "START_GAME",
      firstPlayer: "P1",
      leaderEnabled: false,
    });

    const state2 = reduceGameState(state1, {
      type: "KEEP_STARTING_HAND",
      playerId: "P1",
    });

    const state3 = reduceGameState(state2, {
      type: "KEEP_STARTING_HAND",
      playerId: "P2",
    });

    const state4 = reduceGameState(state3, { type: "FINALIZE_STARTUP" });

    expect(state4.startup.active).toBe(false);
    expect(state4.turn.phase).toBe("wakeup");
  });

  it("선공 첫 턴 메인 진입 시 드로우 1장이 이미 적용된다", () => {
    const state6 = buildReadyToMainState("P1");

    expect(state6.turn.activePlayer).toBe("P1");
    expect(state6.turn.phase).toBe("main");
    expect(state6.players.P1.hand.length).toBe(8);
  });

  it("턴이 돌아오면 캐릭터는 untap 된다", () => {
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

    const state8 = reduceGameState(state7, {
      type: "PASS_PRIORITY",
      playerId: "P2",
    });

    const state9 = reduceGameState(state8, {
      type: "PASS_PRIORITY",
      playerId: "P1",
    });

    const state10 = reduceGameState(state9, {
      type: "DECLARE_ACTION",
      playerId: "P1",
      kind: "attack",
      sourceCardId: charId,
    });

    const state11 = reduceGameState(state10, {
      type: "PASS_PRIORITY",
      playerId: "P2",
    });

    const state12 = reduceGameState(state11, {
      type: "PASS_PRIORITY",
      playerId: "P1",
    });

    const state13 = reduceGameState(state12, {
      type: "SET_DEFENDER",
      playerId: "P2",
    });

    expect(state13.players.P1.field.AF_LEFT.card?.isTapped).toBe(true);

    const state14 = passCurrentMainPhaseToNextTurn(state13);
    const state15 = passCurrentMainPhaseToNextTurn(state14);

    expect(state15.players.P1.field.AF_LEFT.card?.isTapped).toBe(false);
  });

  it("멀리건 후에는 같은 플레이어가 다시 스타트업 선택을 할 수 없다", () => {
    const state0 = createInitialGameState({
      p1Deck: makeDeck("P1", "P1", { includeLeader: true }),
      p2Deck: makeDeck("P2", "P2", { includeLeader: true }),
      leaderEnabled: true,
    });

    const state1 = reduceGameState(state0, {
      type: "START_GAME",
      firstPlayer: "P1",
      leaderEnabled: true,
    });

    const state2 = reduceGameState(state1, {
      type: "MULLIGAN",
      playerId: "P1",
    });

    const state3 = reduceGameState(state2, {
      type: "MULLIGAN",
      playerId: "P1",
    });

    expect(
      state3.logs.some((log) => log.includes("ALREADY_DECIDED")),
    ).toBe(true);
  });
});