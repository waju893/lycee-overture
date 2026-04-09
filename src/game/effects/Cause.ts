import type {
  CauseCategory,
  CauseDescriptor,
  EffectOwnerKind,
  PlayerID,
  RelationToAffectedPlayer,
} from '../GameTypes';

function toRelation(
  controllerPlayerId: PlayerID | undefined,
  affectedPlayerId: PlayerID | undefined,
): RelationToAffectedPlayer | undefined {
  if (!controllerPlayerId || !affectedPlayerId) return undefined;
  return controllerPlayerId === affectedPlayerId ? 'self' : 'opponent';
}

export function createEffectCause(params: {
  controllerPlayerId?: PlayerID;
  affectedPlayerId?: PlayerID;
  sourceKind: Extract<EffectOwnerKind, 'character' | 'event' | 'item' | 'area' | 'handDeclaration'>;
  sourceCardId?: string;
  sourceEffectId?: string;
  declarationKind?: string;
}): CauseDescriptor {
  const isAbility = params.sourceKind === 'character';
  return {
    controllerPlayerId: params.controllerPlayerId,
    relationToAffectedPlayer: toRelation(params.controllerPlayerId, params.affectedPlayerId),
    category: isAbility ? 'ability' : 'effect',
    sourceKind: params.sourceKind,
    sourceCardId: params.sourceCardId,
    sourceEffectId: params.sourceEffectId,
    declarationKind: params.declarationKind,
    isEffect: true,
    isAbility,
  };
}

export function createRuleCause(params?: {
  controllerPlayerId?: PlayerID;
  affectedPlayerId?: PlayerID;
  declarationKind?: string;
}): CauseDescriptor {
  return {
    controllerPlayerId: params?.controllerPlayerId,
    relationToAffectedPlayer: toRelation(params?.controllerPlayerId, params?.affectedPlayerId),
    category: 'rule',
    sourceKind: 'rule',
    declarationKind: params?.declarationKind,
    isEffect: false,
    isAbility: false,
  };
}

export function createBattleCause(params?: {
  controllerPlayerId?: PlayerID;
  affectedPlayerId?: PlayerID;
  sourceCardId?: string;
  declarationKind?: string;
}): CauseDescriptor {
  return {
    controllerPlayerId: params?.controllerPlayerId,
    relationToAffectedPlayer: toRelation(params?.controllerPlayerId, params?.affectedPlayerId),
    category: 'battle',
    sourceKind: 'battle',
    sourceCardId: params?.sourceCardId,
    declarationKind: params?.declarationKind ?? 'attack',
    isEffect: false,
    isAbility: false,
  };
}

export function createCostCause(params?: {
  controllerPlayerId?: PlayerID;
  affectedPlayerId?: PlayerID;
  sourceCardId?: string;
  sourceEffectId?: string;
  declarationKind?: string;
}): CauseDescriptor {
  return {
    controllerPlayerId: params?.controllerPlayerId,
    relationToAffectedPlayer: toRelation(params?.controllerPlayerId, params?.affectedPlayerId),
    category: 'cost',
    sourceKind: 'cost',
    sourceCardId: params?.sourceCardId,
    sourceEffectId: params?.sourceEffectId,
    declarationKind: params?.declarationKind,
    isEffect: false,
    isAbility: false,
  };
}

export function isOpponentCause(
  cause: CauseDescriptor | undefined,
  affectedPlayerId: PlayerID,
): boolean {
  if (!cause?.controllerPlayerId) return false;
  return cause.controllerPlayerId !== affectedPlayerId;
}

export function isEffectCause(cause: CauseDescriptor | undefined): boolean {
  return Boolean(cause?.isEffect);
}

export function isAbilityCause(cause: CauseDescriptor | undefined): boolean {
  return Boolean(cause?.isAbility);
}
