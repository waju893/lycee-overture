import type { CardDefinition } from './CardDefinition';
import { registerCardDefinitions } from './CardRegistry';

export const SAMPLE_CARDS: CardDefinition[] = [

  {
    cardId: 'LO-0235',
    name: '秘密のアルバイト',
    cardType: 'event',
    text: '카드를 2장 뽑는다.',
    tags: ['lycee', 'draw'],
    effects: [
      {
        id: 'LO-0235_draw_2',
        definition: {
          id: 'LO-0235_draw_2',
          text: '카드를 2장 뽑는다.',
          triggerTiming: 'manual',
          steps: [
            {
              type: 'draw',
              player: 'self',
              count: 2,
            },
          ],
        },
      },
    ],
  },
  {
    cardId: 'LO-9001',
    name: '샘플 드로우 이벤트',
    cardType: 'event',
    text: '카드를 1장 뽑는다.',
    tags: ['sample', 'draw'],
    effects: [
      {
        id: 'sample_draw_1',
        definition: {
          id: 'sample_draw_1',
          text: '카드를 1장 뽑는다.',
          triggerTiming: 'manual',
          steps: [
            {
              type: 'draw',
              player: 'self',
              count: 1,
            },
          ],
        },
      },
    ],
  },
  {
    cardId: 'LO-9002',
    name: '샘플 탭 효과',
    cardType: 'event',
    text: '상대 캐릭터 1장을 탭한다.',
    tags: ['sample', 'tap'],
    effects: [
      {
        id: 'sample_tap_opponent',
        definition: {
          id: 'sample_tap_opponent',
          text: '상대 캐릭터 1장을 탭한다.',
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
      },
    ],
  },
  {
    cardId: 'LO-9003',
    name: '샘플 스토리지 생성',
    cardType: 'event',
    text: '내 비공개 저장소 1개를 만든다.',
    tags: ['sample', 'storage'],
    storageEffects: [
      {
        id: 'sample_create_storage',
        steps: [
          {
            type: 'ensureStorage',
            player: 'self',
            storageId: 'sample_secret_box',
            label: '샘플 비밀 상자',
            visibility: 'private',
          },
        ],
      },
      {
        id: 'sample_move_to_storage',
        steps: [
          {
            type: 'ensureStorage',
            player: 'self',
            storageId: 'sample_secret_box',
            label: '샘플 비밀 상자',
            visibility: 'private',
          },
          {
            type: 'moveToStorage',
            player: 'self',
            storageId: 'sample_secret_box',
            target: 'thisCard',
            visibility: 'private',
          },
        ],
      },
    ],
  },
];

export function registerSampleCards(): void {
  registerCardDefinitions(SAMPLE_CARDS);
}
