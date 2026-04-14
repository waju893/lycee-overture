/**
 * Minimal tests for CardScriptRunner
 *
 * Suggested path:
 *   src/game/__tests__/CardScriptRunner.test.ts
 *
 * Assumes:
 *   - src/game/cards/CardScriptTypes.ts
 *   - src/game/cards/CardScriptRunner.ts
 *
 * Test scope:
 * 1) onEnterFromHand -> draw 1
 * 2) onAttackDeclare -> modifyStat SP -2 to opponent character
 * 3) onUse -> sequence(recover deck up to 6 random + shuffle)
 */

import { describe, expect, it } from "vitest";
import type {
  CardEffectScript,
  PlayerRef,
  TargetSelector,
} from "../cards/CardScriptTypes";
import {
  CardScriptRunner,
  type RunnerContext,
  type RunnerStateView,
  type RunnerTargetRef,
} from "../cards/CardScriptRunner";

function makeStateView(): RunnerStateView {
  return {
    currentTurnPlayerId: "P1",
    currentNonTurnPlayerId: "P2",

    resolvePlayer(ref: PlayerRef, context: RunnerContext): string {
      switch (ref) {
        case "self":
          return context.actingPlayerId;
        case "opponent":
          return context.actingPlayerId === "P1" ? "P2" : "P1";
        case "turnPlayer":
          return context.turnPlayerId;
        case "nonTurnPlayer":
          return context.turnPlayerId === "P1" ? "P2" : "P1";
        default: {
          const _never: never = ref;
          throw new Error(`Unhandled PlayerRef: ${String(_never)}`);
        }
      }
    },

    resolveTargets(selector: TargetSelector, context: RunnerContext): RunnerTargetRef[] {
      if (selector.kind === "source") {
        return [{ kind: "card", id: context.sourceCard.id }];
      }

      if (selector.kind === "lookedCards") {
        return (context.lookedCardIds ?? []).map((id) => ({ kind: "card", id }));
      }

      if (selector.kind === "player") {
        const playerId =
          selector.side === "self"
            ? context.actingPlayerId
            : selector.side === "opponent"
              ? context.actingPlayerId === "P1" ? "P2" : "P1"
              : context.actingPlayerId;
        return [{ kind: "player", id: playerId }];
      }

      if (selector.kind === "character") {
        if (selector.side === "opponent") {
          return [{ kind: "card", id: "OPP_CHAR_1" }];
        }
        if (selector.side === "self") {
          return [{ kind: "card", id: "SELF_CHAR_1" }];
        }
        return [{ kind: "card", id: "ANY_CHAR_1" }];
      }

      if (selector.kind === "card") {
        if (selector.zone === "trash") {
          return [
            { kind: "card", id: "TRASH_1" },
            { kind: "card", id: "TRASH_2" },
            { kind: "card", id: "TRASH_3" },
            { kind: "card", id: "TRASH_4" },
            { kind: "card", id: "TRASH_5" },
            { kind: "card", id: "TRASH_6" },
          ].slice(0, selector.amount);
        }

        return [{ kind: "card", id: "GENERIC_CARD_1" }];
      }

      const _never: never = selector;
      throw new Error(`Unhandled TargetSelector: ${JSON.stringify(_never)}`);
    },

    getDeckCount(playerId: string): number {
      return playerId === "P1" ? 10 : 20;
    },

    didSourceEnterFromHand(sourceCardId: string): boolean {
      return sourceCardId === "SRC_1";
    },
  };
}

function makeContext(
  timing: RunnerContext["timing"],
  overrides?: Partial<RunnerContext>,
): RunnerContext {
  return {
    timing,
    sourceCard: {
      id: "SRC_1",
      cardNo: "LO-TEST",
      ownerId: "P1",
      controllerId: "P1",
      zone: "field",
      name: "Test Card",
    },
    actingPlayerId: "P1",
    turnPlayerId: "P1",
    chosenTargets: [],
    lookedCardIds: ["LOOK_1", "LOOK_2"],
    metadata: {},
    ...overrides,
  };
}

describe("CardScriptRunner", () => {
  it("creates draw intent for onEnterFromHand script", () => {
    const runner = new CardScriptRunner();
    const state = makeStateView();

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
    ];

    const result = runner.run(scripts, state, makeContext("onEnterFromHand"));

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.intents).toHaveLength(1);

    const intent = result.intents[0];
    expect(intent.kind).toBe("draw");

    if (intent.kind === "draw") {
      expect(intent.playerId).toBe("P1");
      expect(intent.amount).toBe(1);
      expect(intent.sourceCardNo).toBe("LO-TEST");
    }
  });

  it("creates modifyStat intent for opponent target on attack declare", () => {
    const runner = new CardScriptRunner();
    const state = makeStateView();

    const scripts: CardEffectScript[] = [
      {
        timing: "onAttackDeclare",
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
    ];

    const result = runner.run(scripts, state, makeContext("onAttackDeclare"));

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.intents).toHaveLength(1);

    const intent = result.intents[0];
    expect(intent.kind).toBe("modifyStat");

    if (intent.kind === "modifyStat") {
      expect(intent.targetIds).toEqual(["OPP_CHAR_1"]);
      expect(intent.stat).toBe("sp");
      expect(intent.amount).toBe(-2);
      expect(intent.duration).toBe("untilEndOfTurn");
    }
  });

  it("creates sequence intents for recover-like moveCard + shuffle", () => {
    const runner = new CardScriptRunner();
    const state = makeStateView();

    const scripts: CardEffectScript[] = [
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

    const result = runner.run(scripts, state, makeContext("onUse"));

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.intents).toHaveLength(2);

    const first = result.intents[0];
    const second = result.intents[1];

    expect(first.kind).toBe("moveCard");
    expect(second.kind).toBe("shuffle");

    if (first.kind === "moveCard") {
      expect(first.from).toBe("trash");
      expect(first.to).toBe("deck");
      expect(first.targetIds).toEqual([
        "TRASH_1",
        "TRASH_2",
        "TRASH_3",
        "TRASH_4",
        "TRASH_5",
        "TRASH_6",
      ]);
      expect(first.amount).toBe(6);
      expect(first.upTo).toBe(true);
      expect(first.random).toBe(true);
    }

    if (second.kind === "shuffle") {
      expect(second.playerId).toBe("P1");
      expect(second.zone).toBe("deck");
    }
  });
});
