// src/game/GameTypes.ts

export type PlayerID = "P1" | "P2";

export type Phase =
  | "startup"
  | "wakeup"
  | "warmup"
  | "main"
  | "end";

export type Zone =
  | "deck"
  | "hand"
  | "discard"
  | "leader"
  | "limbo"
  | "declared"
  | "field";

export type FieldSlot =
  | "AF_LEFT"
  | "AF_CENTER"
  | "AF_RIGHT"
  | "DF_LEFT"
  | "DF_CENTER"
  | "DF_RIGHT";

export type CardType = "character" | "event" | "item" | "area";

export type EffectType =
  | "declaration"
  | "triggered"
  | "continuous"
  | "cost"
  | "handDeclaration";

export type TargetingMode = "declareTime" | "resolutionTime" | "none";

export type TimingWindow =
  | "startup"
  | "main"
  | "response"
  | "battle"
  | "battleDeclaration"
  | "turnStart"
  | "turnEnd"
  | "phaseStart"
  | "phaseEnd";

export type DeclarationKind =
  | "useCharacter"
  | "useEvent"
  | "useItem"
  | "useArea"
  | "useAbility"
  | "useBasicAbility"
  | "useHandAbility"
  | "attack"
  | "support"
  | "pass"
  | "tapCharacter"
  | "untapCharacter"
  | "chargeCharacter"
  | "moveCharacter";

export type BasicAbilityKeyword =
  | "step"
  | "sidestep"
  | "orderstep"
  | "jump"
  | "aggressive"
  | "engage"
  | "assist"
  | "orderchange"
  | "recovery"
  | "leader"
  | "supporter"
  | "penalty"
  | "guts"
  | "bonus"
  | "charge"
  | "turnRecovery"
  | "surprise"
  | "principal"
  | "convert";

export interface CardRef {
  instanceId: string;
  cardNo: string;
  name: string;
  owner: PlayerID;
  cardType: CardType;
  cost?: string[];
  basicAbilities?: BasicAbilityKeyword[];
  effectTypes?: EffectType[];
  sameNameKey?: string;

  isLeader?: boolean;
  isTapped?: boolean;
  canAttack?: boolean;
  canBlock?: boolean;

  ap?: number;
  dp?: number;
  dmg?: number;

  power?: number;
  damage?: number;
  hp?: number;

  location?: Zone;
  slot?: FieldSlot;
  revealed?: boolean;
  chargeCards?: CardRef[];
}

export interface FieldCell {
  slot: FieldSlot;
  card: CardRef | null;
  attachedItem: CardRef | null;
  area: CardRef | null;
}

export type FieldState = Record<FieldSlot, FieldCell>;

export interface PlayerState {
  id: PlayerID;
  deck: CardRef[];
  hand: CardRef[];
  discard: CardRef[];
  leaderZone: CardRef[];
  limbo: CardRef[];
  declaredZone: CardRef[];
  field: FieldState;
}

export interface DeclaredTarget {
  kind: "card" | "field" | "player" | "none";
  playerId?: PlayerID;
  cardId?: string;
  slot?: FieldSlot;
}

export interface Declaration {
  id: string;
  playerId: PlayerID;
  kind: DeclarationKind;
  sourceCardId?: string;
  sourceEffectId?: string;
  targetingMode: TargetingMode;
  declaredTargets: DeclaredTarget[];
  payload?: Record<string, unknown>;
  paid?: boolean;
  committed?: boolean;
  resolved?: boolean;
  responseToDeclarationId?: string;
}

export interface TriggeredEffect {
  id: string;
  controller: PlayerID;
  sourceCardId?: string;
  label: string;
  payload?: Record<string, unknown>;
  optional?: boolean;
}

export interface BattleState {
  isActive: boolean;
  attackDeclarationId?: string;
  attackerPlayerId?: PlayerID;
  defenderPlayerId?: PlayerID;
  attackerCardId?: string;
  defenderCardId?: string | null;
  supportAttackers: string[];
  supportDefenders: string[];
  battleEndedByBothPass: boolean;
}

export interface StartupState {
  active: boolean;
  firstPlayer?: PlayerID;
  secondPlayer?: PlayerID;
  leaderEnabled: boolean;
  mulliganUsed: Record<PlayerID, boolean>;
  startupFinished: boolean;
  keepDecided: Record<PlayerID, boolean>;
  leaderRevealed: Record<PlayerID, string | null>;
  rerollCount: number;
}

export interface TurnState {
  turnNumber: number;
  activePlayer: PlayerID;
  phase: Phase;
  priorityPlayer: PlayerID;
  passedInRow: number;
  firstPlayerDrawFixed: boolean;
}

export interface UsageCounter {
  key: string;
  used: number;
  limit: number;
}

export interface RuleViolation {
  code: string;
  message: string;
  playerId?: PlayerID;
  cardId?: string;
}

export interface GameEvent {
  type: string;
  playerId?: PlayerID;
  cardId?: string;
  relatedCardId?: string;
  slot?: FieldSlot;
  amount?: number;
  payload?: Record<string, unknown>;
}

export interface ReplayEvent {
  turnNumber: number;
  playerId: PlayerID | "SYSTEM";
  actionType: string;
  payload: Record<string, unknown>;
  timestamp: number;
}

export interface ReplaySnapshot {
  id: string;
  savedAt: number;
  initialState: GameState;
  events: ReplayEvent[];
  winner: PlayerID | null;
}

export interface RulingOverride {
  sourceCardNo: string;
  sourceEffectId: string;
  targetingMode?: TargetingMode;
  canUseInBattle?: boolean;
  canUseAsResponse?: boolean;
}

export interface GameState {
  players: Record<PlayerID, PlayerState>;
  turn: TurnState;
  startup: StartupState;
  battle: BattleState;
  declarationStack: Declaration[];
  pendingTriggers: TriggeredEffect[];
  resolvingTriggerIds: string[];
  usageCounters: UsageCounter[];
  logs: string[];
  events: GameEvent[];
  replayEvents: ReplayEvent[];
  rulingOverrides: RulingOverride[];
  winner: PlayerID | null;
  seed?: number;
  lastResolvedDeclarationId?: string;
}
