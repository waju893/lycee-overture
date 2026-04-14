/**
 * Suggested path:
 *   src/game/cards/examples/LO6556.ts
 */

export const LO_6556 = {
  cardNo: "LO-6556",
  name: "ツインテールの悪魔 月野 舞",
  type: "character",
  attributes: ["sun"],
  useTarget: ["sun", "sun"],
  ap: 4,
  dp: 0,
  sp: 1,
  dmg: 3,
  text: [
    "[宣言] [C1]:{味方[日]キャラ１体}にＡＰ＋２・ＤＰ－２する。（１ターンに２回まで使用可能）",
    "[誘発] このキャラが手札から登場したとき、このキャラに２枚チャージできる。しない場合、相手は相手の手札を１枚デッキの下に置く。",
    "[誘発] 自ターン開始時、このキャラに１枚チャージできる。"
  ].join("\n"),
  parsedEffects: [
    {
      timing: "onUse",
      conditions: [{ type: "myTurn" }],
      note: "cost:C1 / usageLimitPerTurn:2",
      actions: [
        {
          type: "sequence",
          actions: [
            {
              type: "modifyStat",
              target: {
                side: "self",
                kind: "character",
                amount: 1,
                attributeFilter: ["sun"]
              },
              stat: "ap",
              amount: 2,
              duration: "untilEndOfTurn"
            },
            {
              type: "modifyStat",
              target: {
                side: "self",
                kind: "character",
                amount: 1,
                attributeFilter: ["sun"]
              },
              stat: "dp",
              amount: -2,
              duration: "untilEndOfTurn"
            }
          ]
        }
      ]
    },
    {
      timing: "onEnterFromHand",
      actions: [
        {
          type: "optionalElse",
          prompt: "이 캐릭터에 2장 차지할까?",
          optionalActions: [
            {
              type: "charge",
              target: { kind: "source" },
              amount: 2,
              mode: "may"
            }
          ],
          elseActions: [
            {
              type: "moveCard",
              from: "hand",
              to: "deck",
              target: {
                side: "opponent",
                kind: "card",
                zone: "hand",
                amount: 1
              },
              amount: 1,
              position: "bottom"
            }
          ]
        }
      ]
    },
    {
      timing: "onTurnStart",
      conditions: [{ type: "myTurn" }],
      actions: [
        {
          type: "charge",
          target: { kind: "source" },
          amount: 1,
          mode: "may"
        }
      ]
    }
  ]
} as const;
