import type { RunnerIntent, RunnerTimingContext } from "./CardScriptRunner";

export type CardScriptPrompt = OptionalBranchPrompt | ChooseCardsPrompt;

export interface PromptBuildContext {
  actingPlayerId: string;
}

export interface PromptBuildResult {
  immediateIntents: RunnerIntent[];
  prompts: CardScriptPrompt[];
}

export interface BaseCardScriptPrompt {
  promptId: string;
  playerId: string;
  sourceCardId: string;
  sourceCardNo: string;
  timing: RunnerTimingContext;
}

export interface OptionalBranchPrompt extends BaseCardScriptPrompt {
  kind: "optionalBranch";
  prompt: string;
  optionalIntents: RunnerIntent[];
  elseIntents: RunnerIntent[];
}

export interface ChooseCardsPrompt extends BaseCardScriptPrompt {
  kind: "choose";
  from: "lookedCards" | "zone" | "targets";
  amount: number;
  upTo?: boolean;
  destinationIntents: RunnerIntent[];
}

export type CardScriptPromptSelection =
  | {
      promptId: string;
      kind: "optionalBranch";
      choose: "optional" | "else";
    }
  | {
      promptId: string;
      kind: "choose";
      selectedIds: string[];
    };

export interface PromptResolutionResult {
  resolvedIntents: RunnerIntent[];
  selectedIds?: string[];
}
