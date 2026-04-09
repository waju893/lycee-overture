src/game/GameTypes.ts

// Declaration stack limit for this implementation.
export const MAX_DECLARATION_STACK_DEPTH = 100;

export type PlayerId = 'P1' | 'P2';

export function getOpponentPlayerId(playerId: PlayerId): PlayerId {
  return playerId === 'P1' ? 'P2' : 'P1';
}

export type CardType = 'character' | 'event' | 'item' | 'area';

export type DeclarationType =
  | 'cardDeclaration'
  | 'effectDeclaration'
  | 'skillDeclaration'
  | 'handDeclaration'
  | 'attackDeclaration'
  | 'moveDeclaration';

export type DeclarationStatus =
  | 'pending'
  | 'awaitingResponse'
  | 'resolving'
  | 'resolved'
  | 'failed'
  | 'cancelled';

export interface RuleViolation {
  code: string;
  message: string;
}

export interface DeclarationFailure {
  code:
    | 'stackLimitExceeded'
    | 'noResponseWindow'
    | 'wrongResponder'
    | 'cannotRespondToOwnDeclaration'
    | 'invalidDeclaration'
    | 'timingNotAllowed'
    | 'ruleBlocked';
  message: string;
}

export interface TargetReference {
  cardId?: string;
  characterId?: string;
  playerId?: PlayerId;
  zone?: string;
  index?: number;
}

export interface BaseDeclaration {
  id: string;
  type: DeclarationType;
  status: DeclarationStatus;
  declaredBy: PlayerId;
  createdAt: number;

  // Response chain metadata.
  isResponse: boolean;
  respondedToDeclarationId?: string;
  responseWindowOpen: boolean;
  canBeRespondedTo: boolean;

  sourceCardId?: string;
  sourceCharacterId?: string;
  targets?: TargetReference[];
  metadata?: Record<string, unknown>;
  failure?: DeclarationFailure;
}

export interface CardDeclaration extends BaseDeclaration {
  type: 'cardDeclaration';
  cardId: string;
  cardType: CardType;
  zoneFrom: string;
  declarationKind: 'characterSpawn' | 'eventUse' | 'itemEquip' | 'areaDeploy';
}

export interface EffectDeclaration extends BaseDeclaration {
  type: 'effectDeclaration';
  effectId: string;
  sourceType: 'card' | 'character' | 'area' | 'item' | 'rule';
}

export interface SkillDeclaration extends BaseDeclaration {
  type: 'skillDeclaration';
  skillId: string;
  characterId: string;
}

export interface HandDeclaration extends BaseDeclaration {
  type: 'handDeclaration';
  handCardId: string;
  abilityId: string;
}

export interface AttackDeclaration extends BaseDeclaration {
  type: 'attackDeclaration';
  attackerId: string;
  attackColumn: number;
  defenderId?: string;
}

export interface MoveDeclaration extends BaseDeclaration {
  type: 'moveDeclaration';
  moverId: string;
  moveKind: 'step' | 'sidestep' | 'orderstep' | 'jump' | 'orderchange';
  from: { row: number; column: number };
  to?: { row: number; column: number };
  swapWithCharacterId?: string;
}

export type Declaration =
  | CardDeclaration
  | EffectDeclaration
  | SkillDeclaration
  | HandDeclaration
  | AttackDeclaration
  | MoveDeclaration;

export type DeclareActionInput =
  | {
      type: 'cardDeclaration';
      declaredBy: PlayerId;
      cardId: string;
      cardType: CardType;
      zoneFrom: string;
      declarationKind: CardDeclaration['declarationKind'];
      sourceCardId?: string;
      targets?: TargetReference[];
      metadata?: Record<string, unknown>;
    }
  | {
      type: 'effectDeclaration';
      declaredBy: PlayerId;
      effectId: string;
      sourceType: EffectDeclaration['sourceType'];
      sourceCardId?: string;
      sourceCharacterId?: string;
      targets?: TargetReference[];
      metadata?: Record<string, unknown>;
    }
  | {
      type: 'skillDeclaration';
      declaredBy: PlayerId;
      skillId: string;
      characterId: string;
      sourceCardId?: string;
      targets?: TargetReference[];
      metadata?: Record<string, unknown>;
    }
  | {
      type: 'handDeclaration';
      declaredBy: PlayerId;
      handCardId: string;
      abilityId: string;
      sourceCardId?: string;
      targets?: TargetReference[];
      metadata?: Record<string, unknown>;
    }
  | {
      type: 'attackDeclaration';
      declaredBy: PlayerId;
      attackerId: string;
      attackColumn: number;
      defenderId?: string;
      targets?: TargetReference[];
      metadata?: Record<string, unknown>;
    }
  | {
      type: 'moveDeclaration';
      declaredBy: PlayerId;
      moverId: string;
      moveKind: MoveDeclaration['moveKind'];
      from: MoveDeclaration['from'];
      to?: MoveDeclaration['to'];
      swapWithCharacterId?: string;
      sourceCardId?: string;
      targets?: TargetReference[];
      metadata?: Record<string, unknown>;
    };

export interface ActiveResponseWindow {
  topDeclarationId: string;
  responderPlayerId: PlayerId;
}

export interface DeclarationStackState {
  items: Declaration[];
  limit: number;
  activeResponseWindow?: ActiveResponseWindow;
}

export interface TriggeredEffect {
  id: string;
  controller: PlayerId;
  sourceCardId?: string;
  sourceCharacterId?: string;
  triggerEvent: string;
  optional: boolean;
  targets?: TargetReference[];
}

export interface TriggerQueueState {
  pendingGroups: TriggeredEffect[][];
}

export interface GameState {
  declarationStack: DeclarationStackState;
  triggerQueue: TriggerQueueState;
  log: string[];
}