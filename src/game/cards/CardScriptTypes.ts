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
export type SearchZone = "deck" | "trash" | "hand" | "field" | "removed";
export type UsageKind = "character" | "event" | "item" | "area";

export type TargetSelector =
  | { kind: "source" }
  | { kind: "lookedCards" }
  | {
      kind: "player";
      side: "self" | "opponent" | "either";
    }
  | {
      kind: "character";
      side: "self" | "opponent" | "either";
      amount: number;
      attributeFilter?: string[];
      tapped?: boolean;
    }
  | {
      kind: "card";
      side: "self" | "opponent" | "either";
      zone: "deck" | "hand" | "trash" | "field" | "exile" | "charge" | "unknown";
      amount: number;
      attributeFilter?: string[];
      exactName?: string;
      exactCardNo?: string;
      type?: UsageKind;
    };

export type Condition =
  | { type: "myTurn" }
  | { type: "opponentTurn" }
  | { type: "inBattle" }
  | { type: "ifSourceEnteredFromHand" }
  | { type: "ifDeckCountAtMost"; value: number }
  | { type: "ifDeckCountAtLeast"; value: number }
  | { type: "custom"; key: string; value?: unknown };

export interface DrawAction {
  type: "draw";
  player: PlayerRef;
  amount: number;
}

export interface MoveCardAction {
  type: "moveCard";
  target: TargetSelector;
  from: string;
  to: string;
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
  targetPlayer?: PlayerRef;
  targetCard?: TargetSelector;
  amount: number;
  damageKind: "deck" | "effect" | "battle";
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
  zone: string;
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
  zone?: string;
  amount?: number;
}

export interface PreventAction {
  type: "prevent";
  target: PlayerRef | TargetSelector;
  prevent:
    | "response"
    | "gainStatModifier"
    | "loseStatModifier"
    | "move"
    | "useAbility";
  duration?: Duration;
}

export interface SequenceAction {
  type: "sequence";
  actions: Action[];
}

export interface CardMatchRule {
  exactCardNo?: string;
  exactName?: string;
  nameIncludes?: string;
  type?: UsageKind;
  kind?: UsageKind;
  owner?: "self" | "opponent" | "any";
}

export interface SearchCardAction {
  type: "searchCard";
  owner: "self" | "opponent";
  zones: SearchZone[];
  count?: number;
  min?: number;
  max?: number;
  resultSlot?: string;
  storeAs?: string;
  match: CardMatchRule;
  revealToOpponent?: boolean;
  shuffleAfterSearch?: boolean;
}

export interface ChooseOneBranch {
  label?: string;
  actions: Action[];
}

export interface ChooseOneAction {
  type: "chooseOne";
  prompt: string;
  choices: Array<ChooseOneBranch | Action[]>;
}

export interface FreeUseAction {
  type: "freeUse";
  source?: "searchResult";
  sourceRef?: string;
  resultSlot?: string;
  usageKind?: UsageKind;
  useKind?: UsageKind;
  ignoreCost: true;
  ignoreTimingRestriction?: boolean;
  ignoreHandRestriction?: boolean;
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
  | SearchCardAction
  | ChooseOneAction
  | FreeUseAction
  | ChargeAction
  | OptionalElseAction;

export interface CardEffectScript {
  timing?: Timing;
  conditions?: Condition[];
  actions: Action[];
  note?: string;
}
