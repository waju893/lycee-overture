export type SearchZone = "deck" | "trash" | "hand" | "field" | "removed";
export type UsageKind = "character" | "event" | "item" | "area";

export interface CardMatchRule {
  exactCardNo?: string;
  exactName?: string;
  nameIncludes?: string;
  type?: UsageKind;
  owner?: "self" | "opponent" | "any";
}

export interface SearchCardAction {
  type: "searchCard";
  owner: "self" | "opponent";
  zones: SearchZone[];
  count: number;
  resultSlot: string;
  match: CardMatchRule;
  revealToOpponent?: boolean;
  shuffleAfterSearch?: boolean;
}

export interface ChooseOneBranch {
  label: string;
  actions: Action[];
}

export interface ChooseOneAction {
  type: "chooseOne";
  prompt: string;
  choices: ChooseOneBranch[];
}

export interface FreeUseAction {
  type: "freeUse";
  source: "searchResult";
  resultSlot: string;
  usageKind: UsageKind;
  ignoreCost: true;
}

export interface SearchCardIntent {
  kind: "searchCard";
  owner: "self" | "opponent";
  zones: SearchZone[];
  count: number;
  resultSlot: string;
  match: CardMatchRule;
  revealToOpponent?: boolean;
  shuffleAfterSearch?: boolean;
}

export interface FreeUseIntent {
  kind: "freeUse";
  source: "searchResult";
  resultSlot: string;
  usageKind: UsageKind;
  ignoreCost: true;
}

export interface ChooseOnePromptIntent {
  kind: "prompt";
  promptType: "chooseOne";
  prompt: string;
  choices: Array<{
    index: number;
    label: string;
    actions: Action[];
  }>;
}

// 기존 Action, RunnerIntent 유니온에 아래를 추가하는 식으로 쓰면 된다.
// export type Action = ExistingAction | SearchCardAction | ChooseOneAction | FreeUseAction;
// export type RunnerIntent = ExistingRunnerIntent | SearchCardIntent | FreeUseIntent | ChooseOnePromptIntent;
