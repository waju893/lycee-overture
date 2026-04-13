import type { PlayerID } from '../GameTypes';
import type { StorageAwareGameState } from './CardStorageTypes';
import { ensureSpecialZones } from './CardStorageEngine';

export function countRemovedFromGame(
  state: StorageAwareGameState,
  playerId: PlayerID,
): number {
  return ensureSpecialZones(state, playerId).removedFromGame!.length;
}

export function countSetAside(
  state: StorageAwareGameState,
  playerId: PlayerID,
): number {
  return ensureSpecialZones(state, playerId).setAside!.length;
}

export function listCardStorageIds(
  state: StorageAwareGameState,
  playerId: PlayerID,
): string[] {
  return Object.keys(ensureSpecialZones(state, playerId).cardStorages ?? {});
}
