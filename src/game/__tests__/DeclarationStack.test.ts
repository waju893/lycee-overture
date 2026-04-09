import { describe, expect, it } from 'vitest';
import {
  canCurrentPlayerRespond,
  createEmptyGameState,
  declare,
  passResponse,
} from '../GameEngine';

function makeCardDeclarationInput(declaredBy: 'P1' | 'P2', suffix: string) {
  return {
    type: 'cardDeclaration' as const,
    declaredBy,
    cardId: `CARD-${suffix}`,
    cardType: 'event' as const,
    zoneFrom: 'hand',
    declarationKind: 'eventUse' as const,
  };
}

describe('DeclarationStack', () => {
  it('alternates response priority between players', () => {
    let state = createEmptyGameState();

    state = declare(state, makeCardDeclarationInput('P1', '1'));
    expect(canCurrentPlayerRespond(state, 'P2')).toBe(true);
    expect(canCurrentPlayerRespond(state, 'P1')).toBe(false);

    state = declare(state, makeCardDeclarationInput('P2', '2'));
    expect(canCurrentPlayerRespond(state, 'P1')).toBe(true);
    expect(canCurrentPlayerRespond(state, 'P2')).toBe(false);

    state = declare(state, makeCardDeclarationInput('P1', '3'));
    expect(canCurrentPlayerRespond(state, 'P2')).toBe(true);
    expect(canCurrentPlayerRespond(state, 'P1')).toBe(false);
  });

  it('prevents responding to your own declaration regardless of stack depth', () => {
    let state = createEmptyGameState();

    state = declare(state, makeCardDeclarationInput('P1', '1'));
    expect(canCurrentPlayerRespond(state, 'P1')).toBe(false);

    state = declare(state, makeCardDeclarationInput('P2', '2'));
    expect(canCurrentPlayerRespond(state, 'P2')).toBe(false);
  });

  it('resolves declarations in reverse order after a pass', () => {
    let state = createEmptyGameState();

    state = declare(state, makeCardDeclarationInput('P1', '1'));
    state = declare(state, makeCardDeclarationInput('P2', '2'));
    state = declare(state, makeCardDeclarationInput('P1', '3'));

    state = passResponse(state, 'P2');

    const logText = state.log.join('\n');
    expect(logText).toContain('[resolve start]');
    expect(state.declarationStack.items.length).toBe(0);
  });

  it('blocks declaration beyond max stack depth 100', () => {
    let state = createEmptyGameState();

    for (let i = 0; i < 100; i += 1) {
      const declaredBy = i % 2 === 0 ? 'P1' : 'P2';
      state = declare(state, makeCardDeclarationInput(declaredBy, String(i + 1)));
    }

    const beforeLength = state.declarationStack.items.length;
    state = declare(state, makeCardDeclarationInput('P1', '101'));

    expect(state.declarationStack.items.length).toBe(beforeLength);
    expect(state.log[state.log.length - 1]).toContain('Declaration stack cannot exceed 100');
  });
});
