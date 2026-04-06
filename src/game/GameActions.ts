// src/game/GameActions.ts

import type {
  DeclarationKind,
  FieldSlot,
  PlayerID,
  TargetingMode,
} from "./GameTypes";

export interface StartGameAction {
  type: "START_GAME";
  firstPlayer?: PlayerID;
  leaderEnabled?: boolean;
}

export interface FinalizeStartupAction {
  type: "FINALIZE_STARTUP";
}

export interface MulliganAction {
  type: "MULLIGAN";
  playerId: PlayerID;
}

export interface KeepStartingHandAction {
  type: "KEEP_STARTING_HAND";
  playerId: PlayerID;
}

export interface StartTurnAction {
  type: "START_TURN";
}

export interface AdvancePhaseAction {
  type: "ADVANCE_PHASE";
}

export interface WarmupDrawAction {
  type: "WARMUP_DRAW";
}

export interface DeclareActionAction {
  type: "DECLARE_ACTION";
  playerId: PlayerID;
  kind: DeclarationKind;
  sourceCardId?: string;
  sourceEffectId?: string;
  targetingMode?: TargetingMode;
  targetCardIds?: string[];
  targetSlots?: FieldSlot[];
  payload?: Record<string, unknown>;
  responseToDeclarationId?: string;
}

export interface PassPriorityAction {
  type: "PASS_PRIORITY";
  playerId: PlayerID;
}

export interface ResolveTopDeclarationAction {
  type: "RESOLVE_TOP_DECLARATION";
}

export interface ResolvePendingTriggerAction {
  type: "RESOLVE_PENDING_TRIGGER";
  triggerId: string;
}

export interface ChooseTriggerOrderAction {
  type: "CHOOSE_TRIGGER_ORDER";
  playerId: PlayerID;
  orderedTriggerIds: string[];
}

export interface SetDefenderAction {
  type: "SET_DEFENDER";
  playerId: PlayerID;
  defenderCardId?: string;
}

export interface EndBattleDeclarationTimingAction {
  type: "END_BATTLE_DECLARATION_TIMING";
  playerId: PlayerID;
}

export interface EndBattleAction {
  type: "END_BATTLE";
}

export interface CheckStateBasedRulesAction {
  type: "CHECK_STATE_BASED_RULES";
}

export interface ConcedeAction {
  type: "CONCEDE";
  playerId: PlayerID;
}

export type GameAction =
  | StartGameAction
  | FinalizeStartupAction
  | MulliganAction
  | KeepStartingHandAction
  | StartTurnAction
  | AdvancePhaseAction
  | WarmupDrawAction
  | DeclareActionAction
  | PassPriorityAction
  | ResolveTopDeclarationAction
  | ResolvePendingTriggerAction
  | ChooseTriggerOrderAction
  | SetDefenderAction
  | EndBattleDeclarationTimingAction
  | EndBattleAction
  | CheckStateBasedRulesAction
  | ConcedeAction;

// -------------------------
// Action creators
// -------------------------

export const startGame = (
  firstPlayer?: PlayerID,
  leaderEnabled = true,
): StartGameAction => ({
  type: "START_GAME",
  firstPlayer,
  leaderEnabled,
});

export const finalizeStartup = (): FinalizeStartupAction => ({
  type: "FINALIZE_STARTUP",
});

export const mulligan = (playerId: PlayerID): MulliganAction => ({
  type: "MULLIGAN",
  playerId,
});

export const keepStartingHand = (
  playerId: PlayerID,
): KeepStartingHandAction => ({
  type: "KEEP_STARTING_HAND",
  playerId,
});

export const startTurn = (): StartTurnAction => ({
  type: "START_TURN",
});

export const advancePhase = (): AdvancePhaseAction => ({
  type: "ADVANCE_PHASE",
});

export const warmupDraw = (): WarmupDrawAction => ({
  type: "WARMUP_DRAW",
});

export const declareAction = (params: {
  playerId: PlayerID;
  kind: DeclarationKind;
  sourceCardId?: string;
  sourceEffectId?: string;
  targetingMode?: TargetingMode;
  targetCardIds?: string[];
  targetSlots?: FieldSlot[];
  payload?: Record<string, unknown>;
  responseToDeclarationId?: string;
}): DeclareActionAction => ({
  type: "DECLARE_ACTION",
  playerId: params.playerId,
  kind: params.kind,
  sourceCardId: params.sourceCardId,
  sourceEffectId: params.sourceEffectId,
  targetingMode: params.targetingMode,
  targetCardIds: params.targetCardIds,
  targetSlots: params.targetSlots,
  payload: params.payload,
  responseToDeclarationId: params.responseToDeclarationId,
});

export const passPriority = (playerId: PlayerID): PassPriorityAction => ({
  type: "PASS_PRIORITY",
  playerId,
});

export const resolveTopDeclaration = (): ResolveTopDeclarationAction => ({
  type: "RESOLVE_TOP_DECLARATION",
});

export const resolvePendingTrigger = (
  triggerId: string,
): ResolvePendingTriggerAction => ({
  type: "RESOLVE_PENDING_TRIGGER",
  triggerId,
});

export const chooseTriggerOrder = (
  playerId: PlayerID,
  orderedTriggerIds: string[],
): ChooseTriggerOrderAction => ({
  type: "CHOOSE_TRIGGER_ORDER",
  playerId,
  orderedTriggerIds,
});

export const setDefender = (
  playerId: PlayerID,
  defenderCardId?: string,
): SetDefenderAction => ({
  type: "SET_DEFENDER",
  playerId,
  defenderCardId,
});

export const endBattleDeclarationTiming = (
  playerId: PlayerID,
): EndBattleDeclarationTimingAction => ({
  type: "END_BATTLE_DECLARATION_TIMING",
  playerId,
});

export const endBattle = (): EndBattleAction => ({
  type: "END_BATTLE",
});

export const checkStateBasedRules = (): CheckStateBasedRulesAction => ({
  type: "CHECK_STATE_BASED_RULES",
});

export const concede = (playerId: PlayerID): ConcedeAction => ({
  type: "CONCEDE",
  playerId,
});

// -------------------------
// Type guards (optional)
// -------------------------

export const isStartupAction = (
  action: GameAction,
): action is
  | StartGameAction
  | FinalizeStartupAction
  | MulliganAction
  | KeepStartingHandAction =>
  action.type === "START_GAME" ||
  action.type === "FINALIZE_STARTUP" ||
  action.type === "MULLIGAN" ||
  action.type === "KEEP_STARTING_HAND";

export const isTurnFlowAction = (
  action: GameAction,
): action is StartTurnAction | AdvancePhaseAction | WarmupDrawAction =>
  action.type === "START_TURN" ||
  action.type === "ADVANCE_PHASE" ||
  action.type === "WARMUP_DRAW";

export const isDeclarationFlowAction = (
  action: GameAction,
): action is
  | DeclareActionAction
  | PassPriorityAction
  | ResolveTopDeclarationAction
  | ResolvePendingTriggerAction
  | ChooseTriggerOrderAction =>
  action.type === "DECLARE_ACTION" ||
  action.type === "PASS_PRIORITY" ||
  action.type === "RESOLVE_TOP_DECLARATION" ||
  action.type === "RESOLVE_PENDING_TRIGGER" ||
  action.type === "CHOOSE_TRIGGER_ORDER";

export const isBattleFlowAction = (
  action: GameAction,
): action is
  | SetDefenderAction
  | EndBattleDeclarationTimingAction
  | EndBattleAction =>
  action.type === "SET_DEFENDER" ||
  action.type === "END_BATTLE_DECLARATION_TIMING" ||
  action.type === "END_BATTLE";

export const isSystemAction = (
  action: GameAction,
): action is CheckStateBasedRulesAction | ConcedeAction =>
  action.type === "CHECK_STATE_BASED_RULES" ||
  action.type === "CONCEDE";