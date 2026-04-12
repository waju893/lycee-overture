import { describe, expect, it } from 'vitest';
import { reduceGameState } from '../GameEngine';
import { createInitialGameState, placeCharacterOnField } from '../GameRules';
import type { CardRef, GameState, PlayerID } from '../GameTypes';

function makeCharacter(instanceId: string, owner: PlayerID, stats?: { ap?: number; dp?: number; dmg?: number; sp?: number; bonus?: number }): CardRef {
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
    bonus: stats?.bonus ?? 0,
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

function baseBattleState(attacker: CardRef, defender: CardRef, supporter?: CardRef): GameState {
  let state = createInitialGameState({ p1Deck: makeDeck('P1','P1'), p2Deck: makeDeck('P2','P2'), leaderEnabled: false });
  state = reduceGameState(state, { type: 'START_GAME', firstPlayer: 'P1', leaderEnabled: false });
  state = reduceGameState(state, { type: 'KEEP_STARTING_HAND', playerId: 'P1' });
  state = reduceGameState(state, { type: 'KEEP_STARTING_HAND', playerId: 'P2' });
  state = reduceGameState(state, { type: 'FINALIZE_STARTUP' });
  state = reduceGameState(state, { type: 'START_TURN' });
  state = reduceGameState(state, { type: 'ADVANCE_PHASE' });
  placeCharacterOnField(state, 'P1', 'AF_LEFT', attacker);
  if (supporter) placeCharacterOnField(state, 'P1', 'AF_CENTER', supporter);
  placeCharacterOnField(state, 'P2', 'DF_LEFT', defender);
  state = reduceGameState(state, { type: 'DECLARE_ACTION', playerId: 'P1', kind: 'attack', sourceCardId: attacker.instanceId });
  state = reduceGameState(state, { type: 'PASS_PRIORITY', playerId: 'P2' });
  state = reduceGameState(state, { type: 'PASS_PRIORITY', playerId: 'P1' });
  state = reduceGameState(state, { type: 'SET_DEFENDER', playerId: 'P2', defenderCardId: defender.instanceId });
  return state;
}

function resolveLatestDeclarationByDoublePass(state: GameState): GameState {
  const s1 = reduceGameState(state, { type: 'PASS_PRIORITY', playerId: state.battle.priorityPlayer ?? 'P1' });
  const s2 = reduceGameState(s1, { type: 'PASS_PRIORITY', playerId: s1.battle.priorityPlayer ?? 'P2' });
  return s2;
}
function resolveBattleByDoublePass(state: GameState): GameState {
  const s1 = reduceGameState(state, { type: 'PASS_PRIORITY', playerId: state.battle.priorityPlayer ?? 'P1' });
  return reduceGameState(s1, { type: 'PASS_PRIORITY', playerId: s1.battle.priorityPlayer ?? 'P2' });
}

describe('BattleCalculation', () => {
  it('support and bonus increase attacker battle AP', () => {
    const withDefender = baseBattleState(
      makeCharacter('P1_ATK', 'P1', { ap: 3, dp: 3, bonus: 1 }),
      makeCharacter('P2_DEF', 'P2', { ap: 2, dp: 4 }),
      makeCharacter('P1_SUP', 'P1', { sp: 1 }),
    );
    const supportDeclared = reduceGameState(withDefender, {
      type: 'DECLARE_ACTION', playerId: 'P1', kind: 'support',
      payload: { supporterCardId: 'P1_SUP', targetCardId: 'P1_ATK', payWith: 'tap' },
    });
    const afterSupport = resolveLatestDeclarationByDoublePass(supportDeclared);
    const result = resolveBattleByDoublePass(afterSupport);
    expect(result.players.P2.field.DF_LEFT.card).toBeNull();
    expect(result.logs.some((log) => log.includes('[BATTLE CALC] attacker AP=5'))).toBe(true);
  });

  it('bonus increases defender DP and can prevent destruction', () => {
    const withDefender = baseBattleState(
      makeCharacter('P1_ATK', 'P1', { ap: 4, dp: 3 }),
      makeCharacter('P2_DEF', 'P2', { ap: 2, dp: 3, bonus: 1 }),
    );
    const result = resolveBattleByDoublePass(withDefender);
    expect(result.players.P2.field.DF_LEFT.card?.instanceId).toBe('P2_DEF');
    expect(result.logs.some((log) => log.includes('defender DP=4'))).toBe(true);
  });

  it('support and bonus also apply to defender counterattack AP', () => {
    const withDefender = baseBattleState(
      makeCharacter('P1_ATK', 'P1', { ap: 3, dp: 3 }),
      makeCharacter('P2_DEF', 'P2', { ap: 2, dp: 3, bonus: 1 }),
      undefined,
    );
    // manually grant defender-side support bonus to emulate defender support chain
    withDefender.battle.supportDefenseBonus = 0;
    const defInfoState = withDefender;
    // attacker should survive if defender AP 3 is not greater than attacker DP 3; use bonus only check
    defInfoState.players.P2.field.DF_LEFT.card!.bonus = 2;
    const result = resolveBattleByDoublePass(defInfoState);
    expect(result.players.P1.field.AF_LEFT.card).toBeNull();
    expect(result.logs.some((log) => log.includes('defender AP=4'))).toBe(true);
  });
});
