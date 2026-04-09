import type { GameState, PlayerID } from "../GameTypes";
import { createInitialGameState as createInitialGameStateFromRules } from "../GameRules";
import { appendLog } from "./cloneState";
import { drawTopCards } from "./utils";

export function handleStartGame(
  state: GameState,
  params: { firstPlayer?: PlayerID; leaderEnabled?: boolean },
): GameState {
  const next = createInitialGameStateFromRules({
    p1Deck: state.players.P1.deck,
    p2Deck: state.players.P2.deck,
    leaderEnabled: params.leaderEnabled ?? false,
  });

  next.replayEvents = [...state.replayEvents];
  next.logs = [...state.logs];
  next.log = next.logs;
  next.events = [...state.events];

  next.startup.active = true;
  next.startup.leaderEnabled = params.leaderEnabled ?? false;
  next.startup.firstPlayer = params.firstPlayer ?? "P1";
  next.turn.firstPlayer = params.firstPlayer ?? "P1";
  next.turn.activePlayer = params.firstPlayer ?? "P1";
  next.turn.priorityPlayer = params.firstPlayer ?? "P1";

  if (params.leaderEnabled) {
    for (const playerId of ["P1", "P2"] as PlayerID[]) {
      const leaderIndex = next.players[playerId].deck.findIndex((card) => card.isLeader);
      if (leaderIndex >= 0) {
        const [leader] = next.players[playerId].deck.splice(leaderIndex, 1);
        leader.location = "hand";
        leader.revealed = true;
        next.players[playerId].hand.push(leader);
        drawTopCards(next, playerId, 6);
      } else {
        drawTopCards(next, playerId, 7);
      }
    }
  } else {
    drawTopCards(next, "P1", 7);
    drawTopCards(next, "P2", 7);
  }

  appendLog(next, "START_GAME");
  return next;
}

export function finalizeStartup(next: GameState): void {
  next.startup.active = false;
  next.startup.startupFinished = true;
  next.turn.firstPlayer = next.startup.firstPlayer ?? next.turn.firstPlayer ?? "P1";
  next.turn.activePlayer = next.turn.firstPlayer;
  next.turn.priorityPlayer = next.turn.firstPlayer;
  next.turn.phase = "wakeup";
}
