import { describe, expect, it } from "vitest";
import {
  createBattleWithOptionalDefender,
  passBattlePriority,
  registerBattleDeclaration,
  resolveBattleAfterPriority,
} from "../battle/BattlePriorityWindow";

function createState() {
  return {
    players: {
      P1: {
        deck: ["a1", "a2", "a3"],
        field: {
          AF_LEFT: {
            card: {
              id: "attacker-1",
              isTapped: false,
            },
          },
        },
      },
      P2: {
        deck: ["d1", "d2", "d3", "d4"],
        field: {
          DF_LEFT: {
            card: undefined,
          },
        },
      },
    },
    battle: createBattleWithOptionalDefender({
      attackerPlayer: "P1",
      defenderPlayer: "P2",
      attackerSlot: "AF_LEFT",
      attackerCardId: "attacker-1",
      defenderSlot: null,
      defenderCardId: null,
      turnPlayer: "P1",
    }),
  };
}

describe("BattlePriorityWindow", () => {
  it("방어자가 없어도 배틀 중 상태로 진입하고 턴 플레이어가 먼저 우선 선언한다", () => {
    const state = createState();

    expect(state.battle.isActive).toBe(true);
    expect(state.battle.pendingDirectAttack).toBe(true);
    expect(state.battle.defenderSlot).toBeNull();
    expect(state.battle.priorityPlayer).toBe("P1");
    expect(state.battle.phase).toBe("PRIORITY_WINDOW");
  });

  it("턴 플레이어 선언 시 stackDepth가 증가하고 pass 기록이 초기화된다", () => {
    const state = createState();
    const next = registerBattleDeclaration(state, "P1");

    expect(next.battle.stackDepth).toBe(1);
    expect(next.battle.passedPlayers).toEqual([]);
    expect(next.battle.priorityPlayer).toBe("P1");
  });

  it("양쪽이 순서대로 우선권을 포기하면 resolving으로 이동한다", () => {
    const state = createState();
    const s1 = passBattlePriority(state, "P1");
    const s2 = passBattlePriority(s1, "P2");

    expect(s1.battle.priorityPlayer).toBe("P2");
    expect(s2.battle.phase).toBe("RESOLVING");
  });

  it("최종 해소 시 방어자가 끝내 없으면 직접 공격으로 처리되고 배틀이 종료된다", () => {
    const state = createState();
    const s1 = passBattlePriority(state, "P1");
    const s2 = passBattlePriority(s1, "P2");
    const next = resolveBattleAfterPriority(s2);

    expect(next.battle.isActive).toBe(false);
    expect(next.players.P1.field.AF_LEFT.card?.isTapped).toBe(true);
    expect(next.players.P2.deck.length).toBe(2);
  });
});
