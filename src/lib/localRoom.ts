import type { GameState } from "../game/GameTypes";

export type RoomSeat = "P1" | "P2";

export type LocalRoomRecord = {
  roomId: string;
  createdAt: number;
  updatedAt: number;
  createdBy: RoomSeat;
  seats: {
    P1: boolean;
    P2: boolean;
  };
  state: GameState | null;
};

const ROOM_KEY_PREFIX = "lycee.local-room.";
const ROOM_ID_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function roomKey(roomId: string): string {
  return `${ROOM_KEY_PREFIX}${roomId.trim().toUpperCase()}`;
}

export function generateRoomId(length = 6): string {
  let result = "";
  const cryptoRef = globalThis.crypto;
  if (cryptoRef?.getRandomValues) {
    const bytes = new Uint8Array(length);
    cryptoRef.getRandomValues(bytes);
    for (let i = 0; i < length; i += 1) {
      result += ROOM_ID_CHARS[bytes[i] % ROOM_ID_CHARS.length];
    }
    return result;
  }

  for (let i = 0; i < length; i += 1) {
    result += ROOM_ID_CHARS[Math.floor(Math.random() * ROOM_ID_CHARS.length)];
  }
  return result;
}

export function normalizeRoomId(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function readLocalRoom(roomId: string): LocalRoomRecord | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(roomKey(roomId));
    if (!raw) return null;
    return JSON.parse(raw) as LocalRoomRecord;
  } catch {
    return null;
  }
}

export function saveLocalRoom(record: LocalRoomRecord): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(roomKey(record.roomId), JSON.stringify(record));
}

export function createLocalRoom(createdBy: RoomSeat): LocalRoomRecord {
  let roomId = generateRoomId();
  while (readLocalRoom(roomId)) {
    roomId = generateRoomId();
  }

  const now = Date.now();
  const record: LocalRoomRecord = {
    roomId,
    createdAt: now,
    updatedAt: now,
    createdBy,
    seats: {
      P1: createdBy === "P1",
      P2: createdBy === "P2",
    },
    state: null,
  };

  saveLocalRoom(record);
  return record;
}

export function joinLocalRoom(roomId: string): { ok: true; room: LocalRoomRecord; seat: RoomSeat } | { ok: false; reason: string } {
  const normalized = normalizeRoomId(roomId);
  const room = readLocalRoom(normalized);

  if (!room) {
    return { ok: false, reason: "해당 Room ID를 찾지 못했어." };
  }

  const seat: RoomSeat | null = !room.seats.P1 ? "P1" : !room.seats.P2 ? "P2" : null;
  if (!seat) {
    return { ok: false, reason: "이 방은 이미 2명이 모두 참가했어." };
  }

  const next: LocalRoomRecord = {
    ...room,
    updatedAt: Date.now(),
    seats: {
      ...room.seats,
      [seat]: true,
    },
  };

  saveLocalRoom(next);
  return { ok: true, room: next, seat };
}

export function ensureRoomSeat(roomId: string, seat: RoomSeat): LocalRoomRecord | null {
  const room = readLocalRoom(roomId);
  if (!room) return null;

  if (room.seats[seat]) return room;

  const next: LocalRoomRecord = {
    ...room,
    updatedAt: Date.now(),
    seats: {
      ...room.seats,
      [seat]: true,
    },
  };
  saveLocalRoom(next);
  return next;
}

export function saveRoomState(roomId: string, state: GameState): LocalRoomRecord | null {
  const room = readLocalRoom(roomId);
  if (!room) return null;

  const next: LocalRoomRecord = {
    ...room,
    updatedAt: Date.now(),
    state,
  };
  saveLocalRoom(next);
  return next;
}

export function getRoomBroadcastChannelName(roomId: string): string {
  return `lycee-room-${normalizeRoomId(roomId)}`;
}
