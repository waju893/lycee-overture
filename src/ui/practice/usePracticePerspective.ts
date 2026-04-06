import * as React from "react";
import type { PlayerId } from "../../room/RoomTypes";
import { getOpponentPlayerId } from "../../room/roomHelpers";

interface UsePracticePerspectiveParams {
  roomId: string;
  enabled: boolean;
  defaultPlayerId?: PlayerId;
}

interface PracticePerspectiveResult {
  viewingPlayerId: PlayerId;
  bottomPlayerId: PlayerId;
  topPlayerId: PlayerId;
  setViewingPlayerId: (playerId: PlayerId) => void;
  toggleViewingPlayer: () => void;
}

export function usePracticePerspective(
  params: UsePracticePerspectiveParams
): PracticePerspectiveResult {
  const storageKey = React.useMemo(
    () => `practice:viewing-player:${params.roomId}`,
    [params.roomId]
  );

  const [viewingPlayerId, setViewingPlayerIdState] = React.useState<PlayerId>(() => {
    if (!params.enabled) {
      return params.defaultPlayerId ?? "P1";
    }

    const saved =
      typeof window !== "undefined" ? window.localStorage.getItem(storageKey) : null;

    if (saved === "P1" || saved === "P2") {
      return saved;
    }

    return params.defaultPlayerId ?? "P1";
  });

  const setViewingPlayerId = React.useCallback(
    (playerId: PlayerId) => {
      setViewingPlayerIdState(playerId);

      if (params.enabled && typeof window !== "undefined") {
        window.localStorage.setItem(storageKey, playerId);
      }
    },
    [params.enabled, storageKey]
  );

  const toggleViewingPlayer = React.useCallback(() => {
    setViewingPlayerId(viewingPlayerId === "P1" ? "P2" : "P1");
  }, [setViewingPlayerId, viewingPlayerId]);

  const bottomPlayerId = viewingPlayerId;
  const topPlayerId = getOpponentPlayerId(viewingPlayerId);

  return {
    viewingPlayerId,
    bottomPlayerId,
    topPlayerId,
    setViewingPlayerId,
    toggleViewingPlayer,
  };
}