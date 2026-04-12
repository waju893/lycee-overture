import { useMemo, useRef, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import PracticeBoardView from "../components/PracticeBoard";
import { reduceGameState } from "../game/GameEngine";
import {
  createInitialGameState,
  getMatchingDefenderSlotForColumn,
} from "../game/GameRules";
import type { GameAction } from "../game/GameActions";
import type { CardRef, FieldSlot, GameState, PlayerID } from "../game/GameTypes";
import type { DeckEntry } from "../lib/deck";
import { CARD_META_BY_CODE } from "../lib/cards";

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

function createPracticeState(): GameState {
  const p1DeckFromBuilder = readPracticeDeckFromStorage("P1");
  const p1Deck = shuffleCards(p1DeckFromBuilder ?? makeDeck("P1", "P1"));
  const p2Deck = shuffleCards(makeDeck("P2", "P2"));

  return createInitialGameState({
    p1Deck,
    p2Deck,
    leaderEnabled: false,
  });
}

function getDefaultPerspective(state: GameState): PlayerID {
  if (state.turn.activePlayer === "P1" || state.turn.activePlayer === "P2") {
    return state.turn.activePlayer;
  }
  return "P1";
}

function getPendingDeclarationSummary(state: GameState): string | null {
  const top = state.declarationStack[state.declarationStack.length - 1];
  if (!top) return null;

  if (top.kind === "useCharacter") return `${top.playerId} 캐릭터 등장 선언 대기`;
  if (top.kind === "attack") return `${top.playerId} 공격 선언 대기`;
  if (top.kind === "chargeCharacter") return `${top.playerId} 차지 선언 대기`;
  return `${top.playerId} 선언 대기`;
}

function getFirstEmptySlot(state: GameState, playerId: PlayerID): FieldSlot | null {
  for (const slot of ALL_SLOTS) {
    if (!state.players[playerId].field[slot].card) return slot;
  }
  return null;
}

function normalizeAttributeToken(value: string): string | null {
  const v = String(value ?? "").trim().toLowerCase();
  switch (v) {
    case "snow":
    case "雪":
      return "snow";
    case "moon":
    case "月":
      return "moon";
    case "flower":
    case "花":
      return "flower";
    case "cosmos":
    case "space":
    case "宙":
      return "cosmos";
    case "sun":
    case "日":
      return "sun";
    case "star":
    case "none":
    case "無":
      return "star";
    default:
      return null;
  }
}

function parseUseTargetSequence(useTarget: string | string[] | 0 | undefined): string[] {
  if (Array.isArray(useTarget)) {
    return useTarget
      .map((value) => normalizeAttributeToken(String(value)))
      .filter((value): value is string => Boolean(value));
  }

  const raw = String(useTarget ?? "").trim();
  if (!raw) return [];

  const tokenMatches = raw.match(/snow|moon|flower|cosmos|space|sun|star|none|雪|月|花|宙|日|無/gi) ?? [];
  const normalized = tokenMatches
    .map((token) => normalizeAttributeToken(token))
    .filter((value): value is string => Boolean(value));

  if (normalized.length > 0) return normalized;

  const fallback: string[] = [];
  for (const ch of raw) {
    const token = normalizeAttributeToken(ch);
    if (token) fallback.push(token);
  }
  return fallback;
}

function parseUseTargetAttributes(useTarget: string | string[] | 0 | undefined): string[] {
  return Array.from(new Set(parseUseTargetSequence(useTarget)));
}

function getCardMeta(cardNo?: string) {
  if (!cardNo) return undefined;
  return CARD_META_BY_CODE[String(cardNo).trim().toUpperCase()];
}

function getCardAttributes(card: CardRef): string[] {
  const meta = getCardMeta(card.cardNo);
  const attrs = (meta?.attributesList ?? [])
    .map((value) => String(value).toLowerCase())
    .filter(Boolean);
  if (attrs.length > 0) return attrs;
  const primary = normalizeAttributeToken(String(meta?.attribute ?? ""));
  return primary ? [primary] : [];
}

function getCardEx(card: CardRef): number {
  const meta = getCardMeta(card.cardNo);
  return Math.max(0, Number(meta?.ex ?? 0) || 0);
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

function placeAreaOnField(
  next: GameState,
  playerId: PlayerID,
  slot: FieldSlot,
  card: CardRef,
): boolean {
  const cell = next.players[playerId].field[slot] as {
    card: CardRef | null;
    area?: CardRef | null;
    attachedItem?: CardRef | null;
  };
  if (cell.area) {
    next.logs.push(`[ZONE] ${playerId} 에리어 배치 실패: 해당 칸에 이미 에리어가 있음`);
    return false;
  }

  card.location = "field";
  card.slot = slot;
  card.revealed = true;
  cell.area = card;
  return true;
}

function attachItemToCharacter(
  next: GameState,
  playerId: PlayerID,
  slot: FieldSlot,
  card: CardRef,
): boolean {
  const cell = next.players[playerId].field[slot] as {
    card: CardRef | null;
    area?: CardRef | null;
    attachedItem?: CardRef | null;
  };
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
  return ALL_SLOTS.some((slot) => {
    const cell = state.players[playerId].field[slot] as { area?: CardRef | null };
    return !cell.area;
  });
}

function hasEquipableCharacterSlot(state: GameState, playerId: PlayerID): boolean {
  return ALL_SLOTS.some((slot) => {
    const cell = state.players[playerId].field[slot] as {
      card: CardRef | null;
      attachedItem?: CardRef | null;
    };
    return Boolean(cell.card) && !cell.attachedItem;
  });
}

function payHandCosts(next: GameState, playerId: PlayerID, costCardIds: string[], actionCardId?: string) {
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

export default function PracticeBoardPage() {
  const [state, setState] = useState<GameState>(() => createPracticeState());
  const [perspective, setPerspective] = useState<PlayerID>("P1");
  const [placementMode, setPlacementMode] = useState<PlacementMode>(null);
  const [moveMode, setMoveMode] = useState<{ playerId: PlayerID; cardId: string } | null>(null);
  const [chargePromptState, setChargePromptState] = useState<{
    playerId: PlayerID;
    cardId: string;
    deckCount: number;
    discardCount: number;
  } | null>(null);
  const [chargeDiscardSelectionState, setChargeDiscardSelectionState] = useState<{
    playerId: PlayerID;
    cardId: string;
    deckCount: number;
    discardCount: number;
    selectedIds: string[];
  } | null>(null);

  const [characterCostSelectionState, setCharacterCostSelectionState] = useState<{
    playerId: PlayerID;
    cardId: string;
    requiredCost: number;
    parsedCost: number;
    useTargetText: string;
    requiredAttributes: string[];
    useTargetSequence: string[];
    selectedIds: string[];
  } | null>(null);

  const initialStateRef = useRef<GameState>(structuredClone(createPracticeState()));

  const currentPriority = state.battle.isActive
    ? state.battle.priorityPlayer ?? state.turn.priorityPlayer
    : state.turn.priorityPlayer;
  const pendingDeclaration = state.declarationStack.length > 0;
  const pendingSummary = getPendingDeclarationSummary(state);
  const usingDeckBuilderDeck = useMemo(
    () => state.players.P1.deck.some((card) => card.cardNo.startsWith("LO-")),
    [state.players.P1.deck],
  );

  const battleCandidate = useMemo(() => {
    if (!state.battle.isActive) return null;
    const attackerPlayerId = state.battle.attackerPlayerId;
    const defenderPlayerId = state.battle.defenderPlayerId;
    const attackColumn = state.battle.attackColumn;
    if (!attackerPlayerId || !defenderPlayerId || typeof attackColumn !== "number") return null;

    const defenderSlot = getMatchingDefenderSlotForColumn(attackColumn);
    const defenderCard = state.players[defenderPlayerId].field[defenderSlot].card;
    if (!defenderCard || defenderCard.isTapped) return null;

    return {
      playerId: defenderPlayerId,
      slot: defenderSlot,
      cardId: defenderCard.instanceId,
      name: defenderCard.name,
    };
  }, [state]);

  function dispatch(action: GameAction) {
    setState((prev) => reduceGameState(prev, action));
  }

  function resetPractice() {
    const next = createPracticeState();
    setState(next);
    initialStateRef.current = structuredClone(next);
    setPerspective(getDefaultPerspective(next));
    setPlacementMode(null);
    setMoveMode(null);
    setChargePromptState(null);
    setChargeDiscardSelectionState(null);
    setCharacterCostSelectionState(null);
  }

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
    dispatch({ type: "START_TURN" });
    dispatch({ type: "ADVANCE_PHASE" });
  }

  function handleAdvancePhase() {
    dispatch({ type: "ADVANCE_PHASE" });
    setPlacementMode(null);
    setCharacterCostSelectionState(null);
  }

  function handleStartTurn() {
    dispatch({ type: "START_TURN" });
    setPlacementMode(null);
    setCharacterCostSelectionState(null);
  }

  function handlePassPriority() {
    dispatch({ type: "PASS_PRIORITY", playerId: currentPriority });
    setPlacementMode(null);
    setCharacterCostSelectionState(null);
  }

  function handleDrawFromDeck(playerId: PlayerID) {
    setState((prev) => {
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
      next.events.push({ type: "DRAW", playerId, cardId: topCard.instanceId, amount: 1 } as any);
      next.logs.push(`[DECK] ${playerId} 덱 맨 위 1장을 패로 이동: ${topCard.name}`);
      return next;
    });
  }

  function handleDamageFromDeck(playerId: PlayerID) {
    setState((prev) => {
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
      next.events.push({ type: "MILL", playerId, cardId: topCard.instanceId, amount: 1 } as any);
      next.logs.push(`[DECK] ${playerId} 덱 맨 위 1장을 쓰레기통으로 이동: ${topCard.name}`);
      return next;
    });
  }

  function handleShuffleDeck(playerId: PlayerID) {
    setState((prev) => {
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
      if (currentPriority !== playerId) return;
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
      if (currentPriority !== playerId) return;
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
      if (currentPriority !== playerId) return;
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

    setState((prev) => {
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
    setState((prev) => {
      const next = structuredClone(prev) as GameState;
      const player = next.players[playerId];
      const sourcePile = source === "deck" ? player.deck : player.discard;
      const index = sourcePile.findIndex((card) => card.instanceId === cardId);

      if (index < 0) {
        next.logs.push(`[ZONE] 이동 실패: ${playerId} ${source}에서 카드를 찾지 못함 (${cardId})`);
        return next;
      }

      const [card] = sourcePile.splice(index, 1);
      if (!card) return next;

      card.location = "hand";
      card.revealed = false;
      player.hand.push(card);
      next.logs.push(`[ZONE] ${playerId} ${source} → 손패: ${card.name}`);
      return next;
    });
  }

  function handleRecoverCardsToDeckBottom(playerId: PlayerID, cardIdsInOrder: string[]) {
    setState((prev) => {
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
        next.logs.push(`[RECOVERY] ${playerId} ${recoveredNames.length}장 회복 -> 덱 아래 / 순서: ${recoveredNames.join(" -> ")}`);
      }
      return next;
    });
  }

  function handleHandPrimaryAction(playerId: PlayerID, card: CardRef, costCardIds: string[]) {
    if (card.cardType === "character") {
      if (pendingDeclaration) return;
      if (currentPriority !== playerId) return;
      if (!getFirstEmptySlot(state, playerId)) return;

      const meta = getCardMeta(card.cardNo);
      const parsedCost = Math.max(0, Number(meta?.cost ?? 0) || 0);
      const useTargetText = String(meta?.useTarget ?? "").trim();
      const useTargetSequence = parseUseTargetSequence(meta?.useTarget);
      const requiredAttributes = Array.from(new Set(useTargetSequence));
      const needsCostSelection = parsedCost > 0 || useTargetText !== "" || useTargetSequence.length > 0;
      const requiredCost = parsedCost > 0 ? parsedCost : Math.max(useTargetSequence.length, useTargetText ? 1 : 0);

      if (needsCostSelection) {
        const availableCostCards = state.players[playerId].hand.filter((handCard) => {
          if (handCard.instanceId === card.instanceId) return false;
          if (requiredAttributes.length === 0) return true;
          const attrs = getCardAttributes(handCard);
          return requiredAttributes.some((attr) => attrs.includes(attr));
        });

        const availableEx = availableCostCards.reduce((sum, handCard) => sum + getCardEx(handCard), 0);

        if (availableEx < requiredCost) {
          setState((prev) => {
            const next = structuredClone(prev) as GameState;
            next.logs.push(`[COST] ${playerId} ${card.name} 등장 실패: parsedCost=${parsedCost}, useTarget=${useTargetText || "none"}, 필요 코스트=${requiredCost}, 지불 가능 EX=${availableEx}`);
            return next;
          });
          return;
        }

        setState((prev) => {
          const next = structuredClone(prev) as GameState;
          next.logs.push(`[USECHARACTER] ${playerId} ${card.name} costUI 진입 / parsedCost=${parsedCost} / useTarget=${useTargetText || "none"} / requiredCost=${requiredCost}`);
          return next;
        });

        setCharacterCostSelectionState({
          playerId,
          cardId: card.instanceId,
          requiredCost,
          parsedCost,
          useTargetText,
          requiredAttributes,
          useTargetSequence,
          selectedIds: [],
        });
        return;
      }

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
      if (currentPriority !== playerId) return;
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
      if (currentPriority !== playerId) return;
      if (!hasEquipableCharacterSlot(state, playerId)) return;

      setPlacementMode({
        type: "hand_item_to_field",
        playerId,
        cardId: card.instanceId,
        costCardIds,
      });
      return;
    }

    setState((prev) => {
      const next = structuredClone(prev) as GameState;
      const player = next.players[playerId];
      const index = player.hand.findIndex((item) => item.instanceId === card.instanceId);

      if (index < 0) {
        next.logs.push(`[HAND] ${playerId} 손패 행동 실패: 카드를 찾지 못함 (${card.instanceId})`);
        return next;
      }

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
    setState((prev) => {
      const next = structuredClone(prev) as GameState;
      const player = next.players[playerId];
      const index = player.hand.findIndex((card) => card.instanceId === cardId);

      if (index < 0) {
        next.logs.push(`[HAND_DECLARE] ${playerId} 패 선언 실패: 카드를 찾지 못함 (${cardId})`);
        return next;
      }

      const [card] = player.hand.splice(index, 1);
      if (!card) return next;

      card.location = "discard";
      card.revealed = true;
      player.discard.push(card);
      next.logs.push(`[HAND_DECLARE] ${playerId} 패 선언: ${card.name} -> 먼저 쓰레기통으로 보낸 뒤 해결`);
      next.events.push({ type: "HAND_DECLARE", playerId, cardId: card.instanceId } as any);
      return next;
    });
  }

  function handleMoveHandCardToDeckTop(playerId: PlayerID, cardId: string) {
    setState((prev) => {
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
    setState((prev) => {
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
      setState((prev) => {
        const next = structuredClone(prev) as GameState;
        const fromSlot = ALL_SLOTS.find(
          (candidateSlot) =>
            next.players[playerId].field[candidateSlot].card?.instanceId === moveMode.cardId,
        );
        if (!fromSlot) return next;
        const movingCard = next.players[playerId].field[fromSlot].card;
        next.players[playerId].field[fromSlot].card = null;
        next.players[playerId].field[slot].card = movingCard;
        next.logs.push(`[MOVE] ${playerId} ${moveMode.cardId} ${fromSlot} -> ${slot}`);
        return next;
      });
      setMoveMode(null);
      return;
    }

    if (!card) return;

    if (actionKind === "attack") {
      if (pendingDeclaration) return;
      if (currentPriority !== playerId) return;

      dispatch({
        type: "DECLARE_ACTION",
        playerId,
        kind: "attack",
        sourceCardId: card.instanceId,
      } as GameAction);
      return;
    }

    if (actionKind === "tap" || actionKind === "untap") {
      setState((prev) => {
        const next = structuredClone(prev) as GameState;
        const current = next.players[playerId].field[slot].card;
        if (current) current.isTapped = actionKind === "tap";
        next.logs.push(`[FIELD] ${playerId} ${slot} ${actionKind === "tap" ? "행동 완료" : "미행동"}: ${card.name}`);
        return next;
      });
      return;
    }

    if (actionKind === "move") {
      setMoveMode({ playerId, cardId: card.instanceId });
      return;
    }

    if (actionKind === "charge") {
      setChargePromptState({
        playerId,
        cardId: card.instanceId,
        deckCount: 0,
        discardCount: 0,
      });
    }
  }

  function handleFieldClick(playerId: PlayerID, slot: FieldSlot) {
    const cell = state.players[playerId].field[slot] as {
      card: CardRef | null;
      area?: CardRef | null;
      attachedItem?: CardRef | null;
    };

    if (placementMode?.type === "hand_character_to_field" && placementMode.playerId === playerId) {
      if (cell.card) return;

      setState((prev) => {
        const next = structuredClone(prev) as GameState;
        payHandCosts(next, playerId, placementMode.costCardIds, placementMode.cardId);
        return reduceGameState(next, {
          type: "DECLARE_ACTION",
          playerId,
          kind: "useCharacter",
          sourceCardId: placementMode.cardId,
          targetSlots: [slot],
          targetingMode: "declareTime",
        } as GameAction);
      });
      setPlacementMode(null);
      return;
    }

    if (placementMode?.type === "pile_character_to_field" && placementMode.playerId === playerId) {
      if (cell.card) return;

      setState((prev) => {
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
        } as GameAction);
      });
      setPlacementMode(null);
      return;
    }

    if (placementMode?.type === "hand_area_to_field" && placementMode.playerId === playerId) {
      if (cell.area) return;
      setState((prev) => {
        const next = structuredClone(prev) as GameState;
        const player = next.players[playerId];
        const index = player.hand.findIndex((item) => item.instanceId === placementMode.cardId);
        if (index < 0) return next;
        payHandCosts(next, playerId, placementMode.costCardIds, placementMode.cardId);
        const [removed] = player.hand.splice(index, 1);
        if (!removed) return next;
        placeAreaOnField(next, playerId, slot, removed);
        next.logs.push(`[AREA] ${playerId} ${slot} 에리어 배치: ${removed.name}`);
        return next;
      });
      setPlacementMode(null);
      return;
    }

    if (placementMode?.type === "pile_area_to_field" && placementMode.playerId === playerId) {
      if (cell.area) return;
      setState((prev) => {
        const next = structuredClone(prev) as GameState;
        const player = next.players[playerId];
        const sourcePile = placementMode.source === "deck" ? player.deck : player.discard;
        const sourceIndex = sourcePile.findIndex((item) => item.instanceId === placementMode.cardId);
        if (sourceIndex < 0) return next;
        payHandCosts(next, playerId, placementMode.costCardIds, placementMode.cardId);
        const [removed] = sourcePile.splice(sourceIndex, 1);
        if (!removed) return next;
        placeAreaOnField(next, playerId, slot, removed);
        next.logs.push(`[AREA] ${playerId} ${placementMode.source} -> ${slot}: ${removed.name}`);
        return next;
      });
      setPlacementMode(null);
      return;
    }

    if (placementMode?.type === "hand_item_to_field" && placementMode.playerId === playerId) {
      if (!cell.card || cell.attachedItem) return;
      setState((prev) => {
        const next = structuredClone(prev) as GameState;
        const player = next.players[playerId];
        const index = player.hand.findIndex((item) => item.instanceId === placementMode.cardId);
        if (index < 0) return next;
        payHandCosts(next, playerId, placementMode.costCardIds, placementMode.cardId);
        const [removed] = player.hand.splice(index, 1);
        if (!removed) return next;
        if (!attachItemToCharacter(next, playerId, slot, removed)) return prev;
        next.logs.push(`[ITEM] ${playerId} ${slot} 장비: ${removed.name}`);
        return next;
      });
      setPlacementMode(null);
      return;
    }

    if (placementMode?.type === "pile_item_to_field" && placementMode.playerId === playerId) {
      if (!cell.card || cell.attachedItem) return;
      setState((prev) => {
        const next = structuredClone(prev) as GameState;
        const player = next.players[playerId];
        const sourcePile = placementMode.source === "deck" ? player.deck : player.discard;
        const sourceIndex = sourcePile.findIndex((item) => item.instanceId === placementMode.cardId);
        if (sourceIndex < 0) return next;
        payHandCosts(next, playerId, placementMode.costCardIds, placementMode.cardId);
        const [removed] = sourcePile.splice(sourceIndex, 1);
        if (!removed) return next;
        if (!attachItemToCharacter(next, playerId, slot, removed)) return prev;
        next.logs.push(`[ITEM] ${playerId} ${placementMode.source} -> ${slot}: ${removed.name}`);
        return next;
      });
      setPlacementMode(null);
      return;
    }
  }

  function handleChooseDefender() {
    if (!battleCandidate) return;
    dispatch({
      type: "SET_DEFENDER",
      playerId: battleCandidate.playerId,
      defenderCardId: battleCandidate.cardId,
    } as GameAction);
    setPerspective(battleCandidate.playerId);
  }

  function handleDeclineDefender() {
    if (!battleCandidate) return;
    dispatch({
      type: "SET_DEFENDER",
      playerId: battleCandidate.playerId,
    } as GameAction);
    setPerspective(battleCandidate.playerId);
  }

  const passButtonLabel = pendingDeclaration
    ? `대응 안 함 / 해결 (${currentPriority})`
    : state.battle.isActive
      ? `PASS_PRIORITY (${currentPriority})`
      : `PASS_PRIORITY (${currentPriority})`;

  return (
    <div style={pageStyle}>
      <div style={pageInnerStyle}>
        <div style={headerRowStyle}>
          <div>
            <div style={pageTitleStyle}>연습 모드</div>
            <div style={pageSubTitleStyle}>
              Battle UI 완전 연결: 공격 대응 창 / 방어 선택 / 배틀 디버그 패널
            </div>
          </div>

          <div style={headerButtonsStyle}>
            <Link to="/" style={linkButtonStyle}>
              타이틀로
            </Link>
            <button type="button" style={secondaryButtonStyle} onClick={resetPractice}>
              연습판 초기화
            </button>
          </div>
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

        <div style={toolbarStyle}>
          <button
            type="button"
            style={perspective === "P1" ? primaryButtonStyle : secondaryButtonStyle}
            onClick={() => setPerspective("P1")}
          >
            P1 시점
          </button>
          <button
            type="button"
            style={perspective === "P2" ? primaryButtonStyle : secondaryButtonStyle}
            onClick={() => setPerspective("P2")}
          >
            P2 시점
          </button>
          <div style={hintTextStyle}>
            현재 조작 시점: {perspective} / P1 덱 소스: {usingDeckBuilderDeck ? "덱 편성 현재 덱" : "기본 연습 덱"}
          </div>
        </div>

        {placementMode ? (
          <div style={noticeStyle}>
            선언/배치 대기 중: {placementMode.playerId} / 카드 {placementMode.cardId} / 원하는 필드 칸을 클릭
          </div>
        ) : null}

        {moveMode ? (
          <div style={noticeStyle}>
            이동 대기 중: {moveMode.playerId} / 카드 {moveMode.cardId} / 이동할 자신의 빈 필드 칸을 클릭
          </div>
        ) : null}

        {pendingDeclaration ? (
          <div style={noticeStyle}>
            선언 스택 존재: {pendingSummary}
            <br />
            현재 우선권 플레이어인 <strong>{currentPriority}</strong>만 대응할 수 있습니다.
          </div>
        ) : null}

        <div style={battleGridStyle}>
          <div style={battlePanelStyle}>
            <div style={battlePanelTitleStyle}>배틀 상태</div>
            <div>isActive: {String(state.battle.isActive)}</div>
            <div>phase: {state.battle.phase}</div>
            <div>turn.priorityPlayer: {state.turn.priorityPlayer}</div>
            <div>battle.priorityPlayer: {state.battle.priorityPlayer ?? "-"}</div>
            <div>attackerPlayer: {state.battle.attackerPlayerId ?? "-"}</div>
            <div>attackerCardId: {state.battle.attackerCardId ?? "-"}</div>
            <div>defenderPlayer: {state.battle.defenderPlayerId ?? "-"}</div>
            <div>defenderCardId: {state.battle.defenderCardId ?? "없음"}</div>
            <div>attackColumn: {typeof state.battle.attackColumn === "number" ? state.battle.attackColumn : "-"}</div>
            <div>passedPlayers: {(state.battle.passedPlayers ?? []).join(", ") || "-"}</div>
          </div>

          {state.battle.isActive ? (
            <div style={battlePanelStyle}>
              <div style={battlePanelTitleStyle}>
                {state.battle.phase === "awaitingDefenderSelection" ? "공격 선언 대응 창" : "배틀 중 우선권 창"}
              </div>

              {state.battle.phase === "awaitingDefenderSelection" ? (
                <>
                  <div>공격 선언에 대한 대응 선언을 먼저 처리하는 단계입니다.</div>
                  <div style={battleHintStyle}>
                    같은 열 DF가 있더라도 지금은 아직 방어자 판정 전입니다. 대응 선언 stack이 전부 처리된 뒤에만 방어 후보를 다시 검사합니다.
                  </div>
                </>
              ) : null}

              {state.battle.phase === "duringBattle" ? (
                <>
                  <div>방어자 지정 이후 또는 방어 안 함 확정 이후의 배틀 우선권 창입니다.</div>
                  {battleCandidate ? (
                    <>
                      <div style={battleHintStyle}>
                        방어 후보: {battleCandidate.playerId} / {battleCandidate.slot} / {battleCandidate.name}
                      </div>
                      {!state.battle.defenderCardId ? (
                        <div style={toolbarStyle}>
                          <button type="button" style={primaryButtonStyle} onClick={handleChooseDefender}>
                            방어 선택
                          </button>
                          <button type="button" style={secondaryButtonStyle} onClick={handleDeclineDefender}>
                            방어 안 함
                          </button>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <div style={battleHintStyle}>현재 선택 가능한 방어 후보가 없습니다.</div>
                  )}
                </>
              ) : null}
            </div>
          ) : null}
        </div>

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

                {characterCostSelectionState ? (
          <div style={noticeStyle}>
            <div style={battlePanelTitleStyle}>useCharacter 코스트 지불</div>
            <div>플레이어: {characterCostSelectionState.playerId}</div>
            <div>
              카드: {
                state.players[characterCostSelectionState.playerId].hand.find(
                  (card) => card.instanceId === characterCostSelectionState.cardId,
                )?.name ?? characterCostSelectionState.cardId
              }
            </div>
            <div>필요 코스트: {characterCostSelectionState.requiredCost}</div>
            <div>parsed cost: {characterCostSelectionState.parsedCost}</div>
            <div>useTarget: {characterCostSelectionState.useTargetText || "제한 없음"}</div>
            <div style={battleHintStyle}>선택한 카드들의 EX 합이 필요한 코스트 이상이어야 합니다.</div>
            {characterCostSelectionState.useTargetSequence.length > 0 ? (
              <div>useTarget sequence: {characterCostSelectionState.useTargetSequence.join(" / ")}</div>
            ) : null}
            {characterCostSelectionState.requiredAttributes.length > 0 ? (
              <div>허용 속성: {characterCostSelectionState.requiredAttributes.join(" / ")}</div>
            ) : null}
            <div>
              현재 선택 EX 합: {
                state.players[characterCostSelectionState.playerId].hand
                  .filter((card) => characterCostSelectionState.selectedIds.includes(card.instanceId))
                  .reduce((sum, card) => sum + getCardEx(card), 0)
              }
            </div>

            <div style={chargeGridStyle}>
              {state.players[characterCostSelectionState.playerId].hand
                .filter((card) => card.instanceId !== characterCostSelectionState.cardId)
                .filter((card) => {
                  if (characterCostSelectionState.requiredAttributes.length === 0) return true;
                  const attrs = getCardAttributes(card);
                  return characterCostSelectionState.requiredAttributes.some((attr) => attrs.includes(attr));
                })
                .map((handCard) => {
                  const selected = characterCostSelectionState.selectedIds.includes(handCard.instanceId);
                  const attrs = getCardAttributes(handCard).join(", ");
                  const ex = getCardEx(handCard);
                  return (
                    <button
                      key={handCard.instanceId}
                      type="button"
                      style={{
                        ...secondaryButtonStyle,
                        background: selected ? "#4a7cff" : "#24324a",
                      }}
                      onClick={() =>
                        setCharacterCostSelectionState((prev) => {
                          if (!prev) return prev;
                          const exists = prev.selectedIds.includes(handCard.instanceId);
                          if (exists) {
                            return {
                              ...prev,
                              selectedIds: prev.selectedIds.filter((id) => id !== handCard.instanceId),
                            };
                          }
                          return {
                            ...prev,
                            selectedIds: [...prev.selectedIds, handCard.instanceId],
                          };
                        })
                      }
                    >
                      {handCard.name}
                      <br />
                      <span style={{ fontSize: 12, color: "#dbeafe" }}>
                        attr {attrs || "없음"} / EX {ex}
                      </span>
                    </button>
                  );
                })}
            </div>

            <div style={toolbarStyle}>
              <button
                type="button"
                style={primaryButtonStyle}
                onClick={() => {
                  if (!characterCostSelectionState) return;
                  const selectedCards = state.players[characterCostSelectionState.playerId].hand.filter((card) =>
                    characterCostSelectionState.selectedIds.includes(card.instanceId),
                  );
                  const totalEx = selectedCards.reduce((sum, card) => sum + getCardEx(card), 0);
                  if (totalEx < characterCostSelectionState.requiredCost) return;

                  setPlacementMode({
                    type: "hand_character_to_field",
                    playerId: characterCostSelectionState.playerId,
                    cardId: characterCostSelectionState.cardId,
                    costCardIds: characterCostSelectionState.selectedIds,
                  });
                  setCharacterCostSelectionState(null);
                }}
              >
                코스트 확정 후 배치 칸 선택
              </button>
              <button
                type="button"
                style={secondaryButtonStyle}
                onClick={() => setCharacterCostSelectionState(null)}
              >
                취소
              </button>
            </div>
          </div>
        ) : null}

{chargePromptState ? (
          <div style={noticeStyle}>
            어느 곳에서 차지하시겠습니까?
            <div style={counterRowStyle}>
              <span>덱</span>
              <button
                type="button"
                style={secondaryButtonStyle}
                onClick={() =>
                  setChargePromptState((prev) =>
                    prev ? { ...prev, deckCount: Math.max(0, prev.deckCount - 1) } : prev,
                  )
                }
              >
                -
              </button>
              <span>{chargePromptState.deckCount}</span>
              <button
                type="button"
                style={secondaryButtonStyle}
                onClick={() =>
                  setChargePromptState((prev) => (prev ? { ...prev, deckCount: prev.deckCount + 1 } : prev))
                }
              >
                +
              </button>
              <span>쓰레기통</span>
              <button
                type="button"
                style={secondaryButtonStyle}
                onClick={() =>
                  setChargePromptState((prev) =>
                    prev ? { ...prev, discardCount: Math.max(0, prev.discardCount - 1) } : prev,
                  )
                }
              >
                -
              </button>
              <span>{chargePromptState.discardCount}</span>
              <button
                type="button"
                style={secondaryButtonStyle}
                onClick={() =>
                  setChargePromptState((prev) =>
                    prev ? { ...prev, discardCount: prev.discardCount + 1 } : prev,
                  )
                }
              >
                +
              </button>
            </div>
            <div style={toolbarStyle}>
              <button
                type="button"
                style={primaryButtonStyle}
                onClick={() => {
                  if (chargePromptState.discardCount > 0) {
                    setChargeDiscardSelectionState({
                      playerId: chargePromptState.playerId,
                      cardId: chargePromptState.cardId,
                      deckCount: chargePromptState.deckCount,
                      discardCount: chargePromptState.discardCount,
                      selectedIds: [],
                    });
                    setChargePromptState(null);
                    return;
                  }

                  dispatch({
                    type: "DECLARE_ACTION",
                    playerId: chargePromptState.playerId,
                    kind: "chargeCharacter",
                    sourceCardId: chargePromptState.cardId,
                    payload: {
                      deckCount: chargePromptState.deckCount,
                      discardCardIds: [],
                    },
                  } as GameAction);
                  setChargePromptState(null);
                }}
              >
                확인
              </button>
              <button type="button" style={secondaryButtonStyle} onClick={() => setChargePromptState(null)}>
                취소
              </button>
            </div>
          </div>
        ) : null}

        {chargeDiscardSelectionState ? (
          <div style={noticeStyle}>
            차지할 카드를 n장 골라주세요
            <div style={chargeGridStyle}>
              {state.players[chargeDiscardSelectionState.playerId].discard.map((discardCard) => {
                const selected = chargeDiscardSelectionState.selectedIds.includes(discardCard.instanceId);
                return (
                  <button
                    key={discardCard.instanceId}
                    type="button"
                    style={{
                      ...secondaryButtonStyle,
                      background: selected ? "#4a7cff" : "#24324a",
                    }}
                    onClick={() =>
                      setChargeDiscardSelectionState((prev) => {
                        if (!prev) return prev;
                        const exists = prev.selectedIds.includes(discardCard.instanceId);
                        if (exists) {
                          return {
                            ...prev,
                            selectedIds: prev.selectedIds.filter((id) => id !== discardCard.instanceId),
                          };
                        }
                        if (prev.selectedIds.length >= prev.discardCount) return prev;
                        return {
                          ...prev,
                          selectedIds: [...prev.selectedIds, discardCard.instanceId],
                        };
                      })
                    }
                  >
                    {discardCard.name}
                  </button>
                );
              })}
            </div>
            <div style={toolbarStyle}>
              <button
                type="button"
                style={primaryButtonStyle}
                onClick={() => {
                  if (!chargeDiscardSelectionState) return;
                  if (chargeDiscardSelectionState.selectedIds.length !== chargeDiscardSelectionState.discardCount) return;

                  dispatch({
                    type: "DECLARE_ACTION",
                    playerId: chargeDiscardSelectionState.playerId,
                    kind: "chargeCharacter",
                    sourceCardId: chargeDiscardSelectionState.cardId,
                    payload: {
                      deckCount: chargeDiscardSelectionState.deckCount,
                      discardCardIds: chargeDiscardSelectionState.selectedIds,
                    },
                  } as GameAction);
                  setChargeDiscardSelectionState(null);
                }}
              >
                확인
              </button>
              <button
                type="button"
                style={secondaryButtonStyle}
                onClick={() => setChargeDiscardSelectionState(null)}
              >
                취소
              </button>
            </div>
          </div>
        ) : null}

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
                <div key={`${event.type}-${event.cardId ?? "none"}-${index}`} style={logItemStyle}>
                  {event.type}
                  {"playerId" in event && event.playerId ? ` / ${event.playerId}` : ""}
                  {"cardId" in event && event.cardId ? ` / ${event.cardId}` : ""}
                  {"amount" in event && typeof event.amount === "number" ? ` / ${event.amount}` : ""}
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
  marginTop: 10,
  marginBottom: 10,
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

const hintTextStyle: CSSProperties = {
  alignSelf: "center",
  color: "#b9c3d6",
};

const battleGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 16,
  marginBottom: 16,
};

const battlePanelStyle: CSSProperties = {
  background: "#182233",
  border: "1px solid #2a3850",
  borderRadius: 12,
  padding: 16,
  lineHeight: 1.7,
};

const battlePanelTitleStyle: CSSProperties = {
  fontSize: 18,
  fontWeight: 800,
  marginBottom: 10,
};

const battleHintStyle: CSSProperties = {
  marginTop: 8,
  color: "#dbeafe",
};

const counterRowStyle: CSSProperties = {
  display: "flex",
  gap: 12,
  alignItems: "center",
  marginTop: 8,
  flexWrap: "wrap",
};

const chargeGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
  gap: 10,
  marginTop: 10,
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
