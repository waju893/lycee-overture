import type { GameState } from "../../game/GameTypes";
import { GameEngine } from "../../game/GameEngine";
import type { PlayerId, RoomState } from "../../room/RoomTypes";
import { usePracticePerspective } from "./usePracticePerspective";
import { PracticeModeToolbar } from "./PracticeModeToolbar";
import { PlayerInfoPanel } from "./PlayerInfoPanel";
import PracticeBoard from "../../components/PracticeBoard";

interface PracticeRoomGameViewProps {
  room: RoomState;
  engine: GameEngine;
  onStateChanged: () => void;
}

function toPlayerView(gameState: GameState, playerId: PlayerId) {
  const player = gameState.players[playerId];
  return {
    id: playerId,
    life: player?.life ?? 0,
    handCount: player?.handCardIds?.length ?? 0,
    deckCount: player?.deckCardIds?.length ?? 0,
    trashCount: player?.trashCardIds?.length ?? 0,
  };
}

export function PracticeRoomGameView(props: PracticeRoomGameViewProps) {
  const isPracticeMode = props.room.mode === "PRACTICE";
  const gameState = props.engine.getState();

  const {
    viewingPlayerId,
    bottomPlayerId,
    topPlayerId,
    setViewingPlayerId,
    toggleViewingPlayer,
  } = usePracticePerspective({
    roomId: props.room.id,
    enabled: isPracticeMode,
    defaultPlayerId: "P1",
  });

  const topPlayer = toPlayerView(gameState, topPlayerId);
  const bottomPlayer = toPlayerView(gameState, bottomPlayerId);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {isPracticeMode && (
        <PracticeModeToolbar
          viewingPlayerId={viewingPlayerId}
          onChangeViewingPlayer={setViewingPlayerId}
          onToggleViewingPlayer={toggleViewingPlayer}
        />
      )}

      <PlayerInfoPanel
        player={topPlayer}
        position="top"
        isCurrentView={false}
      />

      <div
        style={{
          border: "1px dashed #2b3a55",
          borderRadius: 8,
          padding: 12,
          textAlign: "center",
          background: "#18263d",
          color: "#ffffff",
        }}
      >
        <strong style={{ color: "#ffffff" }}>중앙 정보</strong>
        <div style={{ marginTop: 8, color: "#ffffff" }}>
          턴 플레이어: {gameState.turnPlayerId}
        </div>
        <div style={{ color: "#ffffff" }}>
          액티브 플레이어: {gameState.activePlayerId}
        </div>
        <div style={{ color: "#ffffff" }}>페이즈: {gameState.turn.phase}</div>
      </div>

      <PracticeBoard
        engine={props.engine}
        viewingPlayerId={viewingPlayerId}
        onStateChanged={props.onStateChanged}
      />

      <PlayerInfoPanel
        player={bottomPlayer}
        position="bottom"
        isCurrentView={true}
      />
    </div>
  );
}