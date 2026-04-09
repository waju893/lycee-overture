import type { GameState } from "../GameTypes";
import { getOpponentPlayerId } from "../GameTypes";
import { canPlayerRespondToTopDeclaration, validatePassResponse } from "../GameRules";
import { resolveLegacyDeclaration } from "../declarations";
import { appendLog } from "./cloneState";

function resolveTopDeclaration(state: GameState): void {
  const declaration = state.declarationStack.pop();
  if (!declaration) return;

  resolveLegacyDeclaration(state, declaration);
  state.turn.priorityPlayer = state.turn.activePlayer;
}

export function passPriority(state: GameState, playerId: GameState["turn"]["priorityPlayer"]): void {
  if (state.declarationStack.length > 0) {
    const violations = validatePassResponseForEngine(state, playerId);
    if (violations.length > 0) {
      appendLog(state, `[pass blocked] ${violations.map((v) => v.message).join(" | ")}`);
      return;
    }

    appendLog(state, `[pass] ${playerId} passed response`);
    resolveTopDeclaration(state);
    return;
  }

  if (state.turn.priorityPlayer === playerId) {
    state.turn.priorityPlayer = getOpponentPlayerId(playerId);
  }
}

function validatePassResponseForEngine(state: GameState, playerId: GameState["turn"]["priorityPlayer"]) {
  const maybeLegacyOnly = state.declarationStack.activeResponseWindow;
  if (!maybeLegacyOnly) {
    const top = state.declarationStack[state.declarationStack.length - 1];
    if (!top) return [];
    return canPlayerRespondToTopDeclaration(state, playerId)
      ? []
      : [{ code: "wrongResponder", message: `Only ${state.turn.priorityPlayer} can pass this response window.` }];
  }
  return validatePassResponse(state, playerId);
}

export function canCurrentPlayerRespond(state: GameState, playerId: GameState["turn"]["priorityPlayer"]): boolean {
  if (state.declarationStack.activeResponseWindow) {
    return canPlayerRespondToTopDeclaration(state, playerId);
  }

  const top = state.declarationStack[state.declarationStack.length - 1];
  if (!top) return false;
  return top.playerId !== playerId && state.turn.priorityPlayer === playerId;
}
