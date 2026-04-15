import type { GameAction } from "../GameActions";
import { declareAction } from "../GameActions";
import type { PlayerID } from "../GameTypes";
import type { KeywordTagAction, ParsedAction } from "../../tools/card-import/LyceeEffectParserTypes";

export type KeywordActionResolutionMode =
  | "manual_declare"
  | "triggered_hook"
  | "passive_state"
  | "unsupported";

export interface KeywordGameActionPlan {
  keyword: KeywordTagAction["keyword"];
  mode: KeywordActionResolutionMode;
  actions: GameAction[];
  notes?: string[];
  hook?: "onEnterField" | "continuous" | "battle" | "startup" | "manual";
  payload?: Record<string, unknown>;
}

function toNumberOrUndefined(value: string | number | undefined): number | undefined {
  if (typeof value === "number") return value;
  if (typeof value === "string" && /^\d+$/.test(value)) return Number(value);
  return undefined;
}

export function resolveKeywordTagToGameActionPlan(params: {
  playerId: PlayerID;
  sourceCardId?: string;
  action: KeywordTagAction;
}): KeywordGameActionPlan {
  const { playerId, sourceCardId, action } = params;

  switch (action.keyword) {
    case "step":
    case "sidestep":
    case "jump":
    case "orderstep":
    case "orderchange":
      return {
        keyword: action.keyword,
        mode: "manual_declare",
        actions: [
          declareAction({
            playerId,
            kind: "useAbility",
            sourceCardId,
            payload: {
              keywordAbility: action.keyword,
              movementValue: action.value,
              movementCount: toNumberOrUndefined(action.value),
            },
          }),
        ],
        hook: "manual",
        payload: {
          keywordAbility: action.keyword,
          movementValue: action.value,
        },
        notes: [
          "movement keyword는 현재 DECLARE_ACTION/useAbility 후보로 변환된다.",
          "실제 이동 칸 선택과 합법성 검사는 엔진 단계에서 처리해야 한다.",
        ],
      };

    case "engage":
      return {
        keyword: action.keyword,
        mode: "manual_declare",
        actions: [
          declareAction({
            playerId,
            kind: "useAbility",
            sourceCardId,
            payload: {
              keywordAbility: "engage",
              nestedActions: action.nestedActions ?? [],
            },
          }),
        ],
        hook: "manual",
        payload: {
          nestedActions: action.nestedActions ?? [],
        },
        notes: [
          "engage는 즉시 실행보다 선언 후보로 올리고, nestedActions는 후속 DSL/engine 레이어가 소비한다.",
        ],
      };

    case "charge":
      return {
        keyword: action.keyword,
        mode: "triggered_hook",
        actions: [],
        hook: "onEnterField",
        payload: {
          amount: toNumberOrUndefined(action.value),
        },
        notes: [
          "charge는 즉시 GameAction으로 발행하지 않고, 엔터 시점 훅에서 소비하는 편이 안전하다.",
        ],
      };

    case "assist":
    case "aggressive":
    case "supporter":
    case "leader":
    case "principal":
      return {
        keyword: action.keyword,
        mode: "passive_state",
        actions: [],
        hook: action.keyword === "leader" || action.keyword === "principal" ? "startup" : "continuous",
        payload: {
          value: action.value,
        },
        notes: [
          "이 keyword는 즉시 실행형보다 상태/규칙 수정자로 유지하는 편이 안전하다.",
        ],
      };

    case "penalty":
    case "recovery":
    case "bonus":
    case "turnRecovery":
      return {
        keyword: action.keyword,
        mode: "triggered_hook",
        actions: [],
        hook: action.keyword === "turnRecovery" ? "onEnterField" : "battle",
        payload: {
          nestedActions: action.nestedActions ?? [],
        },
        notes: [
          "nestedActions를 가진 keyword는 우선 훅 정보와 함께 보존하고, 구체 실행은 후속 resolver가 맡는다.",
        ],
      };

    default:
      return {
        keyword: action.keyword,
        mode: "unsupported",
        actions: [],
        notes: ["현재 keywordTag -> GameAction 변환 규칙이 아직 연결되지 않았다."],
      };
  }
}

export function resolveKeywordTagsToGameActionPlans(params: {
  playerId: PlayerID;
  sourceCardId?: string;
  actions: ParsedAction[];
}): KeywordGameActionPlan[] {
  return params.actions
    .filter((action): action is KeywordTagAction => action.type === "keywordTag")
    .map((action) =>
      resolveKeywordTagToGameActionPlan({
        playerId: params.playerId,
        sourceCardId: params.sourceCardId,
        action,
      }),
    );
}

export function collectKeywordDrivenGameActions(params: {
  playerId: PlayerID;
  sourceCardId?: string;
  actions: ParsedAction[];
}): GameAction[] {
  return resolveKeywordTagsToGameActionPlans(params).flatMap((plan) => plan.actions);
}
