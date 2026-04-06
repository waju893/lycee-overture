import type { PlayerId } from "../../room/RoomTypes";

interface PracticeModeToolbarProps {
  viewingPlayerId: PlayerId;
  onChangeViewingPlayer: (playerId: PlayerId) => void;
  onToggleViewingPlayer: () => void;
}

export function PracticeModeToolbar(props: PracticeModeToolbarProps) {
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        alignItems: "center",
        padding: 12,
        border: "1px solid #2b3a55",
        borderRadius: 8,
        marginBottom: 12,
        background: "#18263d",
        color: "#ffffff",
        flexWrap: "wrap",
      }}
    >
      <strong style={{ color: "#ffffff" }}>연습 모드</strong>
      <span style={{ color: "#ffffff" }}>
        현재 조작 시점: {props.viewingPlayerId}
      </span>

      <button
        type="button"
        onClick={() => props.onChangeViewingPlayer("P1")}
        style={{
          borderRadius: 8,
          border: "1px solid #2b3a55",
          background: "#24395c",
          color: "#ffffff",
          padding: "6px 12px",
          cursor: "pointer",
        }}
      >
        P1 보기
      </button>

      <button
        type="button"
        onClick={() => props.onChangeViewingPlayer("P2")}
        style={{
          borderRadius: 8,
          border: "1px solid #2b3a55",
          background: "#24395c",
          color: "#ffffff",
          padding: "6px 12px",
          cursor: "pointer",
        }}
      >
        P2 보기
      </button>

      <button
        type="button"
        onClick={props.onToggleViewingPlayer}
        style={{
          borderRadius: 8,
          border: "1px solid #2b3a55",
          background: "#24395c",
          color: "#ffffff",
          padding: "6px 12px",
          cursor: "pointer",
        }}
      >
        전환
      </button>
    </div>
  );
}