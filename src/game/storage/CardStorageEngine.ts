import type { GameState, PlayerID } from '../GameTypes';

// Intentionally permissive internal shapes so this module works with both
// the full engine GameState and the lighter-weight Storage DSL test state.
type AnyCard = Record<string, any> & {
  instanceId?: string;
  id?: string;
  owner?: PlayerID | string;
  controller?: PlayerID | string;
  location?: string;
  zone?: string;
  name?: string;
};

type StorageVisibility = 'public' | 'private';

type CardStorageZone = {
  id: string;
  label?: string;
  visibility: StorageVisibility;
  cards: AnyCard[];
};

type StorageAwarePlayerState = Record<string, any> & {
  id?: PlayerID | string;
  hand?: AnyCard[];
  deck?: AnyCard[];
  discard?: AnyCard[];
  field?: any;
  removedFromGame?: AnyCard[];
  setAside?: AnyCard[];
  cardStorages?: Record<string, CardStorageZone>;
};

type StorageAwareGameState = GameState & {
  players?: Record<string, StorageAwarePlayerState>;
  cards?: Record<string, AnyCard>;
};

function createEmptyField(): any {
  return {
    AF_LEFT: { card: null },
    AF_CENTER: { card: null },
    AF_RIGHT: { card: null },
    DF_LEFT: { card: null },
    DF_CENTER: { card: null },
    DF_RIGHT: { card: null },
  };
}

function getPlayerState(state: StorageAwareGameState, playerId: PlayerID): StorageAwarePlayerState {
  if (!state.players) {
    (state as any).players = {};
  }

  if (!state.players[playerId]) {
    state.players[playerId] = {
      id: playerId,
      hand: [],
      deck: [],
      discard: [],
      field: createEmptyField(),
      removedFromGame: [],
      setAside: [],
      cardStorages: {},
    } as StorageAwarePlayerState;
  }

  const player = state.players[playerId] as StorageAwarePlayerState;
  if (!player.hand) player.hand = [];
  if (!player.deck) player.deck = [];
  if (!player.discard) player.discard = [];
  if (!player.field) player.field = createEmptyField();
  if (!player.removedFromGame) player.removedFromGame = [];
  if (!player.setAside) player.setAside = [];
  if (!player.cardStorages) player.cardStorages = {};
  return player;
}

export function ensureSpecialZones(
  state: StorageAwareGameState,
  playerId: PlayerID,
): StorageAwarePlayerState {
  return getPlayerState(state, playerId);
}

function cloneCard(card: AnyCard): AnyCard {
  return { ...card };
}

function getCardId(card: AnyCard | undefined): string | undefined {
  return card?.instanceId ?? card?.id;
}

function toScopedStorageId(playerId: PlayerID, storageId: string | undefined): string {
  const raw = storageId ?? '';
  return raw.includes(':') ? raw : `${playerId}:${raw}`;
}

function inferStorageLabel(scopedId: string, fallback?: string): string | undefined {
  return fallback ?? scopedId.split(':')[1];
}

function getStorageMap(state: StorageAwareGameState, playerId: PlayerID): Record<string, CardStorageZone> {
  return ensureSpecialZones(state, playerId).cardStorages!;
}

export function ensureCardStorage(
  state: StorageAwareGameState,
  playerId: PlayerID,
  storageId: string | undefined,
  options?: { label?: string; visibility?: StorageVisibility },
): CardStorageZone {
  const scopedId = toScopedStorageId(playerId, storageId);
  const storages = getStorageMap(state, playerId);
  if (!storages[scopedId]) {
    storages[scopedId] = {
      id: scopedId,
      label: inferStorageLabel(scopedId, options?.label),
      visibility: options?.visibility ?? 'public',
      cards: [],
    };
  } else {
    if (options?.label && !storages[scopedId].label) {
      storages[scopedId].label = options.label;
    }
    if (options?.visibility) {
      storages[scopedId].visibility = options.visibility;
    }
  }
  return storages[scopedId];
}

export function createCardStorageIfNeededFromEffect(
  state: StorageAwareGameState,
  arg1: any,
  arg2?: any,
  arg3?: any,
): CardStorageZone {
  // Supports both object-form and positional-form callers.
  if (arg1 && typeof arg1 === 'object' && !Array.isArray(arg1)) {
    const playerId = (arg1.playerId ?? arg1.player ?? 'P1') as PlayerID;
    const storageId = (arg1.storageId ?? arg1.storage ?? arg1.id) as string | undefined;
    return ensureCardStorage(state, playerId, storageId, {
      label: arg1.label,
      visibility: arg1.visibility,
    });
  }

  return ensureCardStorage(state, arg1 as PlayerID, arg2 as string | undefined, arg3);
}

function getAllFieldCards(player: StorageAwarePlayerState): AnyCard[] {
  const field = player.field;
  if (!field) return [];
  if (Array.isArray(field)) return field;
  const results: AnyCard[] = [];
  for (const value of Object.values(field)) {
    const cell = value as any;
    if (cell?.card) results.push(cell.card);
    if (cell?.area) results.push(cell.area);
    if (cell?.attachedItem) results.push(cell.attachedItem);
  }
  return results;
}

function removeFromField(player: StorageAwarePlayerState, cardId: string): AnyCard | undefined {
  const field = player.field;
  if (!field) return undefined;
  if (Array.isArray(field)) {
    const idx = field.findIndex((card: AnyCard) => getCardId(card) === cardId);
    if (idx >= 0) {
      const [card] = field.splice(idx, 1);
      return card;
    }
    return undefined;
  }

  for (const key of Object.keys(field)) {
    const cell = field[key] as any;
    if (cell?.card && getCardId(cell.card) === cardId) {
      const found = cell.card;
      cell.card = null;
      return found;
    }
    if (cell?.area && getCardId(cell.area) === cardId) {
      const found = cell.area;
      cell.area = null;
      return found;
    }
    if (cell?.attachedItem && getCardId(cell.attachedItem) === cardId) {
      const found = cell.attachedItem;
      cell.attachedItem = null;
      return found;
    }
  }
  return undefined;
}

function removeFromArray(zone: AnyCard[] | undefined, cardId: string): AnyCard | undefined {
  if (!zone) return undefined;
  const idx = zone.findIndex((card) => getCardId(card) === cardId);
  if (idx < 0) return undefined;
  const [card] = zone.splice(idx, 1);
  return card;
}

function removeCardByIdFromPlayer(state: StorageAwareGameState, playerId: PlayerID, cardId: string): AnyCard | undefined {
  const player = ensureSpecialZones(state, playerId);

  const fromHand = removeFromArray(player.hand, cardId);
  if (fromHand) return fromHand;

  const fromDeck = removeFromArray(player.deck, cardId);
  if (fromDeck) return fromDeck;

  const fromDiscard = removeFromArray(player.discard, cardId);
  if (fromDiscard) return fromDiscard;

  const fromRemoved = removeFromArray(player.removedFromGame, cardId);
  if (fromRemoved) return fromRemoved;

  const fromSetAside = removeFromArray(player.setAside, cardId);
  if (fromSetAside) return fromSetAside;

  for (const storage of Object.values(player.cardStorages ?? {})) {
    const fromStorage = removeFromArray(storage.cards, cardId);
    if (fromStorage) return fromStorage;
  }

  const fromField = removeFromField(player, cardId);
  if (fromField) return fromField;

  return undefined;
}

function removeCardByIdAnyPlayer(state: StorageAwareGameState, cardId: string): { playerId: PlayerID; card: AnyCard } | null {
  for (const playerId of Object.keys(state.players ?? {}) as PlayerID[]) {
    const removed = removeCardByIdFromPlayer(state, playerId, cardId);
    if (removed) {
      return { playerId, card: removed };
    }
  }

  const fromMap = state.cards?.[cardId];
  if (fromMap) {
    return {
      playerId: (fromMap.owner ?? fromMap.controller ?? 'P1') as PlayerID,
      card: cloneCard(fromMap),
    };
  }

  return null;
}

function pullFromZone(
  state: StorageAwareGameState,
  zone: any,
  amount: number,
): { playerId: PlayerID; cards: AnyCard[] } {
  const playerId = (zone?.playerId ?? 'P1') as PlayerID;
  const player = ensureSpecialZones(state, playerId);
  const cards: AnyCard[] = [];
  const count = Math.max(1, amount || 1);

  const kind = zone?.kind ?? zone;
  if (kind === 'setAside') {
    while (player.setAside!.length > 0 && cards.length < count) {
      cards.push(player.setAside!.shift()!);
    }
    return { playerId, cards };
  }

  if (kind === 'removedFromGame') {
    while (player.removedFromGame!.length > 0 && cards.length < count) {
      cards.push(player.removedFromGame!.shift()!);
    }
    return { playerId, cards };
  }

  if (kind === 'discard') {
    while (player.discard!.length > 0 && cards.length < count) {
      cards.push(player.discard!.shift()!);
    }
    return { playerId, cards };
  }

  if (kind === 'hand') {
    while (player.hand!.length > 0 && cards.length < count) {
      cards.push(player.hand!.shift()!);
    }
    return { playerId, cards };
  }

  if (kind === 'deck' || kind === 'deckTop') {
    while (player.deck!.length > 0 && cards.length < count) {
      cards.push(player.deck!.shift()!);
    }
    return { playerId, cards };
  }

  if (kind === 'deckBottom') {
    while (player.deck!.length > 0 && cards.length < count) {
      cards.push(player.deck!.pop()!);
    }
    return { playerId, cards };
  }

  if (kind === 'storage') {
    const storage = ensureCardStorage(state, playerId, zone?.storageId ?? zone?.storage);
    while (storage.cards.length > 0 && cards.length < count) {
      cards.push(storage.cards.shift()!);
    }
    return { playerId, cards };
  }

  return { playerId, cards };
}

function pushIntoZone(state: StorageAwareGameState, zone: any, playerId: PlayerID, cards: AnyCard[]): void {
  const targetPlayerId = (zone?.playerId ?? playerId) as PlayerID;
  const player = ensureSpecialZones(state, targetPlayerId);
  const kind = zone?.kind ?? zone;

  if (kind === 'setAside') {
    for (const card of cards) {
      card.location = 'setAside';
      player.setAside!.push(card);
    }
    return;
  }

  if (kind === 'removedFromGame') {
    for (const card of cards) {
      card.location = 'removedFromGame';
      player.removedFromGame!.push(card);
    }
    return;
  }

  if (kind === 'discard') {
    for (const card of cards) {
      card.location = 'discard';
      player.discard!.push(card);
    }
    return;
  }

  if (kind === 'hand') {
    for (const card of cards) {
      card.location = 'hand';
      player.hand!.push(card);
    }
    return;
  }

  if (kind === 'storage') {
    const storage = ensureCardStorage(state, targetPlayerId, zone?.storageId ?? zone?.storage);
    for (const card of cards) {
      card.location = 'storage';
      storage.cards.push(card);
    }
  }
}

export function moveCardBetweenZones(state: StorageAwareGameState, spec: any): StorageAwareGameState {
  if (spec?.cardId) {
    const removed = removeCardByIdAnyPlayer(state, spec.cardId);
    if (!removed) return state;
    pushIntoZone(state, spec.to, removed.playerId, [removed.card]);
    return state;
  }

  const pulled = pullFromZone(state, spec?.from, spec?.amount ?? 1);
  if (pulled.cards.length === 0) return state;
  pushIntoZone(state, spec?.to, pulled.playerId, pulled.cards);
  return state;
}

export function getVisibleCardStorages(
  state: StorageAwareGameState,
  ownerPlayerId: PlayerID,
  viewerPlayerId: PlayerID,
): CardStorageZone[] {
  const player = ensureSpecialZones(state, ownerPlayerId);
  return Object.values(player.cardStorages ?? {}).map((storage) => {
    if (storage.visibility !== 'private' || ownerPlayerId === viewerPlayerId) {
      return {
        ...storage,
        cards: storage.cards.map((card) => ({ ...card })),
      };
    }

    return {
      ...storage,
      cards: storage.cards.map(() => ({ name: 'HIDDEN' } as AnyCard)),
    };
  });
}

export function countRemovedFromGame(state: StorageAwareGameState, playerId: PlayerID): number {
  return ensureSpecialZones(state, playerId).removedFromGame!.length;
}

export function countSetAside(state: StorageAwareGameState, playerId: PlayerID): number {
  return ensureSpecialZones(state, playerId).setAside!.length;
}

export function listCardStorageIds(state: StorageAwareGameState, playerId: PlayerID): string[] {
  return Object.keys(ensureSpecialZones(state, playerId).cardStorages ?? {});
}
