import type { GameState, PlayerID, TriggerCandidate } from '../GameTypes';

export interface ResolveTriggerOptions {
  chooseOrder?: (group: TriggerCandidate[], activePlayer: PlayerID) => TriggerCandidate[];
}

/**
 * Lycee-specific trigger ordering:
 * 1. simultaneous triggers are grouped together
 * 2. turn player chooses order
 * 3. if new triggers appear during trigger resolution, they must resolve first
 *
 * Queue strategy:
 * - pendingGroups[0] is always the next simultaneous trigger batch
 * - nested triggers should be unshifted by the event producer
 */
export function resolveNextTriggerGroup(
  state: GameState,
  options?: ResolveTriggerOptions,
): TriggerCandidate[] {
  const group = state.triggerQueue.pendingGroups.shift();
  if (!group || group.length === 0) {
    return [];
  }

  const activePlayer = state.turn.activePlayer;
  const ordered = options?.chooseOrder ? options.chooseOrder(group, activePlayer) : defaultOrder(group, activePlayer);

  state.logs.push(`[TRIGGER] resolve group size=${ordered.length} active=${activePlayer}`);
  state.log = state.logs;

  return ordered;
}

function defaultOrder(group: TriggerCandidate[], activePlayer: PlayerID): TriggerCandidate[] {
  const mine = group.filter((candidate) => candidate.controller === activePlayer);
  const others = group.filter((candidate) => candidate.controller !== activePlayer);
  return [...mine, ...others];
}
