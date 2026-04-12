적용 방법

1. 이 zip의 GameEngine.ts를 프로젝트의 src/game/GameEngine.ts에 덮어쓰기
2. 프로젝트 루트에서 npm test 실행

이번 수정 핵심
- Effect DSL resolver가 id 없는 raw DSL({ steps: [...] })도 허용
- compiled DSL({ normalizedSteps: [...] })도 허용
- wrapper.definition 안의 raw DSL도 허용

즉, executeEffectDefinitionInEngine()에 전달되는 DSL 형태가 달라도 definition undefined로 죽지 않도록 보강한 패치입니다.
