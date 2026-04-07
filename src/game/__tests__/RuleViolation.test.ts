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
    damage: power,
    hp: power,
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

function getFieldCardId(
  state: GameState,
  playerId: PlayerID,
  slot: FieldSlot,
): string | null {
  return state.players[playerId].field[slot].card?.instanceId ?? null;
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

function declareCharacterFromHand(
  state: GameState,
  playerId: PlayerID,
  sourceCardId: string,
  slot: FieldSlot,
): GameState {
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

function putCharacterOnField(
  state: GameState,
  playerId: PlayerID,
  slot: FieldSlot,
): { state: GameState; cardId: string } {
  const cardId = getFirstHandCharacterId(state, playerId);
  const declared = declareCharacterFromHand(state, playerId, cardId, slot);
  const resolved = resolveLatestDeclarationByDoublePass(declared);
  return { state: resolved, cardId };
}

function resolveAttackDeclaration(
  state: GameState,
  attackerPlayerId: PlayerID,
  attackerCardId: string,
): GameState {
  const state1 = reduceGameState(state, {
    type: "DECLARE_ACTION",
    playerId: attackerPlayerId,
    kind: "attack",
    sourceCardId: attackerCardId,
  });

  const state2 = reduceGameState(state1, {
    type: "PASS_PRIORITY",
    playerId: state1.turn.priorityPlayer,
  });

  const state3 = reduceGameState(state2, {
    type: "PASS_PRIORITY",
    playerId: state2.turn.priorityPlayer,
  });

  return state3;
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

    expect(next.declarationStack).toHaveLength(0);
    expect(next.battle.isActive).toBe(false);
    expect(next.logs.some((log) => log.includes("ATTACKER_NOT_AF"))).toBe(true);
  });

  it("행동완료 캐릭터는 공격 선언할 수 없다", () => {
    const ready = buildReadyToMainState("P1");
    const entered = putCharacterOnField(ready, "P1", "AF_LEFT");

    const attacker = entered.state.players.P1.field.AF_LEFT.card;
    expect(attacker).not.toBeNull();
    if (!attacker) throw new Error("attacker should exist");

    attacker.isTapped = true;

    const next = reduceGameState(entered.state, {
      type: "DECLARE_ACTION",
      playerId: "P1",
      kind: "attack",
      sourceCardId: entered.cardId,
    });

    expect(next.declarationStack).toHaveLength(0);
    expect(next.battle.isActive).toBe(false);
    expect(next.logs.some((log) => log.includes("ATTACKER_TAPPED"))).toBe(true);
  });

  it("메인페이즈가 아니면 등장 선언할 수 없다", () => {
    const ready = buildReadyToMainState("P1");
    const nonMain = reduceGameState(ready, { type: "ADVANCE_PHASE" });

    const handCardId = getFirstHandCharacterId(nonMain, "P1");
    const beforeHandCount = nonMain.players.P1.hand.length;

    const next = declareCharacterFromHand(nonMain, "P1", handCardId, "AF_LEFT");

    expect(next.declarationStack).toHaveLength(0);
    expect(next.players.P1.hand.length).toBe(beforeHandCount);
    expect(getFieldCardId(next, "P1", "AF_LEFT")).toBeNull();
    expect(next.logs.some((log) => log.includes("TIMING_INVALID"))).toBe(true);
  });

  it("메인페이즈가 아니면 공격 선언할 수 없다", () => {
    const ready = buildReadyToMainState("P1");
    const entered = putCharacterOnField(ready, "P1", "AF_LEFT");
    const nonMain = reduceGameState(entered.state, { type: "ADVANCE_PHASE" });

    const next = reduceGameState(nonMain, {
      type: "DECLARE_ACTION",
      playerId: "P1",
      kind: "attack",
      sourceCardId: entered.cardId,
    });

    expect(next.declarationStack).toHaveLength(0);
    expect(next.battle.isActive).toBe(false);
    expect(next.logs.some((log) => log.includes("TIMING_INVALID"))).toBe(true);
  });

  it("같은 이름 캐릭터는 자기 장에 중복 등장할 수 없다", () => {
    const ready = buildReadyToMainState("P1");
    const firstCardId = getFirstHandCharacterId(ready, "P1");
    const firstCard = ready.players.P1.hand.find((c) => c.instanceId === firstCardId);

    if (!firstCard) {
      throw new Error("first card should exist");
    }

    const entered = declareCharacterFromHand(ready, "P1", firstCardId, "AF_LEFT");
    const resolved = resolveLatestDeclarationByDoublePass(entered);

    const duplicateCard: CardRef = {
      ...makeCharacter("P1_DUPLICATE", "P1", "P1_DUPLICATE_NAME", 4, false),
      sameNameKey: firstCard.sameNameKey,
      location: "hand",
    };

    resolved.players.P1.hand.push(duplicateCard);

    const next = declareCharacterFromHand(
      resolved,
      "P1",
      duplicateCard.instanceId,
      "AF_CENTER",
    );

    expect(next.declarationStack).toHaveLength(0);
    expect(getFieldCardId(next, "P1", "AF_CENTER")).toBeNull();
    expect(next.logs.some((log) => log.includes("SAME_NAME_ON_FIELD"))).toBe(true);
  });

  it("이미 카드가 있는 칸에는 등장 선언할 수 없다", () => {
    const ready = buildReadyToMainState("P1");
    const entered = putCharacterOnField(ready, "P1", "AF_LEFT");

    const secondCardId = getFirstHandCharacterId(entered.state, "P1");
    const beforeHandCount = entered.state.players.P1.hand.length;

    const next = declareCharacterFromHand(
      entered.state,
      "P1",
      secondCardId,
      "AF_LEFT",
    );

    expect(next.declarationStack).toHaveLength(0);
    expect(next.players.P1.hand.length).toBe(beforeHandCount);
    expect(getFieldCardId(next, "P1", "AF_LEFT")).toBe(entered.cardId);
    expect(next.logs.some((log) => log.includes("FIELD_OCCUPIED"))).toBe(true);
  });

  it("다른 열 DF만 있으면 방어자로 채택되지 않고 직접 공격이 된다", () => {
    const ready = buildReadyToMainState("P1");
    const attackerEntered = putCharacterOnField(ready, "P1", "AF_LEFT");

    const p2Main = passCurrentMainPhaseToNextTurn(attackerEntered.state);
    const defenderEntered = putCharacterOnField(p2Main, "P2", "DF_RIGHT");

    const defenderCard = defenderEntered.state.players.P2.field.DF_RIGHT.card;
    expect(defenderCard).not.toBeNull();
    if (!defenderCard) {
      throw new Error("defender should exist");
    }

    const backToP1Main = passCurrentMainPhaseToNextTurn(defenderEntered.state);
    const beforeDeck = backToP1Main.players.P2.deck.length;
    const beforeDiscard = backToP1Main.players.P2.discard.length;

    const next = resolveAttackDeclaration(
      backToP1Main,
      "P1",
      attackerEntered.cardId,
    );

    expect(next.battle.isActive).toBe(false);
    expect(next.players.P2.field.DF_RIGHT.card?.instanceId).toBe(defenderEntered.cardId);
    expect(next.players.P2.field.DF_RIGHT.card?.isTapped).toBe(false);
    expect(next.players.P2.deck.length).toBe(beforeDeck - 1);
    expect(next.players.P2.discard.length).toBe(beforeDiscard + 1);
    expect(next.logs.some((log) => log.includes("직접 공격"))).toBe(true);
  });

  it("행동완료 같은 열 DF는 방어자로 채택되지 않고 직접 공격이 된다", () => {
    const ready = buildReadyToMainState("P1");
    const attackerEntered = putCharacterOnField(ready, "P1", "AF_LEFT");

    const p2Main = passCurrentMainPhaseToNextTurn(attackerEntered.state);
    const defenderEntered = putCharacterOnField(p2Main, "P2", "DF_LEFT");

    const defenderCard = defenderEntered.state.players.P2.field.DF_LEFT.card;
    expect(defenderCard).not.toBeNull();
    if (!defenderCard) {
      throw new Error("defender should exist");
    }

    defenderCard.isTapped = true;

    const backToP1Main = passCurrentMainPhaseToNextTurn(defenderEntered.state);
    const beforeDeck = backToP1Main.players.P2.deck.length;
    const beforeDiscard = backToP1Main.players.P2.discard.length;

    const next = resolveAttackDeclaration(
      backToP1Main,
      "P1",
      attackerEntered.cardId,
    );

    expect(next.battle.isActive).toBe(false);
    expect(next.players.P2.field.DF_LEFT.card?.instanceId).toBe(defenderEntered.cardId);
    expect(next.players.P2.field.DF_LEFT.card?.isTapped).toBe(true);
    expect(next.players.P2.deck.length).toBe(beforeDeck - 1);
    expect(next.players.P2.discard.length).toBe(beforeDiscard + 1);
    expect(next.logs.some((log) => log.includes("직접 공격"))).toBe(true);
  });
});
