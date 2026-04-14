/**
 * LO-6556 minimal action extensions
 *
 * Suggested path:
 *   src/game/cards/CardScriptTypes.LO6556.ts
 *
 * Purpose:
 * - Keep your main Action 15 design mostly intact
 * - Add only what LO-6556 really needs:
 *   1) charge
 *   2) optionalElse
 */

import type {
  Action,
  CardEffectScript,
  Duration,
  ExecutionMode,
  TargetSelector,
  Timing,
} from "./CardScriptTypes";

export interface ChargeAction {
  type: "charge";
  target: TargetSelector;
  amount: number;
  mode?: ExecutionMode;
}

export interface OptionalElseAction {
  type: "optionalElse";
  optionalActions: Action[];
  elseActions: Action[];
  prompt?: string;
}

export type ExtendedAction = Action | ChargeAction | OptionalElseAction;

export interface ExtendedCardEffectScript
  extends Omit<CardEffectScript, "actions"> {
  actions: ExtendedAction[];
}

/**
 * Optional helper if you want a single widened script type.
 */
export interface ExtendedCardDefinitionForLO6556 {
  cardNo: string;
  name: string;
  text?: string;
  textKr?: string;
  parsedEffects?: ExtendedCardEffectScript[];
}

/**
 * Notes
 * - charge: "이 캐릭터에 n장 차지"
 * - optionalElse:
 *    "n장 차지할 수 있다. 하지 않으면 ..."
 */
