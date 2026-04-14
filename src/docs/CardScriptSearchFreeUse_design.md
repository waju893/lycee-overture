# Lycee 공통 설계안: searchCard + chooseOne + freeUse

목표 효과 예시:

> [誘発] このキャラが登場したとき、１枚ドローまたは自分のゴミ箱またはデッキから「ビジネスパートナー」１枚を探し無償で配置する

이 설계안은 카드 1장 하드코딩이 아니라, 아래 계열을 공통으로 받기 위한 최소 확장이다.

- 등장 시 A 또는 B 선택
- 덱 / 쓰레기통 / 패 / 제외존 등에서 특정 카드 탐색
- 찾은 카드를 무상 사용
- 특히 에리어는 `무상 배치`, 이벤트는 `무상 사용`, 아이템은 `무상 장비`로 확장 가능

## 핵심 원칙

1. `searchCard`는 카드 찾기만 담당한다.
2. `freeUse`는 찾은 카드를 비용 무시하고 사용하는 intent만 만든다.
3. `chooseOne`은 플레이어 선택을 prompt로 올린다.
4. 실제 상태 변경은 commit에서 처리한다.

---

## 1. 타입 계층에 추가할 것

### SearchCardAction
- owner, zones, count, match를 받는다.
- 결과는 commit 직전의 임시 선택 결과 컨텍스트에 저장한다.

### ChooseOneAction
- 선택지별 액션 시퀀스를 가진다.
- Runner 단계에서는 `prompt` intent를 만든다.

### FreeUseAction
- 이전 `searchCard` 결과를 참조해 비용 무시 사용을 요청한다.
- `usageKind`는 `character | event | item | area` 정도면 충분하다.

### CardMatchRule
- exactCardNo
- exactName
- nameIncludes
- type
- owner
같은 정도만 먼저 열어 두면 된다.

---

## 2. Runner에서 할 일

### searchCard
Runner는 바로 카드를 찾지 않는다.
대신 아래 의미의 intent를 만든다.

- searchable zones
- 매치 조건
- 최대 선택 수
- 다음 액션과 연결할 resultSlot

### chooseOne
Runner는 prompt intent를 만든다.
선택지는 각각 독립 액션 시퀀스로 보관한다.

### freeUse
Runner는 "search 결과 슬롯에 든 카드 1장을 비용 무시 사용" intent를 만든다.
아직 상태는 바꾸지 않는다.

---

## 3. PromptBuilder에서 할 일

### chooseOne
유저에게 A/B 선택 prompt를 만든다.
선택 결과에 따라 해당 branch actions를 다시 intents로 내린다.

### searchCard
- 검색 존이 공개존만 포함하면 commit 직행 가능
- 덱처럼 비공개존이 포함되면 search prompt 필요

즉 `searchCard`는 경우에 따라 prompt가 될 수도 있고, 자동 처리될 수도 있다.

예:
- trash only: 자동
- deck only: prompt
- trash + deck: prompt

---

## 4. Commit에서 할 일

### searchCard commit
- owner / zones 기준으로 후보 카드 목록을 만든다.
- 공개존만이면 조건 매치 시 자동 선택 가능
- 비공개존이 있으면 prompt에서 받은 selection을 검증한다.
- 선택 결과는 `resolvedSearchResults[resultSlot]`에 저장한다.

### freeUse commit
- `resultSlot`에서 카드를 가져온다.
- 카드 타입이 area면 area 사용 규칙으로 배치한다.
- `ignoreCost: true`로 처리한다.
- 가능하면 단순 이동보다 기존 use pipeline을 태우는 편이 좋다.

즉 추천 의미는:
- 나중에 `onUse`, `onPlace`, `onEnterField` 계열과 잘 연결됨

---

## 5. 이 카드의 parsedEffects 예시

```ts
[
  {
    timing: "onEnter",
    actions: [
      {
        type: "chooseOne",
        prompt: "하나를 선택한다",
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
]
```

---

## 6. 왜 이 방식이 현실적인가

- `searchCard`는 수많은 Lycee 카드에 재사용 가능
- `chooseOne`은 modal 선택 카드 전반에 재사용 가능
- `freeUse`는 무상 등장 / 무상 사용 / 무상 배치 / 무상 장비를 모두 포괄 가능

즉 이번 카드 1장을 위해 만든 기능이 아니라, 앞으로 자주 나오는 카드군 전체를 받는 기반이 된다.
