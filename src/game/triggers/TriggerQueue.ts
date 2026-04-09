import type {
  CardRef,
  EngineEvent,
  FieldSlot,
  GameState,
  TriggerCandidate,
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

export function enqueueTriggerCandidates(state: GameState, event: EngineEvent): void {
  const candidates: TriggerCandidate[] = [];
  const cards = getAllCardsWithTriggers(state);

  for (const card of cards) {
    for (const template of card.triggerTemplates ?? []) {
      if (matchesTriggerCondition(template.condition, event)) {
        candidates.push({
          triggerId: template.triggerId,
          sourceCardId: card.instanceId,
          controller: card.owner,
          event,
          template,
        });
      }
    }
  }

  if (candidates.length > 0) {
    state.triggerQueue.pendingGroups.push(candidates);
  }
}
