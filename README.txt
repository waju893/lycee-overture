설치 루트:
C:\Users\DESKTOP\Desktop\lycee-overture

교체 파일:
- src/game/GameEngine.ts
- src/game/effects/EffectDSLRuntime.ts
- src/game/effects/EffectExecutor.ts

이번 최종 DSL 안정화 패치에서 고친 것:
1. step에서 생긴 이벤트를 같은 step의 normalize 대상으로 넘기도록 Runtime 수정
2. DSL definition lookup 완전 보강
   - string id
   - sample_ alias
   - object.effectId
   - object.id
   - object.definition
   - full definition object
3. trigger 경유 DSL 실행 복구
4. queue 기반 trigger loop 유지

적용 후:
cd C:\Users\DESKTOP\Desktop\lycee-overture
npm test
npx vitest run --config vitest.config.ts

목표:
Test Files 20 passed
Tests 41 passed
