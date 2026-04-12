import type {
  EffectDSLCompiled,
  EffectDSLDefinition,
  EffectDSLStep,
  EffectDSLValidationResult,
} from './EffectDSL';

function isPositiveInt(value: unknown): boolean {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

function validateStep(step: EffectDSLStep, index: number, errors: string[]): void {
  switch (step.type) {
    case 'draw':
      if (!isPositiveInt(step.count)) errors.push(`steps[${index}].count must be positive for draw`);
      return;
    case 'destroy':
      if (!isPositiveInt(step.count)) errors.push(`steps[${index}].count must be positive for destroy`);
      if (step.targetTiming === 'none') errors.push(`steps[${index}].targetTiming cannot be none for destroy`);
      return;
    case 'battleDestroy':
      if (!isPositiveInt(step.count)) errors.push(`steps[${index}].count must be positive for battleDestroy`);
      if (step.isDown !== true) errors.push(`steps[${index}].isDown must be true for battleDestroy`);
      return;
    case 'discard':
    case 'moveToHand':
    case 'charge':
      if (!isPositiveInt(step.count)) errors.push(`steps[${index}].count must be positive for ${step.type}`);
      return;
    case 'log':
      if (!step.message || !step.message.trim()) errors.push(`steps[${index}].message required for log`);
      return;
    default: {
      const exhaustive: never = step;
      return exhaustive;
    }
  }
}

export function validateEffectDSL(definition: EffectDSLDefinition | undefined | null): EffectDSLValidationResult {
  const errors: string[] = [];

  if (!definition) {
    errors.push('definition is undefined');
    return { ok: false, errors };
  }

  if (!definition.id || !definition.id.trim()) errors.push('definition.id is required');
  if (!Array.isArray(definition.steps) || definition.steps.length === 0) {
    errors.push('definition.steps must contain at least one step');
  } else {
    definition.steps.forEach((step, index) => validateStep(step, index, errors));
  }
  return { ok: errors.length === 0, errors };
}

export function compileEffectDSL(definition: EffectDSLDefinition): EffectDSLCompiled {
  const validation = validateEffectDSL(definition);
  if (!validation.ok) throw new Error(`Invalid Effect DSL: ${validation.errors.join(' | ')}`);
  return { definition, normalizedSteps: [...definition.steps] };
}
