import { describe, expect, it } from "vitest";
import type { GameAction } from "../GameActions";
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
    isTapped: false,
    canAttack: true,
    canBlock: true,
    location: "deck",
  };
}

function makeDeck(owner: PlayerID, prefix: string): CardRef[] {
  return Array.from({ length: 60 }, (_, idx) => {
    const n = idx + 1;
    return makeCharacter(`${prefix}_${String(n).padStart(3, "0")}`, owner, `${prefix}_${n}`);
  });
}

function runActions(state: GameState, actions: GameAction[]): GameState {
  return actions.reduce((acc, action) => reduceGameState(acc, action), state);
}

describe("Replay determinism", () => {
  it("같은 이벤트 스트림이면 같은 결과 상태를 재현한다", () => {
    const initial = createInitialGameState({
      p1Deck: makeDeck("P1", "P1"),
      p2Deck: makeDeck("P2", "P2"),
      leaderEnabled: false,
    });

    const actions: GameAction[] = [
      { type: "START_GAME", firstPlayer: "P1", leaderEnabled: false },
      { type: "KEEP_STARTING_HAND", playerId: "P1" },
      { type: "KEEP_STARTING_HAND", playerId: "P2" },
      { type: "FINALIZE_STARTUP" },
      { type: "START_TURN" },
      { type: "ADVANCE_PHASE" },
      { type: "PASS_PRIORITY", playerId: "P1" },
    ];

    const finalA = runActions(initial, actions);
    const replayedActions = finalA.replayEvents.map((event) => event.payload as GameAction);
    const finalB = runActions(initial, replayedActions);

    expect(finalB.turn).toEqual(finalA.turn);
    expect(finalB.players.P1.hand.length).toBe(finalA.players.P1.hand.length);
    expect(finalB.players.P2.hand.length).toBe(finalA.players.P2.hand.length);
    expect(finalB.logs).toEqual(finalA.logs);
  });
});
