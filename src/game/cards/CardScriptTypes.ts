export type Timing =
  | "onUse"
  | "onEnter"
  | "onEnterFromHand"
  | "onLeave"
  | "onAttackDeclare"
  | "onDefendDeclare"
  | "onBattle"
  | "onTurnStart"
  | "onTurnEnd";

export type Duration =
  | "instant"
  | "untilEndOfTurn"
  | "whileOnField"
  | "permanent"
  | "custom";

export type ExecutionMode = "must" | "may" | "cannot";
export type PlayerRef = "self" | "opponent" | "turnPlayer" | "nonTurnPlayer";
export type SelectorSide = "self" | "opponent" | "any";
export type Zone = "deck" | "hand" | "trash" | "field" | "exile" | "charge" | "unknown";

export type Condition =
  | { type: "myTurn" }
  | { type: "opponentTurn" }
  | { type: "inBattle" }
  | { type: "ifSourceEnteredFromHand" }
  | { type: "ifDeckCountAtMost"; value: number }
  | { type: "ifDeckCountAtLeast"; value: number }
  | { type: "custom"; value: string };

export type TargetSelector =
  | { kind: "source" }
  | { kind: "lookedCards"; amount: number }
  | { kind: "player"; side: SelectorSide }
  | {
      kind: "character";
      side: SelectorSide;
      amount: number;
      attributeFilter?: string[];
      upTo?: boolean;
      random?: boolean;
    }
  | {
      kind: "card";
      side: SelectorSide;
      zone: Zone;
      amount: number;
      attributeFilter?: string[];
      upTo?: boolean;
      random?: boolean;
      faceUp?: boolean;
    };

export interface DrawAction {
  type: "draw";
  player: PlayerRef;
  amount: number;
}

export interface MoveCardAction {
  type: "moveCard";
  from: Zone;
  to: Zone;
  target: TargetSelector;
  amount?: number;
  upTo?: boolean;
  random?: boolean;
  faceUp?: boolean;
  position?: "top" | "bottom" | "default";
}

export interface ModifyStatAction {
  type: "modifyStat";
  target: TargetSelector;
  stat: "ap" | "dp" | "sp" | "dmg";
  amount: number;
  duration?: Duration;
  sourceTag?: string;
}

export interface ModifyPropertyAction {
  type: "modifyProperty";
  target: TargetSelector;
  property: string;
  operation: "set" | "add" | "remove";
  value: unknown;
  duration?: Duration;
}

export interface GrantAbilityAction {
  type: "grantAbility";
  target: TargetSelector;
  abilities: string[];
  duration?: Duration;
}

export interface RemoveAbilityAction {
  type: "removeAbility";
  target: TargetSelector;
  modeType: "one" | "all" | "originalOne" | "originalAll";
}

export interface ApplyStateAction {
  type: "applyState";
  target: TargetSelector;
  state: "tap" | "untap" | "down" | "cannotUntap" | "cannotTap";
  value?: boolean;
  duration?: Duration;
}

export interface DealDamageAction {
  type: "dealDamage";
  amount: number;
  damageKind: "deck" | "effect" | "battle";
  targetPlayer?: PlayerRef;
  targetCard?: TargetSelector;
}

export interface RecoverAction {
  type: "recover";
  zone: "deck" | "shield" | "life" | "resource";
  target: PlayerRef | TargetSelector;
  amount: number;
  upTo?: boolean;
  random?: boolean;
}

export interface ShuffleAction {
  type: "shuffle";
  player: PlayerRef;
  zone: "deck";
}

export interface LookCardsAction {
  type: "lookCards";
  player: PlayerRef;
  zone: Zone;
  amount: number;
  from: "top" | "bottom";
}

export interface ChooseAction {
  type: "choose";
  from: "lookedCards" | "zone" | "targets";
  amount: number;
  upTo?: boolean;
  destinationActions?: Action[];
}

export interface RevealAction {
  type: "reveal";
  target: PlayerRef | TargetSelector;
  zone?: Zone;
  amount?: number;
}

export interface PreventAction {
  type: "prevent";
  target: PlayerRef | TargetSelector;
  prevent: "response" | "gainStatModifier" | "loseStatModifier" | "move" | "useAbility";
  duration?: Duration;
}

export interface SequenceAction {
  type: "sequence";
  actions: Action[];
}

export interface ChargeAction {
  type: "charge";
  target: TargetSelector;
  amount: number;
  mode?: ExecutionMode;
}

export interface OptionalElseAction {
  type: "optionalElse";
  optionalActions: Action[];
  elseActions: Action[];
  prompt?: string;
}

export type Action =
  | DrawAction
  | MoveCardAction
  | ModifyStatAction
  | ModifyPropertyAction
  | GrantAbilityAction
  | RemoveAbilityAction
  | ApplyStateAction
  | DealDamageAction
  | RecoverAction
  | ShuffleAction
  | LookCardsAction
  | ChooseAction
  | RevealAction
  | PreventAction
  | SequenceAction
  | ChargeAction
  | OptionalElseAction;

export interface CardEffectScript {
  timing?: Timing;
  conditions?: Condition[];
  note?: string;
  actions: Action[];
}
