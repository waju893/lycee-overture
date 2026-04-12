import type { EffectDSLDefinition } from './EffectDSL';

/**
 * Sample registry entries only.
 * Safe scaffold for tests and engine wiring.
 */
export const SAMPLE_EFFECT_DSL_CATALOG: Record<string, EffectDSLDefinition> = {
  draw_one_on_destroy: {
    id: 'draw_one_on_destroy',
    text: '이 캐릭터가 파기되었을 때 카드 1장을 뽑는다.',
    triggerTiming: 'onDestroyed',
    steps: [
      {
        type: 'draw',
        player: 'self',
        count: 1,
      },
    ],
  },

  destroy_opponent_character: {
    id: 'destroy_opponent_character',
    text: '상대 캐릭터 1체를 파기한다.',
    triggerTiming: 'manual',
    steps: [
      {
        type: 'destroy',
        target: 'opponent_character',
        count: 1,
        targetTiming: 'resolutionTime',
      },
    ],
  },

  battle_destroy_opponent_character: {
    id: 'battle_destroy_opponent_character',
    text: '상대 캐릭터 1체를 전투 파기한다.',
    triggerTiming: 'manual',
    steps: [
      {
        type: 'battleDestroy',
        target: 'opponent_character',
        count: 1,
        targetTiming: 'resolutionTime',
        isDown: true,
      },
    ],
  },

  sample_draw_then_destroy: {
    id: 'sample_draw_then_destroy',
    text: '카드 1장을 뽑고, 상대 캐릭터 1체를 파기한다.',
    triggerTiming: 'manual',
    steps: [
      {
        type: 'draw',
        player: 'self',
        count: 1,
      },
      {
        type: 'destroy',
        target: 'opponent_character',
        count: 1,
        targetTiming: 'resolutionTime',
      },
    ],
  },

  sample_destroy_then_log: {
    id: 'sample_destroy_then_log',
    text: '상대 캐릭터 1체를 파기한 뒤 로그를 남긴다.',
    triggerTiming: 'manual',
    steps: [
      {
        type: 'destroy',
        target: 'opponent_character',
        count: 1,
        targetTiming: 'resolutionTime',
      },
      {
        type: 'log',
        message: 'after destroy',
      },
    ],
  },

  sample_declare_time_destroy: {
    id: 'sample_declare_time_destroy',
    text: '선언 시 선택한 상대 캐릭터 1체를 파기한다.',
    triggerTiming: 'manual',
    steps: [
      {
        type: 'destroy',
        target: 'opponent_character',
        count: 1,
        targetTiming: 'declareTime',
      },
    ],
  },

  sample_resolution_time_destroy: {
    id: 'sample_resolution_time_destroy',
    text: '해결 시 선택한 상대 캐릭터 1체를 파기한다.',
    triggerTiming: 'manual',
    steps: [
      {
        type: 'destroy',
        target: 'opponent_character',
        count: 1,
        targetTiming: 'resolutionTime',
      },
    ],
  },
};
