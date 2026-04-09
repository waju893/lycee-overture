import type {
  Declaration,
  DeclarationStackArray,
  DeclareActionInput,
  GameState,
  PlayerId,
} from "../GameTypes";
import { getOpponentPlayerId } from "../GameTypes";
import {
  canPlayerRespondToTopDeclaration,
  createInitialGameState,
  validateDeclarationStackLimit,
  validatePassResponse,
  validateResponseDeclarationOpportunity,
} from "../GameRules";
import { appendLog, syncLogs } from "./cloneState";
import { nextDeclarationId } from "./ids";

function syncDeclarationStack(stack: DeclarationStackArray): DeclarationStackArray {
  stack.items = stack;
  return stack;
}

function makeDeclarationState(): GameState {
  const base = createInitialGameState({
    p1Deck: [],
    p2Deck: [],
    leaderEnabled: false,
  });
  base.logs = [];
  syncLogs(base);
  return base;
}

function buildDeclaration(state: GameState, input: DeclareActionInput): Declaration {
  const isResponse = state.declarationStack.length > 0;
  const top = state.declarationStack[state.declarationStack.length - 1];

  return {
    id: nextDeclarationId(state),
    type: input.type,
    declaredBy: input.declaredBy,
    status: "awaitingResponse",
    isResponse,
    respondedToDeclarationId: top?.id,
    responseWindowOpen: true,
    canBeRespondedTo: true,
    createdAt: Date.now(),
    ...(input as Omit<Declaration, "id" | "declaredBy" | "status" | "isResponse" | "responseWindowOpen" | "canBeRespondedTo" | "createdAt">),
  };
}

export function createEmptyGameState(): GameState {
  return makeDeclarationState();
}

export function declare(state: GameState, input: DeclareActionInput): GameState {
  const stack = syncDeclarationStack([...state.declarationStack] as unknown as DeclarationStackArray);
  stack.activeResponseWindow = state.declarationStack.activeResponseWindow;
  stack.limit = state.declarationStack.limit;

  const next: GameState = {
    ...state,
    declarationStack: stack,
    logs: [...state.logs],
    log: [...state.logs],
  };

  const hasOpenResponseWindow = Boolean(next.declarationStack.activeResponseWindow);
  const violations = hasOpenResponseWindow
    ? validateResponseDeclarationOpportunity(next, input.declaredBy)
    : validateDeclarationStackLimit(next);

  if (violations.length > 0) {
    appendLog(next, `[declare blocked] ${violations.map((v) => v.message).join(" | ")}`);
    return next;
  }

  const declaration = buildDeclaration(next, input);
  next.declarationStack.push({
    id: declaration.id,
    playerId: declaration.declaredBy,
    kind: "useAbility",
    sourceCardId: declaration.cardId,
  });
  syncDeclarationStack(next.declarationStack);

  const previousEntry = next.declarationStack[next.declarationStack.length - 2];
  const responderPlayerId = declaration.isResponse
    ? (previousEntry?.playerId ?? getOpponentPlayerId(declaration.declaredBy))
    : getOpponentPlayerId(declaration.declaredBy);

  next.declarationStack.activeResponseWindow = {
    topDeclarationId: declaration.id,
    responderPlayerId,
  };

  appendLog(
    next,
    declaration.isResponse
      ? `[declare] ${declaration.declaredBy} responded with ${declaration.type} (${declaration.id})`
      : `[declare] ${declaration.declaredBy} declared ${declaration.type} (${declaration.id})`,
  );

  return next;
}

export function passResponse(state: GameState, playerId: PlayerId): GameState {
  const stack = syncDeclarationStack([...state.declarationStack] as unknown as DeclarationStackArray);
  stack.activeResponseWindow = state.declarationStack.activeResponseWindow;
  stack.limit = state.declarationStack.limit;

  const next: GameState = {
    ...state,
    declarationStack: stack,
    logs: [...state.logs],
    log: [...state.logs],
  };

  const violations = validatePassResponse(next, playerId);
  if (violations.length > 0) {
    appendLog(next, `[pass blocked] ${violations.map((v) => v.message).join(" | ")}`);
    return next;
  }

  appendLog(next, `[pass] ${playerId} passed response`);
  while (next.declarationStack.length > 0) {
    const top = next.declarationStack.pop();
    appendLog(next, `[resolve start] ${top?.id ?? "unknown"}`);
  }
  syncDeclarationStack(next.declarationStack);
  next.declarationStack.activeResponseWindow = undefined;
  return next;
}

export function canCurrentPlayerRespond(state: GameState, playerId: PlayerId): boolean {
  return canPlayerRespondToTopDeclaration(state, playerId);
}
