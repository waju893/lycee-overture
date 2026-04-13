import type { EffectDSLDefinition } from '../effects/EffectDSL';
import type { RawCardSource } from './CardSourceTypes';

export interface CardTextMapRule {
  match: (card: RawCardSource) => boolean;
  buildEffect: (card: RawCardSource) => EffectDSLDefinition;
}

export const CARD_TEXT_MAP_RULES: CardTextMapRule[] = [
  {
    match: (card) =>
      card.cardNo === 'LO-0235' ||
      card.name === '秘密のアルバイト' ||
      card.text.includes('2장 드로우') ||
      card.text.includes('カードを2枚引く'),
    buildEffect: (card) => ({
      id: `${card.cardNo}_draw_2`,
      text: card.text,
      triggerTiming: 'manual',
      steps: [
        {
          type: 'draw',
          player: 'self',
          count: 2,
        },
      ],
    }),
  },
  {
    match: (card) =>
      card.cardNo === 'LO-6644' ||
      card.name === '夢の銃弾' ||
      (card.text.includes('相手キャラ１体') && card.text.includes('行動済み')),
    buildEffect: (card) => ({
      id: `${card.cardNo}_tap_opponent_1`,
      text: card.text,
      triggerTiming: 'manual',
      steps: [
        {
          type: 'tap',
          target: 'opponent_character',
          count: 1,
          targetTiming: 'resolutionTime',
        },
      ],
    }),
  },
  {
    match: (card) =>
      card.cardNo === 'LO-0094' ||
      card.name === 'フォウ' ||
      (card.text.includes('味方キャラ２体') && card.text.includes('未行動')),
    buildEffect: (card) => ({
      id: `${card.cardNo}_untap_self_2`,
      text: card.text,
      triggerTiming: 'manual',
      steps: [
        {
          type: 'untap',
          target: 'self_character',
          count: 2,
          targetTiming: 'resolutionTime',
          multiTarget: true,
        },
      ],
    }),
  },
];

export function findMappedEffectDefinition(card: RawCardSource): EffectDSLDefinition | undefined {
  const rule = CARD_TEXT_MAP_RULES.find((item) => item.match(card));
  return rule?.buildEffect(card);
}

/**
 * LO-3795 is intentionally not mapped into plain EffectDSL yet.
 * It needs reveal + condition + parity + once-per-turn tracking,
 * so it should be exercised through sandbox helpers first.
 */
export function needsSandboxExecution(card: RawCardSource): boolean {
  return card.cardNo === 'LO-3795';
}
