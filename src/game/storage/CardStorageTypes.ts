import type { CardRef, FieldSlot, GameState, PlayerID } from '../GameTypes';

export type StorageVisibility = 'public' | 'private';

export type CardStorageZone = {
  id: string;
  ownerPlayerId: PlayerID;
  key: string;
  label: string;
  visibility: StorageVisibility;
  cards: CardRef[];
  sharedKey?: string;
  createdByCardId?: string;
  createdByCardNo?: string;
};

export type ZoneRef =
  | { kind: 'hand'; playerId: PlayerID }
  | { kind: 'deck'; playerId: PlayerID }
  | { kind: 'discard'; playerId: PlayerID }
  | { kind: 'removedFromGame'; playerId: PlayerID }
  | { kind: 'setAside'; playerId: PlayerID }
  | { kind: 'field'; playerId: PlayerID; slot: FieldSlot }
  | { kind: 'cardStorage'; playerId: PlayerID; storageId: string };

export type StorageAwarePlayerState = {
  hand: CardRef[];
  deck: CardRef[];
  discard: CardRef[];
  field: Record<FieldSlot, { card: CardRef | null }>;
  removedFromGame?: CardRef[];
  setAside?: CardRef[];
  cardStorages?: Record<string, CardStorageZone>;
};

export type StorageAwareGameState = GameState & {
  players: Record<PlayerID, StorageAwarePlayerState>;
};

export type EnsureCardStorageOptions = {
  label?: string;
  visibility?: StorageVisibility;
  sharedKey?: string;
  createdByCardId?: string;
  createdByCardNo?: string;
};
