import type { CardRef, PlayerID } from '../GameTypes';
import type {
  CardStorageZone,
  EnsureCardStorageOptions,
  StorageAwareGameState,
  StorageAwarePlayerState,
  ZoneRef,
} from './CardStorageTypes';

function getPlayerState(state: StorageAwareGameState, playerId: PlayerID): StorageAwarePlayerState {
  return state.players[playerId];
}

export function ensureSpecialZones(
  state: StorageAwareGameState,
  playerId: PlayerID,
): StorageAwarePlayerState {
  const player = getPlayerState(state, playerId);
  if (!player.removedFromGame) player.removedFromGame = [];
  if (!player.setAside) player.setAside = [];
  if (!player.cardStorages) player.cardStorages = {};
  return player;
}

export function makeCardStorageId(playerId: PlayerID, key: string): string {
  return `${playerId}:${key}`;
}

export function ensureCardStorage(
  state: StorageAwareGameState,
  playerId: PlayerID,
  key: string,
  options: EnsureCardStorageOptions = {},
): CardStorageZone {
  const player = ensureSpecialZones(state, playerId);
  const storageId = makeCardStorageId(playerId, key);
  const existing = player.cardStorages![storageId];
  if (existing) return existing;

  const created: CardStorageZone = {
    id: storageId,
    ownerPlayerId: playerId,
    key,
    label: options.label ?? key,
    visibility: options.visibility ?? 'public',
    cards: [],
    sharedKey: options.sharedKey,
    createdByCardId: options.createdByCardId,
    createdByCardNo: options.createdByCardNo,
  };

  player.cardStorages![storageId] = created;
  return created;
}

function removeFromArray(cards: CardRef[], cardId: string): CardRef | null {
  const index = cards.findIndex((card) => card.instanceId === cardId);
  if (index < 0) return null;
  const [card] = cards.splice(index, 1);
  return card;
}

export function findCardInZone(
  state: StorageAwareGameState,
  zone: ZoneRef,
  cardId: string,
): CardRef | null {
  const player = ensureSpecialZones(state, zone.playerId);

  switch (zone.kind) {
    case 'hand':
      return player.hand.find((card) => card.instanceId === cardId) ?? null;
    case 'deck':
      return player.deck.find((card) => card.instanceId === cardId) ?? null;
    case 'discard':
      return player.discard.find((card) => card.instanceId === cardId) ?? null;
    case 'removedFromGame':
      return player.removedFromGame!.find((card) => card.instanceId === cardId) ?? null;
    case 'setAside':
      return player.setAside!.find((card) => card.instanceId === cardId) ?? null;
    case 'cardStorage':
      return player.cardStorages?.[zone.storageId]?.cards.find((card) => card.instanceId === cardId) ?? null;
    case 'field':
      return player.field[zone.slot]?.card?.instanceId === cardId
        ? player.field[zone.slot].card
        : null;
  }
}

export function removeCardFromZone(
  state: StorageAwareGameState,
  zone: ZoneRef,
  cardId: string,
): CardRef | null {
  const player = ensureSpecialZones(state, zone.playerId);

  switch (zone.kind) {
    case 'hand':
      return removeFromArray(player.hand, cardId);
    case 'deck':
      return removeFromArray(player.deck, cardId);
    case 'discard':
      return removeFromArray(player.discard, cardId);
    case 'removedFromGame':
      return removeFromArray(player.removedFromGame!, cardId);
    case 'setAside':
      return removeFromArray(player.setAside!, cardId);
    case 'cardStorage': {
      const storage = player.cardStorages?.[zone.storageId];
      if (!storage) return null;
      return removeFromArray(storage.cards, cardId);
    }
    case 'field': {
      const cell = player.field[zone.slot];
      if (!cell?.card || cell.card.instanceId !== cardId) return null;
      const removed = cell.card;
      cell.card = null;
      return removed;
    }
  }
}

export function insertCardIntoZone(
  state: StorageAwareGameState,
  zone: ZoneRef,
  card: CardRef,
): void {
  const player = ensureSpecialZones(state, zone.playerId);

  switch (zone.kind) {
    case 'hand':
      card.location = 'hand';
      player.hand.push(card);
      return;
    case 'deck':
      card.location = 'deck';
      player.deck.push(card);
      return;
    case 'discard':
      card.location = 'discard';
      player.discard.push(card);
      return;
    case 'removedFromGame':
      card.location = 'removedFromGame' as any;
      player.removedFromGame!.push(card);
      return;
    case 'setAside':
      card.location = 'setAside' as any;
      player.setAside!.push(card);
      return;
    case 'cardStorage': {
      const storage = player.cardStorages?.[zone.storageId];
      if (!storage) {
        throw new Error(`CardStorage not found: ${zone.storageId}`);
      }
      card.location = 'cardStorage' as any;
      storage.cards.push(card);
      return;
    }
    case 'field': {
      const cell = player.field[zone.slot];
      if (!cell) {
        throw new Error(`Field slot not found: ${zone.slot}`);
      }
      if (cell.card) {
        throw new Error(`Field slot occupied: ${zone.slot}`);
      }
      card.location = 'field';
      cell.card = card;
      return;
    }
  }
}

export function moveCardBetweenZones(
  state: StorageAwareGameState,
  args: {
    cardId: string;
    from: ZoneRef;
    to: ZoneRef;
    ensureStorageLabel?: string;
    ensureStorageVisibility?: 'public' | 'private';
  },
): CardRef {
  if (args.to.kind === 'cardStorage') {
    const key = args.to.storageId.replace(`${args.to.playerId}:`, '');
    ensureCardStorage(state, args.to.playerId, key, {
      label: args.ensureStorageLabel,
      visibility: args.ensureStorageVisibility,
    });
  }

  const removed = removeCardFromZone(state, args.from, args.cardId);
  if (!removed) {
    throw new Error(`Card not found in source zone: ${args.cardId}`);
  }

  insertCardIntoZone(state, args.to, removed);
  return removed;
}

export function createCardStorageIfNeededFromEffect(
  state: StorageAwareGameState,
  args: {
    playerId: PlayerID;
    storageKey: string;
    label: string;
    visibility?: 'public' | 'private';
    createdByCardId?: string;
    createdByCardNo?: string;
    sharedKey?: string;
  },
): CardStorageZone {
  return ensureCardStorage(state, args.playerId, args.storageKey, {
    label: args.label,
    visibility: args.visibility ?? 'public',
    createdByCardId: args.createdByCardId,
    createdByCardNo: args.createdByCardNo,
    sharedKey: args.sharedKey,
  });
}

export function getVisibleCardStorages(
  state: StorageAwareGameState,
  viewerPlayerId: PlayerID,
  ownerPlayerId: PlayerID,
): CardStorageZone[] {
  const player = ensureSpecialZones(state, ownerPlayerId);
  return Object.values(player.cardStorages ?? {}).map((storage) => {
    if (storage.visibility === 'public' || viewerPlayerId === ownerPlayerId) {
      return storage;
    }

    return {
      ...storage,
      cards: storage.cards.map((card) => ({
        ...card,
        name: 'HIDDEN',
        cardNo: 'HIDDEN',
      })),
    };
  });
}
