export type PlayerId = "P1" | "P2";
export type FieldSlot = string;

export type BattlePriorityPhase =
  | "ATTACK_DECLARED"
  | "PRIORITY_WINDOW"
  | "RESOLVING"
  | "FINISHED";

export interface BattlePriorityState {
  isActive: boolean;
  attackerPlayer: PlayerId;
  defenderPlayer: PlayerId;
  attackerSlot: FieldSlot;
  attackerCardId: string;
  defenderSlot: FieldSlot | null;
  defenderCardId: string | null;
  pendingDirectAttack: boolean;
  priorityPlayer: PlayerId;
  passedPlayers: PlayerId[];
  stackDepth: number;
  phase: BattlePriorityPhase;
}

export function createBattleWithOptionalDefender(params: {
  attackerPlayer: PlayerId;
  defenderPlayer: PlayerId;
  attackerSlot: FieldSlot;
  attackerCardId: string;
  defenderSlot?: FieldSlot | null;
  defenderCardId?: string | null;
  turnPlayer: PlayerId;
}): BattlePriorityState {
  const hasDefender = !!params.defenderSlot && !!params.defenderCardId;

  return {
    isActive: true,
    attackerPlayer: params.attackerPlayer,
    defenderPlayer: params.defenderPlayer,
    attackerSlot: params.attackerSlot,
    attackerCardId: params.attackerCardId,
    defenderSlot: hasDefender ? params.defenderSlot! : null,
    defenderCardId: hasDefender ? params.defenderCardId! : null,
    pendingDirectAttack: !hasDefender,
    priorityPlayer: params.turnPlayer,
    passedPlayers: [],
    stackDepth: 0,
    phase: "PRIORITY_WINDOW",
  };
}

export function passBattlePriority<T extends { battle: BattlePriorityState }>(
  state: T,
  player: PlayerId,
): T {
  if (!state.battle.isActive || state.battle.phase !== "PRIORITY_WINDOW") {
    return state;
  }

  if (state.battle.priorityPlayer !== player) {
    return state;
  }

  const alreadyPassed = state.battle.passedPlayers.includes(player);
  const nextPassed = alreadyPassed
    ? state.battle.passedPlayers
    : [...state.battle.passedPlayers, player];

  const other: PlayerId = player === "P1" ? "P2" : "P1";

  if (nextPassed.includes("P1") && nextPassed.includes("P2")) {
    return {
      ...state,
      battle: {
        ...state.battle,
        priorityPlayer: other,
        passedPlayers: nextPassed,
        phase: "RESOLVING",
      },
    };
  }

  return {
    ...state,
    battle: {
      ...state.battle,
      priorityPlayer: other,
      passedPlayers: nextPassed,
    },
  };
}

export function registerBattleDeclaration<T extends { battle: BattlePriorityState }>(
  state: T,
  player: PlayerId,
): T {
  if (!state.battle.isActive || state.battle.phase !== "PRIORITY_WINDOW") {
    return state;
  }

  if (state.battle.priorityPlayer !== player) {
    return state;
  }

  return {
    ...state,
    battle: {
      ...state.battle,
      stackDepth: state.battle.stackDepth + 1,
      passedPlayers: [],
    },
  };
}

export function resolveBattleAfterPriority<T extends {
  battle: BattlePriorityState;
  players: Record<string, { deck: unknown[]; field?: Record<string, { card?: { isTapped?: boolean } }> }>;
}>(state: T): T {
  if (!state.battle.isActive || state.battle.phase !== "RESOLVING") {
    return state;
  }

  const battle = state.battle;
  const players = { ...state.players };
  const attackerSide = players[battle.attackerPlayer];
  const defenderSide = players[battle.defenderPlayer];

  if (attackerSide?.field?.[battle.attackerSlot]?.card) {
    attackerSide.field[battle.attackerSlot].card = {
      ...attackerSide.field[battle.attackerSlot].card!,
      isTapped: true,
    };
  }

  if (battle.pendingDirectAttack || !battle.defenderSlot || !battle.defenderCardId) {
    const defenderDeck = [...defenderSide.deck];
    defenderDeck.splice(0, 2);
    players[battle.defenderPlayer] = {
      ...defenderSide,
      deck: defenderDeck,
    };

    return {
      ...state,
      players,
      battle: {
        ...battle,
        isActive: false,
        phase: "FINISHED",
      },
    };
  }

  return {
    ...state,
    players,
    battle: {
      ...battle,
      isActive: false,
      phase: "FINISHED",
    },
  };
}
