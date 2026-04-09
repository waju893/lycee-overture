import type { EngineEvent, PlayerID } from '../GameTypes';
import { isOpponentAbility, isOpponentEffect } from './EffectSource';

export type TriggerConditionKind =
  | 'destroyedByOpponentEffect'
  | 'destroyedByOpponentAbility';

export function matchesTriggeredByCause(
  condition: TriggerConditionKind,
  event: EngineEvent,
  selfPlayerId: PlayerID,
): boolean {
  switch (condition) {
    case 'destroyedByOpponentEffect':
      return event.type === 'CARD_DESTROYED' && isOpponentEffect(event, selfPlayerId);
    case 'destroyedByOpponentAbility':
      return event.type === 'CARD_DESTROYED' && isOpponentAbility(event, selfPlayerId);
    default:
      return false;
  }
}
