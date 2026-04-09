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

function getFirstHandCharacterId(state: GameState, playerId: PlayerID): string {
  const card = state.players[playerId].hand.find((c) => c.cardType === "character");
  if (!card) {
    throw new Error(`${playerId} hand has no character`);
  }
  return card.instanceId;
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

describe("AbilityUse", () => {
  it("자기 메인페이즈에 자기 캐릭터로 useAbility 선언 후 해결할 수 있다", () => {
    const p1Deck = makeDeck("P1", "P1", {
      1: makeCharacter("P1_ABILITY_USER", "P1", "P1_ABILITY_USER"),
    });
    const p2Deck = makeDeck("P2", "P2");

    const ready = buildReadyToMainState("P1", p1Deck, p2Deck);
    const entered = putCharacterOnField(ready, "P1", "AF_LEFT");

    const declared = reduceGameState(entered.state, {
      type: "DECLARE_ACTION",
      playerId: "P1",
      kind: "useAbility",
      sourceCardId: entered.cardId,
      sourceEffectId: "ability_001",
      targetingMode: "none",
    });

    expect(declared.declarationStack.length).toBe(1);
    expect(declared.turn.priorityPlayer).toBe("P2");
    expect(
      declared.logs.some((log) => log.includes("능력 사용 선언")),
    ).toBe(true);

    const resolved = resolveLatestDeclarationByDoublePass(declared);

    expect(resolved.declarationStack.length).toBe(0);
    expect(
      resolved.events.some(
        (event) =>
          event.type === "ABILITY_USED" &&
          event.playerId === "P1" &&
          event.cardId === entered.cardId,
      ),
    ).toBe(true);
    expect(
      resolved.logs.some((log) => log.includes("능력 사용 해결")),
    ).toBe(true);
  });

  it("장에 없는 카드로 useAbility를 선언하면 거부된다", () => {
    const p1Deck = makeDeck("P1", "P1");
    const p2Deck = makeDeck("P2", "P2");

    const ready = buildReadyToMainState("P1", p1Deck, p2Deck);
    const handCardId = getFirstHandCharacterId(ready, "P1");

    const next = reduceGameState(ready, {
      type: "DECLARE_ACTION",
      playerId: "P1",
      kind: "useAbility",
      sourceCardId: handCardId,
      sourceEffectId: "ability_fail",
      targetingMode: "none",
    });

    expect(next.declarationStack.length).toBe(0);
    expect(
      next.logs.some((log) => log.includes("CARD_NOT_FOUND")),
    ).toBe(true);
  });
});
