파일 설명
- src/tools/card-import/generateUnresolvedReport.ts
  - public/cards 아래 LO-xxxx.json들을 읽어서
  - parseLyceeEffectText(text)를 실행하고
  - unresolvedTextLines를 빈도순으로 모아서
  - _unresolved_parse_report.json을 생성합니다.

기본 출력 위치
- public/cards/_unresolved_parse_report.json

기본 실행
npx ts-node src/tools/card-import/generateUnresolvedReport.ts "C:/Users/DESKTOP/Desktop/lycee-overture/public/cards"

출력 경로 직접 지정
npx ts-node src/tools/card-import/generateUnresolvedReport.ts "C:/Users/DESKTOP/Desktop/lycee-overture/public/cards" "C:/Users/DESKTOP/Desktop/lycee-overture/public/cards/_unresolved_parse_report.json"

권장 다음 순서
1. unresolved report 생성
2. 상위 20~50개 패턴 확인
3. 실존 카드 패턴만 rule로 추가
4. 다시 report 생성해서 감소 추적
