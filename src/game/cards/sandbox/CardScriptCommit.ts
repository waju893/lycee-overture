import type { GameState } from '../../GameTypes';
import type { CardScriptIntent } from './CardScriptIntent';

export interface CardScriptCommitResult {
  state: GameState;
  appliedIntents: CardScriptIntent[];
  skippedIntents: Array<{
    intent: CardScriptIntent;
    reason: string;
  }>;
}

function appendLog(state: GameState, message: string): void {
  if (!state.logs) state.logs = [];
  state.logs.push(message);
  state.log = state.logs;
}

function cloneState(state: GameState): GameState {
  return {
    ...state,
    players: {
      P1: {
        ...state.players.P1,
        deck: [...state.players.P1.deck],
        hand: [...state.players.P1.hand],
        discard: [...state.players.P1.discard],
        removedFromGame: [...(((state.players.P1 as any).removedFromGame) ?? [])],
        setAside: [...(((state.players.P1 as any).setAside) ?? [])],
        cardStorages: { ...(((state.players.P1 as any).cardStorages) ?? {}) },
        field: {
          AF_LEFT: { ...state.players.P1.field.AF_LEFT, card: state.players.P1.field.AF_LEFT.card ? { ...state.players.P1.field.AF_LEFT.card } : null },
          AF_CENTER: { ...state.players.P1.field.AF_CENTER, card: state.players.P1.field.AF_CENTER.card ? { ...state.players.P1.field.AF_CENTER.card } : null },
          AF_RIGHT: { ...state.players.P1.field.AF_RIGHT, card: state.players.P1.field.AF_RIGHT.card ? { ...state.players.P1.field.AF_RIGHT.card } : null },
          DF_LEFT: { ...state.players.P1.field.DF_LEFT, card: state.players.P1.field.DF_LEFT.card ? { ...state.players.P1.field.DF_LEFT.card } : null },
          DF_CENTER: { ...state.players.P1.field.DF_CENTER, card: state.players.P1.field.DF_CENTER.card ? { ...state.players.P1.field.DF_CENTER.card } : null },
          DF_RIGHT: { ...state.players.P1.field.DF_RIGHT, card: state.players.P1.field.DF_RIGHT.card ? { ...state.players.P1.field.DF_RIGHT.card } : null },
        },
      },
      P2: {
        ...state.players.P2,
        deck: [...state.players.P2.deck],
        hand: [...state.players.P2.hand],
        discard: [...state.players.P2.discard],
        removedFromGame: [...(((state.players.P2 as any).removedFromGame) ?? [])],
        setAside: [...(((state.players.P2 as any).setAside) ?? [])],
        cardStorages: { ...(((state.players.P2 as any).cardStorages) ?? {}) },
        field: {
          AF_LEFT: { ...state.players.P2.field.AF_LEFT, card: state.players.P2.field.AF_LEFT.card ? { ...state.players.P2.field.AF_LEFT.card } : null },
          AF_CENTER: { ...state.players.P2.field.AF_CENTER, card: state.players.P2.field.AF_CENTER.card ? { ...state.players.P2.field.AF_CENTER.card } : null },
          AF_RIGHT: { ...state.players.P2.field.AF_RIGHT, card: state.players.P2.field.AF_RIGHT.card ? { ...state.players.P2.field.AF_RIGHT.card } : null },
          DF_LEFT: { ...state.players.P2.field.DF_LEFT, card: state.players.P2.field.DF_LEFT.card ? { ...state.players.P2.field.DF_LEFT.card } : null },
          DF_CENTER: { ...state.players.P2.field.DF_CENTER, card: state.players.P2.field.DF_CENTER.card ? { ...state.players.P2.field.DF_CENTER.card } : null },
          DF_RIGHT: { ...state.players.P2.field.DF_RIGHT, card: state.players.P2.field.DF_RIGHT.card ? { ...state.players.P2.field.DF_RIGHT.card } : null },
        },
      },
    },
    startup: {
      ...state.startup,
      decisions: { ...state.startup.decisions },
    },
    turn: { ...state.turn, passedPlayers: [...(state.turn.passedPlayers ?? [])] },
    battle: { ...state.battle, passedPlayers: [...(state.battle.passedPlayers ?? [])] },
    declarationStack: [...state.declarationStack] as any,
    triggerQueue: {
      pendingGroups: state.triggerQueue.pendingGroups.map((group) => [...group]),
      isResolving: state.triggerQueue.isResolving,
    },
    logs: [...state.logs],
    log: [...state.logs],
    events: [...state.events],
    replayEvents: [...state.replayEvents],
  };
}

function findFieldCard(state: GameState, cardId: string) {
  for (const playerId of ['P1', 'P2'] as const) {
    for (const slot of Object.keys(state.players[playerId].field) as Array<keyof typeof state.players.P1.field>) {
      const card = state.players[playerId].field[slot].card;
      if (card?.instanceId === cardId) {
        return { playerId, slot, card };
      }
    }
  }
  return null;
}

function commitDraw(state: GameState, intent: Extract<CardScriptIntent, { kind: 'draw' }>): boolean {
  let moved = 0;
  for (let i = 0; i < intent.count; i += 1) {
    const card = state.players[intent.playerId].deck.shift();
    if (!card) break;
    card.location = 'hand';
    state.players[intent.playerId].hand.push(card);
    moved += 1;
  }
  appendLog(state, `[CARD SCRIPT] draw ${moved} for ${intent.playerId}`);
  return moved > 0;
}

function commitTap(state: GameState, intent: Extract<CardScriptIntent, { kind: 'tap' }>): boolean {
  const found = findFieldCard(state, intent.cardId);
  if (!found) return false;
  found.card.isTapped = true;
  appendLog(state, `[CARD SCRIPT] tap ${intent.cardId}`);
  return true;
}

function commitUntap(state: GameState, intent: Extract<CardScriptIntent, { kind: 'untap' }>): boolean {
  const found = findFieldCard(state, intent.cardId);
  if (!found) return false;
  found.card.isTapped = false;
  appendLog(state, `[CARD SCRIPT] untap ${intent.cardId}`);
  return true;
}

function commitRevealTopCard(state: GameState, intent: Extract<CardScriptIntent, { kind: 'revealTopCard' }>): boolean {
  const card = state.players[intent.playerId].deck[0];
  if (!card) return false;
  appendLog(state, `[CARD SCRIPT] reveal top ${intent.playerId}: ${card.instanceId}`);
  return true;
}

function commitLog(state: GameState, intent: Extract<CardScriptIntent, { kind: 'log' }>): boolean {
  appendLog(state, `[CARD SCRIPT] ${intent.message}`);
  return true;
}

export function commitCardScriptIntents(
  state: GameState,
  intents: CardScriptIntent[],
): CardScriptCommitResult {
  const next = cloneState(state);
  const appliedIntents: CardScriptIntent[] = [];
  const skippedIntents: Array<{ intent: CardScriptIntent; reason: string }> = [];

  for (const intent of intents) {
    let ok = false;

    switch (intent.kind) {
      case 'draw':
        ok = commitDraw(next, intent);
        break;
      case 'tap':
        ok = commitTap(next, intent);
        break;
      case 'untap':
        ok = commitUntap(next, intent);
        break;
      case 'revealTopCard':
        ok = commitRevealTopCard(next, intent);
        break;
      case 'log':
        ok = commitLog(next, intent);
        break;
      default:
        ok = false;
    }

    if (ok) {
      appliedIntents.push(intent);
    } else {
      skippedIntents.push({
        intent,
        reason: `commit failed for ${intent.kind}`,
      });
    }
  }

  return {
    state: next,
    appliedIntents,
    skippedIntents,
  };
}


export default commitCardScriptIntents;
