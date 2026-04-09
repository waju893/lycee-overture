Lycee pipeline engine patch v1

교체 파일
- src/game/GameEngine.ts

새로 추가할 폴더/파일
- src/game/engine/cloneState.ts
- src/game/engine/replay.ts
- src/game/engine/ids.ts
- src/game/engine/utils.ts
- src/game/engine/startupPipeline.ts
- src/game/engine/turnPipeline.ts
- src/game/engine/declarePipeline.ts
- src/game/engine/resolvePipeline.ts
- src/game/engine/battlePipeline.ts
- src/game/engine/declarationApi.ts
- src/game/declarations/index.ts
- src/game/declarations/resolveUseCharacter.ts
- src/game/declarations/resolveUseAbility.ts
- src/game/declarations/resolveChargeCharacter.ts
- src/game/declarations/resolveAttack.ts

적용 방식
1) zip 압축을 풀기
2) 프로젝트 루트에 그대로 덮어쓰기
3) 테스트 실행

현재 이번 1차 리팩터링에서 한 일
- GameEngine.ts를 얇은 오케스트레이터로 변경
- 선언 생성 / 선언 해결 / 스타트업 / 턴 진행 / 배틀 처리 분리
- declaration resolver registry 도입
- 기존 public API(createEmptyGameState, declare, passResponse, reduceGameState) 유지

이번 1차 리팩터링에서 아직 안 한 일
- useEvent / useItem / useArea / move resolver 추가
- trigger queue 실해결
- state-based rule 파이프라인 연결
- support / hand ability / skill declaration 전개

권장 다음 작업 순서
1) resolveUseEvent / resolveUseItem / resolveUseArea 추가
2) declarePipeline에 kind별 legality validator 분리
3) triggerPipeline.ts 추가
4) PracticeBoard에서 reducer 직통 경로만 쓰도록 정리
