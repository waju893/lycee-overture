

src/game/GameEngine.ts

import {
  DeclareActionInput,
  Declaration,
  GameState,
  MAX_DECLARATION_STACK_DEPTH,
  PlayerId,
  getOpponentPlayerId,
} from './GameTypes';
import {
  canPlayerRespondToTopDeclaration,
  getTopDeclaration,
  validateDeclarationStackLimit,
  validatePassResponse,
  validateResponseDeclarationOpportunity,
} from './GameRules';

function nextDeclarationId(state: GameState): string {
  return `DECL-${state.declarationStack.items.length + 1}-${Date.now()}`;
}

function appendLog(state: GameState, message: string): GameState {
  return {
    ...state,
    log: [...state.log, message],
  };
}

function buildDeclaration(state: GameState, input: DeclareActionInput): Declaration {
  const top = getTopDeclaration(state);
  const isResponse = Boolean(top && state.declarationStack.activeResponseWindow);

  const base = {
    id: nextDeclarationId(state),
    status: 'awaitingResponse' as const,
    declaredBy: input.declaredBy,
    createdAt: Date.now(),
    isResponse,
    respondedToDeclarationId: top?.id,
    responseWindowOpen: true,
    canBeRespondedTo: true,
    sourceCardId: 'sourceCardId' in input ? input.sourceCardId : undefined,
    sourceCharacterId: 'characterId' in input ? input.characterId : undefined,
    targets: input.targets,
    metadata: input.metadata,
  };

  switch (input.type) {
    case 'cardDeclaration':
      return {
        ...base,
        type: 'cardDeclaration',
        cardId: input.cardId,
        cardType: input.cardType,
        zoneFrom: input.zoneFrom,
        declarationKind: input.declarationKind,
      };
    case 'effectDeclaration':
      return {
        ...base,
        type: 'effectDeclaration',
        effectId: input.effectId,
        sourceType: input.sourceType,
      };
    case 'skillDeclaration':
      return {
        ...base,
        type: 'skillDeclaration',
        skillId: input.skillId,
        characterId: input.characterId,
      };
    case 'handDeclaration':
      return {
        ...base,
        type: 'handDeclaration',
        handCardId: input.handCardId,
        abilityId: input.abilityId,
      };
    case 'attackDeclaration':
      return {
        ...base,
        type: 'attackDeclaration',
        attackerId: input.attackerId,
        attackColumn: input.attackColumn,
        defenderId: input.defenderId,
      };
    case 'moveDeclaration':
      return {
        ...base,
        type: 'moveDeclaration',
        moverId: input.moverId,
        moveKind: input.moveKind,
        from: input.from,
        to: input.to,
        swapWithCharacterId: input.swapWithCharacterId,
      };
  }
}

function openResponseWindowForTopDeclaration(state: GameState): GameState {
  const top = getTopDeclaration(state);
  if (!top || !top.canBeRespondedTo) {
    return {
      ...state,
      declarationStack: {
        ...state.declarationStack,
        activeResponseWindow: undefined,
      },
    };
  }

  let responderPlayerId: PlayerId;

  if (top.isResponse) {
    // 대응 선언이면 responder는 "직전 선언자"
    const previous = state.declarationStack.items.find(
      (d) => d.id === top.respondedToDeclarationId,
    );
    responderPlayerId = previous ? previous.declaredBy : getOpponentPlayerId(top.declaredBy);
  } else {
    // 최초 선언이면 상대 플레이어
    responderPlayerId = getOpponentPlayerId(top.declaredBy);
  }

  const updatedItems = state.declarationStack.items.map((item, index, array) => {
    if (index !== array.length - 1) {
      return { ...item, responseWindowOpen: false };
    }
    return { ...item, responseWindowOpen: true, status: 'awaitingResponse' as const };
  });

  return {
    ...state,
    declarationStack: {
      ...state.declarationStack,
      items: updatedItems,
      activeResponseWindow: {
        topDeclarationId: top.id,
        responderPlayerId,
      },
    },
  };
}

  const responderPlayerId = getOpponentPlayerId(top.declaredBy);
  const updatedItems = state.declarationStack.items.map((item, index, array) => {
    if (index !== array.length - 1) {
      return { ...item, responseWindowOpen: false };
    }
    return { ...item, responseWindowOpen: true, status: 'awaitingResponse' as const };
  });

  return {
    ...state,
    declarationStack: {
      ...state.declarationStack,
      items: updatedItems,
      activeResponseWindow: {
        topDeclarationId: top.id,
        responderPlayerId,
      },
    },
  };
}

function closeTopResponseWindow(state: GameState): GameState {
  const top = getTopDeclaration(state);
  if (!top) {
    return state;
  }

  const updatedItems = state.declarationStack.items.map((item, index, array) => {
    if (index !== array.length - 1) {
      return item;
    }
    return { ...item, responseWindowOpen: false };
  });

  return {
    ...state,
    declarationStack: {
      ...state.declarationStack,
      items: updatedItems,
      activeResponseWindow: undefined,
    },
  };
}

export function declare(state: GameState, input: DeclareActionInput): GameState {
  const hasOpenResponseWindow = Boolean(state.declarationStack.activeResponseWindow);

  if (hasOpenResponseWindow) {
    const responseViolations = validateResponseDeclarationOpportunity(state, input.declaredBy);
    if (responseViolations.length > 0) {
      return appendLog(
        state,
        `[declare blocked] ${responseViolations.map((v) => v.message).join(' | ')}`,
      );
    }
  } else {
    const stackViolations = validateDeclarationStackLimit(state);
    if (stackViolations.length > 0) {
      return appendLog(
        state,
        `[declare blocked] ${stackViolations.map((v) => v.message).join(' | ')}`,
      );
    }
  }

  const declaration = buildDeclaration(state, input);
  const pushedState: GameState = {
    ...state,
    declarationStack: {
      ...state.declarationStack,
      limit: MAX_DECLARATION_STACK_DEPTH,
      items: [...state.declarationStack.items, declaration],
      activeResponseWindow: undefined,
    },
  };

  const withWindow = openResponseWindowForTopDeclaration(pushedState);
  return appendLog(
    withWindow,
    declaration.isResponse
      ? `[declare] ${declaration.declaredBy} responded with ${declaration.type} (${declaration.id})`
      : `[declare] ${declaration.declaredBy} declared ${declaration.type} (${declaration.id})`,
  );
}

function resolveSingleDeclaration(state: GameState, declarationId: string): GameState {
  const items = [...state.declarationStack.items];
  const top = items[items.length - 1];
  if (!top || top.id !== declarationId) {
    return appendLog(state, `[resolve skipped] top declaration mismatch for ${declarationId}`);
  }

  const resolvingTop: Declaration = {
    ...top,
    status: 'resolving',
  };
  items[items.length - 1] = resolvingTop;

  let nextState: GameState = {
    ...state,
    declarationStack: {
      ...state.declarationStack,
      items,
      activeResponseWindow: undefined,
    },
  };

  nextState = appendLog(
    nextState,
    `[resolve start] ${resolvingTop.id} by ${resolvingTop.declaredBy} (${resolvingTop.type})`,
  );

  // TODO: connect real declaration-specific resolver logic here.
  // At this skeleton stage, we only mark the declaration resolved.

  const poppedItems = nextState.declarationStack.items.slice(0, -1);
  nextState = {
    ...nextState,
    declarationStack: {
      ...nextState.declarationStack,
      items: poppedItems,
      activeResponseWindow: undefined,
    },
  };

  nextState = appendLog(nextState, `[resolve end] ${resolvingTop.id}`);
  return nextState;
}

export function resolveDeclarationStack(state: GameState): GameState {
  let nextState = state;

  while (nextState.declarationStack.items.length > 0) {
    const top = getTopDeclaration(nextState);
    if (!top) {
      break;
    }
    nextState = resolveSingleDeclaration(nextState, top.id);
  }

  return nextState;
}

export function passResponse(state: GameState, playerId: PlayerId): GameState {
  const violations = validatePassResponse(state, playerId);
  if (violations.length > 0) {
    return appendLog(
      state,
      `[pass blocked] ${violations.map((v) => v.message).join(' | ')}`,
    );
  }

  const top = getTopDeclaration(state);
  if (!top) {
    return appendLog(state, '[pass blocked] No declaration exists on the stack.');
  }

  let nextState = closeTopResponseWindow(state);
  nextState = appendLog(
    nextState,
    `[pass] ${playerId} passed response to ${top.id}; stack resolves in reverse order`,
  );

  return resolveDeclarationStack(nextState);
}

export function createEmptyGameState(): GameState {
  return {
    declarationStack: {
      items: [],
      limit: MAX_DECLARATION_STACK_DEPTH,
      activeResponseWindow: undefined,
    },
    triggerQueue: {
      pendingGroups: [],
    },
    log: [],
  };
}

export function canCurrentPlayerRespond(state: GameState, playerId: PlayerId): boolean {
  return canPlayerRespondToTopDeclaration(state, playerId);
}