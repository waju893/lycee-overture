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
        message: 'after destroy step',
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

  sample_destroy_declared_target: {
    id: 'sample_destroy_declared_target',
    text: '선언 시 선택된 상대 캐릭터를 그대로 파기한다.',
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

  sample_destroy_resolution_target: {
    id: 'sample_destroy_resolution_target',
    text: '해결 시 현재 존재하는 상대 캐릭터를 파기한다.',
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

  sample_mill_opponent_two: {
    id: 'sample_mill_opponent_two',
    text: '상대 덱 위에서 2장을 버린다.',
    triggerTiming: 'manual',
    steps: [
      {
        type: 'mill',
        player: 'opponent',
        count: 2,
      },
    ],
  },

  sample_move_opponent_to_hand: {
    id: 'sample_move_opponent_to_hand',
    text: '상대 캐릭터 1체를 패로 되돌린다.',
    triggerTiming: 'manual',
    steps: [
      {
        type: 'move',
        target: 'opponent_character',
        count: 1,
        targetTiming: 'resolutionTime',
        destination: 'hand',
      },
    ],
  },

  sample_tap_opponent_character: {
    id: 'sample_tap_opponent_character',
    text: '상대 캐릭터 1체를 행동 완료 상태로 한다.',
    triggerTiming: 'manual',
    steps: [
      {
        type: 'tap',
        target: 'opponent_character',
        count: 1,
        targetTiming: 'resolutionTime',
      },
    ],
  },

  sample_untap_opponent_character: {
    id: 'sample_untap_opponent_character',
    text: '상대 캐릭터 1체를 미행동 상태로 한다.',
    triggerTiming: 'manual',
    steps: [
      {
        type: 'untap',
        target: 'opponent_character',
        count: 1,
        targetTiming: 'resolutionTime',
      },
    ],
  },

  sample_optional_destroy_opponent: {
    id: 'sample_optional_destroy_opponent',
    text: '가능하면 상대 캐릭터 1체를 파기한다.',
    triggerTiming: 'manual',
    steps: [
      {
        type: 'destroy',
        target: 'opponent_character',
        count: 1,
        targetTiming: 'resolutionTime',
        optionalTarget: true,
      },
    ],
  },

  sample_multi_destroy_two_opponents: {
    id: 'sample_multi_destroy_two_opponents',
    text: '상대 캐릭터를 최대 2체 파기한다.',
    triggerTiming: 'manual',
    steps: [
      {
        type: 'destroy',
        target: 'opponent_character',
        count: 2,
        targetTiming: 'resolutionTime',
        multiTarget: true,
      },
    ],
  },

  sample_filter_untapped_tap: {
    id: 'sample_filter_untapped_tap',
    text: '미행동 상태의 상대 캐릭터 1체를 행동 완료 상태로 한다.',
    triggerTiming: 'manual',
    steps: [
      {
        type: 'tap',
        target: 'opponent_character',
        count: 1,
        targetTiming: 'resolutionTime',
        filter: 'untapped',
      },
    ],
  },

};
