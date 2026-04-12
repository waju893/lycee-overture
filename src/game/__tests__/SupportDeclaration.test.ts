import { describe, expect, it } from 'vitest';
import { reduceGameState } from '../GameEngine';
import { createInitialGameState, placeCharacterOnField } from '../GameRules';
import type { CardRef, GameState, PlayerID } from '../GameTypes';

function makeCharacter(instanceId: string, owner: PlayerID, stats?: { ap?: number; dp?: number; dmg?: number; sp?: number }): CardRef {
  return {
    instanceId,
    cardNo: instanceId,
    name: instanceId,
    owner,
    cardType: 'character',
    sameNameKey: instanceId,
    ap: stats?.ap ?? 3,
    dp: stats?.dp ?? 3,
    dmg: stats?.dmg ?? 1,
    sp: stats?.sp ?? 0,
    power: stats?.ap ?? 3,
    damage: stats?.dmg ?? 1,
    hp: stats?.dp ?? 3,
    isTapped: false,
    canAttack: true,
    canBlock: true,
    revealed: false,
    location: 'field',
  };
}

function makeDeck(owner: PlayerID, prefix: string): CardRef[] {
  return Array.from({ length: 60 }, (_, i) => makeCharacter(`${prefix}_${i+1}`, owner));
}

function buildBattleState(): GameState {
  let state = createInitialGameState({ p1Deck: makeDeck('P1','P1'), p2Deck: makeDeck('P2','P2'), leaderEnabled: false });
  state = reduceGameState(state, { type: 'START_GAME', firstPlayer: 'P1', leaderEnabled: false });
  state = reduceGameState(state, { type: 'KEEP_STARTING_HAND', playerId: 'P1' });
  state = reduceGameState(state, { type: 'KEEP_STARTING_HAND', playerId: 'P2' });
  state = reduceGameState(state, { type: 'FINALIZE_STARTUP' });
  state = reduceGameState(state, { type: 'START_TURN' });
  state = reduceGameState(state, { type: 'ADVANCE_PHASE' });

  placeCharacterOnField(state, 'P1', 'AF_CENTER', makeCharacter('P1_ATK', 'P1', { ap: 3, dp: 3, dmg: 2 }));
  placeCharacterOnField(state, 'P1', 'AF_LEFT', makeCharacter('P1_SUP_1', 'P1', { sp: 1 }));
  placeCharacterOnField(state, 'P1', 'AF_RIGHT', makeCharacter('P1_SUP_2', 'P1', { sp: 2 }));
  placeCharacterOnField(state, 'P2', 'DF_CENTER', makeCharacter('P2_DEF', 'P2', { ap: 2, dp: 3, dmg: 1 }));

  state = reduceGameState(state, { type: 'DECLARE_ACTION', playerId: 'P1', kind: 'attack', sourceCardId: 'P1_ATK' });
  state = reduceGameState(state, { type: 'PASS_PRIORITY', playerId: 'P2' });
  state = reduceGameState(state, { type: 'PASS_PRIORITY', playerId: 'P1' });
  state = reduceGameState(state, { type: 'SET_DEFENDER', playerId: 'P2', defenderCardId: 'P2_DEF' });
  return state;
}

function resolveLatestDeclarationByDoublePass(state: GameState): GameState {
  const s1 = reduceGameState(state, { type: 'PASS_PRIORITY', playerId: state.battle.priorityPlayer ?? 'P1' });
  const s2 = reduceGameState(s1, { type: 'PASS_PRIORITY', playerId: s1.battle.priorityPlayer ?? 'P2' });
  return s2;
}

describe('SupportDeclaration', () => {
  it('taps supporter immediately and grants AP to attacker on resolve', () => {
    const battleState = buildBattleState();
    const supportDeclared = reduceGameState(battleState, {
      type: 'DECLARE_ACTION',
      playerId: 'P1',
      kind: 'support',
      payload: { supporterCardId: 'P1_SUP_1', targetCardId: 'P1_ATK', payWith: 'tap' },
    });

    expect(supportDeclared.players.P1.field.AF_LEFT.card?.isTapped).toBe(true);
    expect(supportDeclared.logs.some((log) => log.includes('[SUPPORT COST] P1_SUP_1 tapped'))).toBe(true);

    const afterSupport = resolveLatestDeclarationByDoublePass(supportDeclared);
    expect(afterSupport.battle.supportAttackBonus).toBe(1);
  });

  it('allows chained supports from multiple adjacent supporters in the same battle', () => {
    const battleState = buildBattleState();
    const firstSupportDeclared = reduceGameState(battleState, {
      type: 'DECLARE_ACTION',
      playerId: 'P1',
      kind: 'support',
      payload: { supporterCardId: 'P1_SUP_1', targetCardId: 'P1_ATK', payWith: 'tap' },
    });
    const afterFirstSupport = resolveLatestDeclarationByDoublePass(firstSupportDeclared);

    const secondSupportDeclared = reduceGameState(afterFirstSupport, {
      type: 'DECLARE_ACTION',
      playerId: 'P1',
      kind: 'support',
      payload: { supporterCardId: 'P1_SUP_2', targetCardId: 'P1_ATK', payWith: 'tap' },
    });

    expect(secondSupportDeclared.players.P1.field.AF_RIGHT.card?.isTapped).toBe(true);

    const afterSecondSupport = resolveLatestDeclarationByDoublePass(secondSupportDeclared);
    expect(afterSecondSupport.battle.supportAttackBonus).toBe(3);
    expect(afterSecondSupport.battle.supportHistory?.length).toBe(2);
  });
});
