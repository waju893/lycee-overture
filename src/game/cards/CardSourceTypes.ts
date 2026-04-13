import type { CardType } from '../GameTypes';

export interface RawCardSource {
  cardNo: string;
  name: string;
  cardType: CardType;
  text: string;
  tags?: string[];
}

export interface CardScriptBuildResult {
  ok: boolean;
  cardId: string;
  cardDefinition?: import('./CardDefinition').CardDefinition;
  unsupportedReason?: string;
}
