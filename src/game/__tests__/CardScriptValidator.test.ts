/**
 * Minimal tests for CardScriptValidator
 *
 * Suggested path:
 *   src/game/__tests__/CardScriptValidator.test.ts
 */

import { describe, expect, it } from "vitest";
import type { CardEffectScript } from "../cards/CardScriptTypes";
import { CardScriptValidator } from "../cards/CardScriptValidator";

describe("CardScriptValidator", () => {
  it("passes valid scripts", () => {
    const validator = new CardScriptValidator();

    const scripts: CardEffectScript[] = [
      {
        timing: "onEnterFromHand",
        actions: [
          {
            type: "draw",
            player: "self",
            amount: 1,
          },
        ],
      },
      {
        timing: "onAttackDeclare",
        conditions: [{ type: "myTurn" }],
        actions: [
          {
            type: "modifyStat",
            target: { side: "opponent", kind: "character", amount: 1 },
            stat: "sp",
            amount: -2,
            duration: "untilEndOfTurn",
          },
        ],
      },
      {
        timing: "onUse",
        actions: [
          {
            type: "sequence",
            actions: [
              {
                type: "moveCard",
                from: "trash",
                to: "deck",
                target: {
                  side: "self",
                  kind: "card",
                  zone: "trash",
                  amount: 6,
                  upTo: true,
                  random: true,
                },
                amount: 6,
                upTo: true,
                random: true,
              },
              {
                type: "shuffle",
                player: "self",
                zone: "deck",
              },
            ],
          },
        ],
      },
    ];

    const result = validator.validateScripts(scripts);

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("fails malformed action payloads", () => {
    const validator = new CardScriptValidator();

    const scripts: CardEffectScript[] = [
      {
        timing: "onUse",
        actions: [
          {
            type: "draw",
            player: "self",
            amount: -3,
          },
          {
            type: "modifyStat",
            target: { side: "opponent", kind: "character", amount: 1 },
            // @ts-expect-error intentional invalid stat for runtime validation test
            stat: "hp",
            amount: 2,
          },
        ],
      },
    ];

    const result = validator.validateScripts(scripts);

    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes("amount must be a positive integer"))).toBe(true);
    expect(result.errors.some((e) => e.includes(".stat is invalid"))).toBe(true);
  });

  it("fails malformed target structures", () => {
    const validator = new CardScriptValidator();

    const scripts: CardEffectScript[] = [
      {
        timing: "onUse",
        actions: [
          {
            type: "moveCard",
            from: "trash",
            to: "deck",
            target: {
              side: "self",
              kind: "card",
              zone: "trash",
              amount: 0,
            },
            amount: 0,
          },
        ],
      },
    ];

    const result = validator.validateScripts(scripts);

    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.includes(".target.amount must be a positive integer"))).toBe(true);
    expect(result.errors.some((e) => e.includes(".amount must be a positive integer"))).toBe(true);
  });
});
