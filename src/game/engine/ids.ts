import type { GameState } from "../GameTypes";

export function nextLegacyDeclarationId(state: GameState): string {
  return `D-${state.declarationStack.length + 1}-${state.replayEvents.length + 1}`;
}

export function nextDeclarationId(state: GameState): string {
  return `DECL-${state.declarationStack.length + 1}-${state.replayEvents.length + 1}`;
}
