import type {
  CardRef,
  DeclarationStackArray,
  FieldCell,
  FieldSlot,
  GameState,
  PlayerState,
} from "../GameTypes";

function syncDeclarationStack(stack: DeclarationStackArray): DeclarationStackArray {
  stack.items = stack;
  return stack;
}

function cloneCard(card: CardRef): CardRef {
  return {
    ...card,
    chargeCards: card.chargeCards ? card.chargeCards.map(cloneCard) : undefined,
  };
}

function cloneFieldCell(cell: FieldCell): FieldCell {
  return {
    ...cell,
    card: cell.card ? cloneCard(cell.card) : null,
  };
}

function clonePlayerState(player: PlayerState): PlayerState {
  const slots = Object.keys(player.field) as FieldSlot[];
  const field = {} as PlayerState["field"];

  for (const slot of slots) {
    field[slot] = cloneFieldCell(player.field[slot]);
  }

  return {
    ...player,
    deck: player.deck.map(cloneCard),
    hand: player.hand.map(cloneCard),
    discard: player.discard.map(cloneCard),
    field,
  };
}

export function cloneState(state: GameState): GameState {
  const declarationStack = syncDeclarationStack([
    ...state.declarationStack.map((declaration) => ({
      ...declaration,
      targetSlots: declaration.targetSlots ? [...declaration.targetSlots] : undefined,
      targetCardIds: declaration.targetCardIds ? [...declaration.targetCardIds] : undefined,
      payload: declaration.payload ? { ...declaration.payload } : undefined,
    })),
  ] as unknown as DeclarationStackArray);

  declarationStack.limit = state.declarationStack.limit;
  declarationStack.activeResponseWindow = state.declarationStack.activeResponseWindow
    ? { ...state.declarationStack.activeResponseWindow }
    : undefined;

  return {
    ...state,
    players: {
      P1: clonePlayerState(state.players.P1),
      P2: clonePlayerState(state.players.P2),
    },
    startup: {
      ...state.startup,
      decisions: { ...state.startup.decisions },
    },
    turn: { ...state.turn },
    battle: { ...state.battle },
    declarationStack,
    triggerQueue: {
      pendingGroups: state.triggerQueue.pendingGroups.map((group) => [...group]),
    },
    logs: [...state.logs],
    log: [...state.logs],
    events: [...state.events.map((event) => ({ ...event }))],
    replayEvents: state.replayEvents.map((event) => ({
      ...event,
      payload: JSON.parse(JSON.stringify(event.payload)),
    })),
  };
}

export function syncLogs(state: GameState): void {
  state.log = state.logs;
}

export function appendLog(state: GameState, message: string): void {
  state.logs.push(message);
  syncLogs(state);
}
