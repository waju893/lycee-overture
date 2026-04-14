/**
 * Updated CardScriptRunner for LO-6556 support
 *
 * Suggested path:
 *   src/game/cards/CardScriptRunner.ts
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
  PlayerRef,
  PreventAction,
  RecoverAction,
  RemoveAbilityAction,
  RevealAction,
  SequenceAction,
  ShuffleAction,
  TargetSelector,
} from "./CardScriptTypes";

type AnyAction = Action;

export type RunnerTimingContext =
  | "onUse"
  | "onEnter"
  | "onEnterFromHand"
  | "onLeave"
  | "onAttackDeclare"
  | "onDefendDeclare"
  | "onBattle"
  | "onTurnStart"
  | "onTurnEnd";

export interface RunnerCardRef {
  id: string;
  cardNo: string;
  ownerId: string;
  controllerId: string;
  zone: string;
  name?: string;
}

export interface RunnerTargetRef {
  kind: "card" | "player";
  id: string;
}

export interface RunnerContext {
  timing: RunnerTimingContext;
  sourceCard: RunnerCardRef;
  actingPlayerId: string;
  turnPlayerId: string;
  chosenTargets?: RunnerTargetRef[];
  lookedCardIds?: string[];
  metadata?: Record<string, unknown>;
}

export interface RunnerStateView {
  currentTurnPlayerId: string;
  currentNonTurnPlayerId: string;
  resolvePlayer(ref: PlayerRef, context: RunnerContext): string;
  resolveTargets(selector: TargetSelector, context: RunnerContext): RunnerTargetRef[];
  getDeckCount?(playerId: string): number;
  didSourceEnterFromHand?(sourceCardId: string): boolean;
}

export type RunnerIntent =
  | DrawIntent
  | MoveCardIntent
  | ModifyStatIntent
  | ModifyPropertyIntent
  | GrantAbilityIntent
  | RemoveAbilityIntent
  | ApplyStateIntent
  | DealDamageIntent
  | RecoverIntent
  | ShuffleIntent
  | LookCardsIntent
  | ChooseIntent
  | RevealIntent
  | PreventIntent
  | ChargeIntent
  | SearchCardIntent
  | FreeUseIntent
  | PromptIntent;

export interface BaseIntent {
  kind: string;
  sourceCardId: string;
  sourceCardNo: string;
  timing: RunnerTimingContext;
}

export interface DrawIntent extends BaseIntent {
  kind: "draw";
  playerId: string;
  amount: number;
}

export interface MoveCardIntent extends BaseIntent {
  kind: "moveCard";
  targetIds: string[];
  from: string;
  to: string;
  amount?: number;
  upTo?: boolean;
  random?: boolean;
  faceUp?: boolean;
  position?: "top" | "bottom" | "default";
}

export interface ModifyStatIntent extends BaseIntent {
  kind: "modifyStat";
  targetIds: string[];
  stat: "ap" | "dp" | "sp" | "dmg";
  amount: number;
  duration?: string;
  sourceTag?: string;
}

export interface ModifyPropertyIntent extends BaseIntent {
  kind: "modifyProperty";
  targetIds: string[];
  property: string;
  operation: "set" | "add" | "remove";
  value: unknown;
  duration?: string;
}

export interface GrantAbilityIntent extends BaseIntent {
  kind: "grantAbility";
  targetIds: string[];
  abilities: string[];
  duration?: string;
}

export interface RemoveAbilityIntent extends BaseIntent {
  kind: "removeAbility";
  targetIds: string[];
  modeType: "one" | "all" | "originalOne" | "originalAll";
}

export interface ApplyStateIntent extends BaseIntent {
  kind: "applyState";
  targetIds: string[];
  state: "tap" | "untap" | "down" | "cannotUntap" | "cannotTap";
  value?: boolean;
  duration?: string;
}

export interface DealDamageIntent extends BaseIntent {
  kind: "dealDamage";
  targetPlayerId?: string;
  targetCardIds?: string[];
  amount: number;
  damageKind: "deck" | "effect" | "battle";
}

export interface RecoverIntent extends BaseIntent {
  kind: "recover";
  zone: "deck" | "shield" | "life" | "resource";
  targetPlayerId?: string;
  targetIds?: string[];
  amount: number;
  upTo?: boolean;
  random?: boolean;
}

export interface ShuffleIntent extends BaseIntent {
  kind: "shuffle";
  playerId: string;
  zone: "deck";
}

export interface LookCardsIntent extends BaseIntent {
  kind: "lookCards";
  playerId: string;
  zone: string;
  amount: number;
  from: "top" | "bottom";
}

export interface ChooseIntent extends BaseIntent {
  kind: "choose";
  from: "lookedCards" | "zone" | "targets";
  amount: number;
  upTo?: boolean;
  destinationIntents: RunnerIntent[];
}

export interface RevealIntent extends BaseIntent {
  kind: "reveal";
  targetIds: string[];
  zone?: string;
  amount?: number;
}

export interface PreventIntent extends BaseIntent {
  kind: "prevent";
  targetIds: string[];
  prevent:
    | "response"
    | "gainStatModifier"
    | "loseStatModifier"
    | "move"
    | "useAbility";
  duration?: string;
}

export interface ChargeIntent extends BaseIntent {
  kind: "charge";
  targetIds: string[];
  amount: number;
}

export interface SearchCardIntent extends BaseIntent {
  kind: "searchCard";
  playerId: string;
  zones: ("deck" | "trash" | "hand" | "field" | "removed")[];
  count: number;
  resultSlot: string;
  match: {
    exactCardNo?: string;
    exactName?: string;
    nameIncludes?: string;
    type?: "character" | "event" | "item" | "area";
    kind?: "character" | "event" | "item" | "area";
    owner?: "self" | "opponent" | "any";
  };
  revealToOpponent?: boolean;
  shuffleAfterSearch?: boolean;
}

export interface FreeUseIntent extends BaseIntent {
  kind: "freeUse";
  playerId: string;
  source: "searchResult";
  resultSlot: string;
  usageKind: "character" | "event" | "item" | "area";
  ignoreCost: true;
}

export interface PromptIntent extends BaseIntent {
  kind: "prompt";
  promptType?: "optionalBranch" | "chooseOne";
  prompt: string;
  optionalIntents?: RunnerIntent[];
  elseIntents?: RunnerIntent[];
  choices?: Array<{
    index: number;
    label: string;
    intents: RunnerIntent[];
  }>;
}

export interface RunnerResult {
  ok: boolean;
  intents: RunnerIntent[];
  errors: string[];
}

export class CardScriptRunner {
  public run(
    scripts: CardEffectScript[] | undefined,
    state: RunnerStateView,
    context: RunnerContext,
  ): RunnerResult {
    if (!scripts || scripts.length === 0) {
      return { ok: true, intents: [], errors: [] };
    }

    const intents: RunnerIntent[] = [];
    const errors: string[] = [];

    for (const script of scripts) {
      if (!this.matchesTiming(script, context.timing)) continue;

      const conditionErrors = this.evaluateConditions(script.conditions ?? [], state, context);
      if (conditionErrors.length > 0) {
        errors.push(...conditionErrors);
        continue;
      }

      const actionResult = this.runActions(script.actions as AnyAction[], state, context);
      intents.push(...actionResult.intents);
      errors.push(...actionResult.errors);
    }

    return { ok: errors.length === 0, intents, errors };
  }

  private matchesTiming(script: CardEffectScript, timing: RunnerTimingContext): boolean {
    if (!script.timing) return true;
    return script.timing === timing;
  }

  private evaluateConditions(
    conditions: Condition[],
    state: RunnerStateView,
    context: RunnerContext,
  ): string[] {
    const errors: string[] = [];

    for (const condition of conditions) {
      switch (condition.type) {
        case "myTurn":
          if (context.actingPlayerId !== context.turnPlayerId) errors.push("Condition failed: myTurn");
          break;
        case "opponentTurn":
          if (context.actingPlayerId === context.turnPlayerId) errors.push("Condition failed: opponentTurn");
          break;
        case "inBattle":
          if (!Boolean(context.metadata?.inBattle)) errors.push("Condition failed: inBattle");
          break;
        case "ifDeckCountAtMost":
          if (!state.getDeckCount) errors.push("Condition check unavailable: ifDeckCountAtMost");
          else if (state.getDeckCount(context.actingPlayerId) > condition.value) {
            errors.push(`Condition failed: deckCountAtMost(${condition.value})`);
          }
          break;
        case "ifDeckCountAtLeast":
          if (!state.getDeckCount) errors.push("Condition check unavailable: ifDeckCountAtLeast");
          else if (state.getDeckCount(context.actingPlayerId) < condition.value) {
            errors.push(`Condition failed: deckCountAtLeast(${condition.value})`);
          }
          break;
        case "ifSourceEnteredFromHand":
          if (!state.didSourceEnterFromHand) errors.push("Condition check unavailable: ifSourceEnteredFromHand");
          else if (!state.didSourceEnterFromHand(context.sourceCard.id)) {
            errors.push("Condition failed: sourceEnteredFromHand");
          }
          break;
        case "custom":
          break;
        default:
          errors.push(`Unhandled condition: ${JSON.stringify(condition)}`);
      }
    }

    return errors;
  }

  private runActions(actions: AnyAction[], state: RunnerStateView, context: RunnerContext): RunnerResult {
    const intents: RunnerIntent[] = [];
    const errors: string[] = [];

    for (const action of actions) {
      const result = this.runAction(action, state, context);
      intents.push(...result.intents);
      errors.push(...result.errors);
    }

    return { ok: errors.length === 0, intents, errors };
  }

  private runAction(action: AnyAction, state: RunnerStateView, context: RunnerContext): RunnerResult {
    switch (action.type) {
      case "draw":
        return this.runDraw(action, state, context);
      case "moveCard":
        return this.runMoveCard(action, state, context);
      case "modifyStat":
        return this.runModifyStat(action, state, context);
      case "modifyProperty":
        return this.runModifyProperty(action, state, context);
      case "grantAbility":
        return this.runGrantAbility(action, state, context);
      case "removeAbility":
        return this.runRemoveAbility(action, state, context);
      case "applyState":
        return this.runApplyState(action, state, context);
      case "dealDamage":
        return this.runDealDamage(action, state, context);
      case "recover":
        return this.runRecover(action, state, context);
      case "shuffle":
        return this.runShuffle(action, state, context);
      case "lookCards":
        return this.runLookCards(action, state, context);
      case "choose":
        return this.runChoose(action, state, context);
      case "reveal":
        return this.runReveal(action, state, context);
      case "prevent":
        return this.runPrevent(action, state, context);
      case "sequence":
        return this.runSequence(action, state, context);
      case "searchCard":
        return this.runSearchCard(action, state, context);
      case "chooseOne":
        return this.runChooseOne(action, state, context);
      case "freeUse":
        return this.runFreeUse(action, state, context);
      case "charge":
        return this.runCharge(action, state, context);
      case "optionalElse":
        return this.runOptionalElse(action, state, context);
      default:
        return { ok: false, intents: [], errors: [`Unhandled action: ${JSON.stringify(action)}`] };
    }
  }

  private makeBase(context: RunnerContext): BaseIntent {
    return {
      kind: "base",
      sourceCardId: context.sourceCard.id,
      sourceCardNo: context.sourceCard.cardNo,
      timing: context.timing,
    };
  }

  private targetIds(selector: TargetSelector, state: RunnerStateView, context: RunnerContext): string[] {
    if (selector.kind === "source") return [context.sourceCard.id];
    if (selector.kind === "lookedCards") return context.lookedCardIds ?? [];
    return state.resolveTargets(selector, context).map((target) => target.id);
  }

  private runDraw(action: DrawAction, state: RunnerStateView, context: RunnerContext): RunnerResult {
    return {
      ok: true,
      intents: [{ ...this.makeBase(context), kind: "draw", playerId: state.resolvePlayer(action.player, context), amount: action.amount }],
      errors: [],
    };
  }

  private runMoveCard(action: MoveCardAction, state: RunnerStateView, context: RunnerContext): RunnerResult {
    return {
      ok: true,
      intents: [{
        ...this.makeBase(context),
        kind: "moveCard",
        targetIds: this.targetIds(action.target, state, context),
        from: action.from,
        to: action.to,
        amount: action.amount,
        upTo: action.upTo,
        random: action.random,
        faceUp: action.faceUp,
        position: action.position,
      }],
      errors: [],
    };
  }

  private runModifyStat(action: ModifyStatAction, state: RunnerStateView, context: RunnerContext): RunnerResult {
    return {
      ok: true,
      intents: [{
        ...this.makeBase(context),
        kind: "modifyStat",
        targetIds: this.targetIds(action.target, state, context),
        stat: action.stat,
        amount: action.amount,
        duration: action.duration,
        sourceTag: action.sourceTag,
      }],
      errors: [],
    };
  }

  private runModifyProperty(action: ModifyPropertyAction, state: RunnerStateView, context: RunnerContext): RunnerResult {
    return {
      ok: true,
      intents: [{
        ...this.makeBase(context),
        kind: "modifyProperty",
        targetIds: this.targetIds(action.target, state, context),
        property: action.property,
        operation: action.operation,
        value: action.value,
        duration: action.duration,
      }],
      errors: [],
    };
  }

  private runGrantAbility(action: GrantAbilityAction, state: RunnerStateView, context: RunnerContext): RunnerResult {
    return {
      ok: true,
      intents: [{
        ...this.makeBase(context),
        kind: "grantAbility",
        targetIds: this.targetIds(action.target, state, context),
        abilities: action.abilities,
        duration: action.duration,
      }],
      errors: [],
    };
  }

  private runRemoveAbility(action: RemoveAbilityAction, state: RunnerStateView, context: RunnerContext): RunnerResult {
    return {
      ok: true,
      intents: [{
        ...this.makeBase(context),
        kind: "removeAbility",
        targetIds: this.targetIds(action.target, state, context),
        modeType: action.modeType,
      }],
      errors: [],
    };
  }

  private runApplyState(action: ApplyStateAction, state: RunnerStateView, context: RunnerContext): RunnerResult {
    return {
      ok: true,
      intents: [{
        ...this.makeBase(context),
        kind: "applyState",
        targetIds: this.targetIds(action.target, state, context),
        state: action.state,
        value: action.value,
        duration: action.duration,
      }],
      errors: [],
    };
  }

  private runDealDamage(action: DealDamageAction, state: RunnerStateView, context: RunnerContext): RunnerResult {
    return {
      ok: true,
      intents: [{
        ...this.makeBase(context),
        kind: "dealDamage",
        targetPlayerId: action.targetPlayer ? state.resolvePlayer(action.targetPlayer, context) : undefined,
        targetCardIds: action.targetCard ? this.targetIds(action.targetCard, state, context) : undefined,
        amount: action.amount,
        damageKind: action.damageKind,
      }],
      errors: [],
    };
  }

  private runRecover(action: RecoverAction, state: RunnerStateView, context: RunnerContext): RunnerResult {
    return {
      ok: true,
      intents: [{
        ...this.makeBase(context),
        kind: "recover",
        zone: action.zone,
        targetPlayerId: typeof action.target === "string" ? state.resolvePlayer(action.target, context) : undefined,
        targetIds: typeof action.target === "string" ? undefined : this.targetIds(action.target, state, context),
        amount: action.amount,
        upTo: action.upTo,
        random: action.random,
      }],
      errors: [],
    };
  }

  private runShuffle(action: ShuffleAction, state: RunnerStateView, context: RunnerContext): RunnerResult {
    return {
      ok: true,
      intents: [{
        ...this.makeBase(context),
        kind: "shuffle",
        playerId: state.resolvePlayer(action.player, context),
        zone: action.zone,
      }],
      errors: [],
    };
  }

  private runLookCards(action: LookCardsAction, state: RunnerStateView, context: RunnerContext): RunnerResult {
    return {
      ok: true,
      intents: [{
        ...this.makeBase(context),
        kind: "lookCards",
        playerId: state.resolvePlayer(action.player, context),
        zone: action.zone,
        amount: action.amount,
        from: action.from,
      }],
      errors: [],
    };
  }

  private runChoose(action: ChooseAction, state: RunnerStateView, context: RunnerContext): RunnerResult {
    const destination = this.runActions((action.destinationActions ?? []) as AnyAction[], state, context);
    return {
      ok: destination.errors.length === 0,
      intents: [{
        ...this.makeBase(context),
        kind: "choose",
        from: action.from,
        amount: action.amount,
        upTo: action.upTo,
        destinationIntents: destination.intents,
      }],
      errors: destination.errors,
    };
  }

  private runReveal(action: RevealAction, state: RunnerStateView, context: RunnerContext): RunnerResult {
    const targetIds = typeof action.target === "string"
      ? [state.resolvePlayer(action.target, context)]
      : this.targetIds(action.target, state, context);

    return {
      ok: true,
      intents: [{
        ...this.makeBase(context),
        kind: "reveal",
        targetIds,
        zone: action.zone,
        amount: action.amount,
      }],
      errors: [],
    };
  }

  private runPrevent(action: PreventAction, state: RunnerStateView, context: RunnerContext): RunnerResult {
    const targetIds = typeof action.target === "string"
      ? [state.resolvePlayer(action.target, context)]
      : this.targetIds(action.target, state, context);

    return {
      ok: true,
      intents: [{
        ...this.makeBase(context),
        kind: "prevent",
        targetIds,
        prevent: action.prevent,
        duration: action.duration,
      }],
      errors: [],
    };
  }

  private runSequence(action: SequenceAction, state: RunnerStateView, context: RunnerContext): RunnerResult {
    return this.runActions(action.actions as AnyAction[], state, context);
  }

  private runSearchCard(
    action: Extract<AnyAction, { type: "searchCard" }>,
    state: RunnerStateView,
    context: RunnerContext,
  ): RunnerResult {
    const count = action.count ?? action.max ?? 1;
    const resultSlot = action.resultSlot ?? action.storeAs ?? "lastSearchResult";

    return {
      ok: true,
      intents: [{
        ...this.makeBase(context),
        kind: "searchCard",
        playerId: state.resolvePlayer(action.owner === "self" ? "self" : "opponent", context),
        zones: [...action.zones],
        count,
        resultSlot,
        match: { ...action.match },
        revealToOpponent: action.revealToOpponent,
        shuffleAfterSearch: action.shuffleAfterSearch,
      }],
      errors: [],
    };
  }

  private runChooseOne(
    action: Extract<AnyAction, { type: "chooseOne" }>,
    state: RunnerStateView,
    context: RunnerContext,
  ): RunnerResult {
    const choices: Array<{ index: number; label: string; intents: RunnerIntent[] }> = [];
    const errors: string[] = [];

    action.choices.forEach((choice, index) => {
      const normalized = Array.isArray(choice)
        ? { label: `choice-${index + 1}`, actions: choice }
        : { label: choice.label ?? `choice-${index + 1}`, actions: choice.actions };

      const result = this.runActions(normalized.actions as AnyAction[], state, context);
      choices.push({
        index,
        label: normalized.label,
        intents: result.intents,
      });
      errors.push(...result.errors);
    });

    return {
      ok: errors.length === 0,
      intents: [{
        ...this.makeBase(context),
        kind: "prompt",
        promptType: "chooseOne",
        prompt: action.prompt,
        choices,
      }],
      errors,
    };
  }

  private runFreeUse(
    action: Extract<AnyAction, { type: "freeUse" }>,
    state: RunnerStateView,
    context: RunnerContext,
  ): RunnerResult {
    return {
      ok: true,
      intents: [{
        ...this.makeBase(context),
        kind: "freeUse",
        playerId: context.actingPlayerId,
        source: "searchResult",
        resultSlot: action.resultSlot ?? action.sourceRef ?? "lastSearchResult",
        usageKind: action.usageKind ?? action.useKind ?? "area",
        ignoreCost: true,
      }],
      errors: [],
    };
  }

  private runCharge(action: Extract<AnyAction, { type: "charge" }>, state: RunnerStateView, context: RunnerContext): RunnerResult {
    return {
      ok: true,
      intents: [{
        ...this.makeBase(context),
        kind: "charge",
        targetIds: this.targetIds(action.target, state, context),
        amount: action.amount,
      }],
      errors: [],
    };
  }

  private runOptionalElse(action: Extract<AnyAction, { type: "optionalElse" }>, state: RunnerStateView, context: RunnerContext): RunnerResult {
    const optionalResult = this.runActions(action.optionalActions, state, context);
    const elseResult = this.runActions(action.elseActions, state, context);

    return {
      ok: optionalResult.errors.length === 0 && elseResult.errors.length === 0,
      intents: [{
        ...this.makeBase(context),
        kind: "prompt",
        promptType: "optionalBranch",
        prompt: action.prompt ?? "optionalElse",
        optionalIntents: optionalResult.intents,
        elseIntents: elseResult.intents,
      }],
      errors: [...optionalResult.errors, ...elseResult.errors],
    };
  }
}


export default CardScriptRunner;
