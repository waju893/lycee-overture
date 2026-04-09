import type {
  CauseDescriptor,
  EngineEvent,
  PlayerID,
  TriggerCauseCondition,
  TriggerCondition,
  TriggerControllerScope,
} from '../GameTypes';

function matchesControllerScope(
  scope: TriggerControllerScope | undefined,
  controllerPlayerId: PlayerID | undefined,
  perspectivePlayerId: PlayerID,
): boolean {
  if (!scope || scope === 'any') return true;
  if (!controllerPlayerId) return false;
  if (scope === 'self') return controllerPlayerId === perspectivePlayerId;
  return controllerPlayerId !== perspectivePlayerId;
}

function matchesAffectedPlayerScope(
  scope: TriggerControllerScope | undefined,
  affectedPlayerId: PlayerID | undefined,
  perspectivePlayerId: PlayerID,
): boolean {
  if (!scope || scope === 'any') return true;
  if (!affectedPlayerId) return false;
  if (scope === 'self') return affectedPlayerId === perspectivePlayerId;
  return affectedPlayerId !== perspectivePlayerId;
}

export function matchesTriggerCause(
  cause: CauseDescriptor | undefined,
  condition: TriggerCauseCondition | undefined,
  perspectivePlayerId: PlayerID,
): boolean {
  if (!condition) return true;
  if (!cause) return false;

  if (!matchesControllerScope(condition.controller, cause.controllerPlayerId, perspectivePlayerId)) {
    return false;
  }

  if (condition.categories && condition.categories.length > 0) {
    if (!condition.categories.includes(cause.category)) return false;
  }

  if (condition.sourceKinds && condition.sourceKinds.length > 0) {
    if (!condition.sourceKinds.includes(cause.sourceKind)) return false;
  }

  if (condition.requireEffect === true && !cause.isEffect) return false;
  if (condition.requireAbility === true && !cause.isAbility) return false;

  return true;
}

export function matchesTriggerCondition(
  event: EngineEvent,
  condition: TriggerCondition,
  perspectivePlayerId: PlayerID,
): boolean {
  if (condition.eventTypes && condition.eventTypes.length > 0) {
    if (!condition.eventTypes.includes(event.type)) return false;
  }

  if (condition.operationKinds && condition.operationKinds.length > 0) {
    const kind = event.operation?.kind;
    if (!kind || !condition.operationKinds.includes(kind)) return false;
  }

  if (condition.cardId && event.cardId !== condition.cardId) {
    return false;
  }

  if (!matchesAffectedPlayerScope(condition.affectedPlayerScope, event.affectedPlayerId, perspectivePlayerId)) {
    return false;
  }

  return matchesTriggerCause(event.cause, condition.cause, perspectivePlayerId);
}

export function destroyedByOpponentEffect(cardId: string): TriggerCondition {
  return {
    eventTypes: ['CARD_DESTROYED'],
    operationKinds: ['destroy'],
    cardId,
    affectedPlayerScope: 'self',
    cause: {
      controller: 'opponent',
      requireEffect: true,
    },
  };
}

export function destroyedByOpponentAbility(cardId: string): TriggerCondition {
  return {
    eventTypes: ['CARD_DESTROYED'],
    operationKinds: ['destroy'],
    cardId,
    affectedPlayerScope: 'self',
    cause: {
      controller: 'opponent',
      requireAbility: true,
    },
  };
}

export function destroyedByOpponentEventEffect(cardId: string): TriggerCondition {
  return {
    eventTypes: ['CARD_DESTROYED'],
    operationKinds: ['destroy'],
    cardId,
    affectedPlayerScope: 'self',
    cause: {
      controller: 'opponent',
      categories: ['effect'],
      sourceKinds: ['event'],
      requireEffect: true,
    },
  };
}

export function leftFieldByOpponentEffect(cardId: string): TriggerCondition {
  return {
    eventTypes: ['CARD_LEFT_FIELD'],
    operationKinds: ['leaveField'],
    cardId,
    affectedPlayerScope: 'self',
    cause: {
      controller: 'opponent',
      requireEffect: true,
    },
  };
}

export function movedToHandByEffect(cardId: string, controller: TriggerControllerScope = 'any'): TriggerCondition {
  return {
    eventTypes: ['CARD_MOVED'],
    operationKinds: ['moveToHand'],
    cardId,
    cause: {
      controller,
      requireEffect: true,
    },
  };
}

export function enteredFieldByRule(cardId: string): TriggerCondition {
  return {
    eventTypes: ['CARD_ENTERED_FIELD'],
    operationKinds: ['enterFieldByRule'],
    cardId,
    cause: {
      categories: ['rule'],
    },
  };
}

export function battleInterrupted(): TriggerCondition {
  return {
    operationKinds: ['battleInterrupted'],
    cause: {
      categories: ['battle'],
    },
  };
}
