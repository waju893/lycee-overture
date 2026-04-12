import type { GameState, TriggerCandidate } from '../GameTypes';

/**
 * Returns the next simultaneous trigger group as-is.
 *
 * Lycee semantics are NOT:
 * "all active player's triggers first".
 *
 * Instead, the turn player chooses ONE trigger from the simultaneous group,
 * resolves it completely, then chooses again from the remaining unresolved
 * triggers if no nested triggers were generated.
 *
 * So this resolver only surfaces the group and leaves one-by-one selection
 * to the engine loop.
 */
export function resolveNextTriggerGroup(state: GameState): TriggerCandidate[] {
  const group = state.triggerQueue.pendingGroups.shift();
  if (!group || group.length === 0) {
    return [];
  }

  const activePlayer = state.turn.activePlayer;
  state.logs.push(`[TRIGGER RESOLVE] group size=${group.length} active=${activePlayer}`);
  state.log = state.logs;

  return [...group];
}
