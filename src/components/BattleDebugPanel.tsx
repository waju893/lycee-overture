
import React from "react";

export type BattleDebugState = {
  phase?: string;
  attackerId?: string | null;
  defenderId?: string | null;
  column?: number | null;
  priorityPlayer?: "P1" | "P2" | null;
  stackDepth?: number;
};

type Props = {
  state: BattleDebugState;
  visible?: boolean;
};

export default function BattleDebugPanel({ state, visible = true }: Props) {
  if (!visible) return null;

  const row = (label: string, value: any) => (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
      <span style={{ opacity: 0.8 }}>{label}</span>
      <span>{String(value ?? "-")}</span>
    </div>
  );

  return (
    <div
      style={{
        position: "absolute",
        right: 8,
        bottom: 8,
        width: 220,
        padding: 10,
        background: "rgba(0,0,0,0.75)",
        color: "white",
        borderRadius: 6,
        fontFamily: "monospace",
        zIndex: 9999,
      }}
    >
      <div style={{ fontWeight: "bold", marginBottom: 6 }}>BATTLE DEBUG</div>
      {row("phase", state.phase)}
      {row("attacker", state.attackerId)}
      {row("defender", state.defenderId)}
      {row("column", state.column)}
      {row("priority", state.priorityPlayer)}
      {row("stackDepth", state.stackDepth)}
    </div>
  );
}
