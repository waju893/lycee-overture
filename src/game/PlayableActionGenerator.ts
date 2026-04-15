
import { declareAction, type GameAction } from "./GameActions";
import type { CardRef, FieldCell, FieldSlot, GameState, PlayerID, PlayerField } from "./GameTypes";

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
  destinationSlots?: FieldSlot[];
  swapTargetSlots?: FieldSlot[];
}

export type KeywordPlansByCardId = Record<string, KeywordActionPlanLike[] | undefined>;

type SlotCoord = { row: "AF" | "DF"; col: 0 | 1 | 2 };

const SLOT_COORDS: Record<FieldSlot, SlotCoord> = {
  AF_LEFT: { row: "AF", col: 0 },
  AF_CENTER: { row: "AF", col: 1 },
  AF_RIGHT: { row: "AF", col: 2 },
  DF_LEFT: { row: "DF", col: 0 },
  DF_CENTER: { row: "DF", col: 1 },
  DF_RIGHT: { row: "DF", col: 2 },
};

const COORD_TO_SLOT: Record<string, FieldSlot> = {
  "AF:0": "AF_LEFT",
  "AF:1": "AF_CENTER",
  "AF:2": "AF_RIGHT",
  "DF:0": "DF_LEFT",
  "DF:1": "DF_CENTER",
  "DF:2": "DF_RIGHT",
};

const MOVEMENT_KEYWORDS = new Set([
  "step",
  "sidestep",
  "jump",
  "orderstep",
  "orderchange",
  "engage",
]);

function getSlotFromCoord(row: "AF" | "DF", col: number): FieldSlot | null {
  return COORD_TO_SLOT[`${row}:${col}`] ?? null;
}

function isEmptyCharacterSlot(field: PlayerField, slot: FieldSlot): boolean {
  const cell = field[slot];
  return !cell?.card;
}

function hasCharacter(field: PlayerField, slot: FieldSlot): boolean {
  const cell = field[slot];
  return !!cell?.card;
}

function getAdjacentSlots(slot: FieldSlot): FieldSlot[] {
  const { row, col } = SLOT_COORDS[slot];
  const out: FieldSlot[] = [];

  const left = getSlotFromCoord(row, col - 1);
  const right = getSlotFromCoord(row, col + 1);
  const vertical = getSlotFromCoord(row === "AF" ? "DF" : "AF", col);

  if (left) out.push(left);
  if (right) out.push(right);
  if (vertical) out.push(vertical);

  return out;
}

function getHorizontalAdjacentSlots(slot: FieldSlot): FieldSlot[] {
  const { row, col } = SLOT_COORDS[slot];
  const out: FieldSlot[] = [];
  const left = getSlotFromCoord(row, col - 1);
  const right = getSlotFromCoord(row, col + 1);
  if (left) out.push(left);
  if (right) out.push(right);
  return out;
}

function getVerticalAdjacentSlot(slot: FieldSlot): FieldSlot[] {
  const { row, col } = SLOT_COORDS[slot];
  const otherRow = row === "AF" ? "DF" : "AF";
  const vertical = getSlotFromCoord(otherRow, col);
  return vertical ? [vertical] : [];
}

function getAllEmptyFieldSlots(field: PlayerField): FieldSlot[] {
  return (Object.keys(field) as FieldSlot[]).filter((slot) => isEmptyCharacterSlot(field, slot));
}

function getActivePlayerCardsOnField(
  state: GameState,
  playerId: PlayerID,
): Array<{ card: CardRef; slot: FieldSlot }> {
  const field = state.players[playerId]?.field;
  if (!field) return [];
  return (Object.entries(field) as Array<[FieldSlot, FieldCell]>)
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

function computeDestinationSlots(field: PlayerField, slot: FieldSlot, keyword: string): FieldSlot[] {
  switch (keyword) {
    case "step":
    case "engage":
      return getAdjacentSlots(slot).filter((candidate) => isEmptyCharacterSlot(field, candidate));
    case "sidestep":
      return getHorizontalAdjacentSlots(slot).filter((candidate) => isEmptyCharacterSlot(field, candidate));
    case "orderstep":
      return getVerticalAdjacentSlot(slot).filter((candidate) => isEmptyCharacterSlot(field, candidate));
    case "jump":
      return getAllEmptyFieldSlots(field).filter((candidate) => candidate !== slot);
    default:
      return [];
  }
}

function computeSwapTargetSlots(field: PlayerField, slot: FieldSlot, keyword: string): FieldSlot[] {
  if (keyword !== "orderchange") return [];
  return getVerticalAdjacentSlot(slot).filter((candidate) => hasCharacter(field, candidate));
}

export function generatePlayableKeywordActions(params: {
  state: GameState;
  playerId?: PlayerID;
  keywordPlansByCardId: KeywordPlansByCardId;
}): PlayableKeywordActionCandidate[] {
  const playerId = params.playerId ?? params.state.turn.activePlayer;
  if (params.state.turn.activePlayer !== playerId) return [];
  if (params.state.turn.phase !== "main") return [];

  const candidates: PlayableKeywordActionCandidate[] = [];
  const field = params.state.players[playerId]?.field;
  if (!field) return candidates;

  for (const { card, slot } of getActivePlayerCardsOnField(params.state, playerId)) {
    if (!cardCanUseKeywordMovement(card)) continue;

    const plans = params.keywordPlansByCardId[card.instanceId] ?? [];
    for (const plan of plans) {
      if (!isAbilityCandidatePlan(plan)) continue;

      const destinationSlots = computeDestinationSlots(field, slot, plan.keyword);
      const swapTargetSlots = computeSwapTargetSlots(field, slot, plan.keyword);

      const isMoveKeyword = plan.keyword !== "orderchange";
      if (isMoveKeyword && destinationSlots.length === 0) continue;
      if (!isMoveKeyword && swapTargetSlots.length === 0) continue;

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
            sourceSlot: slot,
            destinationSlots,
            swapTargetSlots,
          },
        });

      candidates.push({
        cardId: card.instanceId,
        slot,
        keyword: plan.keyword,
        action,
        destinationSlots,
        swapTargetSlots,
      });
    }
  }

  return candidates;
}
