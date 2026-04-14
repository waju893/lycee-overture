export const BUSINESS_PARTNER_TRIGGER_EXAMPLE = [
  {
    timing: "onEnter",
    actions: [
      {
        type: "chooseOne",
        prompt: "하나를 선택한다.",
        choices: [
          {
            label: "1장 드로우",
            actions: [{ type: "draw", amount: 1 }],
          },
          {
            label: "비즈니스 파트너를 무상 배치",
            actions: [
              {
                type: "searchCard",
                owner: "self",
                zones: ["trash", "deck"],
                count: 1,
                resultSlot: "business_partner_target",
                match: {
                  exactName: "ビジネスパートナー",
                  type: "area",
                },
                revealToOpponent: true,
                shuffleAfterSearch: true,
              },
              {
                type: "freeUse",
                source: "searchResult",
                resultSlot: "business_partner_target",
                usageKind: "area",
                ignoreCost: true,
              },
            ],
          },
        ],
      },
    ],
  },
] as const;
