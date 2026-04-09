
import {
  createEmptyField,
  type CardRef,
  type DeclarationStackArray,
  type FieldSlot,
  type GameState,
  MAX_DECLARATION_STACK_DEPTH,
  type PlayerID,
  type PlayerState,
  getOpponentPlayerId,
} from './GameTypes';

function makeDeclarationStack(): DeclarationStackArray {
  const stack = [] as unknown as DeclarationStackArray;
  stack.items = stack;
  stack.limit = MAX_DECLARATION_STACK_DEPTH;
  stack.activeResponseWindow = undefined;
  return stack;
}

function cloneCard(card: CardRef): CardRef {
  return {
    ...card,
    chargeCards: card.chargeCards ? card.chargeCards.map(cloneCard) : undefined,
  };
}

function syncLogs(state: GameState): void {
  state.log = state.logs;
}

export function createInitialGameState(params: {
  p1Deck: CardRef[];
  p2Deck: CardRef[];
  leaderEnabled: boolean;
}): GameState {
  const state: GameState = {
    players: {
      P1: {
        deck: params.p1Deck.map(cloneCard),
        hand: [],
        discard: [],
        field: createEmptyField(),
      },
      P2: {
        deck: params.p2Deck.map(cloneCard),
        hand: [],
        discard: [],
        field: createEmptyField(),
      },
    },
    startup: {
      active: true,
      startupFinished: false,
      leaderEnabled: params.leaderEnabled,
      decisions: {},
    },
    turn: {
      turnNumber: 0,
      activePlayer: 'P1',
      priorityPlayer: 'P1',
      phase: 'startup',
    },
    battle: {
      isActive: false,
      awaitingDefenderSelection: false,
    },
    declarationStack: makeDeclarationStack(),
    triggerQueue: {
      pendingGroups: [],
    },
    logs: [],
    log: [],
    events: [],
    replayEvents: [],
  };
  syncLogs(state);
  return state;
}

export function createPlayerState(deck: CardRef[] = []): PlayerState {
  return {
    deck: deck.map(cloneCard),
    hand: [],
    discard: [],
    field: createEmptyField(),
  };
}

export function findCardInField(
  state: GameState,
  playerId: PlayerID,
  cardId: string,
): { slot: FieldSlot; card: CardRef } | null {
  const field = state.players[playerId].field;
  const slots = Object.keys(field) as FieldSlot[];
  for (const slot of slots) {
    const card = field[slot].card;
    if (card?.instanceId === cardId) {
      return { slot, card };
    }
  }
  return null;
}

export function placeCharacterOnField(
  state: GameState,
  playerId: PlayerID,
  slot: FieldSlot,
  card: CardRef,
): void {
  state.players[playerId].field[slot].card = {
    ...cloneCard(card),
    owner: playerId,
    location: 'field',
    isTapped: card.isTapped ?? false,
  };
}

export function removeChargeCardsFromCharacter(
  state: GameState,
  playerId: PlayerID,
  characterCardId: string,
  chargeCardIds: string[],
): CardRef[] {
  const found = findCardInField(state, playerId, characterCardId);
  if (!found?.card) return [];
  const current = found.card.chargeCards ?? [];
  const removed: CardRef[] = [];
  const keep: CardRef[] = [];
  for (const card of current) {
    if (chargeCardIds.includes(card.instanceId)) {
      const moved = { ...cloneCard(card), location: 'discard' };
      removed.push(moved);
      state.players[playerId].discard.push(moved);
    } else {
      keep.push(card);
    }
  }
  found.card.chargeCards = keep;
  return removed;
}

export function removeCardFromAllZones(
  player: PlayerState,
  cardId: string,
): CardRef | null {
  const removeFromArray = (arr: CardRef[]): CardRef | null => {
    const idx = arr.findIndex((card) => card.instanceId === cardId);
    if (idx < 0) return null;
    const [removed] = arr.splice(idx, 1);
    return removed ?? null;
  };

  const fromHand = removeFromArray(player.hand);
  if (fromHand) return fromHand;

  const fromDeck = removeFromArray(player.deck);
  if (fromDeck) return fromDeck;

  const fromDiscard = removeFromArray(player.discard);
  if (fromDiscard) return fromDiscard;

  const slots = Object.keys(player.field) as FieldSlot[];
  for (const slot of slots) {
    const card = player.field[slot].card;
    if (card?.instanceId === cardId) {
      player.field[slot].card = null;
      for (const charge of card.chargeCards ?? []) {
        player.discard.push({ ...cloneCard(charge), location: 'discard' });
      }
      return card;
    }
  }

  return null;
}

export function getTopDeclaration(state: GameState) {
  return state.declarationStack.length > 0
    ? state.declarationStack[state.declarationStack.length - 1]
    : undefined;
}

export function canPlayerRespondToTopDeclaration(
  state: GameState,
  playerId: PlayerID,
): boolean {
  const top = getTopDeclaration(state);
  const window = state.declarationStack.activeResponseWindow;
  if (!top || !window) return false;
  if (window.responderPlayerId !== playerId) return false;
  if (top.playerId === playerId) return false;
  return true;
}

export function validateDeclarationStackLimit(state: GameState) {
  if (state.declarationStack.length >= MAX_DECLARATION_STACK_DEPTH) {
    return [
      {
        code: 'stackLimitExceeded',
        message: `Declaration stack cannot exceed ${MAX_DECLARATION_STACK_DEPTH} in this implementation.`,
      },
    ];
  }
  return [];
}

export function validateResponseDeclarationOpportunity(
  state: GameState,
  playerId: PlayerID,
) {
  const top = getTopDeclaration(state);
  const window = state.declarationStack.activeResponseWindow;
  const violations: { code: string; message: string }[] = [];
  if (!top || !window) {
    violations.push({ code: 'noResponseWindow', message: 'There is no open response window.' });
    return violations;
  }
  if (window.responderPlayerId !== playerId) {
    violations.push({
      code: 'wrongResponder',
      message: `Only ${window.responderPlayerId} can make the next response declaration.`,
    });
  }
  if (top.playerId === playerId) {
    violations.push({
      code: 'cannotRespondToOwnDeclaration',
      message: 'A player cannot make a response declaration to their own declaration.',
    });
  }
  return [...violations, ...validateDeclarationStackLimit(state)];
}

export function validatePassResponse(state: GameState, playerId: PlayerID) {
  const window = state.declarationStack.activeResponseWindow;
  if (!window) {
    return [{ code: 'noResponseWindow', message: 'There is no open response window to pass.' }];
  }
  if (window.responderPlayerId !== playerId) {
    return [
      {
        code: 'wrongResponder',
        message: `Only ${window.responderPlayerId} can pass this response window.`,
      },
    ];
  }
  return [];
}

export function getAttackColumnFromSlot(slot: FieldSlot): number {
  if (slot.endsWith('LEFT')) return 0;
  if (slot.endsWith('CENTER')) return 1;
  return 2;
}

export function getMatchingDefenderSlotForColumn(column: number): FieldSlot {
  return (['DF_LEFT', 'DF_CENTER', 'DF_RIGHT'] as FieldSlot[])[column];
}

export function getOpponent(playerId: PlayerID): PlayerID {
  return getOpponentPlayerId(playerId);
}
