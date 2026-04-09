import type { EffectDescriptor, EffectOwnerKind, EngineEvent, PlayerID } from '../GameTypes';

export function isAbilityOwnerKind(ownerKind: EffectOwnerKind): boolean {
  return ownerKind === 'character';
}

export function buildEffectDescriptor(params: {
  controller: PlayerID;
  ownerKind: EffectOwnerKind;
  sourceCardId?: string;
  sourceCharacterId?: string;
  effectId?: string;
  label?: string;
  metadata?: Record<string, unknown>;
}): EffectDescriptor {
  return {
    controller: params.controller,
    ownerKind: params.ownerKind,
    sourceCardId: params.sourceCardId,
    sourceCharacterId: params.sourceCharacterId,
    effectId: params.effectId,
    label: params.label,
    metadata: params.metadata,
    isEffect: true,
    isAbility: isAbilityOwnerKind(params.ownerKind),
  };
}

export function buildCharacterAbilityDescriptor(params: {
  controller: PlayerID;
  sourceCardId: string;
  effectId?: string;
  label?: string;
  metadata?: Record<string, unknown>;
}): EffectDescriptor {
  return buildEffectDescriptor({
    controller: params.controller,
    ownerKind: 'character',
    sourceCardId: params.sourceCardId,
    sourceCharacterId: params.sourceCardId,
    effectId: params.effectId,
    label: params.label,
    metadata: params.metadata,
  });
}

export function isOpponentEffect(event: EngineEvent, playerId: PlayerID): boolean {
  return Boolean(event.cause && event.cause.controller !== playerId && event.cause.isEffect);
}

export function isOpponentAbility(event: EngineEvent, playerId: PlayerID): boolean {
  return Boolean(event.cause && event.cause.controller !== playerId && event.cause.isAbility);
}
