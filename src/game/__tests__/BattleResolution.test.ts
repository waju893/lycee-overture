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
  if (!card) {
    throw new Error(`${playerId} hand has no character`);
  }
  return card.instanceId;
}

function buildReadyToMainState(
  firstPlayer: PlayerID,
  p1Deck: CardRef[],
  p2Deck: CardRef[],
): GameState {
  const state0 = createInitialGameState({
    p1Deck,
    p2Deck,
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

function passCurrentMainPhaseToNextTurn(state: GameState): GameState {
  const state1 = reduceGameState(state, { type: "ADVANCE_PHASE" });
  const state2 = reduceGameState(state1, { type: "ADVANCE_PHASE" });
  const state3 = reduceGameState(state2, { type: "ADVANCE_PHASE" });
  return state3;
}

function declareAttackAndEnterBattle(
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

function chooseDefender(state: GameState, playerId: PlayerID, defenderCardId?: string): GameState {
  return reduceGameState(state, {
    type: "SET_DEFENDER",
    playerId,
    defenderCardId,
  });
}

function resolveBattleByDoublePass(state: GameState): GameState {
  const state1 = reduceGameState(state, {
    type: "PASS_PRIORITY",
    playerId: state.battle.priorityPlayer ?? "P1",
  });

  const state2 = reduceGameState(state1, {
    type: "PASS_PRIORITY",
    playerId: state1.battle.priorityPlayer ?? "P2",
  });

  return state2;
}

describe("BattleResolution", () => {
  it("같은 열 미행동 DF가 있어도 자동 방어되지 않고 방어자 미지정 배틀 중 상태로 들어간다", () => {
    const p1Deck = makeDeck("P1", "P1", {
      1: makeCharacter("P1_ATTACKER", "P1", "P1_ATTACKER", {
        ap: 4,
        dp: 3,
        dmg: 1,
      }),
    });

    const p2Deck = makeDeck("P2", "P2", {
      1: makeCharacter("P2_DEFENDER", "P2", "P2_DEFENDER", {
        ap: 2,
        dp: 3,
        dmg: 1,
      }),
    });

    const ready = buildReadyToMainState("P1", p1Deck, p2Deck);
    const attackerEntered = putCharacterOnField(ready, "P1", "AF_LEFT");

    const p2Main = passCurrentMainPhaseToNextTurn(attackerEntered.state);
    const defenderEntered = putCharacterOnField(p2Main, "P2", "DF_LEFT");

    const backToP1Main = passCurrentMainPhaseToNextTurn(defenderEntered.state);
    const next = declareAttackAndEnterBattle(
      backToP1Main,
      "P1",
      attackerEntered.cardId,
    );

    expect(next.battle.isActive).toBe(true);
    expect(next.battle.phase).toBe("duringBattle");
    expect(next.battle.defenderCardId).toBeUndefined();
    expect(next.players.P2.field.DF_LEFT.card?.instanceId).toBe(defenderEntered.cardId);
    expect(next.logs.some((log) => log.includes("배틀 중 상태 진입 (방어자 미지정)"))).toBe(true);
  });

  it("상대는 같은 열 미행동 DF로 방어하기로 선택할 수 있다", () => {
    const p1Deck = makeDeck("P1", "P1", {
      1: makeCharacter("P1_ATTACKER", "P1", "P1_ATTACKER", {
        ap: 4,
        dp: 3,
        dmg: 1,
      }),
    });

    const p2Deck = makeDeck("P2", "P2", {
      1: makeCharacter("P2_DEFENDER", "P2", "P2_DEFENDER", {
        ap: 2,
        dp: 3,
        dmg: 1,
      }),
    });

    const ready = buildReadyToMainState("P1", p1Deck, p2Deck);
    const attackerEntered = putCharacterOnField(ready, "P1", "AF_LEFT");
    const p2Main = passCurrentMainPhaseToNextTurn(attackerEntered.state);
    const defenderEntered = putCharacterOnField(p2Main, "P2", "DF_LEFT");
    const backToP1Main = passCurrentMainPhaseToNextTurn(defenderEntered.state);

    const inBattle = declareAttackAndEnterBattle(backToP1Main, "P1", attackerEntered.cardId);
    const afterChoose = chooseDefender(inBattle, "P2", defenderEntered.cardId);

    expect(afterChoose.battle.isActive).toBe(true);
    expect(afterChoose.battle.defenderCardId).toBe(defenderEntered.cardId);
    expect(afterChoose.logs.some((log) => log.includes("배틀 중 상태 진입 (방어자 지정)"))).toBe(true);
  });

  it("같은 열 미행동 DF가 있어도 상대가 방어하지 않으면 직접 공격으로 처리된다", () => {
    const p1Deck = makeDeck("P1", "P1", {
      1: makeCharacter("P1_ATTACKER", "P1", "P1_ATTACKER", {
        ap: 3,
        dp: 3,
        dmg: 2,
      }),
    });

    const p2Deck = makeDeck("P2", "P2", {
      1: makeCharacter("P2_DEFENDER", "P2", "P2_DEFENDER", {
        ap: 4,
        dp: 4,
        dmg: 1,
      }),
    });

    const ready = buildReadyToMainState("P1", p1Deck, p2Deck);
    const attackerEntered = putCharacterOnField(ready, "P1", "AF_LEFT");
    const p2Main = passCurrentMainPhaseToNextTurn(attackerEntered.state);
    const defenderEntered = putCharacterOnField(p2Main, "P2", "DF_LEFT");
    const backToP1Main = passCurrentMainPhaseToNextTurn(defenderEntered.state);
    const beforeDeck = backToP1Main.players.P2.deck.length;

    const inBattle = declareAttackAndEnterBattle(backToP1Main, "P1", attackerEntered.cardId);
    const next = resolveBattleByDoublePass(inBattle);

    expect(next.battle.isActive).toBe(false);
    expect(next.players.P2.field.DF_LEFT.card?.instanceId).toBe(defenderEntered.cardId);
    expect(next.players.P2.deck.length).toBe(beforeDeck - 2);
    expect(next.logs.some((log) => log.includes("직접 공격 처리"))).toBe(true);
  });

  it("같은 열 DF가 없으면 방어자 미지정 배틀 중 상태로 들어간 뒤 직접 공격으로 처리된다", () => {
    const p1Deck = makeDeck("P1", "P1", {
      1: makeCharacter("P1_ATTACKER", "P1", "P1_ATTACKER", {
        ap: 3,
        dp: 3,
        dmg: 2,
      }),
    });

    const p2Deck = makeDeck("P2", "P2");

    const ready = buildReadyToMainState("P1", p1Deck, p2Deck);
    const attackerEntered = putCharacterOnField(ready, "P1", "AF_LEFT");
    const beforeDeck = attackerEntered.state.players.P2.deck.length;
    const beforeDiscard = attackerEntered.state.players.P2.discard.length;

    const inBattle = declareAttackAndEnterBattle(
      attackerEntered.state,
      "P1",
      attackerEntered.cardId,
    );

    expect(inBattle.battle.isActive).toBe(true);
    expect(inBattle.battle.phase).toBe("duringBattle");
    expect(inBattle.battle.defenderCardId).toBeUndefined();

    const next = resolveBattleByDoublePass(inBattle);

    expect(next.battle.isActive).toBe(false);
    expect(next.players.P1.field.AF_LEFT.card?.isTapped).toBe(true);
    expect(next.players.P2.deck.length).toBe(beforeDeck - 2);
    expect(next.players.P2.discard.length).toBe(beforeDiscard + 2);
    expect(next.logs.some((log) => log.includes("직접 공격 처리"))).toBe(true);
  });
});
