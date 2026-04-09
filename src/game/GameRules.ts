import {
  Declaration,
  GameState,
  MAX_DECLARATION_STACK_DEPTH,
  PlayerId,
  RuleViolation,
} from './GameTypes';

export function getTopDeclaration(state: GameState): Declaration | undefined {
  const { items } = state.declarationStack;
  return items.length > 0 ? items[items.length - 1] : undefined;
}

export function getCurrentResponderPlayerId(state: GameState): PlayerId | undefined {
  return state.declarationStack.activeResponseWindow?.responderPlayerId;
}

export function canPlayerRespondToTopDeclaration(
  state: GameState,
  playerId: PlayerId,
): boolean {
  const top = getTopDeclaration(state);
  const window = state.declarationStack.activeResponseWindow;

  if (!top || !window) {
    return false;
  }

  if (!top.canBeRespondedTo || !top.responseWindowOpen) {
    return false;
  }

  if (window.responderPlayerId !== playerId) {
    return false;
  }

  // Lycee rule applied here:
  // regardless of stack count, you cannot respond to your own declaration.
  if (top.declaredBy === playerId) {
    return false;
  }

  return true;
}

export function validateDeclarationStackLimit(state: GameState): RuleViolation[] {
  if (state.declarationStack.items.length >= MAX_DECLARATION_STACK_DEPTH) {
    return [
      {
        code: 'stackLimitExceeded',
        message: `Declaration stack cannot exceed ${MAX_DECLARATION_STACK_DEPTH} in this implementation.`,
      },
    ];
  }

  return [];
}

export function validateResponseDeclarationOpportunity(
  state: GameState,
  playerId: PlayerId,
): RuleViolation[] {
  const violations: RuleViolation[] = [];
  const top = getTopDeclaration(state);
  const window = state.declarationStack.activeResponseWindow;

  if (!top || !window || !top.responseWindowOpen) {
    violations.push({
      code: 'noResponseWindow',
      message: 'There is no open response window.',
    });
    return violations;
  }

  if (window.responderPlayerId !== playerId) {
    violations.push({
      code: 'wrongResponder',
      message: `Only ${window.responderPlayerId} can make the next response declaration.`,
    });
  }

  if (top.declaredBy === playerId) {
    violations.push({
      code: 'cannotRespondToOwnDeclaration',
      message: 'A player cannot make a response declaration to their own declaration.',
    });
  }

  violations.push(...validateDeclarationStackLimit(state));
  return violations;
}

export function validatePassResponse(state: GameState, playerId: PlayerId): RuleViolation[] {
  const window = state.declarationStack.activeResponseWindow;

  if (!window) {
    return [
      {
        code: 'noResponseWindow',
        message: 'There is no open response window to pass.',
      },
    ];
  }

  if (window.responderPlayerId !== playerId) {
    return [
      {
        code: 'wrongResponder',
        message: `Only ${window.responderPlayerId} can pass this response window.`,
      },
    ];
  }

  return [];
}
