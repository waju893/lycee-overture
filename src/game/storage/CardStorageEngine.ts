import type { PlayerID } from '../GameTypes';

type Visibility = 'public' | 'private';

export interface StorageCardLike {
  instanceId?: string;
  id?: string;
  name?: string;
  [key: string]: any;
}

export interface CardStorage {
  id: string;
  owner: PlayerID;
  label?: string;
  visibility: Visibility;
  cards: StorageCardLike[];
  [key: string]: any;
}

export interface StorageAwarePlayerState {
  id?: PlayerID;
  hand?: StorageCardLike[];
  deck?: StorageCardLike[];
  discard?: StorageCardLike[];
  field?: any;
  removedFromGame?: StorageCardLike[];
  setAside?: StorageCardLike[];
  cardStorages?: Record<string, CardStorage>;
  [key: string]: any;
}

export interface StorageAwareGameState {
  players?: Record<string, StorageAwarePlayerState>;
  [key: string]: any;
}

function ensurePlayers(state: StorageAwareGameState): Record<string, StorageAwarePlayerState> {
  if (!state.players) {
    state.players = {};
  }
  return state.players;
}

function makeEmptyPlayer(playerId: PlayerID): StorageAwarePlayerState {
  return {
    id: playerId,
    hand: [],
    deck: [],
    discard: [],
    field: [],
    removedFromGame: [],
    setAside: [],
    cardStorages: {},
  };
}

function getPlayerState(state: StorageAwareGameState, playerId: PlayerID): StorageAwarePlayerState {
  const players = ensurePlayers(state);
  if (!players[playerId]) {
    players[playerId] = makeEmptyPlayer(playerId);
  }
  return players[playerId];
}

export function ensureSpecialZones(
  state: StorageAwareGameState,
  playerId: PlayerID,
): StorageAwarePlayerState {
  const player = getPlayerState(state, playerId);
  if (!player.hand) player.hand = [];
  if (!player.deck) player.deck = [];
  if (!player.discard) player.discard = [];
  if (!player.field) player.field = [];
  if (!player.removedFromGame) player.removedFromGame = [];
  if (!player.setAside) player.setAside = [];
  if (!player.cardStorages) player.cardStorages = {};
  return player;
}

function toScopedStorageId(playerId: PlayerID, storageId: string | undefined): string {
  if (!storageId) {
    throw new Error('storageId is required');
  }
  return storageId.includes(':') ? storageId : `${playerId}:${storageId}`;
}

function coerceVisibility(value: unknown): Visibility {
  return value === 'private' ? 'private' : 'public';
}

function makeStorage(
  playerId: PlayerID,
  scopedId: string,
  options?: { label?: string; visibility?: Visibility },
): CardStorage {
  return {
    id: scopedId,
    owner: playerId,
    label: options?.label,
    visibility: coerceVisibility(options?.visibility),
    cards: [],
  };
}

export function ensureCardStorage(
  state: StorageAwareGameState,
  playerId: PlayerID,
  storageId: string,
  options?: { label?: string; visibility?: Visibility },
): CardStorage {
  const player = ensureSpecialZones(state, playerId);
  const scopedId = toScopedStorageId(playerId, storageId);

  if (!player.cardStorages![scopedId]) {
    player.cardStorages![scopedId] = makeStorage(playerId, scopedId, options);
  } else {
    if (options?.label !== undefined) {
      player.cardStorages![scopedId].label = options.label;
    }
    if (options?.visibility !== undefined) {
      player.cardStorages![scopedId].visibility = coerceVisibility(options.visibility);
    }
  }

  return player.cardStorages![scopedId];
}

export function createCardStorageIfNeededFromEffect(
  state: StorageAwareGameState,
  arg1: any,
  arg2?: any,
  arg3?: any,
  arg4?: any,
): CardStorage {
  if (typeof arg1 === 'string') {
    return ensureCardStorage(state, arg1 as PlayerID, arg2, arg3);
  }

  const payload = arg1 ?? {};
  const playerId: PlayerID = payload.playerId ?? arg2;
  const storageId: string | undefined =
    payload.storageId ??
    payload.storage ??
    payload.storageKey ??
    payload.id ??
    arg3;

  const options = {
    label: payload.label,
    visibility: payload.visibility,
  };

  return ensureCardStorage(state, playerId, storageId as string, options);
}

function getCardIdentity(card: StorageCardLike): string | undefined {
  return card.instanceId ?? card.id;
}

function removeCardFromArray(cards: StorageCardLike[] | undefined, cardId: string): StorageCardLike | undefined {
  if (!cards) return undefined;
  const index = cards.findIndex((card) => getCardIdentity(card) === cardId);
  if (index < 0) return undefined;
  const [card] = cards.splice(index, 1);
  return card;
}

function normalizeZoneName(zone: string | undefined): string | undefined {
  if (!zone) return zone;
  if (zone === 'cardStorage') return 'storage';
  return zone;
}

function resolveStorageId(
  playerId: PlayerID,
  zone: any,
  explicitStorageId?: string,
): string | undefined {
  const candidate =
    explicitStorageId ??
    zone?.storageId ??
    zone?.storage ??
    zone?.id;
  return candidate ? toScopedStorageId(playerId, candidate) : undefined;
}

function getZoneArray(
  state: StorageAwareGameState,
  playerId: PlayerID,
  zone: string,
  storageId?: string,
): StorageCardLike[] {
  const player = ensureSpecialZones(state, playerId);

  if (zone === 'storage') {
    const scopedId = resolveStorageId(playerId, undefined, storageId);
    const storage = ensureCardStorage(state, playerId, scopedId as string);
    return storage.cards;
  }

  if (zone === 'removedFromGame') return player.removedFromGame!;
  if (zone === 'setAside') return player.setAside!;
  if (zone === 'hand') return player.hand!;
  if (zone === 'discard') return player.discard!;
  if (zone === 'deck' || zone === 'deckTop' || zone === 'deckBottom') return player.deck!;

  throw new Error(`Unsupported zone: ${zone}`);
}

function moveKnownCard(
  state: StorageAwareGameState,
  playerId: PlayerID,
  card: StorageCardLike,
  to: any,
): void {
  const toZone = normalizeZoneName(typeof to === 'string' ? to : to?.kind);
  const toStorageId = resolveStorageId(playerId, to);
  const destination = getZoneArray(state, playerId, toZone as string, toStorageId);

  if (toZone === 'deckBottom') {
    destination.push(card);
    return;
  }

  if (toZone === 'deckTop') {
    destination.unshift(card);
    return;
  }

  destination.push(card);
}

function removeFromNamedZone(
  state: StorageAwareGameState,
  playerId: PlayerID,
  from: any,
  cardId?: string,
): StorageCardLike | undefined {
  if (!from) return undefined;

  const fromZone = normalizeZoneName(typeof from === 'string' ? from : from.kind);
  const fromStorageId = resolveStorageId(playerId, from);
  const source = getZoneArray(state, playerId, fromZone as string, fromStorageId);

  if (cardId) {
    return removeCardFromArray(source, cardId);
  }

  if (fromZone === 'deckBottom') {
    return source.pop();
  }

  return source.shift();
}

function findAndRemoveCardAnywhere(
  state: StorageAwareGameState,
  playerId: PlayerID,
  cardId: string,
): StorageCardLike | undefined {
  const player = ensureSpecialZones(state, playerId);
  const directZones = [
    player.hand!,
    player.deck!,
    player.discard!,
    player.removedFromGame!,
    player.setAside!,
  ];

  for (const zone of directZones) {
    const found = removeCardFromArray(zone, cardId);
    if (found) return found;
  }

  for (const storage of Object.values(player.cardStorages ?? {})) {
    const found = removeCardFromArray(storage.cards, cardId);
    if (found) return found;
  }

  return undefined;
}

export function moveCardBetweenZones(state: StorageAwareGameState, params: any): StorageAwareGameState {
  const playerId: PlayerID =
    params?.playerId ??
    params?.from?.playerId ??
    params?.to?.playerId ??
    'P1';

  ensureSpecialZones(state, playerId);

  let card: StorageCardLike | undefined;

  if (params?.card) {
    card = params.card;
  } else if (params?.cardId) {
    if (params?.from) {
      card = removeFromNamedZone(state, playerId, params.from, params.cardId);
    } else {
      card = findAndRemoveCardAnywhere(state, playerId, params.cardId);
    }
  } else if (params?.from) {
    const amount = params.amount ?? 1;
    for (let i = 0; i < amount; i += 1) {
      const nextCard = removeFromNamedZone(state, playerId, params.from);
      if (!nextCard) break;
      moveKnownCard(state, playerId, nextCard, params.to);
    }
    return state;
  }

  if (!card) {
    return state;
  }

  moveKnownCard(state, playerId, card, params.to);
  return state;
}

export function getVisibleCardStorages(
  state: StorageAwareGameState,
  viewerPlayerId: PlayerID,
  ownerPlayerId: PlayerID,
): CardStorage[] {
  const player = ensureSpecialZones(state, ownerPlayerId);

  return Object.values(player.cardStorages ?? {}).map((storage) => {
    if (storage.visibility !== 'private' || ownerPlayerId === viewerPlayerId) {
      return {
        ...storage,
        cards: [...storage.cards],
      };
    }

    return {
      ...storage,
      cards: storage.cards.map(() => ({
        name: 'HIDDEN',
      })),
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
