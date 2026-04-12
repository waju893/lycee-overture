import { describe, expect, it } from 'vitest';
import { compileEffectDSL, validateEffectDSL } from '../effects/EffectDSLCompiler';
import { SAMPLE_EFFECT_DSL_CATALOG } from '../effects/SampleEffectCatalog';

describe('EffectDSL', () => {
  it('accepts a simple destroy effect with resolution-time targeting', () => {
    const definition = SAMPLE_EFFECT_DSL_CATALOG.destroy_opponent_character;
    const result = validateEffectDSL(definition);

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);

    const compiled = compileEffectDSL(definition);
    expect(compiled.normalizedSteps.length).toBe(1);
    expect(compiled.normalizedSteps[0].type).toBe('destroy');
  });

  it('distinguishes battleDestroy from normal destroy', () => {
    const definition = SAMPLE_EFFECT_DSL_CATALOG.battle_destroy_opponent_character;
    const compiled = compileEffectDSL(definition);

    expect(compiled.normalizedSteps[0].type).toBe('battleDestroy');
    expect((compiled.normalizedSteps[0] as any).isDown).toBe(true);
  });

  it('rejects invalid draw count', () => {
    const result = validateEffectDSL({
      id: 'bad_draw',
      steps: [
        {
          type: 'draw',
          player: 'self',
          count: 0,
        },
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
