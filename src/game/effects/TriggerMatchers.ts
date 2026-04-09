import type {
  EngineEvent,
  TriggerCauseCondition,
  TriggerCondition,
} from '../GameTypes';

function matchesTriggerCause(
  condition: TriggerCauseCondition | undefined,
  event: EngineEvent,
): boolean {
  if (!condition) return true;

  const cause = event.cause;
  if (!cause) return false;

  if (
    condition.relationToAffectedPlayer &&
    cause.relationToAffectedPlayer !== condition.relationToAffectedPlayer
  ) {
    return false;
  }

  if (typeof condition.isEffect === 'boolean' && cause.isEffect !== condition.isEffect) {
    return false;
  }

  if (typeof condition.isAbility === 'boolean' && cause.isAbility !== condition.isAbility) {
    return false;
  }

  if (condition.sourceType && cause.sourceType !== condition.sourceType) {
    return false;
  }

  if (condition.reasonType && cause.reasonType !== condition.reasonType) {
    return false;
  }

  return true;
}

export function matchesTriggerCondition(
  condition: TriggerCondition,
  event: EngineEvent,
): boolean {
  switch (condition.kind) {
    case 'destroyedByOpponentEffect':
      return (
        event.type === 'CARD_DESTROYED' &&
        matchesTriggerCause(
          {
            relationToAffectedPlayer: 'opponent',
            isEffect: true,
          },
          event,
        )
      );

    case 'destroyedByOpponentAbility':
      return (
        event.type === 'CARD_DESTROYED' &&
        matchesTriggerCause(
          {
            relationToAffectedPlayer: 'opponent',
            isAbility: true,
          },
          event,
        )
      );

    case 'destroyedByOpponentEventEffect':
      return (
        event.type === 'CARD_DESTROYED' &&
        matchesTriggerCause(
          {
            relationToAffectedPlayer: 'opponent',
            isEffect: true,
            sourceType: 'event',
          },
          event,
        )
      );

    case 'leftFieldByOpponentEffect':
      return (
        event.type === 'CARD_LEFT_FIELD' &&
        matchesTriggerCause(
          {
            relationToAffectedPlayer: 'opponent',
            isEffect: true,
          },
          event,
        )
      );

    case 'movedToHandByEffect':
      return (
        event.type === 'CARD_MOVED_TO_HAND' &&
        matchesTriggerCause(
          {
            isEffect: true,
          },
          event,
        )
      );

    case 'enteredFieldByRule':
      return (
        event.type === 'CARD_ENTERED_FIELD' &&
        matchesTriggerCause(
          {
            reasonType: 'rule',
          },
          event,
        )
      );

    case 'custom':
      return matchesTriggerCause(condition.cause, event);

    default:
      return false;
  }
}

export {
  matchesTriggerCause,
};

export function destroyedByOpponentEffect(event: EngineEvent): boolean {
  return matchesTriggerCondition({ kind: 'destroyedByOpponentEffect' }, event);
}

export function destroyedByOpponentAbility(event: EngineEvent): boolean {
  return matchesTriggerCondition({ kind: 'destroyedByOpponentAbility' }, event);
}

export function destroyedByOpponentEventEffect(event: EngineEvent): boolean {
  return matchesTriggerCondition({ kind: 'destroyedByOpponentEventEffect' }, event);
}

export function leftFieldByOpponentEffect(event: EngineEvent): boolean {
  return matchesTriggerCondition({ kind: 'leftFieldByOpponentEffect' }, event);
}

export function movedToHandByEffect(event: EngineEvent): boolean {
  return matchesTriggerCondition({ kind: 'movedToHandByEffect' }, event);
}

export function enteredFieldByRule(event: EngineEvent): boolean {
  return matchesTriggerCondition({ kind: 'enteredFieldByRule' }, event);
}
