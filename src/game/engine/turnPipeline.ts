import type { GameState } from "../GameTypes";
import { getOpponentPlayerId } from "../GameTypes";
import { drawTopCards, untapField } from "./utils";

export function startTurn(state: GameState, playerId = state.turn.activePlayer): void {
  state.turn.activePlayer = playerId;
  state.turn.priorityPlayer = playerId;
  state.turn.phase = "wakeup";
  state.turn.turnNumber += 1;
  untapField(state, playerId);
  const drawCount = state.turn.turnNumber <= 1 && state.turn.firstPlayer === playerId ? 1 : 2;
  drawTopCards(state, playerId, drawCount);
}

export function advancePhase(state: GameState): void {
  if (state.turn.phase === "wakeup") {
    state.turn.phase = "main";
    return;
  }

  if (state.turn.phase === "main") {
    state.turn.phase = "battle";
    return;
  }

  if (state.turn.phase === "battle") {
    state.turn.phase = "end";
    return;
  }

  if (state.turn.phase === "end") {
    const nextPlayer = getOpponentPlayerId(state.turn.activePlayer);
    state.turn.activePlayer = nextPlayer;
    state.turn.priorityPlayer = nextPlayer;
    state.turn.phase = "main";
    state.turn.turnNumber += 1;
    untapField(state, nextPlayer);
    const drawCount = state.turn.turnNumber <= 1 && state.turn.firstPlayer === nextPlayer ? 1 : 2;
    drawTopCards(state, nextPlayer, drawCount);
  }
}
