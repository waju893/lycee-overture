import type { CardRef, CauseDescriptor, GameState, PlayerID } from '../GameTypes';
import { removeCardFromAllZones } from '../GameRules';

export interface StateRuleResult {
  changed: boolean;
  generatedEvents: Array<{
    type: string;
    playerId: PlayerID;
    cardId: string;
    cause: CauseDescriptor;
    metadata?: Record<string, unknown>;
    operation?: Record<string, unknown>;
  }>;
}

function makeRuleCause(detail: string, playerId?: PlayerID): CauseDescriptor {
  return {
    controller: playerId,
    relationToAffectedPlayer: 'any',
    causeKind: 'rule',
    sourceOwnerKind: 'rule',
    isEffect: false,
    isAbility: false,
    detail,
  };
}

function getAllFieldCards(state: GameState): Array<{ playerId: PlayerID; slot: string; card: CardRef }> {
  const out: Array<{ playerId: PlayerID; slot: string; card: CardRef }> = [];
  for (const playerId of ['P1', 'P2'] as const) {
    const field = state.players[playerId].field;
    for (const slot of Object.keys(field)) {
      const card = field[slot as keyof typeof field].card;
      if (card) {
        out.push({ playerId, slot, card });
      }
    }
  }
  return out;
}

/**
 * Minimal state-based rule engine.
 *
 * Current safe behavior:
 * - handles cards explicitly marked by effect/declaration code with:
 *   - card.pendingDestroy = true
 *   - card.pendingDown = true
 * - moves them to discard
 * - emits destroy/down/left-field style events
 *
 * This keeps existing attack/declaration code untouched while giving the engine
 * a single post-resolution sweep point.
 */
export function applyStateBasedRules(state: GameState): StateRuleResult {
  const result: StateRuleResult = {
    changed: false,
    generatedEvents: [],
  };

  for (const { playerId, card } of getAllFieldCards(state)) {
    const anyCard = card as CardRef & {
      pendingDestroy?: boolean;
      pendingDown?: boolean;
      pendingDestroyReason?: 'battle' | 'effect' | 'rule' | 'other';
    };

    if (!anyCard.pendingDestroy && !anyCard.pendingDown) {
      continue;
    }

    const removed = removeCardFromAllZones(state.players[playerId], card.instanceId);
    if (!removed) {
      continue;
    }

    removed.location = 'discard';
    state.players[playerId].discard.push(removed);

    const destroyReason = anyCard.pendingDestroyReason ?? (anyCard.pendingDown ? 'battle' : 'effect');
    const cause = makeRuleCause('stateBasedRules', playerId);

    result.generatedEvents.push({
      type: 'CARD_DESTROYED',
      playerId,
      cardId: removed.instanceId,
      cause,
      operation: {
        kind: 'destroy',
        cardId: removed.instanceId,
        playerId,
        fromZone: 'field',
        toZone: 'discard',
      },
      metadata: {
        isDown: Boolean(anyCard.pendingDown),
        destroyReason,
      },
    });

    if (anyCard.pendingDown) {
      result.generatedEvents.push({
        type: 'CARD_DOWNED',
        playerId,
        cardId: removed.instanceId,
        cause,
        operation: {
          kind: 'down',
          cardId: removed.instanceId,
          playerId,
          fromZone: 'field',
          toZone: 'discard',
        },
        metadata: {
          destroyReason,
        },
      });
    }

    result.generatedEvents.push({
      type: 'CARD_LEFT_FIELD',
      playerId,
      cardId: removed.instanceId,
      cause,
      operation: {
        kind: 'leaveField',
        cardId: removed.instanceId,
        playerId,
        fromZone: 'field',
        toZone: 'discard',
      },
      metadata: {
        destroyReason,
      },
    });

    delete anyCard.pendingDestroy;
    delete anyCard.pendingDown;
    delete anyCard.pendingDestroyReason;

    result.changed = true;
  }

  return result;
}
