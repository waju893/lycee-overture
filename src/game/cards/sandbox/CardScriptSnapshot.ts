import type { CardRef, FieldSlot, GameState, PlayerID } from '../../GameTypes';

export interface CardScriptFieldView {
  playerId: PlayerID;
  slot: FieldSlot;
  card: CardRef;
}

export interface CardScriptSnapshot {
  activePlayer: PlayerID;
  priorityPlayer: PlayerID;
  phase: GameState['turn']['phase'];
  turnNumber: number;
  handCounts: Record<PlayerID, number>;
  deckCounts: Record<PlayerID, number>;
  discardCounts: Record<PlayerID, number>;
  fieldCards: CardScriptFieldView[];
  topDeckCards: Partial<Record<PlayerID, CardRef | undefined>>;
}

export function createCardScriptSnapshot(state: GameState): CardScriptSnapshot {
  const fieldCards: CardScriptFieldView[] = [];

  for (const playerId of ['P1', 'P2'] as PlayerID[]) {
    const slots = Object.keys(state.players[playerId].field) as FieldSlot[];
    for (const slot of slots) {
      const card = state.players[playerId].field[slot].card;
      if (card) {
        fieldCards.push({
          playerId,
          slot,
          card,
        });
      }
    }
  }

  return {
    activePlayer: state.turn.activePlayer,
    priorityPlayer: state.turn.priorityPlayer,
    phase: state.turn.phase,
    turnNumber: state.turn.turnNumber,
    handCounts: {
      P1: state.players.P1.hand.length,
      P2: state.players.P2.hand.length,
    },
    deckCounts: {
      P1: state.players.P1.deck.length,
      P2: state.players.P2.deck.length,
    },
    discardCounts: {
      P1: state.players.P1.discard.length,
      P2: state.players.P2.discard.length,
    },
    fieldCards,
    topDeckCards: {
      P1: state.players.P1.deck[0],
      P2: state.players.P2.deck[0],
    },
  };
}

export function listFieldCardsForPlayer(
  snapshot: CardScriptSnapshot,
  playerId: PlayerID,
): CardScriptFieldView[] {
  return snapshot.fieldCards.filter((entry) => entry.playerId === playerId);
}

export function countTappedFieldCards(
  snapshot: CardScriptSnapshot,
  playerId: PlayerID,
): number {
  return listFieldCardsForPlayer(snapshot, playerId).filter((entry) => Boolean(entry.card.isTapped)).length;
}

export function getTopDeckCardForPlayer(
  snapshot: CardScriptSnapshot,
  playerId: PlayerID,
): CardRef | undefined {
  return snapshot.topDeckCards[playerId];
}
