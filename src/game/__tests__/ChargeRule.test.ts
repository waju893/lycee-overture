// src/game/__tests__/ChargeRule.test.ts
import { describe, expect, it } from "vitest";

import { declareAction, passPriority } from "../GameActions";
import { reduceGameState } from "../GameEngine";
import {
  createInitialGameState,
  placeCharacterOnField,
  removeCardFromAllZones,
  removeChargeCardsFromCharacter,
} from "../GameRules";
import type { CardRef, GameState } from "../GameTypes";

function makeCard(
  params: Partial<CardRef> &
    Pick<CardRef, "instanceId" | "cardNo" | "name" | "owner" | "cardType">,
): CardRef {
  return {
    isTapped: false,
    canAttack: true,
    canBlock: true,
    ap: 3,
    dp: 3,
    dmg: 1,
    ...params,
  };
}

function createState(): GameState {
  const state = createInitialGameState({
    p1Deck: [],
    p2Deck: [],
    leaderEnabled: false,
  });

  state.startup.active = false;
  state.startup.startupFinished = true;
  state.turn.turnNumber = 1;
  state.turn.activePlayer = "P1";
  state.turn.priorityPlayer = "P1";
  state.turn.phase = "main";

  return state;
}

describe("Charge rule", () => {
  it("puts charged cards into charge zone and does not tap source character", () => {
    let state = createState();

    const charger = makeCard({
      instanceId: "charger",
      cardNo: "LO-0001",
      name: "Charger",
      owner: "P1",
      cardType: "character",
    });

    const deckCharge = makeCard({
      instanceId: "deck-charge",
      cardNo: "LO-0002",
      name: "Deck Charge",
      owner: "P1",
      cardType: "event",
    });

    const discardCharge = makeCard({
      instanceId: "discard-charge",
      cardNo: "LO-0003",
      name: "Discard Charge",
      owner: "P1",
      cardType: "event",
    });

    placeCharacterOnField(state, "P1", "AF_LEFT", charger);
    state.players.P1.deck.push(deckCharge);
    state.players.P1.discard.push(discardCharge);

    state = reduceGameState(
      state,
      declareAction({
        playerId: "P1",
        kind: "chargeCharacter",
        sourceCardId: "charger",
        payload: {
          deckCount: 1,
          discardCardIds: ["discard-charge"],
        },
      }),
    );

    state = reduceGameState(state, passPriority("P2"));

    const chargedCharacter = state.players.P1.field.AF_LEFT.card;
    expect(chargedCharacter?.isTapped).toBe(false);
    expect(chargedCharacter?.chargeCards?.map((card) => card.instanceId)).toEqual([
      "deck-charge",
      "discard-charge",
    ]);
    expect(chargedCharacter?.chargeCards?.every((card) => card.location === "charge")).toBe(true);
    expect(state.players.P1.deck).toHaveLength(0);
    expect(state.players.P1.discard).toHaveLength(0);
  });

  it("moves removed charge cards to discard", () => {
    const state = createState();

    const charger = makeCard({
      instanceId: "charger",
      cardNo: "LO-0100",
      name: "Charger",
      owner: "P1",
      cardType: "character",
      chargeCards: [
        makeCard({
          instanceId: "charge-a",
          cardNo: "LO-0101",
          name: "Charge A",
          owner: "P1",
          cardType: "event",
          location: "charge",
        }),
        makeCard({
          instanceId: "charge-b",
          cardNo: "LO-0102",
          name: "Charge B",
          owner: "P1",
          cardType: "event",
          location: "charge",
        }),
      ],
    });

    placeCharacterOnField(state, "P1", "AF_LEFT", charger);

    const removed = removeChargeCardsFromCharacter(
      state,
      "P1",
      "charger",
      ["charge-a"],
    );

    expect(removed.map((card) => card.instanceId)).toEqual(["charge-a"]);
    expect(state.players.P1.discard.map((card) => card.instanceId)).toEqual(["charge-a"]);
    expect(
      state.players.P1.field.AF_LEFT.card?.chargeCards?.map((card) => card.instanceId),
    ).toEqual(["charge-b"]);
  });

  it("sends all charge cards to discard when charged character leaves field", () => {
    const state = createState();

    const charger = makeCard({
      instanceId: "charger",
      cardNo: "LO-0200",
      name: "Charged Character",
      owner: "P1",
      cardType: "character",
      chargeCards: [
        makeCard({
          instanceId: "charge-a",
          cardNo: "LO-0201",
          name: "Charge A",
          owner: "P1",
          cardType: "event",
          location: "charge",
        }),
        makeCard({
          instanceId: "charge-b",
          cardNo: "LO-0202",
          name: "Charge B",
          owner: "P1",
          cardType: "event",
          location: "charge",
        }),
      ],
    });

    placeCharacterOnField(state, "P1", "AF_LEFT", charger);

    const removedCharacter = removeCardFromAllZones(state.players.P1, "charger");

    expect(removedCharacter?.instanceId).toBe("charger");
    expect(state.players.P1.discard.map((card) => card.instanceId)).toEqual([
      "charge-a",
      "charge-b",
    ]);
    expect(state.players.P1.field.AF_LEFT.card).toBeNull();
  });
});