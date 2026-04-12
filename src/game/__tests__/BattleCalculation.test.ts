import { describe, expect, it } from "vitest";
import { reduceGameState } from "../GameEngine";
import { createInitialGameState } from "../GameRules";
import type { CardRef, FieldSlot, GameState, PlayerID } from "../GameTypes";

function makeCharacter(
  instanceId: string,
  owner: PlayerID,
  name: string,
  stats?: { ap?: number; dp?: number; dmg?: number; support?: number; bonus?: number },
): CardRef {
  const ap = stats?.ap ?? 3;
  const dp = stats?.dp ?? 3;
  const dmg = stats?.dmg ?? 1;

  return {
    instanceId,
    cardNo: instanceId,
    name,
    owner,
    cardType: "character",
    sameNameKey: instanceId,
    ap,
    dp,
    dmg,
    support: stats?.support ?? 0,
    bonus: stats?.bonus ?? 0,
    power: ap,
    damage: dmg,
    hp: dp,
    isTapped: false,
    canAttack: true,
    canBlock: true,
    revealed: false,
    location: "deck",
  };
}

function makeDeck(
  owner: PlayerID,
  prefix: string,
  overrides?: Partial<Record<number, CardRef>>,
): CardRef[] {
  const deck: CardRef[] = [];
  while (deck.length < 60) {
    const i = deck.length + 1;
    const override = overrides?.[i];
    if (override) {
      deck.push({
        ...override,
        owner,
        location: "deck",
        isTapped: false,
        revealed: false,
      });
    } else {
      deck.push(
        makeCharacter(
          `${prefix}_${String(i).padStart(3, "0")}`,
          owner,
          `${prefix}_CHAR_${i}`,
          { ap: 3 + (i % 3), dp: 3 + (i % 2), dmg: 1 },
        ),
      );
    }
  }
  return deck;
}

function getFirstHandCharacterId(state: GameState, playerId: PlayerID): string {
  const card = state.players[playerId].hand.find((c) => c.cardType === "character");
  if (!card) throw new Error(`${playerId} hand has no character`);
  return card.instanceId;
}

function buildReadyToMainState(firstPlayer: PlayerID, p1Deck: CardRef[], p2Deck: CardRef[]): GameState {
  const state0 = createInitialGameState({ p1Deck, p2Deck, leaderEnabled: false });
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

function passCurrentMainPhaseToNextTurn(state: GameState): GameState {
  const state1 = reduceGameState(state, { type: "ADVANCE_PHASE" });
  const state2 = reduceGameState(state1, { type: "ADVANCE_PHASE" });
  const state3 = reduceGameState(state2, { type: "ADVANCE_PHASE" });
  return state3;
}

function declareAttack(state: GameState, attackerPlayerId: PlayerID, attackerCardId: string): GameState {
  return reduceGameState(state, {
    type: "DECLARE_ACTION",
    playerId: attackerPlayerId,
    kind: "attack",
    sourceCardId: attackerCardId,
  });
}

function passAttackResponses(state: GameState): GameState {
  const s1 = reduceGameState(state, { type: "PASS_PRIORITY", playerId: state.battle.priorityPlayer ?? "P2" });
  const s2 = reduceGameState(s1, { type: "PASS_PRIORITY", playerId: s1.battle.priorityPlayer ?? "P1" });
  return s2;
}

function resolveBattleByDoublePass(state: GameState): GameState {
  const s1 = reduceGameState(state, { type: "PASS_PRIORITY", playerId: state.battle.priorityPlayer ?? "P1" });
  const s2 = reduceGameState(s1, { type: "PASS_PRIORITY", playerId: s1.battle.priorityPlayer ?? "P2" });
  return s2;
}

describe("BattleCalculation", () => {
  it("support and bonus increase attacker battle AP", () => {
    const p1Deck = makeDeck("P1", "P1", {
      1: makeCharacter("P1_ATK", "P1", "P1_ATK", { ap: 2, dp: 3, dmg: 1, support: 2, bonus: 1 }),
    });
    const p2Deck = makeDeck("P2", "P2", {
      1: makeCharacter("P2_DEF", "P2", "P2_DEF", { ap: 1, dp: 4, dmg: 1, bonus: 0 }),
    });

    const ready = buildReadyToMainState("P1", p1Deck, p2Deck);
    const attackerEntered = putCharacterOnField(ready, "P1", "AF_LEFT");
    const p2Main = passCurrentMainPhaseToNextTurn(attackerEntered.state);
    const defenderEntered = putCharacterOnField(p2Main, "P2", "DF_LEFT");
    const backToP1Main = passCurrentMainPhaseToNextTurn(defenderEntered.state);

    const declared = declareAttack(backToP1Main, "P1", attackerEntered.cardId);
    const inBattle = passAttackResponses(declared);
    const withDefender = reduceGameState(inBattle, {
      type: "SET_DEFENDER",
      playerId: "P2",
      defenderCardId: defenderEntered.cardId,
    });
    const result = resolveBattleByDoublePass(withDefender);

    expect(result.players.P2.field.DF_LEFT.card).toBeNull();
    expect(result.logs.some((log) => log.includes("[BATTLE CALC] attacker AP=5 vs DP=4"))).toBe(true);
  });

  it("bonus increases defender DP and can prevent destruction", () => {
    const p1Deck = makeDeck("P1", "P1", {
      1: makeCharacter("P1_ATK", "P1", "P1_ATK", { ap: 4, dp: 3, dmg: 1 }),
    });
    const p2Deck = makeDeck("P2", "P2", {
      1: makeCharacter("P2_DEF", "P2", "P2_DEF", { ap: 1, dp: 3, dmg: 1, bonus: 2 }),
    });

    const ready = buildReadyToMainState("P1", p1Deck, p2Deck);
    const attackerEntered = putCharacterOnField(ready, "P1", "AF_LEFT");
    const p2Main = passCurrentMainPhaseToNextTurn(attackerEntered.state);
    const defenderEntered = putCharacterOnField(p2Main, "P2", "DF_LEFT");
    const backToP1Main = passCurrentMainPhaseToNextTurn(defenderEntered.state);

    const declared = declareAttack(backToP1Main, "P1", attackerEntered.cardId);
    const inBattle = passAttackResponses(declared);
    const withDefender = reduceGameState(inBattle, {
      type: "SET_DEFENDER",
      playerId: "P2",
      defenderCardId: defenderEntered.cardId,
    });
    const result = resolveBattleByDoublePass(withDefender);

    expect(result.players.P2.field.DF_LEFT.card?.instanceId).toBe(defenderEntered.cardId);
    expect(result.logs.some((log) => log.includes("[BATTLE CALC] attacker AP=4 vs DP=5"))).toBe(true);
  });

  it("support and bonus also apply to defender counterattack AP", () => {
    const p1Deck = makeDeck("P1", "P1", {
      1: makeCharacter("P1_ATK", "P1", "P1_ATK", { ap: 3, dp: 3, dmg: 1 }),
    });
    const p2Deck = makeDeck("P2", "P2", {
      1: makeCharacter("P2_DEF", "P2", "P2_DEF", { ap: 2, dp: 2, dmg: 1, support: 2, bonus: 1 }),
    });

    const ready = buildReadyToMainState("P1", p1Deck, p2Deck);
    const attackerEntered = putCharacterOnField(ready, "P1", "AF_LEFT");
    const p2Main = passCurrentMainPhaseToNextTurn(attackerEntered.state);
    const defenderEntered = putCharacterOnField(p2Main, "P2", "DF_LEFT");
    const backToP1Main = passCurrentMainPhaseToNextTurn(defenderEntered.state);

    const declared = declareAttack(backToP1Main, "P1", attackerEntered.cardId);
    const inBattle = passAttackResponses(declared);
    const withDefender = reduceGameState(inBattle, {
      type: "SET_DEFENDER",
      playerId: "P2",
      defenderCardId: defenderEntered.cardId,
    });
    const result = resolveBattleByDoublePass(withDefender);

    expect(result.players.P1.field.AF_LEFT.card).toBeNull();
    expect(result.logs.some((log) => log.includes("[BATTLE CALC] defender AP=5 vs DP=3"))).toBe(true);
  });
});