import { describe, expect, it } from "vitest";
import { reduceGameState } from "../GameEngine";
import { createInitialGameState } from "../GameRules";
import type { CardRef, FieldSlot, GameState, PlayerID } from "../GameTypes";

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
    ap: power,
    dp: power,
    dmg: 1,
    power,
    damage: 1,
    hp: power,
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

function declareCharacterFromHand(state: GameState, playerId: PlayerID, sourceCardId: string, slot: FieldSlot): GameState {
  return reduceGameState(state, {
    type: "DECLARE_ACTION",
    playerId,
    kind: "useCharacter",
    sourceCardId,
    targetSlots: [slot],
    targetingMode: "declareTime",
  });
}

function resolveLatestDeclarationByDoublePass(state: GameState): GameState {
  const state1 = reduceGameState(state, { type: "PASS_PRIORITY", playerId: state.turn.priorityPlayer });
  const state2 = reduceGameState(state1, { type: "PASS_PRIORITY", playerId: state1.turn.priorityPlayer });
  return state2;
}

function putCharacterOnField(state: GameState, playerId: PlayerID, slot: FieldSlot): { state: GameState; cardId: string } {
  const cardId = getFirstHandCharacterId(state, playerId);
  const declared = declareCharacterFromHand(state, playerId, cardId, slot);
  const resolved = resolveLatestDeclarationByDoublePass(declared);
  return { state: resolved, cardId };
}

describe("RuleViolation", () => {
  it("DF 캐릭터는 공격 선언할 수 없다", () => {
    const ready = buildReadyToMainState("P1");
    const entered = putCharacterOnField(ready, "P1", "DF_LEFT");
    const next = reduceGameState(entered.state, {
      type: "DECLARE_ACTION",
      playerId: "P1",
      kind: "attack",
      sourceCardId: entered.cardId,
    });

    expect(next.battle.isActive).toBe(false);
    expect(next.declarationStack).toHaveLength(0);
    expect(next.logs.some((log) => log.includes("ATTACKER_NOT_AF"))).toBe(true);
  });

  it("공격 대응 창에서는 캐릭터 등장 선언을 할 수 없다", () => {
    const ready = buildReadyToMainState("P1");
    const attackerEntered = putCharacterOnField(ready, "P1", "AF_LEFT");
    const p2CardId = getFirstHandCharacterId(attackerEntered.state, "P2");

    const declared = reduceGameState(attackerEntered.state, {
      type: "DECLARE_ACTION",
      playerId: "P1",
      kind: "attack",
      sourceCardId: attackerEntered.cardId,
    });

    const next = reduceGameState(declared, {
      type: "DECLARE_ACTION",
      playerId: "P2",
      kind: "useCharacter",
      sourceCardId: p2CardId,
      targetSlots: ["AF_LEFT"],
      targetingMode: "declareTime",
    });

    expect(next.declarationStack).toHaveLength(0);
    expect(next.logs.some((log) => log.includes("BATTLE_CHARACTER_DECLARATION_FORBIDDEN"))).toBe(true);
  });
});
