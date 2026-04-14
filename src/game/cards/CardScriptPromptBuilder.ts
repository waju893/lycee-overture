import type {
  CardScriptPrompt,
  CardScriptPromptSelection,
  ChooseCardsPrompt,
  ChooseOnePrompt,
  OptionalBranchPrompt,
  PromptBuildContext,
  PromptBuildResult,
  PromptResolutionResult,
} from "./CardScriptPromptTypes";
import type { ChooseIntent, PromptIntent, RunnerIntent } from "./CardScriptRunner";

export class CardScriptPromptBuilder {
  public build(intents: RunnerIntent[], context: PromptBuildContext): PromptBuildResult {
    const immediateIntents: RunnerIntent[] = [];
    const prompts: CardScriptPrompt[] = [];

    intents.forEach((intent, index) => {
      switch (intent.kind) {
        case "prompt":
          if (intent.promptType === "chooseOne") {
            prompts.push(this.toChooseOnePrompt(intent, context, index));
          } else {
            prompts.push(this.toOptionalBranchPrompt(intent, context, index));
          }
          break;
        case "choose":
          prompts.push(this.toChoosePrompt(intent, context, index));
          break;
        default:
          immediateIntents.push(intent);
          break;
      }
    });

    return {
      immediateIntents,
      prompts,
    };
  }

  public resolvePrompt(
    prompt: CardScriptPrompt,
    selection: CardScriptPromptSelection,
  ): PromptResolutionResult {
    if (prompt.promptId !== selection.promptId) {
      throw new Error(
        `Prompt ID mismatch: expected ${prompt.promptId}, got ${selection.promptId}`,
      );
    }

    switch (prompt.kind) {
      case "optionalBranch":
        if (selection.kind !== "optionalBranch") {
          throw new Error(`Prompt kind mismatch for ${prompt.promptId}`);
        }
        return {
          resolvedIntents:
            selection.choose === "optional"
              ? prompt.optionalIntents
              : prompt.elseIntents,
        };

      case "choose":
        if (selection.kind !== "choose") {
          throw new Error(`Prompt kind mismatch for ${prompt.promptId}`);
        }

        this.assertChooseCount(prompt, selection.selectedIds);

        return {
          resolvedIntents: prompt.destinationIntents,
          selectedIds: [...selection.selectedIds],
        };

      case "chooseOne":
        if (selection.kind !== "chooseOne") {
          throw new Error(`Prompt kind mismatch for ${prompt.promptId}`);
        }
        if (!(selection.choiceIndex in prompt.choiceIntents)) {
          throw new Error(`ChooseOne prompt ${prompt.promptId} does not have branch ${selection.choiceIndex}`);
        }
        return {
          resolvedIntents: [...prompt.choiceIntents[selection.choiceIndex]],
        };
    }
  }

  private toOptionalBranchPrompt(
    intent: PromptIntent,
    context: PromptBuildContext,
    index: number,
  ): OptionalBranchPrompt {
    return {
      kind: "optionalBranch",
      promptId: this.makePromptId(intent, index),
      playerId: context.actingPlayerId,
      sourceCardId: intent.sourceCardId,
      sourceCardNo: intent.sourceCardNo,
      timing: intent.timing,
      prompt: intent.prompt,
      optionalIntents: [...(intent.optionalIntents ?? [])],
      elseIntents: [...(intent.elseIntents ?? [])],
    };
  }

  private toChoosePrompt(
    intent: ChooseIntent,
    context: PromptBuildContext,
    index: number,
  ): ChooseCardsPrompt {
    return {
      kind: "choose",
      promptId: this.makePromptId(intent, index),
      playerId: context.actingPlayerId,
      sourceCardId: intent.sourceCardId,
      sourceCardNo: intent.sourceCardNo,
      timing: intent.timing,
      from: intent.from,
      amount: intent.amount,
      upTo: intent.upTo,
      destinationIntents: [...intent.destinationIntents],
    };
  }

  private toChooseOnePrompt(
    intent: PromptIntent,
    context: PromptBuildContext,
    index: number,
  ): ChooseOnePrompt {
    const choices = intent.choices ?? [];
    const choiceIntents: Record<number, RunnerIntent[]> = {};
    choices.forEach((choice) => {
      choiceIntents[choice.index] = [...choice.intents];
    });

    return {
      kind: "chooseOne",
      promptId: this.makePromptId(intent, index),
      playerId: context.actingPlayerId,
      sourceCardId: intent.sourceCardId,
      sourceCardNo: intent.sourceCardNo,
      timing: intent.timing,
      prompt: intent.prompt,
      choices: choices.map((choice) => ({
        index: choice.index,
        label: choice.label,
      })),
      choiceIntents,
    };
  }

  private makePromptId(intent: RunnerIntent, index: number): string {
    return [intent.sourceCardId, intent.timing, intent.kind, String(index)].join(":");
  }

  private assertChooseCount(prompt: ChooseCardsPrompt, selectedIds: string[]): void {
    if (prompt.upTo) {
      if (selectedIds.length > prompt.amount) {
        throw new Error(
          `Choose prompt ${prompt.promptId} allows up to ${prompt.amount} selections`,
        );
      }
      return;
    }

    if (selectedIds.length !== prompt.amount) {
      throw new Error(
        `Choose prompt ${prompt.promptId} requires exactly ${prompt.amount} selections`,
      );
    }
  }
}

export default CardScriptPromptBuilder;
