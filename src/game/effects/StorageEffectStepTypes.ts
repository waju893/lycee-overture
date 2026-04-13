export type StorageStepPlayerScope =
  | 'self'
  | 'opponent'
  | 'owner'
  | 'controller';

export type StorageVisibility = 'public' | 'private';

export type StorageSourceZone =
  | 'hand'
  | 'deckTop'
  | 'deckBottom'
  | 'discard'
  | 'field'
  | 'removedFromGame'
  | 'setAside'
  | 'storage';

export type StorageDestinationZone =
  | 'hand'
  | 'deckTop'
  | 'deckBottom'
  | 'discard'
  | 'field'
  | 'removedFromGame'
  | 'setAside'
  | 'storage';

export type StorageCardReference =
  | 'thisCard'
  | 'targetCard'
  | 'chosenCard'
  | 'chosenCardFromHand'
  | 'chosenCardFromDiscard'
  | 'chosenCardFromRemovedFromGame'
  | 'chosenCardFromSetAside';

export interface EnsureStorageEffectStep {
  type: 'ensureStorage';
  player: StorageStepPlayerScope;
  storageId: string;
  label?: string;
  visibility?: StorageVisibility;
}

export interface MoveToStorageEffectStep {
  type: 'moveToStorage';
  player: StorageStepPlayerScope;
  storageId: string;
  from?: Exclude<StorageSourceZone, 'storage'>;
  target?: StorageCardReference;
  amount?: number;
  visibility?: StorageVisibility;
}

export interface MoveFromStorageEffectStep {
  type: 'moveFromStorage';
  player: StorageStepPlayerScope;
  storageId: string;
  to: Exclude<StorageDestinationZone, 'storage'>;
  amount?: number;
  target?: StorageCardReference;
}

export interface MoveToRemovedFromGameEffectStep {
  type: 'moveToRemovedFromGame';
  from?: Exclude<StorageSourceZone, 'removedFromGame'>;
  target?: StorageCardReference;
  amount?: number;
}

export interface MoveToSetAsideEffectStep {
  type: 'moveToSetAside';
  from?: Exclude<StorageSourceZone, 'setAside'>;
  target?: StorageCardReference;
  amount?: number;
}

export type StorageEffectStep =
  | EnsureStorageEffectStep
  | MoveToStorageEffectStep
  | MoveFromStorageEffectStep
  | MoveToRemovedFromGameEffectStep
  | MoveToSetAsideEffectStep;

export interface StorageRunnerCard {
  id: string;
  owner: string;
  controller?: string;
  zone?: string;
  [key: string]: unknown;
}

export interface StorageRunnerGameState {
  turnPlayer?: string;
  players: Record<string, unknown>;
  cards?: Record<string, StorageRunnerCard>;
  [key: string]: unknown;
}

export interface StorageRunnerContext {
  selfPlayerId: string;
  opponentPlayerId: string;
  ownerPlayerId?: string;
  controllerPlayerId?: string;
  thisCardId?: string;
  targetCardId?: string;
  chosenCardId?: string;
  chosenCardFromHandId?: string;
  chosenCardFromDiscardId?: string;
  chosenCardFromRemovedFromGameId?: string;
  chosenCardFromSetAsideId?: string;
}

export interface StorageStepExecutionResult {
  state: StorageRunnerGameState;
  movedCardIds?: string[];
  createdStorageIds?: string[];
}
