import type { CardEffectScript } from "../CardScriptTypes";

export const businessPartnerEntryEffect: CardEffectScript = {
  timing: "onEnter",
  actions: [
    {
      type: "chooseOne",
      prompt: "1장 드로우 또는 비즈니스 파트너를 무상 배치한다",
      choices: [
        {
          label: "draw 1",
          actions: [
            {
              type: "draw",
              player: "self",
              amount: 1,
            },
          ],
        },
        {
          label: "free use business partner",
          actions: [
            {
              type: "searchCard",
              owner: "self",
              zones: ["trash", "deck"],
              count: 1,
              resultSlot: "businessPartnerHit",
              match: {
                exactName: "ビジネスパートナー",
                type: "area",
              },
              revealToOpponent: false,
              shuffleAfterSearch: true,
            },
            {
              type: "freeUse",
              source: "searchResult",
              resultSlot: "businessPartnerHit",
              usageKind: "area",
              ignoreCost: true,
            },
          ],
        },
      ],
    },
  ],
};

export const BUSINESS_PARTNER_DEMO = {
  cardNo: "LO-DEMO-BP",
  name: "Business Partner Demo",
  type: "character",
  parsedEffects: [businessPartnerEntryEffect],
} as const;
