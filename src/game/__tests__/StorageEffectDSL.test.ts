import { describe, expect, it } from 'vitest';
import { createEmptyGameState } from '../GameEngine';
import {
  runStorageEffectStep,
  runStorageEffectSteps,
} from '../effects/StorageEffectStepRunner';
import type {
  StorageEffectStep,
  StorageRunnerContext,
} from '../effects/StorageEffectStepTypes';
import type { GameState } from '../GameTypes';
import {
  listCardStorageIds,
  countRemovedFromGame,
  countSetAside,
} from '../storage/CardStorageSelectors';

function createCard(instanceId: string, location: string) {
  return {
    instanceId,
    cardNo: `TEST-${instanceId}`,
    name: instanceId,
    owner: 'P1',
    controller: 'P1',
    location,
    revealed: location !== 'hand',
    isTapped: false,
    ap: 1,
    dp: 1,
    sp: 1,
  } as any;
}

function createBaseState(): GameState {
  const state = createEmptyGameState() as GameState;

  const c1 = createCard('c1', 'hand');
  const c2 = createCard('c2', 'discard');
  const c3 = createCard('c3', 'field');

  state.players.P1.hand = [c1];
  state.players.P1.deck = [];
  state.players.P1.discard = [c2];
  state.players.P1.removedFromGame = [] as any;
  state.players.P1.setAside = [] as any;
  state.players.P1.cardStorages = {} as any;

  state.players.P2.hand = [];
  state.players.P2.deck = [];
  state.players.P2.discard = [];
  state.players.P2.removedFromGame = [] as any;
  state.players.P2.setAside = [] as any;
  state.players.P2.cardStorages = {} as any;

  state.players.P1.field.AF_LEFT.card = c3;
  state.players.P1.field.AF_CENTER.card = null;
  state.players.P1.field.AF_RIGHT.card = null;
  state.players.P1.field.DF_LEFT.card = null;
  state.players.P1.field.DF_CENTER.card = null;
  state.players.P1.field.DF_RIGHT.card = null;

  state.players.P2.field.AF_LEFT.card = null;
  state.players.P2.field.AF_CENTER.card = null;
  state.players.P2.field.AF_RIGHT.card = null;
  state.players.P2.field.DF_LEFT.card = null;
  state.players.P2.field.DF_CENTER.card = null;
  state.players.P2.field.DF_RIGHT.card = null;

  return state;
}

function createBaseContext(): StorageRunnerContext {
  return {
    selfPlayerId: 'P1',
    opponentPlayerId: 'P2',
    ownerPlayerId: 'P1',
    controllerPlayerId: 'P1',
    thisCardId: 'c1',
    targetCardId: 'c2',
    chosenCardId: 'c3',
  };
}

describe('StorageEffectDSL', () => {
  it('ensureStorage creates a scoped storage', () => {
    const state = createBaseState();
    const context = createBaseContext();

    const step: StorageEffectStep = {
      type: 'ensureStorage',
      player: 'self',
      storageId: 'sea_token',
      label: '바다의 증표',
      visibility: 'public',
    };

    const result = runStorageEffectStep(state as any, step, context);
    const storageIds = listCardStorageIds(result.state as any, 'P1');

    expect(storageIds).toContain('P1:sea_token');
  });

  it('moveToRemovedFromGame moves a card into removedFromGame', () => {
    const state = createBaseState();
    const context = createBaseContext();

    const step: StorageEffectStep = {
      type: 'moveToRemovedFromGame',
      target: 'thisCard',
    };

    const result = runStorageEffectStep(state as any, step, context);
    expect(countRemovedFromGame(result.state as any, 'P1')).toBe(1);
  });

  it('moveToSetAside moves a card into setAside', () => {
    const state = createBaseState();
    const context = createBaseContext();

    const step: StorageEffectStep = {
      type: 'moveToSetAside',
      target: 'targetCard',
    };

    const result = runStorageEffectStep(state as any, step, context);
    expect(countSetAside(result.state as any, 'P1')).toBe(1);
  });

  it('moveToStorage auto-creates storage and moves card into it', () => {
    const state = createBaseState();
    const context = createBaseContext();

    const step: StorageEffectStep = {
      type: 'moveToStorage',
      player: 'self',
      storageId: 'moon_archive',
      target: 'chosenCard',
      visibility: 'public',
    };

    const result = runStorageEffectStep(state as any, step, context);
    const storageIds = listCardStorageIds(result.state as any, 'P1');

    expect(storageIds).toContain('P1:moon_archive');
  });

  it('moveFromStorage moves card from storage into discard', () => {
    const state = createBaseState();
    const context = createBaseContext();

    const setupSteps: StorageEffectStep[] = [
      {
        type: 'moveToStorage',
        player: 'self',
        storageId: 'moon_archive',
        target: 'chosenCard',
        visibility: 'public',
      },
      {
        type: 'moveFromStorage',
        player: 'self',
        storageId: 'moon_archive',
        to: 'discard',
        target: 'chosenCard',
      },
    ];

    const result = runStorageEffectSteps(state as any, setupSteps, context);
    const storageIds = listCardStorageIds(result.state as any, 'P1');

    expect(storageIds).toContain('P1:moon_archive');
  });
});
