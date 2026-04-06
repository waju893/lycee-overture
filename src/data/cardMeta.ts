import rawCardMeta from "../../cardmeta.json";
import type { CardMeta, CardAttribute, CardType } from "../types/card";

type RawCardMeta = Record<string, any>;

function normalizeType(value?: string): CardType {
  const v = (value ?? "").trim().toLowerCase();

  switch (v) {
    case "character":
    case "キャラクター":
      return "Character";
    case "event":
    case "イベント":
      return "Event";
    case "item":
    case "アイテム":
      return "Item";
    case "area":
    case "エリア":
      return "Area";
    default:
      return value?.trim() || "Unknown";
  }
}

function normalizeAttribute(value?: string): CardAttribute | "" {
  const v = (value ?? "").trim().toLowerCase();

  switch (v) {
    case "":
      return "";

    case "sun":
    case "日":
      return "Sun";

    case "moon":
    case "月":
      return "Moon";

    case "flower":
    case "花":
      return "Flower";

    case "snow":
    case "雪":
      return "Snow";

    case "cosmos":
    case "宙":
      return "cosmos";

    case "space":
      return "cosmos";

    case "star":
    case "無":
    case "none":
      return "star";

    default:
      return value?.trim() || "";
  }
}

function normalizeAttributeListValue(value?: string): string {
  const v = (value ?? "").trim().toLowerCase();

  switch (v) {
    case "sun":
    case "日":
      return "sun";

    case "moon":
    case "月":
      return "moon";

    case "flower":
    case "花":
      return "flower";

    case "snow":
    case "雪":
      return "snow";

    case "cosmos":
    case "space":
    case "宙":
      return "cosmos";

    case "star":
    case "none":
    case "無":
      return "star";

    default:
      return v;
  }
}

function normalizeAttributeList(raw: RawCardMeta): string[] {
  const rawList = Array.isArray(raw.attributesList)
    ? raw.attributesList
    : Array.isArray(raw.attributes_list)
      ? raw.attributes_list
      : [];

  const result: string[] = [];
  const seen = new Set<string>();

  for (const item of rawList) {
    const normalized = normalizeAttributeListValue(String(item ?? ""));
    if (!normalized) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }

  return result;
}

function parseAttributesFromJp(rawAttributeJp?: string): string[] {
  const text = String(rawAttributeJp ?? "").trim();
  if (!text) return [];

  const map: Record<string, string> = {
    "雪": "snow",
    "月": "moon",
    "花": "flower",
    "宙": "cosmos",
    "日": "sun",
    "無": "star",
  };

  const result: string[] = [];
  const seen = new Set<string>();

  for (const ch of text) {
    const attr = map[ch];
    if (!attr) continue;
    if (seen.has(attr)) continue;
    seen.add(attr);
    result.push(attr);
  }

  return result;
}

function mergeAttributeLists(...lists: string[][]): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const list of lists) {
    for (const item of list) {
      const normalized = normalizeAttributeListValue(item);
      if (!normalized) continue;
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      result.push(normalized);
    }
  }

  return result;
}

function pickPrimaryAttribute(
  explicitAttribute: CardAttribute | "",
  attributesList: string[]
): CardAttribute | "" {
  if (explicitAttribute) return explicitAttribute;

  if (attributesList.length === 0) return "";

  const first = attributesList[0];

  switch (first) {
    case "sun":
      return "Sun";
    case "moon":
      return "Moon";
    case "flower":
      return "Flower";
    case "snow":
      return "Snow";
    case "cosmos":
      return "cosmos";
    case "star":
      return "star";
    default:
      return first;
  }
}

function normalizeUseTarget(raw: RawCardMeta): string {
  return String(
    raw.useTarget ??
    raw.target_jp ??
    raw.use_target ??
    ""
  );
}

function normalizeKeyeffects(raw: RawCardMeta): number[] {
  if (Array.isArray(raw.keyEffects)) {
    return raw.keyEffects.filter((v: unknown) => typeof v === "number");
  }

  if (Array.isArray(raw.keyeffects)) {
    return raw.keyeffects.filter((v: unknown) => typeof v === "number");
  }

  return [];
}

function normalizeCard(raw: RawCardMeta, index: number): CardMeta {
  const code = String(raw.code ?? raw.baseCode ?? `UNKNOWN-${index}`).toUpperCase();

  const explicitAttribute = normalizeAttribute(raw.attribute);
  const attributesFromList = normalizeAttributeList(raw);
  const attributesFromJp = parseAttributesFromJp(raw.attribute_jp);
  const mergedAttributes = mergeAttributeLists(attributesFromList, attributesFromJp);
  const primaryAttribute = pickPrimaryAttribute(explicitAttribute, mergedAttributes);

  const keyeffects = normalizeKeyeffects(raw);

  return {
    id: code.toLowerCase(),
    name: String(raw.name ?? code),

    code,
    baseCode: String(raw.baseCode ?? code),
    number: String(raw.number ?? code),
    no: typeof raw.no === "number" ? raw.no : undefined,

    kana: String(raw.kana ?? ""),

    type: normalizeType(raw.type),
    attribute: primaryAttribute,
    color: primaryAttribute,

    attributesList: mergedAttributes,
    useTarget: normalizeUseTarget(raw),

    rarity: String(raw.rarity ?? ""),
    cost: raw.cost ?? null,

    ex: raw.ex ?? null,
    ap: raw.ap ?? null,
    dp: raw.dp ?? null,
    sp: raw.sp ?? null,
    dmg: raw.dmg ?? null,

    imageUrl: String(raw.imageUrl ?? ""),
    detailUrl: String(raw.detailUrl ?? ""),

    leader: Boolean(raw.leader),

    keyeffects,
    keyEffects: keyeffects,

    text: String(raw.text ?? ""),
    flavor: String(raw.flavor ?? ""),
  };
}

const rawCards = Array.isArray(rawCardMeta) ? rawCardMeta : [];

export const CARD_META: CardMeta[] = rawCards.map(normalizeCard);

export const CARD_META_BY_CODE: Record<string, CardMeta> = Object.fromEntries(
  CARD_META.map((card) => [card.code, card])
);