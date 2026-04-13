import { describe, expect, it } from 'vitest';
import type { CardRef, FieldSlot, PlayerID } from '../GameTypes';
import type { StorageAwareGameState } from '../storage/CardStorageTypes';
import {
  createCardStorageIfNeededFromEffect,
  ensureCardStorage,
  ensureSpecialZones,
  getVisibleCardStorages,
  moveCardBetweenZones,
} from '../storage/CardStorageEngine';

function makeCard(instanceId: string): CardRef {
  return {
    instanceId,
    cardNo: instanceId,
    name: instanceId,
    location: 'hand',
    cost: 0,
    ap: 0,
    dp: 0,
    sp: 0,
    dmg: 0,
    revealed: true,
  } as CardRef;
}

function makeEmptyField() {
  const slots: FieldSlot[] = ['AF_LEFT', 'AF_CENTER', 'AF_RIGHT', 'DF_LEFT', 'DF_CENTER', 'DF_RIGHT'];
  return Object.fromEntries(slots.map((slot) => [slot, { card: null }])) as any;
}

function makeState(): StorageAwareGameState {
  return {
    players: {
      P1: { hand: [], deck: [], discard: [], field: makeEmptyField() },
      P2: { hand: [], deck: [], discard: [], field: makeEmptyField() },
    },
  } as StorageAwareGameState;
}

describe('CardStorageEngine', () => {
  it('creates per-player card storages independently', () => {
    const state = makeState();
    const p1 = ensureCardStorage(state, 'P1' as PlayerID, 'sea_token', { label: '바다의 증표' });
    const p2 = ensureCardStorage(state, 'P2' as PlayerID, 'sea_token', { label: '바다의 증표' });

    expect(p1.id).toBe('P1:sea_token');
    expect(p2.id).toBe('P2:sea_token');
    expect(p1.id).not.toBe(p2.id);
  });

  it('keeps card storage after source card leaves field', () => {
    const state = makeState();
    createCardStorageIfNeededFromEffect(state, {
      playerId: 'P1',
      storageKey: 'moon_archive',
      label: '달의 서고',
      createdByCardId: 'SOURCE_1',
    });

    expect(state.players.P1.cardStorages?.['P1:moon_archive']).toBeTruthy();
    expect(state.players.P1.cardStorages?.['P1:moon_archive']?.cards.length).toBe(0);
  });

  it('moves cards between setAside, removedFromGame, and cardStorage', () => {
    const state = makeState();
    ensureSpecialZones(state, 'P1');
    ensureCardStorage(state, 'P1', 'sea_token', { label: '바다의 증표' });

    const card = makeCard('C1');
    state.players.P1.setAside!.push(card);

    moveCardBetweenZones(state, {
      cardId: 'C1',
      from: { kind: 'setAside', playerId: 'P1' },
      to: { kind: 'cardStorage', playerId: 'P1', storageId: 'P1:sea_token' },
    });

    expect(state.players.P1.setAside).toHaveLength(0);
    expect(state.players.P1.cardStorages?.['P1:sea_token']?.cards[0]?.instanceId).toBe('C1');

    moveCardBetweenZones(state, {
      cardId: 'C1',
      from: { kind: 'cardStorage', playerId: 'P1', storageId: 'P1:sea_token' },
      to: { kind: 'removedFromGame', playerId: 'P1' },
    });

    expect(state.players.P1.cardStorages?.['P1:sea_token']?.cards).toHaveLength(0);
    expect(state.players.P1.removedFromGame?.[0]?.instanceId).toBe('C1');
  });

  it('supports private storage visibility', () => {
    const state = makeState();
    ensureCardStorage(state, 'P1', 'secret_box', {
      label: '비밀 상자',
      visibility: 'private',
    });
    state.players.P1.cardStorages!['P1:secret_box'].cards.push(makeCard('SECRET_1'));

    const ownerView = getVisibleCardStorages(state, 'P1', 'P1');
    const enemyView = getVisibleCardStorages(state, 'P2', 'P1');

    expect(ownerView[0].cards[0].instanceId).toBe('SECRET_1');
    expect(enemyView[0].cards[0].name).toBe('HIDDEN');
  });
});
