import { serializeAction, type GameAction } from "../GameActions";
import type { GameState, ReplayEvent } from "../GameTypes";

export function recordReplay(state: GameState, action: GameAction): void {
  const event: ReplayEvent = {
    type: "ACTION_RECORDED",
    payload: serializeAction(action),
  };
  state.replayEvents.push(event);
}
