import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import PracticeBoardView from "../components/PracticeBoard";
import type { GameAction } from "../game/GameActions";
import { reduceGameState } from "../game/GameEngine";
import { createInitialGameState } from "../game/GameRules";
import type { CardRef, FieldSlot, GameState, PlayerID, ReplaySnapshot } from "../game/GameTypes";
import { CARD_META_BY_CODE } from "../lib/cards";
import type { DeckEntry } from "../lib/deck";
import {
  ensureRoomSeat,
  getRoomBroadcastChannelName,
  normalizeRoomId,
  readLocalRoom,
  saveRoomState,
  type RoomSeat,
} from "../lib/localRoom";

type PlacementMode =
  | {
      type: "hand_character_to_field";
      playerId: PlayerID;
      cardId: string;
      costCardIds: string[];
    }
  | {
      type: "pile_character_to_field";
      playerId: PlayerID;
      cardId: string;
      source: "deck" | "discard";
      costCardIds: string[];
    }
  | {
      type: "hand_area_to_field";
      playerId: PlayerID;
      cardId: string;
      costCardIds: string[];
    }
  | {
      type: "pile_area_to_field";
      playerId: PlayerID;
      cardId: string;
      source: "deck" | "discard";
      costCardIds: string[];
    }
  | {
      type: "hand_item_to_field";
      playerId: PlayerID;
      cardId: string;
      costCardIds: string[];
    }
  | {
      type: "pile_item_to_field";
      playerId: PlayerID;
      cardId: string;
      source: "deck" | "discard";
      costCardIds: string[];
    }
  | null;

const ALL_SLOTS: FieldSlot[] = [
  "AF_LEFT",
  "AF_CENTER",
  "AF_RIGHT",
  "DF_LEFT",
  "DF_CENTER",
  "DF_RIGHT",
];
const CURRENT_DECK_STORAGE_KEY = "lycee-current-deck";

type RoomSyncEnvelope = {
  type: "room_state";
  roomId: string;
  sourceId: string;
  updatedAt: number;
  state: GameState;
};

function makeCharacter(
  instanceId: string,
  owner: PlayerID,
  name: string,
  stats?: { ap?: number; dp?: number; dmg?: number },
): CardRef {
  const ap = stats?.ap ?? 3;
  const dp = stats?.dp ?? 3;
  const dmg = stats?.dmg ?? 1;

  return {
    instanceId,
    cardNo: instanceId,
    name,
    owner,
    cardType: "character",
    sameNameKey: instanceId,
    ap,
    dp,
    dmg,
    power: ap,
    hp: dp,
    damage: dmg,
    isTapped: false,
    canAttack: true,
    canBlock: true,
    revealed: false,
    location: "deck",
  };
}

function makeDeck(owner: PlayerID, prefix: string): CardRef[] {
  const deck: CardRef[] = [];

  while (deck.length < 60) {
    const i = deck.length + 1;
    deck.push(
      makeCharacter(
        `${prefix}_${String(i).padStart(3, "0")}`,
        owner,
        `${prefix}_CHAR_${i}`,
        {
          ap: 2 + (i % 4),
          dp: 2 + (i % 3),
          dmg: 1 + (i % 2),
        },
      ),
    );
  }

  return deck;
}

function shuffleCards<T>(cards: T[]): T[] {
  const next = [...cards];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function normalizeDeckCardType(value: string | undefined): CardRef["cardType"] {
  switch ((value ?? "").toLowerCase()) {
    case "event":
      return "event";
    case "item":
      return "item";
    case "area":
      return "area";
    default:
      return "character";
  }
}

function readPracticeDeckFromStorage(owner: PlayerID): CardRef[] | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(CURRENT_DECK_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as DeckEntry[];
    if (!Array.isArray(parsed) || parsed.length === 0) return null;

    const cards: CardRef[] = [];
    for (const entry of parsed) {
      const code = String(entry?.code ?? "").trim().toUpperCase();
      const qty = Number(entry?.qty ?? 0);
      const meta = CARD_META_BY_CODE[code];
      if (!meta || !Number.isFinite(qty) || qty <= 0) continue;

      for (let i = 0; i < qty; i += 1) {
        cards.push({
          instanceId: `${owner}_${code}_${i + 1}_${cards.length + 1}`,
          cardNo: code,
          name: meta.name ?? code,
          owner,
          cardType: normalizeDeckCardType(meta.type),
          sameNameKey: code,
          ap: meta.ap ?? undefined,
          dp: meta.dp ?? undefined,
          dmg: meta.dmg ?? undefined,
          power: meta.ap ?? undefined,
          hp: meta.dp ?? undefined,
          damage: meta.dmg ?? undefined,
          isTapped: false,
          canAttack: true,
          canBlock: true,
          revealed: false,
          location: "deck",
        });
      }
    }

    return cards.length > 0 ? cards : null;
  } catch {
    return null;
  }
}

function createRoomInitialState(): GameState {
  const p1DeckFromBuilder = readPracticeDeckFromStorage("P1");
  const p1Deck = shuffleCards(p1DeckFromBuilder ?? makeDeck("P1", "P1"));
  const p2Deck = shuffleCards(makeDeck("P2", "P2"));

  return createInitialGameState({
    p1Deck,
    p2Deck,
    leaderEnabled: false,
  });
}

function getPendingDeclarationSummary(state: GameState): string | null {
  const top = state.declarationStack[state.declarationStack.length - 1];
  if (!top) return null;

  if (top.kind === "useCharacter") {
    return `${top.playerId} 캐릭터 등장 선언 대기`;
  }
  if (top.kind === "useArea") {
    return `${top.playerId} 에리어 배치 선언 대기`;
  }
  if (top.kind === "useItem") {
    return `${top.playerId} 아이템 장비 선언 대기`;
  }
  if (top.kind === "attack") {
    return `${top.playerId} 공격 선언 대기`;
  }
  return `${top.playerId} 선언 대기`;
}

function getFirstEmptySlot(state: GameState, playerId: PlayerID): FieldSlot | null {
  for (const slot of ALL_SLOTS) {
    if (!state.players[playerId].field[slot].card) {
      return slot;
    }
  }
  return null;
}

function placeCardOnField(next: GameState, playerId: PlayerID, card: CardRef): boolean {
  const emptySlot = getFirstEmptySlot(next, playerId);
  if (!emptySlot) {
    next.logs.push(`[ZONE] ${playerId} 배치 실패: 빈 필드 칸이 없음`);
    return false;
  }

  card.location = "field";
  card.revealed = true;
  next.players[playerId].field[emptySlot].card = card;
  return true;
}

function attachItemToCharacter(
  next: GameState,
  playerId: PlayerID,
  slot: FieldSlot,
  card: CardRef,
): boolean {
  const cell = next.players[playerId].field[slot];
  if (!cell.card) {
    next.logs.push(`[ZONE] ${playerId} 장비 실패: 해당 칸에 캐릭터가 없음`);
    return false;
  }

  if (cell.attachedItem) {
    next.logs.push(`[ZONE] ${playerId} 장비 실패: 해당 캐릭터에는 이미 아이템이 있음`);
    return false;
  }

  card.location = "field";
  card.slot = slot;
  card.revealed = true;
  cell.attachedItem = card;
  return true;
}

function hasOpenAreaSlot(state: GameState, playerId: PlayerID): boolean {
  return ALL_SLOTS.some((slot) => !state.players[playerId].field[slot].area);
}

function hasEquipableCharacterSlot(state: GameState, playerId: PlayerID): boolean {
  return ALL_SLOTS.some((slot) => {
    const cell = state.players[playerId].field[slot];
    return Boolean(cell.card) && !cell.attachedItem;
  });
}

function moveCardFromPile(
  state: GameState,
  playerId: PlayerID,
  cardId: string,
  source: "deck" | "discard",
  destination: "hand" | "field",
): GameState {
  const next = structuredClone(state) as GameState;
  const player = next.players[playerId];
  const sourcePile = source === "deck" ? player.deck : player.discard;
  const index = sourcePile.findIndex((card) => card.instanceId === cardId);

  if (index < 0) {
    next.logs.push(`[ZONE] 이동 실패: ${playerId} ${source}에서 카드를 찾지 못함 (${cardId})`);
    return next;
  }

  const [card] = sourcePile.splice(index, 1);
  if (!card) return next;

  if (destination === "hand") {
    card.location = "hand";
    card.revealed = false;
    player.hand.push(card);
    next.logs.push(`[ZONE] ${playerId} ${source} → 손패: ${card.name}`);
    return next;
  }

  if (!placeCardOnField(next, playerId, card)) {
    sourcePile.splice(index, 0, card);
    return next;
  }

  next.logs.push(`[ZONE] ${playerId} ${source} → 필드: ${card.name}`);
  return next;
}

function payHandCosts(
  next: GameState,
  playerId: PlayerID,
  costCardIds: string[],
  actionCardId?: string,
) {
  const player = next.players[playerId];
  const paidNames: string[] = [];

  for (const costCardId of costCardIds) {
    if (costCardId === actionCardId) continue;
    const index = player.hand.findIndex((card) => card.instanceId === costCardId);
    if (index < 0) continue;
    const [card] = player.hand.splice(index, 1);
    if (!card) continue;

    card.location = "discard";
    card.revealed = true;
    player.discard.push(card);
    paidNames.push(card.name);
  }

  if (paidNames.length > 0) {
    next.logs.push(`[COST] ${playerId} 코스트 지불: ${paidNames.join(" / ")}`);
  }
}

function makeClientId(): string {
  const cryptoRef = globalThis.crypto;
  if (cryptoRef?.randomUUID) {
    return cryptoRef.randomUUID();
  }
  return `client_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export default function RoomGamePage() {
  const navigate = useNavigate();
  const { roomId: roomIdParam = "" } = useParams();
  const [searchParams] = useSearchParams();
  const roomId = normalizeRoomId(roomIdParam);
  const seat = (searchParams.get("seat") === "P2" ? "P2" : "P1") as RoomSeat;

  const roomRecord = useMemo(() => readLocalRoom(roomId), [roomId]);
  const initialState = useMemo(() => {
    const stored = readLocalRoom(roomId)?.state;
    return stored ?? createRoomInitialState();
  }, [roomId]);

  const [state, setState] = useState<GameState>(initialState);
  const [placementMode, setPlacementMode] = useState<PlacementMode>(null);
  const [moveMode, setMoveMode] = useState<{ playerId: PlayerID; cardId: string } | null>(null);
  const initialStateRef = useRef<GameState>(structuredClone(initialState));
  const savedWinnerRef = useRef<PlayerID | null>(null);
  const clientIdRef = useRef<string>(makeClientId());
  const channelRef = useRef<BroadcastChannel | null>(null);
  const lastSyncTimestampRef = useRef<number>(Date.now());

  const perspective = seat;
  const currentPriority = state.turn.priorityPlayer;
  const pendingDeclaration = state.declarationStack.length > 0;
  const pendingSummary = getPendingDeclarationSummary(state);
  const usingDeckBuilderDeck = useMemo(
    () => state.players.P1.deck.some((card) => card.cardNo.startsWith("LO-")),
    [state.players.P1.deck],
  );

  useEffect(() => {
    if (!roomId) {
      navigate("/create-room");
      return;
    }

    const ensured = ensureRoomSeat(roomId, seat);
    if (!ensured) {
      navigate("/create-room");
      return;
    }

    if (!ensured.state) {
      saveRoomState(roomId, initialState);
    }

    const channel = new BroadcastChannel(getRoomBroadcastChannelName(roomId));
    channelRef.current = channel;

    channel.onmessage = (event: MessageEvent<RoomSyncEnvelope>) => {
      const message = event.data;
      if (!message || message.type !== "room_state") return;
      if (message.roomId !== roomId) return;
      if (message.sourceId === clientIdRef.current) return;
      if (message.updatedAt <= lastSyncTimestampRef.current) return;

      lastSyncTimestampRef.current = message.updatedAt;
      setState(message.state);
      setPlacementMode(null);
      setMoveMode(null);
    };

    const latestStored = readLocalRoom(roomId)?.state;
    if (latestStored) {
      setState(latestStored);
    }

    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, [initialState, navigate, roomId, seat]);

  function publishRoomState(next: GameState) {
    if (!roomId) return;

    const updatedAt = Date.now();
    lastSyncTimestampRef.current = updatedAt;
    saveRoomState(roomId, next);

    const envelope: RoomSyncEnvelope = {
      type: "room_state",
      roomId,
      sourceId: clientIdRef.current,
      updatedAt,
      state: next,
    };

    channelRef.current?.postMessage(envelope);
  }

  function commitState(updater: (prev: GameState) => GameState) {
    setState((prev) => {
      const next = updater(prev);
      publishRoomState(next);
      return next;
    });
  }

  function dispatch(action: GameAction) {
    commitState((prev) => reduceGameState(prev, action));
  }

  function resetRoomBoard() {
    const next = createRoomInitialState();
    initialStateRef.current = structuredClone(next);
    savedWinnerRef.current = null;
    setPlacementMode(null);
    setMoveMode(null);
    setState(next);
    publishRoomState(next);
  }

  useEffect(() => {
    if (!state.winner || savedWinnerRef.current === state.winner) return;

    const snapshot: ReplaySnapshot = {
      id: `replay_${Date.now()}`,
      savedAt: Date.now(),
      initialState: structuredClone(initialStateRef.current),
      events: [...state.replayEvents],
      winner: state.winner,
    };

    const key = "lycee.replay.snapshots";
    const prev = localStorage.getItem(key);
    const parsed = prev ? (JSON.parse(prev) as ReplaySnapshot[]) : [];
    const next = [snapshot, ...parsed].slice(0, 20);
    localStorage.setItem(key, JSON.stringify(next));
    savedWinnerRef.current = state.winner;
  }, [state]);

  function handleStartGame() {
    dispatch({ type: "START_GAME", firstPlayer: "P1", leaderEnabled: false });
  }

  function handleKeep(playerId: PlayerID) {
    dispatch({ type: "KEEP_STARTING_HAND", playerId });
  }

  function handleMulligan(playerId: PlayerID) {
    dispatch({ type: "MULLIGAN", playerId });
  }

  function handleFinalizeStartup() {
    dispatch({ type: "FINALIZE_STARTUP" });
  }

  function handleAdvancePhase() {
    dispatch({ type: "ADVANCE_PHASE" });
    setPlacementMode(null);
  }

  function handleStartTurn() {
    dispatch({ type: "START_TURN" });
    setPlacementMode(null);
  }

  function handlePassPriority() {
    dispatch({ type: "PASS_PRIORITY", playerId: currentPriority });
    setPlacementMode(null);
  }

  function handleConcede(playerId: PlayerID) {
    dispatch({ type: "CONCEDE", playerId });
  }

  function handleDrawFromDeck(playerId: PlayerID) {
    commitState((prev) => {
      const next = structuredClone(prev) as GameState;
      const player = next.players[playerId];
      const topCard = player.deck.shift();

      if (!topCard) {
        next.logs.push(`[DECK] ${playerId} 드로우 실패: 덱이 비어 있음`);
        return next;
      }

      topCard.location = "hand";
      topCard.revealed = false;
      player.hand.push(topCard);
      next.logs.push(`[DECK] ${playerId} 덱 맨 위 1장을 패로 이동: ${topCard.name}`);
      return next;
    });
  }

  function handleDamageFromDeck(playerId: PlayerID) {
    commitState((prev) => {
      const next = structuredClone(prev) as GameState;
      const player = next.players[playerId];
      const topCard = player.deck.shift();

      if (!topCard) {
        next.logs.push(`[DECK] ${playerId} 대미지 실패: 덱이 비어 있음`);
        return next;
      }

      topCard.location = "discard";
      topCard.revealed = true;
      player.discard.push(topCard);
      next.logs.push(`[DECK] ${playerId} 덱 맨 위 1장을 쓰레기통으로 이동: ${topCard.name}`);
      return next;
    });
  }

  function handleShuffleDeck(playerId: PlayerID) {
    commitState((prev) => {
      const next = structuredClone(prev) as GameState;
      next.players[playerId].deck = shuffleCards(next.players[playerId].deck);
      next.logs.push(`[DECK] ${playerId} 덱 셔플`);
      return next;
    });
  }

  function handlePrimaryCardAction(
    playerId: PlayerID,
    card: CardRef,
    source: "deck" | "discard",
    costCardIds: string[] = [],
  ) {
    if (card.cardType === "character") {
      if (pendingDeclaration) return;
      if (state.turn.priorityPlayer !== playerId) return;
      if (!getFirstEmptySlot(state, playerId)) return;

      setPlacementMode({
        type: "pile_character_to_field",
        playerId,
        cardId: card.instanceId,
        source,
        costCardIds,
      });
      return;
    }

    if (card.cardType === "area") {
      if (pendingDeclaration) return;
      if (state.turn.priorityPlayer !== playerId) return;
      if (!hasOpenAreaSlot(state, playerId)) return;

      setPlacementMode({
        type: "pile_area_to_field",
        playerId,
        cardId: card.instanceId,
        source,
        costCardIds,
      });
      return;
    }

    if (card.cardType === "item") {
      if (state.turn.priorityPlayer !== playerId) return;
      if (!hasEquipableCharacterSlot(state, playerId)) return;

      setPlacementMode({
        type: "pile_item_to_field",
        playerId,
        cardId: card.instanceId,
        source,
        costCardIds,
      });
      return;
    }

    commitState((prev) => {
      const next = structuredClone(prev) as GameState;
      const player = next.players[playerId];
      const sourcePile = source === "deck" ? player.deck : player.discard;
      const index = sourcePile.findIndex((item) => item.instanceId === card.instanceId);

      if (index < 0) {
        next.logs.push(`[ZONE] 이동 실패: ${playerId} ${source}에서 카드를 찾지 못함 (${card.instanceId})`);
        return next;
      }

      payHandCosts(next, playerId, costCardIds, card.instanceId);
      const [removed] = sourcePile.splice(index, 1);
      if (!removed) return next;

      removed.location = "discard";
      removed.revealed = true;
      player.discard.push(removed);
      next.logs.push(`[ZONE] ${playerId} ${source} → 사용 후 쓰레기통: ${removed.name}`);
      return next;
    });
  }

  function handleMoveCardToHand(playerId: PlayerID, cardId: string, source: "deck" | "discard") {
    commitState((prev) => moveCardFromPile(prev, playerId, cardId, source, "hand"));
  }

  function handleRecoverCardsToDeckBottom(playerId: PlayerID, cardIdsInOrder: string[]) {
    commitState((prev) => {
      const next = structuredClone(prev) as GameState;
      const player = next.players[playerId];
      const recoveredNames: string[] = [];

      for (const cardId of cardIdsInOrder) {
        const index = player.discard.findIndex((card) => card.instanceId === cardId);
        if (index < 0) continue;
        const [card] = player.discard.splice(index, 1);
        if (!card) continue;

        card.location = "deck";
        card.revealed = false;
        player.deck.push(card);
        recoveredNames.push(card.name);
      }

      if (recoveredNames.length > 0) {
        next.logs.push(`[RECOVERY] ${playerId} 회복 -> 덱 아래 / 순서: ${recoveredNames.join(" -> ")}`);
      }
      return next;
    });
  }

  function handleHandPrimaryAction(playerId: PlayerID, card: CardRef, costCardIds: string[]) {
    if (card.cardType === "character") {
      if (pendingDeclaration) return;
      if (state.turn.priorityPlayer !== playerId) return;
      if (!getFirstEmptySlot(state, playerId)) return;

      setPlacementMode({
        type: "hand_character_to_field",
        playerId,
        cardId: card.instanceId,
        costCardIds,
      });
      return;
    }

    if (card.cardType === "area") {
      if (pendingDeclaration) return;
      if (state.turn.priorityPlayer !== playerId) return;
      if (!hasOpenAreaSlot(state, playerId)) return;

      setPlacementMode({
        type: "hand_area_to_field",
        playerId,
        cardId: card.instanceId,
        costCardIds,
      });
      return;
    }

    if (card.cardType === "item") {
      if (state.turn.priorityPlayer !== playerId) return;
      if (!hasEquipableCharacterSlot(state, playerId)) return;

      setPlacementMode({
        type: "hand_item_to_field",
        playerId,
        cardId: card.instanceId,
        costCardIds,
      });
      return;
    }

    commitState((prev) => {
      const next = structuredClone(prev) as GameState;
      const player = next.players[playerId];
      const index = player.hand.findIndex((item) => item.instanceId === card.instanceId);
      if (index < 0) return next;

      payHandCosts(next, playerId, costCardIds, card.instanceId);
      const [removed] = player.hand.splice(index, 1);
      if (!removed) return next;

      removed.location = "discard";
      removed.revealed = true;
      player.discard.push(removed);
      next.logs.push(`[HAND] ${playerId} 손패 사용 -> 쓰레기통: ${removed.name}`);
      return next;
    });
  }

  function handleHandDeclareAction(playerId: PlayerID, cardId: string) {
    commitState((prev) => {
      const next = structuredClone(prev) as GameState;
      const player = next.players[playerId];
      const index = player.hand.findIndex((card) => card.instanceId === cardId);
      if (index < 0) return next;

      const [card] = player.hand.splice(index, 1);
      if (!card) return next;

      card.location = "discard";
      card.revealed = true;
      player.discard.push(card);
      next.logs.push(`[HAND_DECLARE] ${playerId} 패 선언: ${card.name}`);
      return next;
    });
  }

  function handleMoveHandCardToDeckTop(playerId: PlayerID, cardId: string) {
    commitState((prev) => {
      const next = structuredClone(prev) as GameState;
      const player = next.players[playerId];
      const index = player.hand.findIndex((card) => card.instanceId === cardId);
      if (index < 0) return next;

      const [card] = player.hand.splice(index, 1);
      if (!card) return next;

      card.location = "deck";
      card.revealed = false;
      player.deck.unshift(card);
      next.logs.push(`[HAND] ${playerId} 손패 -> 덱 맨 위: ${card.name}`);
      return next;
    });
  }

  function handleMoveHandCardToDeckBottom(playerId: PlayerID, cardId: string) {
    commitState((prev) => {
      const next = structuredClone(prev) as GameState;
      const player = next.players[playerId];
      const index = player.hand.findIndex((card) => card.instanceId === cardId);
      if (index < 0) return next;

      const [card] = player.hand.splice(index, 1);
      if (!card) return next;

      card.location = "deck";
      card.revealed = false;
      player.deck.push(card);
      next.logs.push(`[HAND] ${playerId} 손패 -> 덱 맨 아래: ${card.name}`);
      return next;
    });
  }

  function handleFieldCharacterAction(
    playerId: PlayerID,
    slot: FieldSlot,
    actionKind: "attack" | "tap" | "untap" | "charge" | "move",
  ) {
    const card = state.players[playerId].field[slot].card;

    if (moveMode?.playerId === playerId) {
      if (state.players[playerId].field[slot].card) return;
      dispatch({
        type: "DECLARE_ACTION",
        playerId,
        kind: "moveCharacter",
        sourceCardId: moveMode.cardId,
        targetSlots: [slot],
        targetingMode: "declareTime",
      });
      setMoveMode(null);
      return;
    }

    if (!card) return;

    if (actionKind === "attack") {
      if (pendingDeclaration) return;
      if (state.turn.priorityPlayer !== playerId) return;

      commitState((prev) => {
        const next = structuredClone(prev) as GameState;
        const current = next.players[playerId].field[slot].card;
        if (current) current.isTapped = true;
        return reduceGameState(next, {
          type: "DECLARE_ACTION",
          playerId,
          kind: "attack",
          sourceCardId: card.instanceId,
        });
      });
      return;
    }

    if (actionKind === "tap" || actionKind === "untap") {
      dispatch({
        type: "DECLARE_ACTION",
        playerId,
        kind: actionKind === "tap" ? "tapCharacter" : "untapCharacter",
        sourceCardId: card.instanceId,
      });
      return;
    }

    if (actionKind === "move") {
      setMoveMode({ playerId, cardId: card.instanceId });
      return;
    }

    if (actionKind === "charge") {
      commitState((prev) => {
        const next = structuredClone(prev) as GameState;
        next.logs.push(`[CHARGE] ${playerId} 차지 선언: ${card.name} (상세 선택 UI는 다음 단계에서 확장 예정)`);
        return next;
      });
    }
  }

  function handleFieldClick(playerId: PlayerID, slot: FieldSlot) {
    const cell = state.players[playerId].field[slot];
    const card = cell.card;

    if (placementMode?.type === "hand_character_to_field" && placementMode.playerId === playerId) {
      if (cell.card) return;

      commitState((prev) => {
        const next = structuredClone(prev) as GameState;
        payHandCosts(next, playerId, placementMode.costCardIds, placementMode.cardId);
        return reduceGameState(next, {
          type: "DECLARE_ACTION",
          playerId,
          kind: "useCharacter",
          sourceCardId: placementMode.cardId,
          targetSlots: [slot],
          targetingMode: "declareTime",
        });
      });
      setPlacementMode(null);
      return;
    }

    if (placementMode?.type === "pile_character_to_field" && placementMode.playerId === playerId) {
      if (cell.card) return;

      commitState((prev) => {
        const next = structuredClone(prev) as GameState;
        const player = next.players[playerId];
        const sourcePile = placementMode.source === "deck" ? player.deck : player.discard;
        const sourceIndex = sourcePile.findIndex((item) => item.instanceId === placementMode.cardId);
        if (sourceIndex < 0) return next;

        payHandCosts(next, playerId, placementMode.costCardIds, placementMode.cardId);
        const [sourceCard] = sourcePile.splice(sourceIndex, 1);
        if (!sourceCard) return next;

        sourceCard.location = "hand";
        sourceCard.revealed = false;
        player.hand.push(sourceCard);
        return reduceGameState(next, {
          type: "DECLARE_ACTION",
          playerId,
          kind: "useCharacter",
          sourceCardId: placementMode.cardId,
          targetSlots: [slot],
          targetingMode: "declareTime",
        });
      });
      setPlacementMode(null);
      return;
    }

    if (placementMode?.type === "hand_area_to_field" && placementMode.playerId === playerId) {
      if (cell.area) return;

      commitState((prev) => {
        const next = structuredClone(prev) as GameState;
        payHandCosts(next, playerId, placementMode.costCardIds, placementMode.cardId);
        return reduceGameState(next, {
          type: "DECLARE_ACTION",
          playerId,
          kind: "useArea",
          sourceCardId: placementMode.cardId,
          targetSlots: [slot],
          targetingMode: "declareTime",
        });
      });
      setPlacementMode(null);
      return;
    }

    if (placementMode?.type === "pile_area_to_field" && placementMode.playerId === playerId) {
      if (cell.area) return;

      commitState((prev) => {
        const next = structuredClone(prev) as GameState;
        payHandCosts(next, playerId, placementMode.costCardIds, placementMode.cardId);
        return reduceGameState(next, {
          type: "DECLARE_ACTION",
          playerId,
          kind: "useArea",
          sourceCardId: placementMode.cardId,
          targetSlots: [slot],
          targetingMode: "declareTime",
          payload: {
            sourceZone: placementMode.source,
          },
        });
      });
      setPlacementMode(null);
      return;
    }

    if (placementMode?.type === "hand_item_to_field" && placementMode.playerId === playerId) {
      if (!cell.card || cell.attachedItem) return;

      commitState((prev) => {
        const next = structuredClone(prev) as GameState;
        const player = next.players[playerId];
        const index = player.hand.findIndex((item) => item.instanceId === placementMode.cardId);
        if (index < 0) return next;

        payHandCosts(next, playerId, placementMode.costCardIds, placementMode.cardId);
        const [removed] = player.hand.splice(index, 1);
        if (!removed) return next;

        if (!attachItemToCharacter(next, playerId, slot, removed)) {
          player.hand.splice(index, 0, removed);
          return next;
        }

        next.logs.push(`[HAND] ${playerId} 손패 장비 -> ${slot}: ${removed.name}`);
        return next;
      });
      setPlacementMode(null);
      return;
    }

    if (placementMode?.type === "pile_item_to_field" && placementMode.playerId === playerId) {
      if (!cell.card || cell.attachedItem) return;

      commitState((prev) => {
        const next = structuredClone(prev) as GameState;
        const player = next.players[playerId];
        const sourcePile = placementMode.source === "deck" ? player.deck : player.discard;
        const sourceIndex = sourcePile.findIndex((item) => item.instanceId === placementMode.cardId);
        if (sourceIndex < 0) return next;

        payHandCosts(next, playerId, placementMode.costCardIds, placementMode.cardId);
        const [removed] = sourcePile.splice(sourceIndex, 1);
        if (!removed) return next;

        if (!attachItemToCharacter(next, playerId, slot, removed)) {
          sourcePile.splice(sourceIndex, 0, removed);
          return next;
        }

        next.logs.push(`[PILE_ITEM] ${playerId} ${placementMode.source} 장비 -> ${slot}: ${removed.name}`);
        return next;
      });
      setPlacementMode(null);
      return;
    }

    if (!card) return;
    if (pendingDeclaration) return;
    if (playerId !== perspective) return;
    if (!slot.startsWith("AF")) return;

    dispatch({
      type: "DECLARE_ACTION",
      playerId,
      kind: "attack",
      sourceCardId: card.instanceId,
    });
    setPlacementMode(null);
  }

  const passButtonLabel = pendingDeclaration
    ? `대응 안 함 / 해결 (${currentPriority})`
    : `PASS_PRIORITY (${currentPriority})`;

  if (!roomId || !roomRecord) {
    return (
      <div style={pageStyle}>
        <div style={pageInnerStyle}>
          <div style={noticeStyle}>방 정보를 찾지 못했어. 방 생성 화면으로 돌아가줘.</div>
          <Link to="/create-room" style={linkButtonStyle}>
            방 생성으로
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div style={pageStyle}>
      <div style={pageInnerStyle}>
        <div style={headerRowStyle}>
          <div>
            <div style={pageTitleStyle}>온라인 방 보드</div>
            <div style={pageSubTitleStyle}>
              Room ID {roomId} / 내 좌석 {seat} / 로컬 2탭 동기화
            </div>
          </div>

          <div style={headerButtonsStyle}>
            <Link to="/" style={linkButtonStyle}>
              타이틀로
            </Link>
            <button type="button" style={secondaryButtonStyle} onClick={resetRoomBoard}>
              방 상태 초기화
            </button>
          </div>
        </div>

        <div style={noticeStyle}>
          P1 입장: {roomRecord.seats.P1 ? "예" : "아니오"} / P2 입장: {roomRecord.seats.P2 ? "예" : "아니오"}
          <br />
          같은 브라우저에서 두 탭을 열고 Room ID로 접속하면 상태가 동기화돼.
        </div>

        <div style={toolbarStyle}>
          <button type="button" style={primaryButtonStyle} onClick={handleStartGame}>
            START_GAME
          </button>
          <button type="button" style={secondaryButtonStyle} onClick={handleStartTurn}>
            START_TURN
          </button>
          <button type="button" style={secondaryButtonStyle} onClick={handleAdvancePhase}>
            ADVANCE_PHASE
          </button>
          <button type="button" style={secondaryButtonStyle} onClick={handlePassPriority}>
            {passButtonLabel}
          </button>
          <button type="button" style={dangerButtonStyle} onClick={() => handleConcede(perspective)}>
            {perspective} 항복
          </button>
        </div>

        <div style={toolbarStyle}>
          <button type="button" style={secondaryButtonStyle} onClick={() => handleKeep("P1")}>
            P1 KEEP
          </button>
          <button type="button" style={secondaryButtonStyle} onClick={() => handleMulligan("P1")}>
            P1 MULLIGAN
          </button>
          <button type="button" style={secondaryButtonStyle} onClick={() => handleKeep("P2")}>
            P2 KEEP
          </button>
          <button type="button" style={secondaryButtonStyle} onClick={() => handleMulligan("P2")}>
            P2 MULLIGAN
          </button>
          <button type="button" style={primaryButtonStyle} onClick={handleFinalizeStartup}>
            FINALIZE_STARTUP
          </button>
        </div>

        <div style={noticeStyle}>
          현재 조작 시점: {perspective}
          <br />
          P1 덱 소스: {usingDeckBuilderDeck ? "덱 편성에서 저장한 현재 덱" : "기본 연습 덱"}
        </div>

        {placementMode ? (
          <div style={noticeStyle}>
            선언/배치 대기 중: {placementMode.playerId} / 카드 {placementMode.cardId} / 원하는 필드 칸을 클릭
          </div>
        ) : null}

        {moveMode ? (
          <div style={noticeStyle}>
            이동 선언 대기 중: {moveMode.playerId} / 카드 {moveMode.cardId} / 이동할 자신의 빈 필드 칸을 클릭
          </div>
        ) : null}

        {pendingDeclaration ? (
          <div style={noticeStyle}>
            선언 스택 존재: {pendingSummary}
            <br />
            현재 우선권 플레이어인 <strong>{currentPriority}</strong>만 대응할 수 있어. 대응이 없으면
            <strong> {passButtonLabel}</strong> 버튼으로 즉시 해결돼.
          </div>
        ) : null}

        <PracticeBoardView
          state={state}
          perspective={perspective}
          onHandPrimaryAction={handleHandPrimaryAction}
          onHandDeclareAction={handleHandDeclareAction}
          onMoveHandCardToDeckTop={handleMoveHandCardToDeckTop}
          onMoveHandCardToDeckBottom={handleMoveHandCardToDeckBottom}
          onFieldClick={handleFieldClick}
          onDrawFromDeck={handleDrawFromDeck}
          onDamageFromDeck={handleDamageFromDeck}
          onShuffleDeck={handleShuffleDeck}
          onPrimaryCardAction={handlePrimaryCardAction}
          onMoveCardToHand={handleMoveCardToHand}
          onRecoverCardsToDeckBottom={handleRecoverCardsToDeckBottom}
          onFieldCharacterAction={handleFieldCharacterAction}
        />

        <div style={logGridStyle}>
          <div style={panelStyle}>
            <div style={sectionTitleStyle}>최근 로그</div>
            <div style={logListStyle}>
              {[...state.logs].reverse().map((log, index) => (
                <div key={`${log}-${index}`} style={logItemStyle}>
                  {log}
                </div>
              ))}
            </div>
          </div>

          <div style={panelStyle}>
            <div style={sectionTitleStyle}>최근 이벤트</div>
            <div style={logListStyle}>
              {[...state.events].reverse().map((event, index) => (
                <div
                  key={`${event.type}-${event.cardId ?? "none"}-${index}`}
                  style={logItemStyle}
                >
                  {event.type}
                  {event.playerId ? ` / ${event.playerId}` : ""}
                  {event.cardId ? ` / ${event.cardId}` : ""}
                  {typeof event.amount === "number" ? ` / ${event.amount}` : ""}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const pageStyle: CSSProperties = {
  minHeight: "100vh",
  width: "100%",
  background: "#101722",
  color: "#ffffff",
  padding: 24,
  boxSizing: "border-box",
};

const pageInnerStyle: CSSProperties = {
  width: "100%",
  maxWidth: 1200,
  margin: "0 auto",
};

const headerRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 16,
  marginBottom: 16,
  flexWrap: "wrap",
};

const pageTitleStyle: CSSProperties = {
  fontSize: 28,
  fontWeight: 700,
  marginBottom: 4,
};

const pageSubTitleStyle: CSSProperties = {
  color: "#b9c3d6",
};

const headerButtonsStyle: CSSProperties = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
};

const toolbarStyle: CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
  marginBottom: 12,
};

const panelStyle: CSSProperties = {
  background: "#182233",
  border: "1px solid #2a3850",
  borderRadius: 12,
  padding: 16,
  marginBottom: 16,
};

const sectionTitleStyle: CSSProperties = {
  fontSize: 20,
  fontWeight: 700,
  marginBottom: 10,
};

const primaryButtonStyle: CSSProperties = {
  background: "#4a7cff",
  color: "#ffffff",
  border: "none",
  borderRadius: 10,
  padding: "10px 14px",
  cursor: "pointer",
  fontWeight: 700,
};

const secondaryButtonStyle: CSSProperties = {
  background: "#24324a",
  color: "#ffffff",
  border: "1px solid #3e5379",
  borderRadius: 10,
  padding: "10px 14px",
  cursor: "pointer",
  fontWeight: 600,
};

const dangerButtonStyle: CSSProperties = {
  background: "#7a2434",
  color: "#ffffff",
  border: "1px solid #a04a5b",
  borderRadius: 10,
  padding: "10px 14px",
  cursor: "pointer",
  fontWeight: 700,
};

const linkButtonStyle: CSSProperties = {
  ...secondaryButtonStyle,
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center",
};

const noticeStyle: CSSProperties = {
  background: "#24324a",
  border: "1px solid #4a7cff",
  borderRadius: 10,
  padding: 12,
  marginBottom: 16,
  lineHeight: 1.5,
};

const logGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 16,
};

const logListStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  maxHeight: 320,
  overflowY: "auto",
};

const logItemStyle: CSSProperties = {
  background: "#0f1724",
  borderRadius: 8,
  padding: "8px 10px",
  color: "#d9e2f2",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
};
