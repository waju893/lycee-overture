import type { RawCardSource } from './CardSourceTypes';

export const REAL_CARD_SOURCES: RawCardSource[] = [
  {
    cardNo: 'LO-0235',
    name: '秘密のアルバイト',
    cardType: 'event',
    text: 'カードを2枚引く',
    tags: ['lycee', 'real-card', 'draw'],
  },
  {
    cardNo: 'LO-6644',
    name: '夢の銃弾',
    cardType: 'event',
    text: '対応・バトル中を除く自ターン中に使用する。{相手キャラ１体}を行動済みにする。',
    tags: ['lycee', 'real-card', 'tap', 'target', 'timing:self-turn'],
  },
  {
    cardNo: 'LO-0094',
    name: 'フォウ',
    cardType: 'event',
    text: '味方キャラ２体を未行動にする。',
    tags: ['lycee', 'real-card', 'untap', 'multi-target'],
  },
  {
    cardNo: 'LO-3795',
    name: '〇×クイズ大会',
    cardType: 'event',
    text: '自分のデッキの上のカード１枚を公開する。そのカードのコストが偶数の場合、２枚ドローする。（同番号のイベントは１ターンに１回まで使用可能）',
    tags: ['lycee', 'real-card', 'reveal', 'conditional', 'parity', 'once-per-turn'],
  },
];

export function findRealCardSource(cardNo: string): RawCardSource | undefined {
  return REAL_CARD_SOURCES.find((card) => card.cardNo === cardNo);
}
