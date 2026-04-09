import type { GameAction } from "../GameActions";
import type { GameState, LegacyDeclaration } from "../GameTypes";
import { getOpponentPlayerId } from "../GameTypes";
import { appendLog } from "./cloneState";
import { nextLegacyDeclarationId } from "./ids";
import { fieldHasSameName, findCardInHand, findCardOwnerOnField } from "./utils";

type DeclareAction = Extract<GameAction, { type: "DECLARE_ACTION" }>;

function validateResponseWindow(state: GameState, action: DeclareAction): string | null {
  const topDeclaration = state.declarationStack[state.declarationStack.length - 1];
  if (!topDeclaration) {
    return action.responseToDeclarationId ? "INVALID_RESPONSE_TARGET" : null;
  }

  if (action.responseToDeclarationId && action.responseToDeclarationId !== topDeclaration.id) {
    return "RESPONSE_TARGET_MISMATCH";
  }

  if (topDeclaration.playerId === action.playerId) {
    return "SELF_RESPONSE_FORBIDDEN";
  }

  if (state.turn.priorityPlayer !== action.playerId) {
    return "NO_PRIORITY";
  }

  return null;
}

function validateMainDeclarationTiming(state: GameState, playerId: DeclareAction["playerId"]): string | null {
  if (state.turn.phase !== "main") return "TIMING_INVALID";
  if (state.turn.priorityPlayer !== playerId) return "NO_PRIORITY";
  if (state.declarationStack.length > 0) return "STACK_NOT_EMPTY";
  return null;
}

function validateDeclareAction(state: GameState, action: DeclareAction): string | null {
  const isResponse = state.declarationStack.length > 0 || Boolean(action.responseToDeclarationId);
  const timingViolation = isResponse
    ? validateResponseWindow(state, action)
    : validateMainDeclarationTiming(state, action.playerId);

  if (timingViolation) return timingViolation;

  if (action.kind === "useCharacter") {
    const card = findCardInHand(state, action.playerId, action.sourceCardId ?? "");
    if (!card) return "CARD_NOT_FOUND";
    const slot = action.targetSlots?.[0];
    if (!slot) return "TARGET_SLOT_MISSING";
    if (state.players[action.playerId].field[slot].card) return "FIELD_OCCUPIED";
    if (fieldHasSameName(state, action.playerId, card.sameNameKey)) return "SAME_NAME_ON_FIELD";
    return null;
  }

  if (action.kind === "useAbility") {
    const found = findCardOwnerOnField(state, action.sourceCardId ?? "");
    if (!found || found.playerId !== action.playerId) return "CARD_NOT_FOUND";
    return null;
  }

  if (action.kind === "attack") {
    const found = findCardOwnerOnField(state, action.sourceCardId ?? "");
    if (!found || found.playerId !== action.playerId) return "CARD_NOT_FOUND";
    if (!found.slot.startsWith("AF")) return "ATTACKER_NOT_AF";
    if (found.card.isTapped) return "ATTACKER_TAPPED";
    return null;
  }

  if (action.kind === "chargeCharacter") {
    const found = findCardOwnerOnField(state, action.sourceCardId ?? "");
    if (!found || found.playerId !== action.playerId) return "CARD_NOT_FOUND";
    return null;
  }

  return null;
}

function buildLegacyDeclaration(state: GameState, action: DeclareAction): LegacyDeclaration {
  return {
    id: nextLegacyDeclarationId(state),
    playerId: action.playerId,
    kind: action.kind,
    sourceCardId: action.sourceCardId,
    sourceEffectId: action.sourceEffectId,
    targetSlots: action.targetSlots,
    targetCardIds: action.targetCardIds,
    targetingMode: action.targetingMode,
    payload: action.payload,
    responseToDeclarationId: action.responseToDeclarationId,
  };
}

export function declareAction(state: GameState, action: DeclareAction): void {
  const violation = validateDeclareAction(state, action);
  if (violation) {
    appendLog(state, violation);
    return;
  }

  const declaration = buildLegacyDeclaration(state, action);
  state.declarationStack.push(declaration);
  state.turn.priorityPlayer = getOpponentPlayerId(action.playerId);

  if (action.kind === "useCharacter") appendLog(state, "등장 선언");
  if (action.kind === "useAbility") appendLog(state, "능력 사용 선언");
  if (action.kind === "attack") appendLog(state, "공격 선언");
  if (action.kind === "chargeCharacter") appendLog(state, "차지 선언");
}
