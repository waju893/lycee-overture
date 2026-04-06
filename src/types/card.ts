export type CardType = "Character" | "Event" | "Item" | "Area" | string;

export type CardAttribute =
  | "Sun"
  | "Moon"
  | "Flower"
  | "Snow"
  | "Space"
  | "Star"
  | string;

export type CardMeta = {
  id: string;
  name: string;

  code: string;
  baseCode?: string;
  number?: string;
  no?: number;

  kana?: string;

  type?: CardType;
  attribute?: CardAttribute;
  color?: CardAttribute;

  attributesList?: string[];
  useTarget?: string | string[] | 0;

  rarity?: string;
  cost?: number | null;

  ex?: number | null;
  ap?: number | null;
  dp?: number | null;
  sp?: number | null;
  dmg?: number | null;

  imageUrl: string;
  detailUrl?: string;

  leader?: boolean;

  keyeffects?: number[];
  keyEffects?: number[];

  text?: string;
  flavor?: string;
};