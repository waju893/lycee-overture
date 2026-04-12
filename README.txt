설치 루트:
C:\Users\DESKTOP\Desktop\lycee-overture

이번 ZIP 내용:
- src/game/GameEngine.ts 전체 교체본
- src/game/__tests__/EffectDestroySemantics.test.ts 추가

목적:
- effect destroy 전용 엔진 진입점 추가
- effect destroy = destroy only / left field / discard 이동 / DOWN 없음 검증

적용 후 테스트:
cd C:\Users\DESKTOP\Desktop\lycee-overture
npm test
npx vitest run --config vitest.config.ts
