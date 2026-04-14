cardNo
카드 번호다. 예: LO-0001

title
카드의 메인 이름이다.
예: 騎士王

subName
카드의 서브 이름 또는 캐릭터 고유명 쪽이다.
예: セイバー／アルトリア・ペンドラゴン

name
title + subName을 합친 최종 표시용 이름이다.

rawTypeJa
일본어 원문 카드 종류다.
예: キャラクター

rawTypeKr
그 카드 종류를 한국어로 번역한 값이다.
예: 캐릭터

type
엔진에서 쓰기 위한 영문 정규화 타입이다.
예: character

rarity
레어도다.
예: R, U, P

attributes
카드 자체 속성이다.
예: 宙 → ["cosmos"]
여기는 중복 없이 보관하는 게 맞다.

useTarget
코스트 칸의 속성 요구값이다.
예: 宙宙宙면 원래는 ["cosmos", "cosmos", "cosmos"]처럼 반복 포함이 맞다.
지금 결과처럼 ["cosmos"] 하나만 나온 건 잘못 파싱된 상태다.

ap, dp, sp, dmg
전투 수치다.

ap: 공격력
dp: 방어력
sp: 이동/속도 계열 수치
dmg: 직접 공격 시 밀 수

ex
EX 값이다.

costRaw
사이트 원문 코스트 문자열이다.
예: 宙宙宙

restrictionRaw
구축 제한/사용 제한 칸의 원문 값이다. 비어 있을 수 있다.

typeTagsRaw
세부 타입 태그 원문이다.
예: サーヴァント

text
카드 효과 원문 텍스트다.

sourceUrl
어느 상세 페이지에서 가져왔는지 기록한 URL이다.