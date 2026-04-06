import type { PlayerId } from "../../room/RoomTypes";

interface SimplePlayerView {
  id: PlayerId;
  life: number;
  handCount: number;
  deckCount: number;
  trashCount: number;
}

interface PlayerInfoPanelProps {
  player: SimplePlayerView;
  position: "top" | "bottom";
  isCurrentView: boolean;
}

export function PlayerInfoPanel(props: PlayerInfoPanelProps) {
  return (
    <div
      style={{
        border: "1px solid #2b3a55",
        borderRadius: 8,
        padding: 12,
        background: props.isCurrentView ? "#1f3352" : "#18263d",
        color: "#ffffff",
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <strong style={{ color: "#ffffff" }}>{props.player.id}</strong>
        <span style={{ color: "#ffffff" }}>
          {props.position === "bottom" ? "아래쪽" : "위쪽"}
        </span>
        {props.isCurrentView && (
          <span
            style={{
              padding: "2px 8px",
              borderRadius: 999,
              background: "#0969da",
              color: "#ffffff",
              fontSize: 12,
            }}
          >
            현재 조작 중
          </span>
        )}
      </div>

      <div
        style={{
          marginTop: 8,
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          color: "#ffffff",
        }}
      >
        <span>라이프: {props.player.life}</span>
        <span>손패: {props.player.handCount}</span>
        <span>덱: {props.player.deckCount}</span>
        <span>트래시: {props.player.trashCount}</span>
      </div>
    </div>
  );
}