Lycee Overture attack response window patch v6

핵심 규칙
- 공격 선언 직후 바로 방어자 판정을 하지 않음
- 먼저 공격 선언 대응 창을 연다
- 대응 선언 stack이 전부 처리된 다음
  - 같은 열 미행동 DF 후보를 다시 확인
  - 상대가 방어할지 안 할지 결정
- 그 뒤에 battle priority window 진행
- 양쪽 PASS 후 defender 없으면 direct attack

포함 파일
- src/game/GameEngine.ts
- src/game/__tests__/BattleResolution.test.ts
- src/game/__tests__/RuleViolation.test.ts
- src/game/__tests__/MinimalPlayableEngine.test.ts

적용 방법
- zip을 풀고 같은 경로에 그대로 덮어쓰기

테스트
npm test
npx vitest run --config vitest.config.ts

GitHub 동기화
git add src/game/GameEngine.ts
git add src/game/__tests__/BattleResolution.test.ts
git add src/game/__tests__/RuleViolation.test.ts
git add src/game/__tests__/MinimalPlayableEngine.test.ts
git commit -m "Add attack response window before defender decision"
git push
