import * as React from "react";
import type { RoomState, RoomMode } from "../../room/RoomTypes";
import { createRoom } from "../../room/roomHelpers";

interface CreateRoomPanelProps {
  currentUserId: string;
  onRoomCreated: (room: RoomState) => void;
}

export function CreateRoomPanel(props: CreateRoomPanelProps) {
  const [mode, setMode] = React.useState<RoomMode>("NORMAL");

  const handleCreateRoom = React.useCallback(() => {
    const room = createRoom({
      ownerUserId: props.currentUserId,
      mode,
    });

    props.onRoomCreated(room);
  }, [mode, props]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        border: "1px solid #2b3a55",
        borderRadius: 8,
        padding: 16,
        background: "#0f1b2d",
        color: "#ffffff",
      }}
    >
      <h2 style={{ margin: 0, color: "#ffffff" }}>방 생성</h2>

      <label
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          color: "#ffffff",
        }}
      >
        <input
          type="radio"
          name="room-mode"
          checked={mode === "NORMAL"}
          onChange={() => setMode("NORMAL")}
        />
        <span>일반 방</span>
      </label>

      <label
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          color: "#ffffff",
        }}
      >
        <input
          type="radio"
          name="room-mode"
          checked={mode === "PRACTICE"}
          onChange={() => setMode("PRACTICE")}
        />
        <span>연습 모드</span>
      </label>

      <div
        style={{
          fontSize: 14,
          color: "#ffffff",
          padding: 12,
          borderRadius: 8,
          background: "#18263d",
          border: "1px solid #2b3a55",
        }}
      >
        {mode === "NORMAL"
          ? "일반 대전용 방을 생성합니다."
          : "혼자서 P1/P2를 모두 조작할 수 있는 연습 모드 방을 생성합니다."}
      </div>

      <button
        type="button"
        onClick={handleCreateRoom}
        style={{
          height: 40,
          borderRadius: 8,
          border: "1px solid #2b3a55",
          background: "#24395c",
          color: "#ffffff",
          cursor: "pointer",
          fontWeight: 700,
        }}
      >
        {mode === "NORMAL" ? "일반 방 만들기" : "연습 모드 방 만들기"}
      </button>
    </div>
  );
}