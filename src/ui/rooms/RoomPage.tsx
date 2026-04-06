import * as React from "react";
import type { GameState } from "../../game/GameTypes";
import { GameEngine } from "../../game/GameEngine";
import type { RoomState } from "../../room/RoomTypes";
import { CreateRoomPanel } from "./CreateRoomPanel";
import { PracticeRoomGameView } from "../practice/PracticeRoomGameView";

interface RoomPageProps {
  currentUserId: string;
  initialGameState: GameState;
}

export function RoomPage(props: RoomPageProps) {
  const [room, setRoom] = React.useState<RoomState | null>(null);
  const [, setVersion] = React.useState(0);

  const [engine] = React.useState(() => {
    return new GameEngine(structuredClone(props.initialGameState));
  });

  const handleStateChanged = React.useCallback(() => {
    setVersion((v) => v + 1);
  }, []);

  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: 24 }}>
      {!room && (
        <CreateRoomPanel
          currentUserId={props.currentUserId}
          onRoomCreated={setRoom}
        />
      )}

      {room && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div
            style={{
              border: "1px solid #2b3a55",
              borderRadius: 8,
              padding: 12,
              background: "#18263d",
              color: "#ffffff",
            }}
          >
            <div><strong>Room ID</strong>: {room.id}</div>
            <div><strong>Mode</strong>: {room.mode}</div>
            <div><strong>P1</strong>: {room.seats.P1 ?? "-"}</div>
            <div><strong>P2</strong>: {room.seats.P2 ?? "-"}</div>
          </div>

          <PracticeRoomGameView
            room={room}
            engine={engine}
            onStateChanged={handleStateChanged}
          />
        </div>
      )}
    </div>
  );
}