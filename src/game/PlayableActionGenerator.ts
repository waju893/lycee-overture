import { declareAction, type GameAction } from "./GameActions";
import type { CardRef, FieldSlot, GameState, PlayerID } from "./GameTypes";

export type KeywordActionPlanKind =
  | "declaration_candidate"
  | "triggered_hook"
  | "onEnterField"
  | "passive_state";

export interface KeywordActionPlanLike {
  kind: KeywordActionPlanKind;
  keyword: string;
  gameAction?: GameAction;
  payload?: Record<string, unknown>;
}

export interface PlayableKeywordActionCandidate {
  cardId: string;
  slot: FieldSlot;
  keyword: string;
  action: GameAction;
}

export type KeywordPlansByCardId = Record<string, KeywordActionPlanLike[] | undefined>;

const MOVEMENT_KEYWORDS = new Set([
  "step",
  "sidestep",
  "jump",
  "orderstep",
  "orderchange",
  "engage",
]);

function getActivePlayerCardsOnField(
  state: GameState,
  playerId: PlayerID,
): Array<{ card: CardRef; slot: FieldSlot }> {
  const field = state.players[playerId]?.field;
  if (!field) return [];

  const entries = Object.entries(field) as Array<[FieldSlot, { card: CardRef | null }]>;
  return entries
    .filter(([, cell]) => !!cell.card)
    .map(([slot, cell]) => ({ slot, card: cell.card as CardRef }));
}

function isAbilityCandidatePlan(plan: KeywordActionPlanLike): boolean {
  if (plan.kind !== "declaration_candidate") return false;
  return MOVEMENT_KEYWORDS.has(plan.keyword);
}

function cardCanUseKeywordMovement(card: CardRef): boolean {
  return card.isTapped !== true;
}

export function generatePlayableKeywordActions(params: {
  state: GameState;
  playerId?: PlayerID;
  keywordPlansByCardId: KeywordPlansByCardId;
}): PlayableKeywordActionCandidate[] {
  const playerId = params.playerId ?? params.state.turn.activePlayer;

  if (params.state.turn.activePlayer !== playerId) {
    return [];
  }

  if (params.state.turn.phase !== "main") {
    return [];
  }

  const candidates: PlayableKeywordActionCandidate[] = [];

  for (const { card, slot } of getActivePlayerCardsOnField(params.state, playerId)) {
    if (!cardCanUseKeywordMovement(card)) continue;

    const plans = params.keywordPlansByCardId[card.instanceId] ?? [];
    for (const plan of plans) {
      if (!isAbilityCandidatePlan(plan)) continue;

      const action =
        plan.gameAction ??
        declareAction({
          playerId,
          kind: "useAbility",
          sourceCardId: card.instanceId,
          targetingMode: "none",
          payload: {
            keyword: plan.keyword,
            source: "keywordTag",
          },
        });

      candidates.push({
        cardId: card.instanceId,
        slot,
        keyword: plan.keyword,
        action,
      });
    }
  }

  return candidates;
}
