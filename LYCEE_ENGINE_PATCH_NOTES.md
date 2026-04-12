# Lycee Overture next engine patch

## What I confirmed from the public repo
- `GameEngine.ts` already emits `EngineEvent` objects through `pushEngineEvent(...)`.
- It already imports `enqueueTriggerCandidates` and stores pending trigger groups in `state.triggerQueue.pendingGroups`.
- `GameTypes.ts` already defines `CauseDescriptor`, `TriggerTemplate`, `TriggerCandidate`, and `TriggerQueueState`.
- `GameRules.ts` currently initializes `triggerQueue.pendingGroups = []`.
- The public repo currently shows a minimal visible test file under `src/game/__tests__/MinimalPlayableEngine.test.ts`.

## Safe integration order
1. After declaration resolution / battle resolution:
   - run state-based rules
   - append generated events
   - newly generated events enqueue new trigger groups
2. When declaration stack is empty:
   - resolve next trigger group
   - for each trigger in ordered group, call effect resolver
   - after each trigger resolution, immediately re-run state-based rules
3. If trigger resolution creates new trigger groups:
   - place them before older pending groups

## Suggested GameEngine insertion points
### 1) Add imports
```ts
import { applyStateBasedRules } from './state/StateBasedRules';
import { resolveNextTriggerGroup } from './triggers/TriggerResolver';
import { resolveTriggeredEffect } from './effects/EffectEngine';
```

### 2) Add helper
```ts
function pushEngineEventNoTrigger(state: GameState, event: EngineEvent): void {
  state.events.push(event);
}

function flushStateBasedRules(state: GameState): void {
  const result = applyStateBasedRules(state);
  if (!result.changed) return;

  for (const event of result.generatedEvents) {
    pushEngineEvent(state, event as EngineEvent);
  }
}

function flushTriggers(state: GameState): void {
  while (state.declarationStack.length === 0 && state.triggerQueue.pendingGroups.length > 0) {
    const ordered = resolveNextTriggerGroup(state);
    for (const trigger of ordered) {
      resolveTriggeredEffect(state, trigger);
      flushStateBasedRules(state);
    }
  }
}
```

### 3) Call sequence
- after `resolveLatestLegacyDeclaration(state);`
- after `resolveCurrentBattle(state);`
- after `finalizeAttackResponses(state);` only if you want “response-ended” rules to auto-run
- after explicit future effect resolution entrypoints

Example:
```ts
resolveLatestLegacyDeclaration(state);
flushStateBasedRules(state);
flushTriggers(state);
```

## Why this is the safest next patch
- It does **not** rewrite `declareAttack`, `resolveCurrentBattle`, or `resolveLatestLegacyDeclaration`.
- It adds a post-resolution sweep instead of changing core declaration semantics.
- Existing battle/direct-attack tests should keep their current behavior.
- Card text DSL can be added later by only expanding `EffectEngine.ts`.

## Next real card-text milestone
1. define `effectId` naming convention
2. attach `triggerTemplates` to card metadata
3. register concrete resolvers in `EffectEngine.ts`
4. add focused tests:
   - destroy-only vs down+destroy
   - simultaneous trigger ordering by turn player
   - nested trigger priority
   - summon interrupted by response -> hand trigger -> original declaration continues
