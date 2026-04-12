import type { EngineEvent, GameState, PlayerID } from '../GameTypes';

function sameCard(event: EngineEvent, playerId: PlayerID | undefined, cardId: string | undefined, type: string): boolean {
  return event.type === type && event.playerId === playerId && event.cardId === cardId;
}

function appendNormalizedEvent(state: GameState, event: EngineEvent): void {
  state.events.push(event);
}

function hasEventInRange(
  events: EngineEvent[],
  startIndex: number,
  playerId: PlayerID | undefined,
  cardId: string | undefined,
  type: string,
): boolean {
  for (let i = startIndex; i < events.length; i += 1) {
    if (sameCard(events[i], playerId, cardId, type)) {
      return true;
    }
  }
  return false;
}

/**
 * Lycee state normalization layer.
 *
 * It does not implement HP-style destruction.
 * Instead it normalizes already-produced engine events into Lycee semantics:
 * - battle destroy => ensure DOWN + DESTROY + LEFT_FIELD shape
 * - effect destroy => ensure DESTROY + LEFT_FIELD only
 * - field->discard destroy/move => ensure LEFT_FIELD exists
 */
export function normalizeLyceeStateEvents(state: GameState, startIndex: number): number {
  const producedStart = state.events.length;
  const sourceEvents = state.events.slice(startIndex);

  for (const event of sourceEvents) {
    if (event.type !== 'CARD_DESTROYED') {
      continue;
    }

    const playerId = event.playerId;
    const cardId = event.cardId;
    const destroyReason = String(event.metadata?.destroyReason ?? 'other');
    const isDown = Boolean(event.metadata?.isDown) || destroyReason === 'battle';

    if (isDown && !hasEventInRange(state.events, startIndex, playerId, cardId, 'CARD_DOWNED')) {
      appendNormalizedEvent(state, {
        type: 'CARD_DOWNED',
        playerId,
        affectedPlayerId: event.affectedPlayerId ?? playerId,
        cardId,
        cause: event.cause,
        metadata: {
          normalized: true,
          destroyReason,
        },
        operation: {
          kind: 'down',
          cardId,
          playerId,
          fromZone: 'field',
          toZone: 'discard',
        },
      });
    }

    if (!hasEventInRange(state.events, startIndex, playerId, cardId, 'CARD_LEFT_FIELD')) {
      appendNormalizedEvent(state, {
        type: 'CARD_LEFT_FIELD',
        playerId,
        affectedPlayerId: event.affectedPlayerId ?? playerId,
        cardId,
        cause: event.cause,
        metadata: {
          normalized: true,
          destroyReason,
        },
        operation: {
          kind: 'leaveField',
          cardId,
          playerId,
          fromZone: 'field',
          toZone: 'discard',
        },
      });
    }
  }

  return state.events.length - producedStart;
}
