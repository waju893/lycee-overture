import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import PracticeBoard from "../components/PracticeBoard";
import { reduceGameState } from "../game/GameEngine";
import type { GameAction } from "../game/GameActions";
import type { GameState, ReplaySnapshot } from "../game/GameTypes";

const STORAGE_KEY = "lycee.replay.snapshots";

function loadSnapshots(): ReplaySnapshot[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];

  try {
    return JSON.parse(raw) as ReplaySnapshot[];
  } catch {
    return [];
  }
}

function toStateAt(snapshot: ReplaySnapshot, eventIndex: number): GameState {
  let state = structuredClone(snapshot.initialState);
  const end = Math.min(eventIndex, snapshot.events.length - 1);

  for (let i = 0; i <= end; i += 1) {
    const action = snapshot.events[i]?.payload as GameAction;
    if (!action?.type) continue;
    state = reduceGameState(state, action);
  }

  return state;
}

export default function ReplayPage() {
  const [snapshots, setSnapshots] = useState<ReplaySnapshot[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [cursor, setCursor] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    setSnapshots(loadSnapshots());
  }, []);

  const selected = snapshots[selectedIndex];

  useEffect(() => {
    setCursor(0);
    setIsPlaying(false);
  }, [selectedIndex]);

  useEffect(() => {
    if (!isPlaying || !selected) return;

    const id = window.setInterval(() => {
      setCursor((prev) => {
        if (prev >= selected.events.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 800);

    return () => window.clearInterval(id);
  }, [isPlaying, selected]);

  const state = useMemo(() => {
    if (!selected) return null;
    return toStateAt(selected, cursor);
  }, [selected, cursor]);

  return (
    <div style={{ minHeight: "100vh", background: "#101722", color: "#fff", padding: 24 }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", display: "grid", gap: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1 style={{ margin: 0 }}>리플레이</h1>
          <Link to="/" style={{ color: "#9ec5ff" }}>타이틀로</Link>
        </div>

        <div>
          <label>
            저장된 게임:
            <select
              value={selectedIndex}
              onChange={(e) => setSelectedIndex(Number(e.target.value))}
              style={{ marginLeft: 8 }}
            >
              {snapshots.map((snapshot, index) => (
                <option key={snapshot.id} value={index}>
                  {new Date(snapshot.savedAt).toLocaleString()} / winner {snapshot.winner}
                </option>
              ))}
            </select>
          </label>
        </div>

        {!selected || !state ? (
          <div>저장된 리플레이가 없습니다. 연습 모드에서 게임을 끝내면 자동 저장됩니다.</div>
        ) : (
          <>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={() => setCursor((v) => Math.max(0, v - 1))}>이전</button>
              <button
                type="button"
                onClick={() => setCursor((v) => Math.min(selected.events.length - 1, v + 1))}
              >
                다음
              </button>
              <button type="button" onClick={() => setIsPlaying((v) => !v)}>
                {isPlaying ? "일시정지" : "자동재생"}
              </button>
              <span>
                {selected.events.length === 0
                  ? "이벤트 없음"
                  : `${cursor + 1} / ${selected.events.length}`}
              </span>
            </div>

            <div>
              현재 이벤트: {selected.events[cursor]?.actionType ?? "-"}
            </div>

            <PracticeBoard state={state} perspective={state.turn.activePlayer} />
          </>
        )}
      </div>
    </div>
  );
}
