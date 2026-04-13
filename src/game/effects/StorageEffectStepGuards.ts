import type {
  EnsureStorageEffectStep,
  MoveFromStorageEffectStep,
  MoveToRemovedFromGameEffectStep,
  MoveToSetAsideEffectStep,
  MoveToStorageEffectStep,
  StorageEffectStep,
} from './StorageEffectStepTypes';

export function isEnsureStorageEffectStep(
  step: StorageEffectStep
): step is EnsureStorageEffectStep {
  return step.type === 'ensureStorage';
}

export function isMoveToStorageEffectStep(
  step: StorageEffectStep
): step is MoveToStorageEffectStep {
  return step.type === 'moveToStorage';
}

export function isMoveFromStorageEffectStep(
  step: StorageEffectStep
): step is MoveFromStorageEffectStep {
  return step.type === 'moveFromStorage';
}

export function isMoveToRemovedFromGameEffectStep(
  step: StorageEffectStep
): step is MoveToRemovedFromGameEffectStep {
  return step.type === 'moveToRemovedFromGame';
}

export function isMoveToSetAsideEffectStep(
  step: StorageEffectStep
): step is MoveToSetAsideEffectStep {
  return step.type === 'moveToSetAside';
}

export function isStorageEffectStep(value: unknown): value is StorageEffectStep {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const step = value as { type?: unknown };

  return (
    step.type === 'ensureStorage' ||
    step.type === 'moveToStorage' ||
    step.type === 'moveFromStorage' ||
    step.type === 'moveToRemovedFromGame' ||
    step.type === 'moveToSetAside'
  );
}
