import { describe, expect, it } from 'vitest';
import { buildCardDefinitionFromSource } from '../cards/CardScriptFactory';
import type { RawCardSource } from '../cards/CardSourceTypes';

describe('CardScriptFactory', () => {
  it('builds LO-0235 into a draw-2 CardDefinition', () => {
    const source: RawCardSource = {
      cardNo: 'LO-0235',
      name: '秘密のアルバイト',
      cardType: 'event',
      text: 'カードを2枚引く',
      tags: ['lycee', 'real-card', 'draw'],
    };

    const result = buildCardDefinitionFromSource(source);

    expect(result.ok).toBe(true);
    expect(result.cardDefinition?.cardId).toBe('LO-0235');
    expect(result.cardDefinition?.name).toBe('秘密のアルバイト');
    expect(result.cardDefinition?.effects?.[0]?.id).toBe('LO-0235_draw_2');
    expect(result.cardDefinition?.effects?.[0]?.definition.steps).toEqual([
      {
        type: 'draw',
        player: 'self',
        count: 2,
      },
    ]);
  });
});
