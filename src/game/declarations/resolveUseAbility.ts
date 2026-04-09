import type { EngineEvent, GameState, LegacyDeclaration } from "../GameTypes";
import { appendLog } from "../engine/cloneState";

export function resolveUseAbility(state: GameState, declaration: LegacyDeclaration): void {
  state.events.push({
    type: "ABILITY_USED",
    playerId: declaration.playerId,
    cardId: declaration.sourceCardId,
  } as EngineEvent);

  appendLog(state, `능력 사용 해결: ${declaration.sourceCardId ?? "unknown"}`);
}
