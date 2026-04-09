import { describe, expect, it } from 'vitest';

import type { EngineEvent } from '../GameTypes';
import {
  destroyedByOpponentAbility,
  destroyedByOpponentEffect,
  destroyedByOpponentEventEffect,
  enteredFieldByRule,
  leftFieldByOpponentEffect,
  matchesTriggerCondition,
  movedToHandByEffect,
} from '../effects/TriggerMatchers';

const opponentAbilityDestroy: EngineEvent = {
  type: 'CARD_DESTROYED',
  cardId: 'P1_CARD',
  affectedPlayerId: 'P1',
  cause: {
    controllerPlayerId: 'P2',
    relationToAffectedPlayer: 'opponent',
    category: 'ability',
    sourceKind: 'character',
    sourceCardId: 'P2_CHAR',
    isEffect: true,
    isAbility: true,
  },
  operation: {
    kind: 'destroy',
    fromZone: 'field',
  },
};

const opponentEventDestroy: EngineEvent = {
  ...opponentAbilityDestroy,
  cause: {
    controllerPlayerId: 'P2',
    relationToAffectedPlayer: 'opponent',
    category: 'effect',
    sourceKind: 'event',
    sourceCardId: 'P2_EVENT',
    isEffect: true,
    isAbility: false,
  },
};

describe('TriggerMatchers', () => {
  it('상대의 효과로 파기 트리거는 상대 캐릭터 능력 파기도 포함한다', () => {
    expect(matchesTriggerCondition(opponentAbilityDestroy, destroyedByOpponentEffect('P1_CARD'), 'P1')).toBe(true);
  });

  it('상대의 능력으로 파기 트리거는 상대 캐릭터 효과에만 반응한다', () => {
    expect(matchesTriggerCondition(opponentAbilityDestroy, destroyedByOpponentAbility('P1_CARD'), 'P1')).toBe(true);
    expect(matchesTriggerCondition(opponentEventDestroy, destroyedByOpponentAbility('P1_CARD'), 'P1')).toBe(false);
  });

  it('상대의 이벤트 효과로 파기 트리거는 이벤트만 반응한다', () => {
    expect(matchesTriggerCondition(opponentEventDestroy, destroyedByOpponentEventEffect('P1_CARD'), 'P1')).toBe(true);
    expect(matchesTriggerCondition(opponentAbilityDestroy, destroyedByOpponentEventEffect('P1_CARD'), 'P1')).toBe(false);
  });

  it('장을 떠남 / 손패 이동 / 룰 등장도 같은 방식으로 매칭할 수 있다', () => {
    const leaveFieldEvent: EngineEvent = {
      type: 'CARD_LEFT_FIELD',
      cardId: 'P1_CARD',
      affectedPlayerId: 'P1',
      cause: opponentEventDestroy.cause,
      operation: {
        kind: 'leaveField',
        fromZone: 'field',
      },
    };
    const moveToHandEvent: EngineEvent = {
      type: 'CARD_MOVED',
      cardId: 'P1_CARD',
      affectedPlayerId: 'P1',
      cause: {
        controllerPlayerId: 'P1',
        relationToAffectedPlayer: 'self',
        category: 'effect',
        sourceKind: 'item',
        sourceCardId: 'P1_ITEM',
        isEffect: true,
        isAbility: false,
      },
      operation: {
        kind: 'moveToHand',
        fromZone: 'field',
        toZone: 'hand',
      },
    };
    const ruleEnterEvent: EngineEvent = {
      type: 'CARD_ENTERED_FIELD',
      cardId: 'P1_CARD',
      affectedPlayerId: 'P1',
      cause: {
        controllerPlayerId: 'P1',
        relationToAffectedPlayer: 'self',
        category: 'rule',
        sourceKind: 'rule',
        isEffect: false,
        isAbility: false,
      },
      operation: {
        kind: 'enterFieldByRule',
        fromZone: 'hand',
        toZone: 'field',
      },
    };

    expect(matchesTriggerCondition(leaveFieldEvent, leftFieldByOpponentEffect('P1_CARD'), 'P1')).toBe(true);
    expect(matchesTriggerCondition(moveToHandEvent, movedToHandByEffect('P1_CARD', 'self'), 'P1')).toBe(true);
    expect(matchesTriggerCondition(ruleEnterEvent, enteredFieldByRule('P1_CARD'), 'P1')).toBe(true);
  });
});
