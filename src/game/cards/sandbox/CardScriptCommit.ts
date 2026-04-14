import type { CardRef, FieldSlot, GameState, PlayerID } from '../../GameTypes';
import type { CardScriptIntent } from './CardScriptIntent';

type SearchResultEntry = {
  zone: 'deck' | 'trash' | 'hand' | 'field' | 'removed';
  cardId: string;
};

type SearchBufferState = Record<PlayerID, Record<string, SearchResultEntry[]>>;

export interface CardScriptCommitResult {
  state: GameState;
  appliedIntents: CardScriptIntent[];
  skippedIntents: Array<{
    intent: CardScriptIntent;
    reason: string;
  }>;
}

function appendLog(state: GameState, message: string): void {
  if (!state.logs) state.logs = [];
  state.logs.push(message);
  state.log = state.logs;
}

function cloneFieldCell(cell: any) {
  return {
    ...cell,
    card: cell.card ? { ...cell.card } : null,
    area: cell.area ? { ...cell.area } : null,
    attachedItem: cell.attachedItem ? { ...cell.attachedItem } : null,
  };
}

function cloneSearchBuffer(state: GameState): SearchBufferState {
  const raw = ((state as any).__cardScriptSearchResults ?? {}) as Partial<SearchBufferState>;
  return {
    P1: Object.fromEntries(
      Object.entries(raw.P1 ?? {}).map(([key, value]) => [key, [...(value ?? [])]]),
    ) as Record<string, SearchResultEntry[]>,
    P2: Object.fromEntries(
      Object.entries(raw.P2 ?? {}).map(([key, value]) => [key, [...(value ?? [])]]),
    ) as Record<string, SearchResultEntry[]>,
  };
}

function cloneState(state: GameState): GameState {
  const next: GameState = {
    ...state,
    players: {
      P1: {
        ...state.players.P1,
        deck: [...state.players.P1.deck],
        hand: [...state.players.P1.hand],
        discard: [...state.players.P1.discard],
        removedFromGame: [...(((state.players.P1 as any).removedFromGame) ?? [])],
        setAside: [...(((state.players.P1 as any).setAside) ?? [])],
        cardStorages: { ...(((state.players.P1 as any).cardStorages) ?? {}) },
        field: {
          AF_LEFT: cloneFieldCell(state.players.P1.field.AF_LEFT),
          AF_CENTER: cloneFieldCell(state.players.P1.field.AF_CENTER),
          AF_RIGHT: cloneFieldCell(state.players.P1.field.AF_RIGHT),
          DF_LEFT: cloneFieldCell(state.players.P1.field.DF_LEFT),
          DF_CENTER: cloneFieldCell(state.players.P1.field.DF_CENTER),
          DF_RIGHT: cloneFieldCell(state.players.P1.field.DF_RIGHT),
        },
      },
      P2: {
        ...state.players.P2,
        deck: [...state.players.P2.deck],
        hand: [...state.players.P2.hand],
        discard: [...state.players.P2.discard],
        removedFromGame: [...(((state.players.P2 as any).removedFromGame) ?? [])],
        setAside: [...(((state.players.P2 as any).setAside) ?? [])],
        cardStorages: { ...(((state.players.P2 as any).cardStorages) ?? {}) },
        field: {
          AF_LEFT: cloneFieldCell(state.players.P2.field.AF_LEFT),
          AF_CENTER: cloneFieldCell(state.players.P2.field.AF_CENTER),
          AF_RIGHT: cloneFieldCell(state.players.P2.field.AF_RIGHT),
          DF_LEFT: cloneFieldCell(state.players.P2.field.DF_LEFT),
          DF_CENTER: cloneFieldCell(state.players.P2.field.DF_CENTER),
          DF_RIGHT: cloneFieldCell(state.players.P2.field.DF_RIGHT),
        },
      },
    },
    startup: {
      ...state.startup,
      decisions: { ...state.startup.decisions },
    },
    turn: { ...state.turn, passedPlayers: [...(state.turn.passedPlayers ?? [])] },
    battle: { ...state.battle, passedPlayers: [...(state.battle.passedPlayers ?? [])] },
    declarationStack: [...state.declarationStack] as any,
    triggerQueue: {
      pendingGroups: state.triggerQueue.pendingGroups.map((group) => [...group]),
      isResolving: state.triggerQueue.isResolving,
    },
    logs: [...state.logs],
    log: [...state.logs],
    events: [...state.events],
    replayEvents: [...state.replayEvents],
  };

  (next as any).__cardScriptSearchResults = cloneSearchBuffer(state);
  return next;
}

function getSearchBuffer(state: GameState): SearchBufferState {
  if (!(state as any).__cardScriptSearchResults) {
    (state as any).__cardScriptSearchResults = { P1: {}, P2: {} } satisfies SearchBufferState;
  }
  return (state as any).__cardScriptSearchResults as SearchBufferState;
}

function findFieldCard(state: GameState, cardId: string) {
  for (const playerId of ['P1', 'P2'] as const) {
    for (const slot of Object.keys(state.players[playerId].field) as Array<keyof typeof state.players.P1.field>) {
      const cell = state.players[playerId].field[slot];
      if (cell.card?.instanceId === cardId) {
        return { playerId, slot, card: cell.card, layer: 'card' as const };
      }
      if ((cell as any).area?.instanceId === cardId) {
        return { playerId, slot, card: (cell as any).area as CardRef, layer: 'area' as const };
      }
      if ((cell as any).attachedItem?.instanceId === cardId) {
        return { playerId, slot, card: (cell as any).attachedItem as CardRef, layer: 'attachedItem' as const };
      }
    }
  }
  return null;
}

function commitDraw(state: GameState, intent: Extract<CardScriptIntent, { kind: 'draw' }>): boolean {
  let moved = 0;
  for (let i = 0; i < intent.count; i += 1) {
    const card = state.players[intent.playerId].deck.shift();
    if (!card) break;
    card.location = 'hand';
    state.players[intent.playerId].hand.push(card);
    moved += 1;
  }
  appendLog(state, `[CARD SCRIPT] draw ${moved} for ${intent.playerId}`);
  return moved > 0;
}

function commitTap(state: GameState, intent: Extract<CardScriptIntent, { kind: 'tap' }>): boolean {
  const found = findFieldCard(state, intent.cardId);
  if (!found) return false;
  found.card.isTapped = true;
  appendLog(state, `[CARD SCRIPT] tap ${intent.cardId}`);
  return true;
}

function commitUntap(state: GameState, intent: Extract<CardScriptIntent, { kind: 'untap' }>): boolean {
  const found = findFieldCard(state, intent.cardId);
  if (!found) return false;
  found.card.isTapped = false;
  appendLog(state, `[CARD SCRIPT] untap ${intent.cardId}`);
  return true;
}

function commitRevealTopCard(state: GameState, intent: Extract<CardScriptIntent, { kind: 'revealTopCard' }>): boolean {
  const card = state.players[intent.playerId].deck[0];
  if (!card) return false;
  appendLog(state, `[CARD SCRIPT] reveal top ${intent.playerId}: ${card.instanceId}`);
  return true;
}

function commitLog(state: GameState, intent: Extract<CardScriptIntent, { kind: 'log' }>): boolean {
  appendLog(state, `[CARD SCRIPT] ${intent.message}`);
  return true;
}

function matchesCard(card: CardRef, match: Extract<CardScriptIntent, { kind: 'searchCard' }>['match']): boolean {
  if (match.exactCardNo && card.cardNo !== match.exactCardNo) return false;
  if (match.exactName && card.name !== match.exactName) return false;
  if (match.nameIncludes && !card.name.includes(match.nameIncludes)) return false;
  const expectedType = match.type ?? match.kind;
  if (expectedType && card.cardType !== expectedType) return false;
  return true;
}

function findZoneCards(state: GameState, playerId: PlayerID, zone: SearchResultEntry['zone']): CardRef[] {
  switch (zone) {
    case 'deck':
      return state.players[playerId].deck;
    case 'trash':
      return state.players[playerId].discard;
    case 'hand':
      return state.players[playerId].hand;
    case 'removed':
      return (state.players[playerId].removedFromGame ?? []) as CardRef[];
    case 'field': {
      const cards: CardRef[] = [];
      for (const slot of Object.keys(state.players[playerId].field) as FieldSlot[]) {
        const cell = state.players[playerId].field[slot];
        if (cell.card) cards.push(cell.card);
        if ((cell as any).area) cards.push((cell as any).area);
        if ((cell as any).attachedItem) cards.push((cell as any).attachedItem);
      }
      return cards;
    }
  }
}

function commitSearchCard(state: GameState, intent: Extract<CardScriptIntent, { kind: 'searchCard' }>): boolean {
  const hits: SearchResultEntry[] = [];

  for (const zone of intent.zones) {
    const zoneCards = findZoneCards(state, intent.playerId, zone);
    for (const card of zoneCards) {
      if (!matchesCard(card, intent.match)) continue;
      hits.push({ zone, cardId: card.instanceId });
      if (hits.length >= intent.count) break;
    }
    if (hits.length >= intent.count) break;
  }

  const buffer = getSearchBuffer(state);
  buffer[intent.playerId][intent.resultSlot] = hits;

  if (intent.revealToOpponent && hits.length > 0) {
    appendLog(
      state,
      `[CARD SCRIPT] search ${intent.playerId} revealed ${hits.map((hit) => hit.cardId).join(', ')}`,
    );
  }

  if (intent.shuffleAfterSearch && intent.zones.includes('deck')) {
    appendLog(state, `[CARD SCRIPT] shuffle after search for ${intent.playerId}`);
  }

  appendLog(
    state,
    `[CARD SCRIPT] search ${intent.playerId} -> ${intent.resultSlot} (${hits.length})`,
  );

  return hits.length > 0;
}

function removeCardFromZone(state: GameState, playerId: PlayerID, entry: SearchResultEntry): CardRef | null {
  const removeFromArray = (cards: CardRef[]) => {
    const index = cards.findIndex((card) => card.instanceId === entry.cardId);
    if (index < 0) return null;
    const [card] = cards.splice(index, 1);
    return card ?? null;
  };

  switch (entry.zone) {
    case 'deck':
      return removeFromArray(state.players[playerId].deck);
    case 'trash':
      return removeFromArray(state.players[playerId].discard);
    case 'hand':
      return removeFromArray(state.players[playerId].hand);
    case 'removed':
      return removeFromArray((state.players[playerId].removedFromGame ?? []) as CardRef[]);
    case 'field':
      for (const slot of Object.keys(state.players[playerId].field) as FieldSlot[]) {
        const cell = state.players[playerId].field[slot];
        if (cell.card?.instanceId === entry.cardId) {
          const card = cell.card;
          cell.card = null;
          return card;
        }
        if ((cell as any).area?.instanceId === entry.cardId) {
          const card = (cell as any).area as CardRef;
          (cell as any).area = null;
          return card;
        }
        if ((cell as any).attachedItem?.instanceId === entry.cardId) {
          const card = (cell as any).attachedItem as CardRef;
          (cell as any).attachedItem = null;
          return card;
        }
      }
      return null;
  }
}

function firstEmptyAreaSlot(state: GameState, playerId: PlayerID): FieldSlot | null {
  for (const slot of Object.keys(state.players[playerId].field) as FieldSlot[]) {
    if (!(state.players[playerId].field[slot] as any).area) return slot;
  }
  return null;
}

function commitFreeUseAreaFromSearchResult(
  state: GameState,
  intent: Extract<CardScriptIntent, { kind: 'freeUseAreaFromSearchResult' }>,
): boolean {
  const buffer = getSearchBuffer(state);
  const entries = buffer[intent.playerId][intent.resultSlot] ?? [];
  const entry = entries[0];
  if (!entry) return false;

  const card = removeCardFromZone(state, intent.playerId, entry);
  if (!card) return false;

  const slot = firstEmptyAreaSlot(state, intent.playerId);
  if (!slot) return false;

  card.location = 'field';
  card.revealed = true;
  (state.players[intent.playerId].field[slot] as any).area = card;
  buffer[intent.playerId][intent.resultSlot] = entries.slice(1);

  appendLog(
    state,
    `[CARD SCRIPT] free area use ${card.instanceId} -> ${intent.playerId}.${slot}`,
  );
  return true;
}

export function commitCardScriptIntents(
  state: GameState,
  intents: CardScriptIntent[],
): CardScriptCommitResult {
  const next = cloneState(state);
  const appliedIntents: CardScriptIntent[] = [];
  const skippedIntents: Array<{ intent: CardScriptIntent; reason: string }> = [];

  for (const intent of intents) {
    let ok = false;

    switch (intent.kind) {
      case 'draw':
        ok = commitDraw(next, intent);
        break;
      case 'tap':
        ok = commitTap(next, intent);
        break;
      case 'untap':
        ok = commitUntap(next, intent);
        break;
      case 'revealTopCard':
        ok = commitRevealTopCard(next, intent);
        break;
      case 'log':
        ok = commitLog(next, intent);
        break;
      case 'searchCard':
        ok = commitSearchCard(next, intent);
        break;
      case 'freeUseAreaFromSearchResult':
        ok = commitFreeUseAreaFromSearchResult(next, intent);
        break;
      default:
        ok = false;
    }

    if (ok) {
      appliedIntents.push(intent);
    } else {
      skippedIntents.push({
        intent,
        reason: `commit failed for ${intent.kind}`,
      });
    }
  }

  return {
    state: next,
    appliedIntents,
    skippedIntents,
  };
}

export default commitCardScriptIntents;
