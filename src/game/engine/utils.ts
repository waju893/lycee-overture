import type { CardRef, FieldSlot, GameState, PlayerID } from "../GameTypes";
import { findCardInField, getAttackColumnFromSlot, getMatchingDefenderSlotForColumn } from "../GameRules";

export function drawTopCards(state: GameState, playerId: PlayerID, count: number): void {
  for (let i = 0; i < count; i += 1) {
    const card = state.players[playerId].deck.shift();
    if (!card) break;
    card.location = "hand";
    state.players[playerId].hand.push(card);
  }
}

export function untapField(state: GameState, playerId: PlayerID): void {
  const slots = Object.keys(state.players[playerId].field) as FieldSlot[];
  for (const slot of slots) {
    const card = state.players[playerId].field[slot].card;
    if (card) card.isTapped = false;
  }
}

export function millFromDeckToDiscard(state: GameState, playerId: PlayerID, count: number): void {
  for (let i = 0; i < count; i += 1) {
    const card = state.players[playerId].deck.shift();
    if (!card) break;
    card.location = "discard";
    state.players[playerId].discard.push(card);
  }
}

export function findCardInHand(state: GameState, playerId: PlayerID, cardId: string): CardRef | undefined {
  return state.players[playerId].hand.find((card) => card.instanceId === cardId);
}

export function removeCardFromHand(state: GameState, playerId: PlayerID, cardId: string): CardRef | undefined {
  const index = state.players[playerId].hand.findIndex((card) => card.instanceId === cardId);
  if (index < 0) return undefined;
  const [card] = state.players[playerId].hand.splice(index, 1);
  return card;
}

export function findCardOwnerOnField(
  state: GameState,
  cardId: string,
): { playerId: PlayerID; slot: FieldSlot; card: CardRef } | null {
  for (const playerId of ["P1", "P2"] as PlayerID[]) {
    const found = findCardInField(state, playerId, cardId);
    if (found) {
      return { playerId, slot: found.slot, card: found.card };
    }
  }
  return null;
}

export function fieldHasSameName(state: GameState, playerId: PlayerID, sameNameKey?: string): boolean {
  if (!sameNameKey) return false;
  const slots = Object.keys(state.players[playerId].field) as FieldSlot[];
  return slots.some((slot) => state.players[playerId].field[slot].card?.sameNameKey === sameNameKey);
}

export function getDirectAttackInfo(state: GameState, attackerCardId: string) {
  const attackerInfo = findCardOwnerOnField(state, attackerCardId);
  if (!attackerInfo) return null;

  const defenderPlayerId = attackerInfo.playerId === "P1" ? "P2" : "P1";
  const column = getAttackColumnFromSlot(attackerInfo.slot);
  const defenderSlot = getMatchingDefenderSlotForColumn(column);
  const defender = state.players[defenderPlayerId].field[defenderSlot].card;

  return {
    attackerInfo,
    defenderPlayerId,
    column,
    defenderSlot,
    defender,
  };
}
