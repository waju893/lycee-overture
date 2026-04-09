src/game/__tests__/DeclarationStack.test.ts

import { describe, expect, it } from 'vitest';
import {
  canCurrentPlayerRespond,
  createEmptyGameState,
  declare,
  passResponse,
} from '../GameEngine';
import { MAX_DECLARATION_STACK_DEPTH } from '../GameTypes';

describe('Declaration stack response rules', () => {
  it('allows alternating responses, but never to your own declaration', () => {
    let state = createEmptyGameState();

    state = declare(state, {
      type: 'cardDeclaration',
      declaredBy: 'P1',
      cardId: 'C-001',
      cardType: 'event',
      zoneFrom: 'hand',
      declarationKind: 'eventUse',
    });

    expect(canCurrentPlayerRespond(state, 'P2')).toBe(true);
    expect(canCurrentPlayerRespond(state, 'P1')).toBe(false);

    state = declare(state, {
      type: 'effectDeclaration',
      declaredBy: 'P2',
      effectId: 'E-001',
      sourceType: 'rule',
    });

    expect(canCurrentPlayerRespond(state, 'P1')).toBe(true);
    expect(canCurrentPlayerRespond(state, 'P2')).toBe(false);

    state = declare(state, {
      type: 'skillDeclaration',
      declaredBy: 'P1',
      skillId: 'S-001',
      characterId: 'CH-001',
    });

    expect(canCurrentPlayerRespond(state, 'P2')).toBe(true);
    expect(canCurrentPlayerRespond(state, 'P1')).toBe(false);
  });

  it('resolves in reverse order after the current responder passes', () => {
    let state = createEmptyGameState();

    state = declare(state, {
      type: 'cardDeclaration',
      declaredBy: 'P1',
      cardId: 'C-001',
      cardType: 'event',
      zoneFrom: 'hand',
      declarationKind: 'eventUse',
    });

    state = declare(state, {
      type: 'effectDeclaration',
      declaredBy: 'P2',
      effectId: 'E-001',
      sourceType: 'rule',
    });

    state = declare(state, {
      type: 'skillDeclaration',
      declaredBy: 'P1',
      skillId: 'S-001',
      characterId: 'CH-001',
    });

    state = passResponse(state, 'P2');

    expect(state.declarationStack.items).toHaveLength(0);
    expect(state.log.some((line) => line.includes('[resolve start]'))).toBe(true);
  });

  it('blocks the 101st declaration in this implementation', () => {
    let state = createEmptyGameState();

    for (let i = 0; i < MAX_DECLARATION_STACK_DEPTH; i += 1) {
      const declaredBy = i % 2 === 0 ? 'P1' : 'P2';
      state = declare(state, {
        type: 'effectDeclaration',
        declaredBy,
        effectId: `E-${i}`,
        sourceType: 'rule',
      });
    }

    const before = state.declarationStack.items.length;

    state = declare(state, {
      type: 'effectDeclaration',
      declaredBy: 'P1',
      effectId: 'E-overflow',
      sourceType: 'rule',
    });

    expect(before).toBe(MAX_DECLARATION_STACK_DEPTH);
    expect(state.declarationStack.items.length).toBe(MAX_DECLARATION_STACK_DEPTH);
    expect(state.log[state.log.length - 1]).toContain('cannot exceed 100');
  });
});