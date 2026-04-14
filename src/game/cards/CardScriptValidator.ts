/**
 * Updated CardScriptValidator for LO-6556 support
 *
 * Suggested path:
 *   src/game/cards/CardScriptValidator.ts
 */

import type {
  Action,
  ApplyStateAction,
  CardEffectScript,
  ChooseAction,
  Condition,
  DealDamageAction,
  DrawAction,
  GrantAbilityAction,
  LookCardsAction,
  ModifyPropertyAction,
  ModifyStatAction,
  MoveCardAction,
  PreventAction,
  RecoverAction,
  RemoveAbilityAction,
  RevealAction,
  SequenceAction,
  ShuffleAction,
  TargetSelector,
  Timing,
} from "./CardScriptTypes";

type ExtraAction =
  | {
      type: "charge";
      target: TargetSelector;
      amount: number;
      mode?: "must" | "may" | "cannot";
    }
  | {
      type: "optionalElse";
      optionalActions: AnyAction[];
      elseActions: AnyAction[];
      prompt?: string;
    };

type AnyAction = Action | ExtraAction;

const VALID_TIMINGS: Timing[] = [
  "onUse",
  "onEnter",
  "onEnterFromHand",
  "onLeave",
  "onAttackDeclare",
  "onDefendDeclare",
  "onBattle",
  "onTurnStart",
  "onTurnEnd",
];

const VALID_STATS = ["ap", "dp", "sp", "dmg"] as const;
const VALID_ZONES = ["deck", "hand", "trash", "field", "exile", "charge", "unknown"] as const;
const VALID_STATES = ["tap", "untap", "down", "cannotUntap", "cannotTap"] as const;
const VALID_DAMAGE_KINDS = ["deck", "effect", "battle"] as const;
const VALID_PREVENT = [
  "response",
  "gainStatModifier",
  "loseStatModifier",
  "move",
  "useAbility",
] as const;
const VALID_DURATION = [
  "instant",
  "untilEndOfTurn",
  "whileOnField",
  "permanent",
  "custom",
] as const;
const VALID_PLAYER_REFS = ["self", "opponent", "turnPlayer", "nonTurnPlayer"] as const;

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

export class CardScriptValidator {
  public validateScripts(scripts: CardEffectScript[] | undefined): ValidationResult {
    if (!scripts || scripts.length === 0) {
      return { ok: true, errors: [] };
    }

    const errors: string[] = [];

    scripts.forEach((script, scriptIndex) => {
      errors.push(...this.validateScript(script, `scripts[${scriptIndex}]`));
    });

    return {
      ok: errors.length === 0,
      errors,
    };
  }

  public validateScript(script: CardEffectScript, path = "script"): string[] {
    const errors: string[] = [];

    if (script.timing && !VALID_TIMINGS.includes(script.timing)) {
      errors.push(`${path}.timing is invalid: ${String(script.timing)}`);
    }

    if (script.conditions) {
      if (!Array.isArray(script.conditions)) {
        errors.push(`${path}.conditions must be an array`);
      } else {
        script.conditions.forEach((condition, index) => {
          errors.push(...this.validateCondition(condition, `${path}.conditions[${index}]`));
        });
      }
    }

    if (!Array.isArray(script.actions) || script.actions.length === 0) {
      errors.push(`${path}.actions must be a non-empty array`);
      return errors;
    }

    script.actions.forEach((action, actionIndex) => {
      errors.push(...this.validateAction(action as AnyAction, `${path}.actions[${actionIndex}]`));
    });

    return errors;
  }

  private validateCondition(condition: Condition, path: string): string[] {
    const errors: string[] = [];

    switch (condition.type) {
      case "myTurn":
      case "opponentTurn":
      case "inBattle":
      case "ifSourceEnteredFromHand":
        return errors;

      case "ifDeckCountAtMost":
      case "ifDeckCountAtLeast":
        if (!this.isNonNegativeInteger(condition.value)) {
          errors.push(`${path}.value must be a non-negative integer`);
        }
        return errors;

      case "custom":
        if (!condition.value || typeof condition.value !== "string") {
          errors.push(`${path}.value must be a non-empty string`);
        }
        return errors;

      default: {
        const _never: never = condition;
        errors.push(`${path}.type is unknown: ${JSON.stringify(_never)}`);
        return errors;
      }
    }
  }

  private validateAction(action: AnyAction, path: string): string[] {
    switch (action.type) {
      case "draw":
        return this.validateDrawAction(action, path);
      case "moveCard":
        return this.validateMoveCardAction(action, path);
      case "modifyStat":
        return this.validateModifyStatAction(action, path);
      case "modifyProperty":
        return this.validateModifyPropertyAction(action, path);
      case "grantAbility":
        return this.validateGrantAbilityAction(action, path);
      case "removeAbility":
        return this.validateRemoveAbilityAction(action, path);
      case "applyState":
        return this.validateApplyStateAction(action, path);
      case "dealDamage":
        return this.validateDealDamageAction(action, path);
      case "recover":
        return this.validateRecoverAction(action, path);
      case "shuffle":
        return this.validateShuffleAction(action, path);
      case "lookCards":
        return this.validateLookCardsAction(action, path);
      case "choose":
        return this.validateChooseAction(action, path);
      case "reveal":
        return this.validateRevealAction(action, path);
      case "prevent":
        return this.validatePreventAction(action, path);
      case "sequence":
        return this.validateSequenceAction(action, path);
      case "charge":
        return this.validateChargeAction(action, path);
      case "optionalElse":
        return this.validateOptionalElseAction(action, path);
      default:
        return [`${path}.type is unknown: ${JSON.stringify(action)}`];
    }
  }

  private validateDrawAction(action: DrawAction, path: string): string[] {
    const errors: string[] = [];
    if (!VALID_PLAYER_REFS.includes(action.player)) errors.push(`${path}.player is invalid`);
    if (!this.isPositiveInteger(action.amount)) errors.push(`${path}.amount must be a positive integer`);
    return errors;
  }

  private validateMoveCardAction(action: MoveCardAction, path: string): string[] {
    const errors: string[] = [];
    if (!VALID_ZONES.includes(action.from)) errors.push(`${path}.from is invalid`);
    if (!VALID_ZONES.includes(action.to)) errors.push(`${path}.to is invalid`);
    errors.push(...this.validateTargetSelector(action.target, `${path}.target`));
    if (action.amount !== undefined && !this.isPositiveInteger(action.amount)) {
      errors.push(`${path}.amount must be a positive integer when provided`);
    }
    if (action.position !== undefined && !["top", "bottom", "default"].includes(action.position)) {
      errors.push(`${path}.position is invalid`);
    }
    return errors;
  }

  private validateModifyStatAction(action: ModifyStatAction, path: string): string[] {
    const errors: string[] = [];
    errors.push(...this.validateTargetSelector(action.target, `${path}.target`));
    if (!VALID_STATS.includes(action.stat)) errors.push(`${path}.stat is invalid`);
    if (!this.isInteger(action.amount)) errors.push(`${path}.amount must be an integer`);
    if (action.duration !== undefined && !VALID_DURATION.includes(action.duration)) {
      errors.push(`${path}.duration is invalid`);
    }
    return errors;
  }

  private validateModifyPropertyAction(action: ModifyPropertyAction, path: string): string[] {
    const errors: string[] = [];
    errors.push(...this.validateTargetSelector(action.target, `${path}.target`));
    if (!action.property || typeof action.property !== "string") {
      errors.push(`${path}.property must be a non-empty string`);
    }
    if (!["set", "add", "remove"].includes(action.operation)) {
      errors.push(`${path}.operation is invalid`);
    }
    if (action.duration !== undefined && !VALID_DURATION.includes(action.duration)) {
      errors.push(`${path}.duration is invalid`);
    }
    return errors;
  }

  private validateGrantAbilityAction(action: GrantAbilityAction, path: string): string[] {
    const errors: string[] = [];
    errors.push(...this.validateTargetSelector(action.target, `${path}.target`));
    if (!Array.isArray(action.abilities) || action.abilities.length === 0) {
      errors.push(`${path}.abilities must be a non-empty array`);
    }
    if (action.duration !== undefined && !VALID_DURATION.includes(action.duration)) {
      errors.push(`${path}.duration is invalid`);
    }
    return errors;
  }

  private validateRemoveAbilityAction(action: RemoveAbilityAction, path: string): string[] {
    const errors: string[] = [];
    errors.push(...this.validateTargetSelector(action.target, `${path}.target`));
    if (!["one", "all", "originalOne", "originalAll"].includes(action.modeType)) {
      errors.push(`${path}.modeType is invalid`);
    }
    return errors;
  }

  private validateApplyStateAction(action: ApplyStateAction, path: string): string[] {
    const errors: string[] = [];
    errors.push(...this.validateTargetSelector(action.target, `${path}.target`));
    if (!VALID_STATES.includes(action.state)) errors.push(`${path}.state is invalid`);
    if (action.duration !== undefined && !VALID_DURATION.includes(action.duration)) {
      errors.push(`${path}.duration is invalid`);
    }
    return errors;
  }

  private validateDealDamageAction(action: DealDamageAction, path: string): string[] {
    const errors: string[] = [];
    if (!this.isPositiveInteger(action.amount)) errors.push(`${path}.amount must be a positive integer`);
    if (!VALID_DAMAGE_KINDS.includes(action.damageKind)) errors.push(`${path}.damageKind is invalid`);
    if (action.targetPlayer !== undefined && !VALID_PLAYER_REFS.includes(action.targetPlayer)) {
      errors.push(`${path}.targetPlayer is invalid`);
    }
    if (action.targetCard !== undefined) {
      errors.push(...this.validateTargetSelector(action.targetCard, `${path}.targetCard`));
    }
    return errors;
  }

  private validateRecoverAction(action: RecoverAction, path: string): string[] {
    const errors: string[] = [];
    if (!["deck", "shield", "life", "resource"].includes(action.zone)) errors.push(`${path}.zone is invalid`);
    if (!this.isPositiveInteger(action.amount)) errors.push(`${path}.amount must be a positive integer`);
    if (typeof action.target === "string") {
      if (!VALID_PLAYER_REFS.includes(action.target)) errors.push(`${path}.target player ref is invalid`);
    } else {
      errors.push(...this.validateTargetSelector(action.target, `${path}.target`));
    }
    return errors;
  }

  private validateShuffleAction(action: ShuffleAction, path: string): string[] {
    const errors: string[] = [];
    if (!VALID_PLAYER_REFS.includes(action.player)) errors.push(`${path}.player is invalid`);
    if (action.zone !== "deck") errors.push(`${path}.zone must be "deck"`);
    return errors;
  }

  private validateLookCardsAction(action: LookCardsAction, path: string): string[] {
    const errors: string[] = [];
    if (!VALID_PLAYER_REFS.includes(action.player)) errors.push(`${path}.player is invalid`);
    if (!VALID_ZONES.includes(action.zone)) errors.push(`${path}.zone is invalid`);
    if (!this.isPositiveInteger(action.amount)) errors.push(`${path}.amount must be a positive integer`);
    if (!["top", "bottom"].includes(action.from)) errors.push(`${path}.from must be "top" or "bottom"`);
    return errors;
  }

  private validateChooseAction(action: ChooseAction, path: string): string[] {
    const errors: string[] = [];
    if (!["lookedCards", "zone", "targets"].includes(action.from)) errors.push(`${path}.from is invalid`);
    if (!this.isPositiveInteger(action.amount)) errors.push(`${path}.amount must be a positive integer`);
    if (action.destinationActions !== undefined) {
      if (!Array.isArray(action.destinationActions)) {
        errors.push(`${path}.destinationActions must be an array`);
      } else {
        action.destinationActions.forEach((nestedAction, index) => {
          errors.push(...this.validateAction(nestedAction as AnyAction, `${path}.destinationActions[${index}]`));
        });
      }
    }
    return errors;
  }

  private validateRevealAction(action: RevealAction, path: string): string[] {
    const errors: string[] = [];
    if (typeof action.target === "string") {
      if (!VALID_PLAYER_REFS.includes(action.target)) errors.push(`${path}.target player ref is invalid`);
    } else {
      errors.push(...this.validateTargetSelector(action.target, `${path}.target`));
    }
    if (action.zone !== undefined && !VALID_ZONES.includes(action.zone)) errors.push(`${path}.zone is invalid`);
    if (action.amount !== undefined && !this.isPositiveInteger(action.amount)) {
      errors.push(`${path}.amount must be a positive integer when provided`);
    }
    return errors;
  }

  private validatePreventAction(action: PreventAction, path: string): string[] {
    const errors: string[] = [];
    if (typeof action.target === "string") {
      if (!VALID_PLAYER_REFS.includes(action.target)) errors.push(`${path}.target player ref is invalid`);
    } else {
      errors.push(...this.validateTargetSelector(action.target, `${path}.target`));
    }
    if (!VALID_PREVENT.includes(action.prevent)) errors.push(`${path}.prevent is invalid`);
    if (action.duration !== undefined && !VALID_DURATION.includes(action.duration)) {
      errors.push(`${path}.duration is invalid`);
    }
    return errors;
  }

  private validateSequenceAction(action: SequenceAction, path: string): string[] {
    const errors: string[] = [];
    if (!Array.isArray(action.actions) || action.actions.length === 0) {
      errors.push(`${path}.actions must be a non-empty array`);
      return errors;
    }
    action.actions.forEach((nestedAction, index) => {
      errors.push(...this.validateAction(nestedAction as AnyAction, `${path}.actions[${index}]`));
    });
    return errors;
  }

  private validateChargeAction(action: Extract<AnyAction, { type: "charge" }>, path: string): string[] {
    const errors: string[] = [];
    errors.push(...this.validateTargetSelector(action.target, `${path}.target`));
    if (!this.isPositiveInteger(action.amount)) errors.push(`${path}.amount must be a positive integer`);
    return errors;
  }

  private validateOptionalElseAction(action: Extract<AnyAction, { type: "optionalElse" }>, path: string): string[] {
    const errors: string[] = [];
    if (!Array.isArray(action.optionalActions) || action.optionalActions.length === 0) {
      errors.push(`${path}.optionalActions must be a non-empty array`);
    } else {
      action.optionalActions.forEach((nestedAction, index) => {
        errors.push(...this.validateAction(nestedAction, `${path}.optionalActions[${index}]`));
      });
    }

    if (!Array.isArray(action.elseActions) || action.elseActions.length === 0) {
      errors.push(`${path}.elseActions must be a non-empty array`);
    } else {
      action.elseActions.forEach((nestedAction, index) => {
        errors.push(...this.validateAction(nestedAction, `${path}.elseActions[${index}]`));
      });
    }

    return errors;
  }

  private validateTargetSelector(selector: TargetSelector, path: string): string[] {
    const errors: string[] = [];

    switch (selector.kind) {
      case "source":
        return errors;
      case "lookedCards":
        if (!this.isPositiveInteger(selector.amount)) errors.push(`${path}.amount must be a positive integer`);
        return errors;
      case "player":
        if (!["self", "opponent", "any"].includes(selector.side)) errors.push(`${path}.side is invalid`);
        return errors;
      case "character":
        if (!["self", "opponent", "any"].includes(selector.side)) errors.push(`${path}.side is invalid`);
        if (!this.isPositiveInteger(selector.amount)) errors.push(`${path}.amount must be a positive integer`);
        return errors;
      case "card":
        if (!["self", "opponent", "any"].includes(selector.side)) errors.push(`${path}.side is invalid`);
        if (!VALID_ZONES.includes(selector.zone)) errors.push(`${path}.zone is invalid`);
        if (!this.isPositiveInteger(selector.amount)) errors.push(`${path}.amount must be a positive integer`);
        return errors;
      default:
        return [`${path}.kind is unknown: ${JSON.stringify(selector)}`];
    }
  }

  private isInteger(value: unknown): value is number {
    return typeof value === "number" && Number.isInteger(value);
  }
  private isNonNegativeInteger(value: unknown): value is number {
    return this.isInteger(value) && value >= 0;
  }
  private isPositiveInteger(value: unknown): value is number {
    return this.isInteger(value) && value > 0;
  }
}
