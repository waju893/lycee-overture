
// Utility helper to extract battle-related debug information from the engine state.
// Safe: if fields do not exist yet, it simply returns partial data.

export type EngineLike = any;

export function getBattleDebugState(engine: EngineLike) {
  const s = engine?.state ?? engine;

  return {
    phase: s?.battle?.phase ?? s?.phase ?? null,
    attackerId: s?.battle?.attackerId ?? null,
    defenderId: s?.battle?.defenderId ?? null,
    column: s?.battle?.column ?? null,
    priorityPlayer: s?.priorityPlayer ?? null,
    stackDepth: s?.declarationStack?.length ?? 0,
  };
}
