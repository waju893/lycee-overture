import { describe, expect, it } from "vitest";
import { reduceGameState } from "../GameEngine";
import { createInitialGameState } from "../GameRules";
import type { CardRef, FieldSlot, GameState, PlayerID } from "../GameTypes";

function makeCharacter(
  instanceId: string,
  owner: PlayerID,
  name: string,
  stats?: { ap?: number; dp?: number; dmg?: number },
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

describe("BattleResolution", () => {
  it("공격 선언 직후에는 먼저 대응 창으로 들어간다", () => {
    const ready = buildReadyToMainState("P1", makeDeck("P1", "P1"), makeDeck("P2", "P2"));
    const attackerEntered = putCharacterOnField(ready, "P1", "AF_LEFT");
    const declared = declareAttack(attackerEntered.state, "P1", attackerEntered.cardId);

    expect(declared.battle.isActive).toBe(true);
    expect(declared.battle.phase).toBe("awaitingDefenderSelection");
    expect(declared.battle.priorityPlayer).toBe("P2");
    expect(declared.logs.some((log) => log.includes("공격 선언 대응 창 진입"))).toBe(true);
  });

  it("공격 선언 대응 stack 처리 후에야 방어 선택 가능 배틀 중 상태로 들어간다", () => {
    const p1Deck = makeDeck("P1", "P1");
    const p2Deck = makeDeck("P2", "P2", {
      1: makeCharacter("P2_DEF", "P2", "P2_DEF", { ap: 2, dp: 3, dmg: 1 }),
    });

    const ready = buildReadyToMainState("P1", p1Deck, p2Deck);
    const attackerEntered = putCharacterOnField(ready, "P1", "AF_LEFT");
    const p2Main = passCurrentMainPhaseToNextTurn(attackerEntered.state);
    const defenderEntered = putCharacterOnField(p2Main, "P2", "DF_LEFT");
    const backToP1Main = passCurrentMainPhaseToNextTurn(defenderEntered.state);

    const declared = declareAttack(backToP1Main, "P1", attackerEntered.cardId);
    const inBattle = passAttackResponses(declared);

    expect(inBattle.battle.phase).toBe("duringBattle");
    expect(inBattle.battle.defenderCardId).toBeUndefined();
    expect(inBattle.battle.priorityPlayer).toBe("P1");
    expect(inBattle.logs.some((log) => log.includes("방어 선택 가능"))).toBe(true);
  });

  it("같은 열 미행동 DF가 있어도 상대가 방어하지 않으면 direct attack 된다", () => {
    const p1Deck = makeDeck("P1", "P1", {
      1: makeCharacter("P1_ATK", "P1", "P1_ATK", { ap: 3, dp: 3, dmg: 2 }),
    });
    const p2Deck = makeDeck("P2", "P2", {
      1: makeCharacter("P2_DEF", "P2", "P2_DEF", { ap: 2, dp: 3, dmg: 1 }),
    });

    const ready = buildReadyToMainState("P1", p1Deck, p2Deck);
    const attackerEntered = putCharacterOnField(ready, "P1", "AF_LEFT");
    const p2Main = passCurrentMainPhaseToNextTurn(attackerEntered.state);
    const defenderEntered = putCharacterOnField(p2Main, "P2", "DF_LEFT");
    const backToP1Main = passCurrentMainPhaseToNextTurn(defenderEntered.state);
    const beforeDeck = backToP1Main.players.P2.deck.length;

    const declared = declareAttack(backToP1Main, "P1", attackerEntered.cardId);
    const inBattle = passAttackResponses(declared);
    const next = resolveBattleByDoublePass(inBattle);

    expect(next.battle.isActive).toBe(false);
    expect(next.players.P2.field.DF_LEFT.card?.instanceId).toBe(defenderEntered.cardId);
    expect(next.players.P2.deck.length).toBe(beforeDeck - 2);
  });

  it("공격 선언 대응으로 같은 열 DF가 새로 등장한 뒤 방어 선택이 가능해진다", () => {
    const p1Deck = makeDeck("P1", "P1");
    const p2Deck = makeDeck("P2", "P2");

    const ready = buildReadyToMainState("P1", p1Deck, p2Deck);
    const attackerEntered = putCharacterOnField(ready, "P1", "AF_LEFT");
    const p2CardId = getFirstHandCharacterId(attackerEntered.state, "P2");

    const declared = declareAttack(attackerEntered.state, "P1", attackerEntered.cardId);
    const responseDeclared = reduceGameState(declared, {
      type: "DECLARE_ACTION",
      playerId: "P2",
      kind: "useCharacter",
      sourceCardId: p2CardId,
      targetSlots: ["DF_LEFT"],
      targetingMode: "declareTime",
    });

    const responseResolved = reduceGameState(responseDeclared, {
      type: "PASS_PRIORITY",
      playerId: responseDeclared.battle.priorityPlayer ?? "P1",
    });

    const inBattle = passAttackResponses(responseResolved);

    expect(inBattle.players.P2.field.DF_LEFT.card?.instanceId).toBe(p2CardId);
    expect(inBattle.battle.phase).toBe("duringBattle");
    expect(inBattle.logs.some((log) => log.includes("방어 선택 가능"))).toBe(true);
  });
});
