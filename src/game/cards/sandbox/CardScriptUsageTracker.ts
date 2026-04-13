import type { PlayerID } from '../../GameTypes';

export interface CardScriptUsageKey {
  playerId: PlayerID;
  cardId: string;
  effectId?: string;
  turnNumber: number;
}

export interface CardScriptUsageTrackerState {
  usedKeys: Record<string, true>;
}

export function createEmptyCardScriptUsageTracker(): CardScriptUsageTrackerState {
  return {
    usedKeys: {},
  };
}

export function toCardScriptUsageKeyString(key: CardScriptUsageKey): string {
  return [
    key.playerId,
    key.cardId,
    key.effectId ?? 'default',
    key.turnNumber,
  ].join('::');
}

export function hasCardScriptUsage(
  tracker: CardScriptUsageTrackerState,
  key: CardScriptUsageKey,
): boolean {
  return tracker.usedKeys[toCardScriptUsageKeyString(key)] === true;
}

export function markCardScriptUsage(
  tracker: CardScriptUsageTrackerState,
  key: CardScriptUsageKey,
): CardScriptUsageTrackerState {
  const next: CardScriptUsageTrackerState = {
    usedKeys: {
      ...tracker.usedKeys,
    },
  };

  next.usedKeys[toCardScriptUsageKeyString(key)] = true;
  return next;
}
