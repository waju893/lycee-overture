import type { EngineEvent, TriggerCondition } from '../GameTypes';

type Viewer = 'P1' | 'P2';

function eventMatchesCard(event: EngineEvent, cardId?: string): boolean {
  if (!cardId) return true;
  return event.cardId === cardId;
}

function relationMatches(
  event: EngineEvent,
  expectedRelation: 'self' | 'opponent' | 'any' | undefined,
  viewer?: Viewer,
): boolean {
  if (!expectedRelation || expectedRelation === 'any') return true;

  const cause = event.cause;
  if (!cause) return false;

  if (cause.relationToAffectedPlayer) {
    return cause.relationToAffectedPlayer === expectedRelation;
  }

  if (!viewer || !event.affectedPlayerId || !cause.controllerPlayerId) return false;

  const actual =
    cause.controllerPlayerId === event.affectedPlayerId ? 'self' : 'opponent';
  return actual === expectedRelation;
}

function sourceKindMatches(
  event: EngineEvent,
  expectedSourceKind: string | undefined,
): boolean {
  if (!expectedSourceKind) return true;
  const cause = event.cause;
  if (!cause) return false;
  const actual = cause.sourceKind ?? cause.sourceType;
  return actual === expectedSourceKind;
}

function categoryMatches(
  event: EngineEvent,
  expectedCategory: string | undefined,
): boolean {
  if (!expectedCategory) return true;
  const cause = event.cause;
  if (!cause) return false;

  const actual = cause.category ?? cause.reasonType;

  if (expectedCategory === 'effect') {
    return actual === 'effect' || actual === 'ability' || cause.isEffect === true;
  }

  if (expectedCategory === 'ability') {
    return (
      actual === 'ability' ||
      (cause.isAbility === true && (cause.sourceKind ?? cause.sourceType) === 'character')
    );
  }

  if (expectedCategory === 'rule') {
    return actual === 'rule';
  }

  return actual === expectedCategory;
}

function operationKindMatches(
  event: EngineEvent,
  expectedOperationKind: string | undefined,
): boolean {
  if (!expectedOperationKind) return true;
  return event.operation?.kind === expectedOperationKind;
}

function internalMatches(
  event: EngineEvent,
  condition: TriggerCondition & {
    cardId?: string;
    relation?: 'self' | 'opponent' | 'any';
    category?: string;
    sourceKind?: string;
    operationKind?: string;
  },
  viewer?: Viewer,
): boolean {
  if (!eventMatchesCard(event, condition.cardId)) return false;
  if (!relationMatches(event, condition.relation, viewer)) return false;
  if (!categoryMatches(event, condition.category)) return false;
  if (!sourceKindMatches(event, condition.sourceKind)) return false;
  if (!operationKindMatches(event, condition.operationKind)) return false;

  switch (condition.kind) {
    case 'destroyedByOpponentEffect':
      return event.type === 'CARD_DESTROYED';

    case 'destroyedByOpponentAbility':
      return event.type === 'CARD_DESTROYED';

    case 'destroyedByOpponentEventEffect':
      return event.type === 'CARD_DESTROYED';

    case 'leftFieldByOpponentEffect':
      return event.type === 'CARD_LEFT_FIELD';

    case 'movedToHandByEffect':
      return (
        event.type === 'CARD_MOVED' &&
        (event.operation?.kind === 'moveToHand' || event.operation?.toZone === 'hand')
      );

    case 'enteredFieldByRule':
      return event.type === 'CARD_ENTERED_FIELD';

    case 'custom':
      return true;

    default:
      return false;
  }
}

export function matchesTriggerCondition(
  event: EngineEvent,
  condition: TriggerCondition,
  viewer?: Viewer,
): boolean {
  return internalMatches(
    event,
    condition as TriggerCondition & {
      cardId?: string;
      relation?: 'self' | 'opponent' | 'any';
      category?: string;
      sourceKind?: string;
      operationKind?: string;
    },
    viewer,
  );
}

export function destroyedByOpponentEffect(cardId?: string): TriggerCondition {
  return {
    kind: 'destroyedByOpponentEffect',
    cardId,
    relation: 'opponent',
    category: 'effect',
  } as TriggerCondition;
}

export function destroyedByOpponentAbility(cardId?: string): TriggerCondition {
  return {
    kind: 'destroyedByOpponentAbility',
    cardId,
    relation: 'opponent',
    category: 'ability',
    sourceKind: 'character',
  } as TriggerCondition;
}

export function destroyedByOpponentEventEffect(cardId?: string): TriggerCondition {
  return {
    kind: 'destroyedByOpponentEventEffect',
    cardId,
    relation: 'opponent',
    category: 'effect',
    sourceKind: 'event',
  } as TriggerCondition;
}

export function leftFieldByOpponentEffect(cardId?: string): TriggerCondition {
  return {
    kind: 'leftFieldByOpponentEffect',
    cardId,
    relation: 'opponent',
    category: 'effect',
  } as TriggerCondition;
}

export function movedToHandByEffect(
  cardId?: string,
  relation: 'self' | 'opponent' | 'any' = 'any',
): TriggerCondition {
  return {
    kind: 'movedToHandByEffect',
    cardId,
    relation,
    category: 'effect',
    operationKind: 'moveToHand',
  } as TriggerCondition;
}

export function enteredFieldByRule(cardId?: string): TriggerCondition {
  return {
    kind: 'enteredFieldByRule',
    cardId,
    category: 'rule',
    sourceKind: 'rule',
  } as TriggerCondition;
}
