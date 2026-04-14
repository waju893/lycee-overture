import type { Rule } from "./LyceeRuleRegistry.ts";

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
  ruleMoveToHand,
  ruleMoveToTrash,
  ruleMoveToDeckBottom,
  ruleMoveToDeckTop,
];
