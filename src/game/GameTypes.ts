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
  | "pass";

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

  // 최소 엔진 구동용 확장 필드
  isLeader?: boolean;
  isTapped?: boolean;
  canAttack?: boolean;
  canBlock?: boolean;
  power?: number;
  damage?: number;
  hp?: number;
  location?: Zone;
  slot?: FieldSlot;
  revealed?: boolean;
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

  // 최소 엔진용 추가
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

  // 첫 턴 선공 1드로우 / 이후 2드로우 처리 보조
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
  rulingOverrides: RulingOverride[];
  winner: PlayerID | null;

  // 디버깅/테스트용
  seed?: number;
  lastResolvedDeclarationId?: string;
}