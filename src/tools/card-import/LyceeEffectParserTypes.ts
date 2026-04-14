export type LyceeHeader =
  | "誘発"
  | "宣言"
  | "常時"
  | "手札宣言"
  | "使用代償"
  | "unknown";

export type LyceeTiming =
  | "onUse"
  | "onEnter"
  | "onEnterFromHand"
  | "onTurnStart"
  | "onTurnEnd"
  | "onAttackDeclare"
  | "continuous"
  | "unknown";

export interface ParseMeta {
  originalText: string;
  normalizedText: string;
  lines: string[];
  matchedRuleIds: string[];
}

export interface ParserUnresolvedLine {
  line: string;
  reason: string;
}

export interface ParsedSelector {
  owner: "self" | "opponent";
  kind: "character" | "event" | "item" | "area" | "card";
  count: number;
}

export interface ParsedConditionInBattle {
  type: "inBattle";
  target: "self";
}
export interface ParsedConditionTurn {
  type: "turn";
  side: "self" | "opponent";
}
export type ParsedCondition = ParsedConditionInBattle | ParsedConditionTurn;

export interface DrawAction {
  type: "draw";
  amount: number;
}

export interface ModifyStatAction {
  type: "modifyStat";
  stat: "ap" | "dp" | "sp";
  amount: number;
  duration?: "endOfTurn";
  targetRef?: "self" | "selectedTarget";
}

export interface SearchCardAction {
  type: "searchCard";
  owner: "self" | "opponent";
  zones: Array<"deck" | "trash" | "hand">;
  match: {
    exactName?: string;
    kind?: "character" | "event" | "item" | "area" | "card";
  };
  min: number;
  max: number;
  storeAs?: string;
  shuffleAfterSearch?: boolean;
}

export interface FreeUseAction {
  type: "freeUse";
  sourceRef: string;
  useKind: "character" | "event" | "item" | "area";
  ignoreCost: true;
}

export interface ChargeAction {
  type: "charge";
  amount: number;
  target: "self";
}

export interface MoveCardAction {
  type: "moveCard";
  owner: "self" | "opponent";
  from: "hand" | "deck" | "trash" | "field";
  to: "hand" | "deckTop" | "deckBottom" | "trash";
  count: number;
}

export interface ApplyStateAction {
  type: "applyState";
  state: "tap" | "untap";
  target: "self" | "selectedTarget";
}

export interface RevealAction {
  type: "reveal";
  count: number;
  zone: "deck";
  owner: "self" | "opponent";
}

export interface ShuffleAction {
  type: "shuffle";
  owner: "self" | "opponent";
}

export interface ChooseOneAction {
  type: "chooseOne";
  prompt?: string;
  choices: ParsedChoice[];
}

export interface ChooseTargetAction {
  type: "chooseTarget";
  selector: ParsedSelector;
  storeAs: "selectedTarget";
  prompt?: string;
}

export interface OptionalElseAction {
  type: "optionalElse";
  prompt?: string;
  optionalActions: ParsedAction[];
  elseActions: ParsedAction[];
}

export interface CostBlockAction {
  type: "costBlock";
  actions: ParsedAction[];
}

export type ParsedAction =
  | DrawAction
  | ModifyStatAction
  | SearchCardAction
  | FreeUseAction
  | ChargeAction
  | MoveCardAction
  | ApplyStateAction
  | RevealAction
  | ShuffleAction
  | ChooseOneAction
  | ChooseTargetAction
  | OptionalElseAction
  | CostBlockAction;

export interface ParsedChoice {
  label?: string;
  actions: ParsedAction[];
}

export interface ParsedEffectDraft {
  header: LyceeHeader;
  timing: LyceeTiming;
  triggerText?: string;
  conditionText?: string;
  conditions?: ParsedCondition[];
  originalLine: string;
  actions: ParsedAction[];
}

export interface ParseResult {
  parsedEffectsDraft: ParsedEffectDraft[];
  unresolvedTextLines: ParserUnresolvedLine[];
  parseMeta: ParseMeta;
}

export interface RuleMatch {
  ruleId: string;
  actions: ParsedAction[];
}

export interface ParsedLineResult {
  effect?: ParsedEffectDraft;
  unresolved?: ParserUnresolvedLine;
  matchedRuleIds: string[];
}
