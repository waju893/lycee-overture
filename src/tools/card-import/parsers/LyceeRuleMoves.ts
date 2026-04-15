import type { Rule } from "./LyceeRuleRegistry.ts";

const rulePlaceIntoNamedPlace: Rule = (body) => {
  const m = body.match(/自分の(ゴミ箱|手札|デッキの上)の?(?:カード|キャラ)(\d+)枚を自分の「([^」]+)」置き場に置(?:く|ける)/);
  if (!m) return null;
  return {
    ruleId: "placeCard:namedPlace",
    actions: [{
      type: "placeCard",
      owner: "self",
      from: m[1] === "ゴミ箱" ? "trash" : m[1] === "手札" ? "hand" : "deckTop",
      to: "namedPlace",
      count: Number(m[2]),
      placeName: m[3],
    }],
  };
};

const rulePlaceUnderThisCard: Rule = (body) => {
  const m = body.match(/自分の(ゴミ箱|手札|デッキの上)のカード(\d+)枚をこのキャラの下に置く/);
  if (!m) return null;
  return {
    ruleId: "placeCard:underThisCard",
    actions: [{
      type: "placeCard",
      owner: "self",
      from: m[1] === "ゴミ箱" ? "trash" : m[1] === "手札" ? "hand" : "deckTop",
      to: "underThisCard",
      count: Number(m[2]),
    }],
  };
};

const rulePlaceBesideThisCard: Rule = (body) => {
  if (!/このキャラを横に置く/.test(body)) return null;
  return {
    ruleId: "placeCard:besideThisCard",
    actions: [{
      type: "placeCard",
      owner: "self",
      from: "field",
      to: "besideThisCard",
      count: 1,
    }],
  };
};

const rulePlaceChargeOnThisCard: Rule = (body) => {
  const m = body.match(/自分の(ゴミ箱|手札|デッキの上)のカード(\d+)枚をこのキャラにチャージとして置く/);
  if (!m) return null;
  return {
    ruleId: "placeCard:chargeOnThisCard",
    actions: [{
      type: "placeCard",
      owner: "self",
      from: m[1] === "ゴミ箱" ? "trash" : m[1] === "手札" ? "hand" : "deckTop",
      to: "chargeOnThisCard",
      count: Number(m[2]),
    }],
  };
};

const ruleMoveToHand: Rule = (body) => {
  const m = body.match(/(\d+)枚?.*(手札に入れる|手札に戻す)/);
  if (!m) return null;
  return {
    ruleId: "moveCard:toHand",
    actions: [{
      type: "moveCard",
      owner: /相手/.test(body) ? "opponent" : "self",
      from: /ゴミ箱/.test(body) ? "trash" : /デッキ/.test(body) ? "deck" : "field",
      to: "hand",
      count: Number(m[1] ?? "1"),
    }],
  };
};

const ruleMoveToTrash: Rule = (body) => {
  const m = body.match(/(\d+)枚?.*ゴミ箱に置く/);
  if (!m) return null;
  return {
    ruleId: "moveCard:toTrash",
    actions: [{
      type: "moveCard",
      owner: /相手/.test(body) ? "opponent" : "self",
      from: /手札/.test(body) ? "hand" : /デッキ/.test(body) ? "deck" : "field",
      to: "trash",
      count: Number(m[1] ?? "1"),
    }],
  };
};

const ruleMoveToDeckBottom: Rule = (body) => {
  const m = body.match(/(\d+)枚?.*デッキの一番下に置く/);
  if (!m) return null;
  return {
    ruleId: "moveCard:toDeckBottom",
    actions: [{
      type: "moveCard",
      owner: /相手/.test(body) ? "opponent" : "self",
      from: /手札/.test(body) ? "hand" : /ゴミ箱/.test(body) ? "trash" : "field",
      to: "deckBottom",
      count: Number(m[1] ?? "1"),
    }],
  };
};

const ruleMoveToDeckTop: Rule = (body) => {
  const m = body.match(/(\d+)枚?.*デッキの上に置く/);
  if (!m) return null;
  return {
    ruleId: "moveCard:toDeckTop",
    actions: [{
      type: "moveCard",
      owner: /相手/.test(body) ? "opponent" : "self",
      from: /手札/.test(body) ? "hand" : /ゴミ箱/.test(body) ? "trash" : "field",
      to: "deckTop",
      count: Number(m[1] ?? "1"),
    }],
  };
};

export const moveRules: Rule[] = [
  rulePlaceIntoNamedPlace,
  rulePlaceUnderThisCard,
  rulePlaceBesideThisCard,
  rulePlaceChargeOnThisCard,
  ruleMoveToHand,
  ruleMoveToTrash,
  ruleMoveToDeckBottom,
  ruleMoveToDeckTop,
];
