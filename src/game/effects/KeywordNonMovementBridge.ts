import { declareAction, type GameAction } from "../GameActions";

export interface KeywordPassiveState {
  aggressive?: boolean;
  assist?: boolean;
  leader?: boolean;
  principal?: boolean;
  supporterValue?: number;
  supporterRaw?: string;
  chargeCount?: number;
}

export interface KeywordActionPlanLike {
  kind: "declaration_candidate" | "triggered_hook" | "onEnterField" | "passive_state";
  keyword: string;
  payload?: Record<string, unknown>;
}

export interface CardLikeWithKeywordState {
  sp?: number;
  keywordState?: KeywordPassiveState;
}

function numberFromUnknown(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function countSymbols(raw: string): number {
  return Array.from(raw).length;
}

export function buildKeywordPassiveStateFromPlans(
  plans: KeywordActionPlanLike[],
): KeywordPassiveState {
  const state: KeywordPassiveState = {};

  for (const plan of plans) {
    switch (plan.keyword) {
      case "aggressive":
        state.aggressive = true;
        break;
      case "assist":
        state.assist = true;
        break;
      case "leader":
        state.leader = true;
        break;
      case "principal":
        state.principal = true;
        break;
      case "supporter": {
        const numeric =
          numberFromUnknown(plan.payload?.value) ??
          numberFromUnknown(plan.payload?.supporterValue);
        const raw =
          typeof plan.payload?.rawValue === "string"
            ? plan.payload.rawValue
            : typeof plan.payload?.value === "string"
              ? plan.payload.value
              : undefined;

        if (typeof numeric === "number") {
          state.supporterValue = numeric;
        } else if (typeof raw === "string" && raw.length > 0) {
          state.supporterRaw = raw;
          state.supporterValue = countSymbols(raw);
        }
        break;
      }
      case "charge": {
        const count =
          numberFromUnknown(plan.payload?.count) ??
          numberFromUnknown(plan.payload?.value);
        if (typeof count === "number" && count > 0) {
          state.chargeCount = count;
        }
        break;
      }
      default:
        break;
    }
  }

  return state;
}

export function getSupportAmountFromCard(card: CardLikeWithKeywordState): number {
  if (typeof card.sp === "number") {
    return card.sp;
  }
  return card.keywordState?.supporterValue ?? 0;
}

export function hasAggressiveKeywordState(card: CardLikeWithKeywordState): boolean {
  return card.keywordState?.aggressive === true;
}

export function hasAssistKeywordState(card: CardLikeWithKeywordState): boolean {
  return card.keywordState?.assist === true;
}

export function buildAutoChargeActionFromKeywordState(params: {
  playerId: "P1" | "P2";
  sourceCardId: string;
  keywordState?: KeywordPassiveState;
}): GameAction | null {
  const chargeCount = params.keywordState?.chargeCount ?? 0;
  if (chargeCount <= 0) return null;

  return declareAction({
    playerId: params.playerId,
    kind: "chargeCharacter",
    sourceCardId: params.sourceCardId,
    payload: {
      deckCount: chargeCount,
      source: "keywordTag",
      auto: true,
    },
  });
}
