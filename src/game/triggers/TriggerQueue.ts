import type {
  CardRef,
  EngineEvent,
  FieldSlot,
  GameState,
  TriggerCandidate,
  TriggerTemplate,
} from '../GameTypes';
import { matchesTriggerCondition } from '../effects/TriggerMatchers';

function getAllCardsWithTriggers(state: GameState): CardRef[] {
  const cards: CardRef[] = [];

  for (const playerId of ['P1', 'P2'] as const) {
    const player = state.players[playerId];
    if (!player) continue;

    for (const card of player.hand ?? []) {
      if (card.triggerTemplates?.length) cards.push(card);
    }

    for (const card of player.discard ?? []) {
      if (card.triggerTemplates?.length) cards.push(card);
    }

    for (const card of player.deck ?? []) {
      if (card.triggerTemplates?.length) cards.push(card);
    }

    for (const slot of Object.keys(player.field ?? {}) as FieldSlot[]) {
      const card = player.field[slot]?.card;
      if (card?.triggerTemplates?.length) cards.push(card);
    }
  }

  return cards;
}

function matchesLegacyCondition(event: EngineEvent, condition: any): boolean {
  if (!condition) return false;

  if (condition.eventType && event.type !== condition.eventType) {
    return false;
  }

  const eventCause = event.cause;
  const expectedCause = condition.cause;

  if (expectedCause) {
    if (!eventCause) return false;

    if (
      expectedCause.relationToAffectedPlayer &&
      eventCause.relationToAffectedPlayer !== expectedCause.relationToAffectedPlayer
    ) {
      return false;
    }

    if (expectedCause.causeKind) {
      const actualCauseKind =
        eventCause.causeKind ??
        (eventCause as any).category;
      if (actualCauseKind !== expectedCause.causeKind) {
        return false;
      }
    }

    if (expectedCause.sourceOwnerKind) {
      const actualSourceOwnerKind =
        eventCause.sourceOwnerKind ??
        (eventCause as any).sourceKind ??
        (eventCause as any).sourceType;
      if (actualSourceOwnerKind !== expectedCause.sourceOwnerKind) {
        return false;
      }
    }

    if (
      typeof expectedCause.requireAbility === 'boolean' &&
      Boolean(eventCause.isAbility) !== expectedCause.requireAbility
    ) {
      return false;
    }

    if (
      typeof expectedCause.requireEffect === 'boolean' &&
      Boolean(eventCause.isEffect) !== expectedCause.requireEffect
    ) {
      return false;
    }
  }

  return true;
}

function matchesTemplate(
  event: EngineEvent,
  template: TriggerTemplate,
  viewer: 'P1' | 'P2',
): boolean {
  const condition = template?.condition;
  if (!condition) return false;

  if (typeof condition.kind === 'string' || condition.cardId || condition.relation || condition.category) {
    return matchesTriggerCondition(event, condition, viewer);
  }

  return matchesLegacyCondition(event, condition);
}

function buildTriggerCandidate(
  template: TriggerTemplate,
  card: CardRef,
  event: EngineEvent,
  eventIndex: number,
): TriggerCandidate {
  return {
    triggerId: template.id,
    sourceCardId: card.instanceId,
    controller: card.owner,
    condition: template.condition,
    sourceEventType: event.type,
    sourceEventIndex: eventIndex,
    effectId: template.effectId,
    optional: template.optional,
    description: template.description,
    event,
    template,
  };
}

export function enqueueTriggerCandidates(state: GameState, event: EngineEvent): void {
  const candidates: TriggerCandidate[] = [];
  const cards = getAllCardsWithTriggers(state);
  const eventIndex = Math.max(0, state.events.length - 1);

  for (const card of cards) {
    for (const template of card.triggerTemplates ?? []) {
      if (matchesTemplate(event, template, card.owner)) {
        candidates.push(buildTriggerCandidate(template, card, event, eventIndex));
      }
    }
  }

  if (candidates.length > 0) {
    if (state.triggerQueue.isResolving) {
      state.triggerQueue.pendingGroups.unshift(candidates);
      state.logs.push(`[TRIGGER QUEUE] nested push group size=${candidates.length}`);
      state.log = state.logs;
    } else {
      state.triggerQueue.pendingGroups.push(candidates);
      state.logs.push(`[TRIGGER QUEUE] push group size=${candidates.length}`);
      state.log = state.logs;
    }
  }
}
