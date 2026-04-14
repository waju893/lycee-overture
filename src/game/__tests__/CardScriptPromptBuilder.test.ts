import { describe, expect, it } from "vitest";

import { CardScriptPromptBuilder } from "../cards/CardScriptPromptBuilder";
import type { RunnerIntent } from "../cards/CardScriptRunner";

function makeDrawIntent(): RunnerIntent {
  return {
    kind: "draw",
    sourceCardId: "SRC_1",
    sourceCardNo: "LO-TEST",
    timing: "onUse",
    playerId: "P1",
    amount: 1,
  };
}

describe("CardScriptPromptBuilder", () => {
  it("splits immediate intents and optional branch prompts", () => {
    const builder = new CardScriptPromptBuilder();

    const intents: RunnerIntent[] = [
      makeDrawIntent(),
      {
        kind: "prompt",
        sourceCardId: "SRC_1",
        sourceCardNo: "LO-6556",
        timing: "onEnterFromHand",
        prompt: "2장 차지할 수 있다. 하지 않으면 ...",
        optionalIntents: [
          {
            kind: "charge",
            sourceCardId: "SRC_1",
            sourceCardNo: "LO-6556",
            timing: "onEnterFromHand",
            targetIds: ["SRC_1"],
            amount: 2,
          },
        ],
        elseIntents: [
          {
            kind: "moveCard",
            sourceCardId: "SRC_1",
            sourceCardNo: "LO-6556",
            timing: "onEnterFromHand",
            targetIds: ["OPP_HAND_1"],
            from: "hand",
            to: "deck",
            position: "bottom",
          },
        ],
      },
    ];

    const result = builder.build(intents, { actingPlayerId: "P1" });

    expect(result.immediateIntents).toHaveLength(1);
    expect(result.immediateIntents[0]?.kind).toBe("draw");
    expect(result.prompts).toHaveLength(1);
    expect(result.prompts[0]?.kind).toBe("optionalBranch");

    if (result.prompts[0]?.kind === "optionalBranch") {
      expect(result.prompts[0].prompt).toContain("차지");
      expect(result.prompts[0].optionalIntents).toHaveLength(1);
      expect(result.prompts[0].elseIntents).toHaveLength(1);
    }
  });

  it("resolves optional branch selection into else intents", () => {
    const builder = new CardScriptPromptBuilder();

    const built = builder.build(
      [
        {
          kind: "prompt",
          sourceCardId: "SRC_1",
          sourceCardNo: "LO-6556",
          timing: "onEnterFromHand",
          prompt: "2장 차지할 수 있다. 하지 않으면 ...",
          optionalIntents: [
            {
              kind: "charge",
              sourceCardId: "SRC_1",
              sourceCardNo: "LO-6556",
              timing: "onEnterFromHand",
              targetIds: ["SRC_1"],
              amount: 2,
            },
          ],
          elseIntents: [
            {
              kind: "moveCard",
              sourceCardId: "SRC_1",
              sourceCardNo: "LO-6556",
              timing: "onEnterFromHand",
              targetIds: ["OPP_HAND_1"],
              from: "hand",
              to: "deck",
              position: "bottom",
            },
          ],
        },
      ],
      { actingPlayerId: "P1" },
    );

    const prompt = built.prompts[0];
    if (!prompt || prompt.kind !== "optionalBranch") {
      throw new Error("Expected optionalBranch prompt");
    }

    const resolution = builder.resolvePrompt(prompt, {
      promptId: prompt.promptId,
      kind: "optionalBranch",
      choose: "else",
    });

    expect(resolution.resolvedIntents).toHaveLength(1);
    expect(resolution.resolvedIntents[0]?.kind).toBe("moveCard");
  });

  it("builds choose prompt and validates selection count", () => {
    const builder = new CardScriptPromptBuilder();

    const built = builder.build(
      [
        {
          kind: "choose",
          sourceCardId: "SRC_2",
          sourceCardNo: "LO-CHOOSE",
          timing: "onUse",
          from: "targets",
          amount: 1,
          destinationIntents: [
            {
              kind: "reveal",
              sourceCardId: "SRC_2",
              sourceCardNo: "LO-CHOOSE",
              timing: "onUse",
              targetIds: ["TARGET_1"],
              amount: 1,
            },
          ],
        },
      ],
      { actingPlayerId: "P1" },
    );

    const prompt = built.prompts[0];
    if (!prompt || prompt.kind !== "choose") {
      throw new Error("Expected choose prompt");
    }

    const resolution = builder.resolvePrompt(prompt, {
      promptId: prompt.promptId,
      kind: "choose",
      selectedIds: ["TARGET_1"],
    });

    expect(resolution.selectedIds).toEqual(["TARGET_1"]);
    expect(resolution.resolvedIntents).toHaveLength(1);
    expect(resolution.resolvedIntents[0]?.kind).toBe("reveal");

    expect(() =>
      builder.resolvePrompt(prompt, {
        promptId: prompt.promptId,
        kind: "choose",
        selectedIds: [],
      }),
    ).toThrow(/requires exactly 1 selections/);
  });
});
