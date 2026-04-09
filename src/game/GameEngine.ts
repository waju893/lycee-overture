import type { GameAction } from "./GameActions";
import type { GameState } from "./GameTypes";
import { createInitialGameState as createInitialGameStateFromRules } from "./GameRules";
import { cloneState } from "./engine/cloneState";
import { declareAction } from "./engine/declarePipeline";
import {
  canCurrentPlayerRespond as canCurrentPlayerRespondInDeclarationApi,
  createEmptyGameState,
  declare,
  passResponse,
} from "./engine/declarationApi";
import { recordReplay } from "./engine/replay";
import { passPriority } from "./engine/resolvePipeline";
import { handleStartGame, finalizeStartup } from "./engine/startupPipeline";
import { advancePhase, startTurn } from "./engine/turnPipeline";
import { setDefender } from "./engine/battlePipeline";

export function reduceGameState(state: GameState, action: GameAction): GameState {
  const next = cloneState(state);
  recordReplay(next, action);

  switch (action.type) {
    case "START_GAME":
      return handleStartGame(next, {
        firstPlayer: action.firstPlayer,
        leaderEnabled: action.leaderEnabled,
      });

    case "KEEP_STARTING_HAND":
      if (next.startup.decisions[action.playerId]) {
        next.logs.push("ALREADY_DECIDED");
      } else {
        next.startup.decisions[action.playerId] = "KEEP";
      }
      next.log = next.logs;
      return next;

    case "MULLIGAN":
      if (next.startup.decisions[action.playerId]) {
        next.logs.push("ALREADY_DECIDED");
      } else {
        next.startup.decisions[action.playerId] = "MULLIGAN";
      }
      next.log = next.logs;
      return next;

    case "FINALIZE_STARTUP":
      finalizeStartup(next);
      return next;

    case "START_TURN":
      startTurn(next, next.turn.activePlayer);
      return next;

    case "ADVANCE_PHASE":
      advancePhase(next);
      return next;

    case "DECLARE_ACTION":
      declareAction(next, action);
      return next;

    case "PASS_PRIORITY":
      passPriority(next, action.playerId);
      return next;

    case "SET_DEFENDER":
      setDefender(next, action.playerId, action.defenderCardId);
      return next;

    default:
      return next;
  }
}

export { createEmptyGameState, declare, passResponse };
export const canCurrentPlayerRespond = canCurrentPlayerRespondInDeclarationApi;
export { createInitialGameStateFromRules as createInitialGameState };
