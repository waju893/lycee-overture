
export const MAX_DECLARATION_STACK_DEPTH = 100;

export type PlayerID = 'P1' | 'P2';
export type PlayerId = PlayerID;

export type CardType = 'character' | 'event' | 'item' | 'area';
export type Zone =
  | 'deck'
  | 'hand'
  | 'field'
  | 'discard'
  | 'charge'
  | 'unknown';

export type FieldSlot =
  | 'AF_LEFT'
  | 'AF_CENTER'
  | 'AF_RIGHT'
  | 'DF_LEFT'
  | 'DF_CENTER'
  | 'DF_RIGHT';

export type TurnPhase = 'startup' | 'wakeup' | 'main' | 'battle' | 'end';

export type TargetingMode = 'none' | 'declareTime';
export type DeclarationKind =
  | 'useCharacter'
  | 'useAbility'
  | 'attack'
  | 'chargeCharacter';

export interface CardRef {
  instanceId: string;
  cardNo: string;
  name: string;
  owner: PlayerID;
  cardType: CardType;
  sameNameKey?: string;
  ap?: number;
  dp?: number;
  dmg?: number;
  power?: number;
  damage?: number;
  hp?: number;
  isTapped?: boolean;
  canAttack?: boolean;
  canBlock?: boolean;
  revealed?: boolean;
  location?: Zone | string;
  isLeader?: boolean;
  chargeCards?: CardRef[];
}

export interface FieldCell {
  card: CardRef | null;
}

export type PlayerField = Record<FieldSlot, FieldCell>;

export interface PlayerState {
  deck: CardRef[];
  hand: CardRef[];
  discard: CardRef[];
  field: PlayerField;
}

export interface ReplayEvent {
  type: string;
  payload: unknown;
}

export interface EngineEvent {
  type: string;
  playerId?: PlayerID;
  cardId?: string;
}

export interface LegacyDeclaration {
  id: string;
  playerId: PlayerID;
  kind: DeclarationKind;
  sourceCardId?: string;
  sourceEffectId?: string;
  targetSlots?: FieldSlot[];
  targetCardIds?: string[];
  targetingMode?: TargetingMode;
  payload?: Record<string, unknown>;
  responseToDeclarationId?: string;
}

export type DeclarationType =
  | 'cardDeclaration'
  | 'effectDeclaration'
  | 'skillDeclaration'
  | 'handDeclaration'
  | 'attackDeclaration'
  | 'moveDeclaration';

export interface Declaration {
  id: string;
  type: DeclarationType;
  declaredBy: PlayerID;
  status: 'pending' | 'awaitingResponse' | 'resolving' | 'resolved';
  isResponse: boolean;
  respondedToDeclarationId?: string;
  responseWindowOpen: boolean;
  canBeRespondedTo: boolean;
  cardId?: string;
  cardType?: CardType;
  zoneFrom?: string;
  declarationKind?: string;
  effectId?: string;
  sourceType?: string;
  skillId?: string;
  characterId?: string;
  handCardId?: string;
  abilityId?: string;
  attackerId?: string;
  attackColumn?: number;
  defenderId?: string;
  moverId?: string;
  moveKind?: string;
  from?: { row: number; column: number };
  to?: { row: number; column: number };
  swapWithCharacterId?: string;
  sourceCardId?: string;
  sourceCharacterId?: string;
  targets?: unknown[];
  metadata?: Record<string, unknown>;
  createdAt?: number;
}

export type DeclareActionInput =
  | {
      type: 'cardDeclaration';
      declaredBy: PlayerID;
      cardId: string;
      cardType: CardType;
      zoneFrom: string;
      declarationKind: 'characterSpawn' | 'eventUse' | 'itemEquip' | 'areaDeploy';
      sourceCardId?: string;
      targets?: unknown[];
      metadata?: Record<string, unknown>;
    }
  | {
      type: 'effectDeclaration';
      declaredBy: PlayerID;
      effectId: string;
      sourceType: 'card' | 'character' | 'area' | 'item' | 'rule';
      sourceCardId?: string;
      sourceCharacterId?: string;
      targets?: unknown[];
      metadata?: Record<string, unknown>;
    }
  | {
      type: 'skillDeclaration';
      declaredBy: PlayerID;
      skillId: string;
      characterId: string;
      sourceCardId?: string;
      targets?: unknown[];
      metadata?: Record<string, unknown>;
    }
  | {
      type: 'handDeclaration';
      declaredBy: PlayerID;
      handCardId: string;
      abilityId: string;
      sourceCardId?: string;
      targets?: unknown[];
      metadata?: Record<string, unknown>;
    }
  | {
      type: 'attackDeclaration';
      declaredBy: PlayerID;
      attackerId: string;
      attackColumn: number;
      defenderId?: string;
      targets?: unknown[];
      metadata?: Record<string, unknown>;
    }
  | {
      type: 'moveDeclaration';
      declaredBy: PlayerID;
      moverId: string;
      moveKind: 'step' | 'sidestep' | 'orderstep' | 'jump' | 'orderchange';
      from: { row: number; column: number };
      to?: { row: number; column: number };
      swapWithCharacterId?: string;
      sourceCardId?: string;
      targets?: unknown[];
      metadata?: Record<string, unknown>;
    };

export interface RuleViolation {
  code: string;
  message: string;
}

export interface ActiveResponseWindow {
  topDeclarationId: string;
  responderPlayerId: PlayerID;
}

export interface TriggerQueueState {
  pendingGroups: unknown[][];
}

export type DeclarationStackArray = LegacyDeclaration[] & {
  items: LegacyDeclaration[];
  limit: number;
  activeResponseWindow?: ActiveResponseWindow;
};

export interface GameState {
  players: Record<PlayerID, PlayerState>;
  startup: {
    active: boolean;
    startupFinished: boolean;
    leaderEnabled: boolean;
    firstPlayer?: PlayerID;
    decisions: Partial<Record<PlayerID, 'KEEP' | 'MULLIGAN'>>;
  };
  turn: {
    turnNumber: number;
    activePlayer: PlayerID;
    priorityPlayer: PlayerID;
    phase: TurnPhase;
    firstPlayer?: PlayerID;
  };
  battle: {
    isActive: boolean;
    attackerCardId?: string;
    attackerPlayerId?: PlayerID;
    defenderCardId?: string;
    defenderPlayerId?: PlayerID;
    attackColumn?: number;
    awaitingDefenderSelection?: boolean;
  };
  declarationStack: DeclarationStackArray;
  triggerQueue: TriggerQueueState;
  logs: string[];
  log: string[];
  events: EngineEvent[];
  replayEvents: ReplayEvent[];
}

export function getOpponentPlayerId(playerId: PlayerID): PlayerID {
  return playerId === 'P1' ? 'P2' : 'P1';
}

export function createEmptyField(): PlayerField {
  return {
    AF_LEFT: { card: null },
    AF_CENTER: { card: null },
    AF_RIGHT: { card: null },
    DF_LEFT: { card: null },
    DF_CENTER: { card: null },
    DF_RIGHT: { card: null },
  };
}
