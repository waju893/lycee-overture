// src/game/GameRules.ts
import type {
  CardRef,
  Declaration,
  DeclaredTarget,
  FieldCell,
  FieldSlot,
  GameEvent,
  GameState,
  PlayerID,
  PlayerState,
  RuleViolation,
  TriggeredEffect,
} from "./GameTypes";

export const FIELD_SLOTS: FieldSlot[] = [
  "AF_LEFT","AF_CENTER","AF_RIGHT","DF_LEFT","DF_CENTER","DF_RIGHT",
];

export function getOpponent(playerId: PlayerID): PlayerID {
  return playerId === "P1" ? "P2" : "P1";
}

export function fail(message: string, code = "RULE_VIOLATION", playerId?: PlayerID, cardId?: string): RuleViolation[] {
  return [{ code, message, playerId, cardId }];
}

export function normalizeCardNo(cardNo: string): string {
  return cardNo.replace(/[A-Z]$/i, "");
}

export function getColumn(slot: FieldSlot): "LEFT" | "CENTER" | "RIGHT" {
  if (slot.endsWith("LEFT")) return "LEFT";
  if (slot.endsWith("CENTER")) return "CENTER";
  return "RIGHT";
}

export function isAF(slot: FieldSlot): boolean { return slot.startsWith("AF"); }
export function isDF(slot: FieldSlot): boolean { return slot.startsWith("DF"); }

export function getAdjacentFriendlySlots(slot: FieldSlot): FieldSlot[] {
  const map: Record<FieldSlot, FieldSlot[]> = {
    AF_LEFT: ["AF_CENTER","DF_LEFT"],
    AF_CENTER: ["AF_LEFT","AF_RIGHT","DF_CENTER"],
    AF_RIGHT: ["AF_CENTER","DF_RIGHT"],
    DF_LEFT: ["DF_CENTER","AF_LEFT"],
    DF_CENTER: ["DF_LEFT","DF_RIGHT","AF_CENTER"],
    DF_RIGHT: ["DF_CENTER","AF_RIGHT"],
  };
  return map[slot];
}

export function shuffleArray<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

export function createEmptyField(): Record<FieldSlot, FieldCell> {
  return {
    AF_LEFT: { slot: "AF_LEFT", card: null, attachedItem: null, area: null },
    AF_CENTER: { slot: "AF_CENTER", card: null, attachedItem: null, area: null },
    AF_RIGHT: { slot: "AF_RIGHT", card: null, attachedItem: null, area: null },
    DF_LEFT: { slot: "DF_LEFT", card: null, attachedItem: null, area: null },
    DF_CENTER: { slot: "DF_CENTER", card: null, attachedItem: null, area: null },
    DF_RIGHT: { slot: "DF_RIGHT", card: null, attachedItem: null, area: null },
  };
}

export function createInitialPlayerState(id: PlayerID, deck: CardRef[]): PlayerState {
  return {
    id,
    deck: deck.map((card) => ({ ...card, owner: id, location: "deck", slot: undefined, isTapped: false, revealed: false })),
    hand: [],
    discard: [],
    leaderZone: [],
    limbo: [],
    declaredZone: [],
    field: createEmptyField(),
  };
}

export function createInitialGameState(params: { p1Deck: CardRef[]; p2Deck: CardRef[]; leaderEnabled?: boolean; seed?: number; }): GameState {
  const leaderEnabled = params.leaderEnabled ?? true;
  return {
    players: { P1: createInitialPlayerState("P1", params.p1Deck), P2: createInitialPlayerState("P2", params.p2Deck) },
    turn: { turnNumber: 1, activePlayer: "P1", phase: "startup", priorityPlayer: "P1", passedInRow: 0, firstPlayerDrawFixed: false },
    startup: {
      active: true, firstPlayer: undefined, secondPlayer: undefined, leaderEnabled,
      mulliganUsed: { P1: false, P2: false }, startupFinished: false,
      keepDecided: { P1: false, P2: false }, leaderRevealed: { P1: null, P2: null }, rerollCount: 0,
    },
    battle: {
      isActive: false, attackDeclarationId: undefined, attackerPlayerId: undefined, defenderPlayerId: undefined,
      attackerCardId: undefined, defenderCardId: undefined, supportAttackers: [], supportDefenders: [], battleEndedByBothPass: false,
    },
    declarationStack: [], pendingTriggers: [], resolvingTriggerIds: [], usageCounters: [], logs: [], events: [], replayEvents: [], rulingOverrides: [], winner: null, seed: params.seed, lastResolvedDeclarationId: undefined,
  };
}

export function findCardInZone(cards: CardRef[], cardId: string): CardRef | undefined {
  return cards.find((card) => card.instanceId === cardId);
}

export function findCardController(state: GameState, cardId: string): PlayerID | null {
  for (const playerId of ["P1","P2"] as const) {
    const player = state.players[playerId];
    if (player.hand.some((c) => c.instanceId === cardId)) return playerId;
    if (player.deck.some((c) => c.instanceId === cardId)) return playerId;
    if (player.discard.some((c) => c.instanceId === cardId)) return playerId;
    if (player.declaredZone.some((c) => c.instanceId === cardId)) return playerId;
    if (player.leaderZone.some((c) => c.instanceId === cardId)) return playerId;
    if (player.limbo.some((c) => c.instanceId === cardId)) return playerId;
    for (const slot of FIELD_SLOTS) {
      const cell = player.field[slot];
      if (cell.card?.instanceId === cardId) return playerId;
      if (cell.attachedItem?.instanceId === cardId) return playerId;
      if (cell.area?.instanceId === cardId) return playerId;
    }
  }
  return null;
}

export function getCardCurrentSlot(state: GameState, cardId: string): FieldSlot | null {
  for (const playerId of ["P1","P2"] as const) {
    for (const slot of FIELD_SLOTS) {
      const cell = state.players[playerId].field[slot];
      if (cell.card?.instanceId === cardId) return slot;
      if (cell.attachedItem?.instanceId === cardId) return slot;
      if (cell.area?.instanceId === cardId) return slot;
    }
  }
  return null;
}

function normalizeChargeCardForDiscard(card: CardRef): CardRef {
  return {
    ...card,
    location: "discard",
    slot: undefined,
    isTapped: false,
    revealed: true,
    chargeCards: undefined,
  };
}

export function discardAllChargeCardsFromCharacter(player: PlayerState, character: CardRef | null): number {
  if (!character?.chargeCards || character.chargeCards.length === 0) return 0;

  const removedCharges = character.chargeCards.map(normalizeChargeCardForDiscard);
  player.discard.push(...removedCharges);
  character.chargeCards = [];
  return removedCharges.length;
}

export function removeChargeCardsFromCharacter(
  state: GameState,
  playerId: PlayerID,
  characterCardId: string,
  chargeCardIds: string[],
): CardRef[] {
  const slot = getCardCurrentSlot(state, characterCardId);
  if (!slot) return [];

  const character = state.players[playerId].field[slot].card;
  if (!character?.chargeCards || character.chargeCards.length === 0) return [];

  const removeSet = new Set(chargeCardIds);
  const kept: CardRef[] = [];
  const removed: CardRef[] = [];

  for (const chargeCard of character.chargeCards) {
    if (removeSet.has(chargeCard.instanceId)) {
      removed.push(normalizeChargeCardForDiscard(chargeCard));
    } else {
      kept.push(chargeCard);
    }
  }

  character.chargeCards = kept;
  if (removed.length > 0) {
    state.players[playerId].discard.push(...removed);
    state.logs.push(`[CHARGE] ${playerId}의 ${character.name}에서 차지 ${removed.length}장 파기`);
  }

  return removed;
}

export function removeCardFromAllZones(player: PlayerState, cardId: string): CardRef | null {
  const zoneLists: Array<keyof Pick<PlayerState, "deck" | "hand" | "discard" | "leaderZone" | "limbo" | "declaredZone">> =
    ["deck","hand","discard","leaderZone","limbo","declaredZone"];

  for (const zoneName of zoneLists) {
    const idx = player[zoneName].findIndex((card) => card.instanceId === cardId);
    if (idx >= 0) {
      const [card] = player[zoneName].splice(idx, 1);
      return card;
    }
  }

  for (const slot of FIELD_SLOTS) {
    const cell = player.field[slot];

    if (cell.card?.instanceId === cardId) {
      const card = cell.card;
      discardAllChargeCardsFromCharacter(player, card);
      cell.card = null;
      return card;
    }
    if (cell.attachedItem?.instanceId === cardId) {
      const card = cell.attachedItem;
      cell.attachedItem = null;
      return card;
    }
    if (cell.area?.instanceId === cardId) {
      const card = cell.area;
      cell.area = null;
      return card;
    }
  }

  return null;
}

export function moveCardToHand(state: GameState, playerId: PlayerID, card: CardRef): void {
  card.location = "hand";
  card.slot = undefined;
  state.players[playerId].hand.push(card);
}

export function moveCardToDiscard(state: GameState, playerId: PlayerID, card: CardRef): void {
  card.location = "discard";
  card.slot = undefined;
  card.isTapped = false;
  state.players[playerId].discard.push(card);
}

export function placeCharacterOnField(state: GameState, playerId: PlayerID, slot: FieldSlot, card: CardRef): void {
  card.location = "field";
  card.slot = slot;
  card.isTapped = false;
  card.revealed = true;
  state.players[playerId].field[slot].card = card;
}

export function placeAreaOnField(state: GameState, playerId: PlayerID, slot: FieldSlot, card: CardRef): void {
  card.location = "field";
  card.slot = slot;
  card.isTapped = false;
  card.revealed = true;
  state.players[playerId].field[slot].area = card;
}

export function attachItemToField(state: GameState, playerId: PlayerID, slot: FieldSlot, card: CardRef): void {
  card.location = "field";
  card.slot = slot;
  card.isTapped = false;
  card.revealed = true;
  state.players[playerId].field[slot].attachedItem = card;
}

export function canBuildDeck(cards: CardRef[]): RuleViolation[] {
  const violations: RuleViolation[] = [];
  if (cards.length !== 60) {
    violations.push({ code: "DECK_SIZE_INVALID", message: `덱 장수는 정확히 60장이어야 합니다. 현재 ${cards.length}장입니다.` });
  }
  const counts = new Map<string, number>();
  for (const card of cards) counts.set(normalizeCardNo(card.cardNo), (counts.get(normalizeCardNo(card.cardNo)) ?? 0) + 1);
  for (const [cardNo, count] of counts.entries()) {
    if (count > 4) violations.push({ code: "DECK_DUPLICATE_INVALID", message: `${cardNo}는 같은 번호 카드 4장 제한을 초과했습니다. 현재 ${count}장입니다.` });
  }
  return violations;
}

export function rollFirstPlayer(forcedFirstPlayer?: PlayerID): { firstPlayer: PlayerID; secondPlayer: PlayerID; rerollCount: number; p1Roll: number; p2Roll: number; } {
  if (forcedFirstPlayer) return { firstPlayer: forcedFirstPlayer, secondPlayer: getOpponent(forcedFirstPlayer), rerollCount: 0, p1Roll: forcedFirstPlayer === "P1" ? 20 : 1, p2Roll: forcedFirstPlayer === "P2" ? 20 : 1 };
  let rerollCount = 0;
  for (;;) {
    const p1Roll = Math.floor(Math.random() * 20) + 1;
    const p2Roll = Math.floor(Math.random() * 20) + 1;
    if (p1Roll > p2Roll) return { firstPlayer: "P1", secondPlayer: "P2", rerollCount, p1Roll, p2Roll };
    if (p2Roll > p1Roll) return { firstPlayer: "P2", secondPlayer: "P1", rerollCount, p1Roll, p2Roll };
    rerollCount += 1;
    if (rerollCount > 100) return { firstPlayer: "P1", secondPlayer: "P2", rerollCount, p1Roll, p2Roll };
  }
}

export function extractLeaderToHand(state: GameState, playerId: PlayerID): CardRef | null {
  if (!state.startup.leaderEnabled) return null;
  const player = state.players[playerId];
  const leaderIndex = player.deck.findIndex((card) => card.isLeader);
  if (leaderIndex < 0) return null;
  const [leader] = player.deck.splice(leaderIndex, 1);
  leader.location = "hand";
  leader.revealed = true;
  leader.slot = undefined;
  player.hand.push(leader);
  state.startup.leaderRevealed[playerId] = leader.instanceId;
  state.logs.push(`[STARTUP] ${playerId} 리더 공개: ${leader.name}`);
  return leader;
}

export function drawCards(state: GameState, playerId: PlayerID, amount: number, reason: "startup" | "warmup" | "draw"): number {
  const player = state.players[playerId];
  let drawn = 0;
  for (let i = 0; i < Math.max(0, amount); i += 1) {
    const card = player.deck.shift();
    if (!card) break;
    card.location = "hand";
    card.slot = undefined;
    card.revealed = false;
    player.hand.push(card);
    drawn += 1;
  }
  if (drawn > 0) {
    state.logs.push(`[DRAW] ${playerId} ${reason}로 ${drawn}장 드로우`);
    pushEvent(state, { type: "DRAW", playerId, amount: drawn, payload: { reason } });
  }
  if (player.deck.length === 0 && !state.winner) {
    pushEvent(state, { type: "DECK_BECAME_ZERO", playerId, payload: { reason } });
  }
  return drawn;
}

export function performStartupDraw(state: GameState): void {
  for (const playerId of ["P1","P2"] as const) {
    const amount = state.startup.leaderRevealed[playerId] ? 6 : 7;
    drawCards(state, playerId, amount, "startup");
  }
}

export function performMulligan(state: GameState, playerId: PlayerID): RuleViolation[] {
  const violations: RuleViolation[] = [];
  const player = state.players[playerId];
  if (!state.startup.active) return fail("멀리건은 스타트업 단계에서만 가능합니다.", "TIMING_INVALID");
  if (state.startup.mulliganUsed[playerId]) return fail("멀리건은 1회만 가능합니다.", "MULLIGAN_ALREADY_USED");
  const keptLeaders = player.hand.filter((card) => card.isLeader);
  const mulliganTargets = player.hand.filter((card) => !card.isLeader);
  const redrawCount = mulliganTargets.length;
  player.hand = [...keptLeaders];
  for (const card of mulliganTargets) {
    card.location = "deck";
    card.slot = undefined;
    card.revealed = false;
    player.deck.push(card);
  }
  shuffleArray(player.deck);
  drawCards(state, playerId, redrawCount, "startup");
  state.startup.mulliganUsed[playerId] = true;
  state.startup.keepDecided[playerId] = true;
  state.logs.push(`[STARTUP] ${playerId} 멀리건 실행 (${redrawCount}장)`);
  return violations;
}

export function validateKeepOrMulligan(state: GameState, playerId: PlayerID): RuleViolation[] {
  const violations: RuleViolation[] = [];
  if (!state.startup.active) violations.push(fail("스타트업이 끝난 뒤에는 선택할 수 없습니다.", "STARTUP_FINISHED")[0]);
  if (state.startup.keepDecided[playerId]) violations.push(fail("이미 시작 패 결정을 마쳤습니다.", "ALREADY_DECIDED")[0]);
  return violations;
}

export function canFinalizeStartup(state: GameState): boolean {
  return state.startup.keepDecided.P1 && state.startup.keepDecided.P2;
}

export function finalizeStartupState(state: GameState): void {
  state.startup.active = false;
  state.startup.startupFinished = true;
  for (const playerId of ["P1","P2"] as const) {
    const leaderCardId = state.startup.leaderRevealed[playerId];
    if (!leaderCardId) continue;
    const leader = state.players[playerId].hand.find((card) => card.instanceId === leaderCardId);
    if (leader) leader.revealed = false;
  }
  const firstPlayer = state.startup.firstPlayer ?? "P1";
  state.turn.turnNumber = 1;
  state.turn.activePlayer = firstPlayer;
  state.turn.priorityPlayer = firstPlayer;
  state.turn.phase = "wakeup";
  state.turn.passedInRow = 0;
  state.logs.push(`[STARTUP] 스타트업 종료. 선공: ${firstPlayer}`);
}

export function getWarmupDrawCount(state: GameState): number {
  return state.turn.turnNumber === 1 && state.turn.activePlayer === state.startup.firstPlayer && !state.turn.firstPlayerDrawFixed ? 1 : 2;
}

export function findAttackableCharacters(state: GameState, playerId: PlayerID): string[] {
  const result: string[] = [];
  for (const slot of FIELD_SLOTS) {
    const card = state.players[playerId].field[slot].card;
    if (card && isAF(slot) && !card.isTapped && card.canAttack !== false) result.push(card.instanceId);
  }
  return result;
}

export function findEligibleDefenders(state: GameState, defenderPlayerId: PlayerID, attackerCardId: string): string[] {
  const attackerSlot = getCardCurrentSlot(state, attackerCardId);
  if (!attackerSlot) return [];
  const column = getColumn(attackerSlot);
  const result: string[] = [];
  for (const slot of FIELD_SLOTS) {
    const card = state.players[defenderPlayerId].field[slot].card;
    if (card && isDF(slot) && getColumn(slot) === column && !card.isTapped && card.canBlock !== false) result.push(card.instanceId);
  }
  return result;
}

export function validateCharacterEntry(state: GameState, playerId: PlayerID, card: CardRef, slot: FieldSlot): RuleViolation[] {
  const violations: RuleViolation[] = [];
  const player = state.players[playerId];
  if (state.turn.activePlayer !== playerId || state.turn.phase !== "main") violations.push(fail("캐릭터 등장은 자기 메인페이즈에만 가능합니다.", "TIMING_INVALID")[0]);
  if (card.cardType !== "character") violations.push(fail("캐릭터 카드만 등장 선언할 수 있습니다.", "CARD_TYPE_INVALID")[0]);
  if (player.field[slot].card !== null) violations.push(fail("빈 필드에만 등장할 수 있습니다.", "FIELD_OCCUPIED")[0]);
  const sameNameExists = FIELD_SLOTS.some((fieldSlot) => {
    const fieldCard = player.field[fieldSlot].card;
    return fieldCard?.sameNameKey && card.sameNameKey && fieldCard.sameNameKey === card.sameNameKey;
  });
  if (sameNameExists) violations.push(fail("자기 장에 같은 이름 캐릭터가 이미 등장해 있습니다.", "SAME_NAME_ON_FIELD")[0]);
  if (!player.hand.some((c) => c.instanceId === card.instanceId)) violations.push(fail("손패에 있는 카드만 등장 선언할 수 있습니다.", "CARD_NOT_IN_HAND")[0]);
  return violations;
}

export function validateItemEquip(state: GameState, playerId: PlayerID, card: CardRef, slot: FieldSlot): RuleViolation[] {
  const violations: RuleViolation[] = [];
  const field = state.players[playerId].field[slot];
  if (state.turn.activePlayer !== playerId || state.turn.phase !== "main") violations.push(fail("아이템 장비는 자기 메인페이즈에만 가능합니다.", "TIMING_INVALID")[0]);
  if (card.cardType !== "item") violations.push(fail("아이템 카드만 장비 선언할 수 있습니다.", "CARD_TYPE_INVALID")[0]);
  if (!field.card) violations.push(fail("캐릭터가 있는 필드에만 아이템을 장비할 수 있습니다.", "NO_CHARACTER")[0]);
  if (field.attachedItem) violations.push(fail("아이템은 캐릭터 1장당 1장만 장비할 수 있습니다.", "ITEM_LIMIT")[0]);
  if (!state.players[playerId].hand.some((c) => c.instanceId === card.instanceId)) violations.push(fail("손패에 있는 카드만 장비 선언할 수 있습니다.", "CARD_NOT_IN_HAND")[0]);
  return violations;
}

export function validateAreaPlace(
  state: GameState,
  playerId: PlayerID,
  card: CardRef,
  slot: FieldSlot,
  sourceZone: "hand" | "deck" | "discard" = "hand",
): RuleViolation[] {
  const violations: RuleViolation[] = [];
  const field = state.players[playerId].field[slot];

  if (state.turn.activePlayer !== playerId || state.turn.phase !== "main") {
    violations.push(fail("에리어 배치는 자기 메인페이즈에만 가능합니다.", "TIMING_INVALID")[0]);
  }

  if (card.cardType !== "area") {
    violations.push(fail("에리어 카드만 배치 선언할 수 있습니다.", "CARD_TYPE_INVALID")[0]);
  }

  if (field.area) {
    violations.push(fail("해당 필드에는 이미 에리어가 있습니다.", "AREA_LIMIT")[0]);
  }

  const sourceCards =
    sourceZone === "deck"
      ? state.players[playerId].deck
      : sourceZone === "discard"
        ? state.players[playerId].discard
        : state.players[playerId].hand;

  if (!sourceCards.some((c) => c.instanceId === card.instanceId)) {
    violations.push(
      fail(
        sourceZone === "deck"
          ? "덱에 있는 카드만 배치 선언할 수 있습니다."
          : sourceZone === "discard"
            ? "쓰레기통에 있는 카드만 배치 선언할 수 있습니다."
            : "손패에 있는 카드만 배치 선언할 수 있습니다.",
        sourceZone === "deck"
          ? "CARD_NOT_IN_DECK"
          : sourceZone === "discard"
            ? "CARD_NOT_IN_DISCARD"
            : "CARD_NOT_IN_HAND",
      )[0],
    );
  }

  return violations;
}

export function validateAttackDeclaration(state: GameState, playerId: PlayerID, attackerCardId: string): RuleViolation[] {
  const violations: RuleViolation[] = [];
  if (state.turn.activePlayer !== playerId || state.turn.phase !== "main") violations.push(fail("공격 선언은 자기 메인페이즈에만 가능합니다.", "TIMING_INVALID")[0]);
  const slot = getCardCurrentSlot(state, attackerCardId);
  if (!slot) return fail("공격 캐릭터를 장에서 찾을 수 없습니다.", "CARD_NOT_FOUND");
  if (!isAF(slot)) violations.push(fail("공격은 AF 캐릭터만 할 수 있습니다.", "ATTACKER_NOT_AF")[0]);
  if (findCardController(state, attackerCardId) !== playerId) violations.push(fail("자신의 캐릭터로만 공격 선언할 수 있습니다.", "NOT_OWN_CARD")[0]);
  const card = state.players[playerId].field[slot].card;
  if (!card) return fail("공격 캐릭터를 장에서 찾을 수 없습니다.", "CARD_NOT_FOUND");
  if (card.isTapped) violations.push(fail("행동 완료 상태의 캐릭터는 공격할 수 없습니다.", "ATTACKER_TAPPED")[0]);
  if (card.canAttack === false) violations.push(fail("이 캐릭터는 현재 공격할 수 없습니다.", "ATTACK_FORBIDDEN")[0]);
  return violations;
}

export function validateAbilityUse(
  state: GameState,
  playerId: PlayerID,
  sourceCardId: string,
): RuleViolation[] {
  const violations: RuleViolation[] = [];

  if (state.turn.activePlayer !== playerId || state.turn.phase !== "main") {
    violations.push(fail("능력 사용은 자기 메인페이즈에만 가능합니다.", "TIMING_INVALID")[0]);
  }

  const slot = getCardCurrentSlot(state, sourceCardId);
  if (!slot) {
    violations.push(fail("능력 사용 원본 캐릭터를 장에서 찾을 수 없습니다.", "CARD_NOT_FOUND")[0]);
    return violations;
  }

  if (findCardController(state, sourceCardId) !== playerId) {
    violations.push(fail("자신의 캐릭터 능력만 사용할 수 있습니다.", "NOT_OWN_CARD")[0]);
  }

  const card = state.players[playerId].field[slot].card;
  if (!card) {
    violations.push(fail("능력 사용 원본 캐릭터를 장에서 찾을 수 없습니다.", "CARD_NOT_FOUND")[0]);
    return violations;
  }

  if (card.cardType !== "character") {
    violations.push(fail("현재는 캐릭터 능력만 사용할 수 있습니다.", "CARD_TYPE_INVALID")[0]);
  }

  return violations;
}

export function validateTapUntapCharacter(
  state: GameState,
  playerId: PlayerID,
  sourceCardId: string,
): RuleViolation[] {
  const violations: RuleViolation[] = [];
  const slot = getCardCurrentSlot(state, sourceCardId);
  if (!slot) {
    violations.push(fail("대상 캐릭터를 장에서 찾을 수 없습니다.", "CARD_NOT_FOUND")[0]);
    return violations;
  }
  const owner = findCardController(state, sourceCardId);
  if (owner !== playerId) {
    violations.push(fail("자신의 캐릭터만 선택할 수 있습니다.", "NOT_OWN_CARD")[0]);
  }
  return violations;
}

export function validateMoveCharacter(
  state: GameState,
  playerId: PlayerID,
  sourceCardId: string,
  toSlot: FieldSlot,
): RuleViolation[] {
  const violations: RuleViolation[] = [];
  const fromSlot = getCardCurrentSlot(state, sourceCardId);

  if (state.turn.activePlayer !== playerId || state.turn.phase !== "main") {
    violations.push(fail("이동은 자기 메인페이즈에만 가능합니다.", "TIMING_INVALID")[0]);
  }

  if (!fromSlot) {
    violations.push(fail("이동할 캐릭터를 장에서 찾을 수 없습니다.", "CARD_NOT_FOUND")[0]);
    return violations;
  }

  const owner = findCardController(state, sourceCardId);
  if (owner !== playerId) {
    violations.push(fail("자신의 캐릭터만 이동할 수 있습니다.", "NOT_OWN_CARD")[0]);
  }

  if (state.players[playerId].field[toSlot].card) {
    violations.push(fail("이미 캐릭터가 있는 필드로는 이동할 수 없습니다.", "FIELD_OCCUPIED")[0]);
  }

  return violations;
}

export function validateChargeCharacter(
  state: GameState,
  playerId: PlayerID,
  sourceCardId: string,
  deckCount: number,
  discardCardIds: string[],
): RuleViolation[] {
  const violations: RuleViolation[] = validateTapUntapCharacter(state, playerId, sourceCardId);
  if (violations.length > 0) return violations;

  const safeDeckCount = Math.max(0, Math.trunc(deckCount));
  if (safeDeckCount > state.players[playerId].deck.length) {
    violations.push(fail("덱에서 가져올 차지 수가 현재 덱 장수를 초과합니다.", "DECK_SHORTAGE")[0]);
  }

  for (const discardCardId of discardCardIds) {
    if (!state.players[playerId].discard.some((card) => card.instanceId === discardCardId)) {
      violations.push(fail("선택한 쓰레기통 카드를 찾을 수 없습니다.", "CARD_NOT_IN_DISCARD")[0]);
      break;
    }
  }

  return violations;
}

export function validateDefenderSelection(
  state: GameState,
  playerId: PlayerID,
  defenderCardId: string,
): RuleViolation[] {
  const violations: RuleViolation[] = [];
  if (!state.battle.isActive || !state.battle.attackerCardId) return fail("현재 배틀 중이 아닙니다.", "NO_BATTLE");
  const attackerSlot = getCardCurrentSlot(state, state.battle.attackerCardId);
  const defenderSlot = getCardCurrentSlot(state, defenderCardId);
  if (!attackerSlot || !defenderSlot) return fail("공격자 또는 방어자를 찾을 수 없습니다.", "CARD_NOT_FOUND");
  if (!isDF(defenderSlot)) violations.push(fail("방어 캐릭터는 DF 캐릭터여야 합니다.", "DEFENDER_NOT_DF")[0]);
  if (getColumn(attackerSlot) !== getColumn(defenderSlot)) violations.push(fail("방어 캐릭터는 같은 열이어야 합니다.", "NOT_SAME_COLUMN")[0]);
  if (findCardController(state, defenderCardId) !== playerId) violations.push(fail("자신의 캐릭터만 방어 캐릭터로 지정할 수 있습니다.", "NOT_OWN_CARD")[0]);
  const defender = state.players[playerId].field[defenderSlot].card;
  if (!defender) return fail("방어 캐릭터를 장에서 찾을 수 없습니다.", "CARD_NOT_FOUND");
  if (defender.isTapped) violations.push(fail("행동 완료 상태의 캐릭터는 방어할 수 없습니다.", "DEFENDER_TAPPED")[0]);
  if (defender.canBlock === false) violations.push(fail("이 캐릭터는 현재 방어할 수 없습니다.", "BLOCK_FORBIDDEN")[0]);
  return violations;
}

export function validateStepLikeMove(state: GameState, playerId: PlayerID, sourceCardId: string, toSlot: FieldSlot, allowedDestinations: FieldSlot[]): RuleViolation[] {
  const violations: RuleViolation[] = [];
  const sourceSlot = getCardCurrentSlot(state, sourceCardId);
  if (state.turn.activePlayer !== playerId || state.turn.phase !== "main") violations.push(fail("이동 기본능력은 자기 메인페이즈에만 사용 가능합니다.", "TIMING_INVALID")[0]);
  if (state.battle.isActive) violations.push(fail("배틀 중에는 이동 기본능력을 사용할 수 없습니다.", "BATTLE_FORBIDDEN")[0]);
  if (!sourceSlot) return fail("이동할 캐릭터가 장에 없습니다.", "CARD_NOT_FOUND");
  if (!allowedDestinations.includes(toSlot)) violations.push(fail("해당 기본능력으로 이동할 수 없는 위치입니다.", "DESTINATION_INVALID")[0]);
  if (state.players[playerId].field[toSlot].card !== null) violations.push(fail("빈 아군 필드로만 이동할 수 있습니다.", "FIELD_OCCUPIED")[0]);
  const card = state.players[playerId].field[sourceSlot].card;
  if (card?.isTapped) violations.push(fail("행동 완료 상태의 캐릭터는 이동할 수 없습니다.", "SOURCE_TAPPED")[0]);
  return violations;
}

export function pushEvent(state: GameState, event: GameEvent): void {
  state.events.push(event);
  if (event.type === "DECK_BECAME_ZERO" && event.playerId) state.winner = getOpponent(event.playerId);
  if (event.type === "CONCEDE" && event.playerId) state.winner = getOpponent(event.playerId);
}

export function enqueueTrigger(state: GameState, trigger: TriggeredEffect): void {
  state.pendingTriggers.push(trigger);
}

export function applyStateBasedRules(state: GameState): void {
  for (const playerId of ["P1","P2"] as const) {
    const player = state.players[playerId];
    for (const slot of FIELD_SLOTS) {
      const cell = player.field[slot];
      if (!cell.card && cell.attachedItem) {
        player.discard.push({ ...cell.attachedItem, location: "discard", slot: undefined, isTapped: false });
        cell.attachedItem = null;
        state.logs.push(`[SBA] ${playerId}의 ${slot}에서 장착 대상이 사라져 아이템을 파기했습니다.`);
      }
    }
    if (player.deck.length === 0 && !state.winner) {
      pushEvent(state, { type: "DECK_BECAME_ZERO", playerId });
      state.logs.push(`[WIN] ${playerId}의 덱이 0장이 되어 ${getOpponent(playerId)} 승리`);
    }
  }
}

export function chooseNextTriggerController(state: GameState): PlayerID {
  return state.turn.activePlayer;
}

export function canResolvePendingTriggers(state: GameState): boolean {
  return state.declarationStack.every((d) => d.resolved) && state.pendingTriggers.length > 0;
}

export function createDeclaration(params: {
  id: string;
  playerId: PlayerID;
  kind: Declaration["kind"];
  sourceCardId?: string;
  sourceEffectId?: string;
  targetingMode?: Declaration["targetingMode"];
  declaredTargets?: Declaration["declaredTargets"];
  payload?: Declaration["payload"];
  responseToDeclarationId?: string;
}): Declaration {
  return {
    id: params.id,
    playerId: params.playerId,
    kind: params.kind,
    sourceCardId: params.sourceCardId,
    sourceEffectId: params.sourceEffectId,
    targetingMode: params.targetingMode ?? "none",
    declaredTargets: params.declaredTargets ?? [],
    payload: params.payload,
    paid: false,
    committed: false,
    resolved: false,
    responseToDeclarationId: params.responseToDeclarationId,
  };
}

export function createDeclaredTargets(params: { targetCardIds?: string[]; targetSlots?: FieldSlot[]; targetPlayerId?: PlayerID; }): DeclaredTarget[] {
  const targets: DeclaredTarget[] = [];
  if (params.targetCardIds) for (const cardId of params.targetCardIds) targets.push({ kind: "card", cardId });
  if (params.targetSlots) for (const slot of params.targetSlots) targets.push({ kind: "field", slot });
  if (params.targetPlayerId) targets.push({ kind: "player", playerId: params.targetPlayerId });
  if (targets.length === 0) targets.push({ kind: "none" });
  return targets;
}

export function resolveDeclarationCore(state: GameState, declaration: Declaration): void {
  if (declaration.kind === "useCharacter") {
    const slot = declaration.declaredTargets.find((t) => t.kind === "field")?.slot;
    if (!slot || !declaration.sourceCardId) { state.logs.push(`[RESOLVE] useCharacter 해결 실패: 대상 슬롯 없음`); declaration.resolved = true; return; }
    const player = state.players[declaration.playerId];
    const card = removeCardFromAllZones(player, declaration.sourceCardId);
    if (!card) { state.logs.push(`[RESOLVE] useCharacter 해결 실패: 카드 없음`); declaration.resolved = true; return; }
    placeCharacterOnField(state, declaration.playerId, slot, card);
    declaration.resolved = true;
    state.logs.push(`[RESOLVE] ${declaration.playerId} 캐릭터 등장 해결: ${card.name} -> ${slot}`);
    pushEvent(state, { type: "CHARACTER_ENTERED_FIELD", playerId: declaration.playerId, cardId: card.instanceId, slot });
    return;
  }

  if (declaration.kind === "useArea") {
    const slot = declaration.declaredTargets.find((t) => t.kind === "field")?.slot;
    if (!slot || !declaration.sourceCardId) { state.logs.push(`[RESOLVE] useArea 해결 실패: 대상 슬롯 없음`); declaration.resolved = true; return; }

    const player = state.players[declaration.playerId];
    const sourceZone = declaration.payload?.sourceZone;
    let card: CardRef | null = null;

    if (sourceZone === "deck") {
      const index = player.deck.findIndex((c) => c.instanceId === declaration.sourceCardId);
      if (index >= 0) {
        const [removed] = player.deck.splice(index, 1);
        card = removed ?? null;
      }
    } else if (sourceZone === "discard") {
      const index = player.discard.findIndex((c) => c.instanceId === declaration.sourceCardId);
      if (index >= 0) {
        const [removed] = player.discard.splice(index, 1);
        card = removed ?? null;
      }
    } else {
      card = removeCardFromAllZones(player, declaration.sourceCardId);
    }

    if (!card) { state.logs.push(`[RESOLVE] useArea 해결 실패: 카드 없음`); declaration.resolved = true; return; }

    placeAreaOnField(state, declaration.playerId, slot, card);
    declaration.resolved = true;
    state.logs.push(`[RESOLVE] ${declaration.playerId} 에리어 배치 해결: ${card.name} -> ${slot}`);
    pushEvent(state, { type: "AREA_PLACED", playerId: declaration.playerId, cardId: card.instanceId, slot });
    return;
  }

  if (declaration.kind === "useItem") {
    const slot = declaration.declaredTargets.find((t) => t.kind === "field")?.slot;
    if (!slot || !declaration.sourceCardId) { state.logs.push(`[RESOLVE] useItem 해결 실패: 대상 슬롯 없음`); declaration.resolved = true; return; }
    const player = state.players[declaration.playerId];
    const card = removeCardFromAllZones(player, declaration.sourceCardId);
    if (!card) { state.logs.push(`[RESOLVE] useItem 해결 실패: 카드 없음`); declaration.resolved = true; return; }
    attachItemToField(state, declaration.playerId, slot, card);
    declaration.resolved = true;
    state.logs.push(`[RESOLVE] ${declaration.playerId} 아이템 장비 해결: ${card.name} -> ${slot}`);
    pushEvent(state, { type: "ITEM_EQUIPPED", playerId: declaration.playerId, cardId: card.instanceId, slot });
    return;
  }

  if (declaration.kind === "tapCharacter") {
    if (!declaration.sourceCardId) {
      declaration.resolved = true;
      return;
    }
    const slot = getCardCurrentSlot(state, declaration.sourceCardId);
    const card = slot ? state.players[declaration.playerId].field[slot].card : null;
    if (card) {
      card.isTapped = true;
      state.logs.push(`[RESOLVE] ${declaration.playerId} 행동 완료: ${card.name}`);
      pushEvent(state, {
        type: "CHARACTER_TAPPED",
        playerId: declaration.playerId,
        cardId: card.instanceId,
        slot: slot ?? undefined,
      });
    }
    declaration.resolved = true;
    return;
  }

  if (declaration.kind === "untapCharacter") {
    if (!declaration.sourceCardId) {
      declaration.resolved = true;
      return;
    }
    const slot = getCardCurrentSlot(state, declaration.sourceCardId);
    const card = slot ? state.players[declaration.playerId].field[slot].card : null;
    if (card) {
      card.isTapped = false;
      state.logs.push(`[RESOLVE] ${declaration.playerId} 미행동: ${card.name}`);
      pushEvent(state, {
        type: "CHARACTER_UNTAPPED",
        playerId: declaration.playerId,
        cardId: card.instanceId,
        slot: slot ?? undefined,
      });
    }
    declaration.resolved = true;
    return;
  }

  if (declaration.kind === "moveCharacter") {
    const toSlot = declaration.declaredTargets.find((t) => t.kind === "field")?.slot;
    if (!declaration.sourceCardId || !toSlot) {
      declaration.resolved = true;
      return;
    }
    const fromSlot = getCardCurrentSlot(state, declaration.sourceCardId);
    if (!fromSlot) {
      declaration.resolved = true;
      return;
    }
    const card = state.players[declaration.playerId].field[fromSlot].card;
    if (!card) {
      declaration.resolved = true;
      return;
    }
    state.players[declaration.playerId].field[fromSlot].card = null;
    placeCharacterOnField(state, declaration.playerId, toSlot, card);
    state.logs.push(`[RESOLVE] ${declaration.playerId} 이동 해결: ${card.name} ${fromSlot} -> ${toSlot}`);
    pushEvent(state, {
      type: "CHARACTER_MOVED",
      playerId: declaration.playerId,
      cardId: card.instanceId,
      slot: toSlot,
      payload: { fromSlot },
    });
    declaration.resolved = true;
    return;
  }

  if (declaration.kind === "chargeCharacter") {
    if (!declaration.sourceCardId) {
      declaration.resolved = true;
      return;
    }
    const slot = getCardCurrentSlot(state, declaration.sourceCardId);
    const card = slot ? state.players[declaration.playerId].field[slot].card : null;
    if (!card) {
      declaration.resolved = true;
      return;
    }

    const deckCount = Math.max(0, Math.trunc(Number(declaration.payload?.deckCount ?? 0)));
    const discardCardIds = Array.isArray(declaration.payload?.discardCardIds)
      ? declaration.payload!.discardCardIds.filter((value): value is string => typeof value === "string")
      : [];

    const charged: CardRef[] = [];

    for (let i = 0; i < deckCount; i += 1) {
      const top = state.players[declaration.playerId].deck.shift();
      if (!top) break;
      top.location = "charge";
      top.revealed = true;
      top.slot = undefined;
      top.isTapped = false;
      charged.push(top);
    }

    for (const discardCardId of discardCardIds) {
      const index = state.players[declaration.playerId].discard.findIndex((item) => item.instanceId === discardCardId);
      if (index < 0) continue;
      const [picked] = state.players[declaration.playerId].discard.splice(index, 1);
      if (!picked) continue;
      picked.location = "charge";
      picked.revealed = true;
      picked.slot = undefined;
      picked.isTapped = false;
      charged.push(picked);
    }

    card.chargeCards = [...(card.chargeCards ?? []), ...charged];
    state.logs.push(`[RESOLVE] ${declaration.playerId} 차지 해결: ${card.name} / ${charged.length}장`);
    pushEvent(state, {
      type: "CHARACTER_CHARGED",
      playerId: declaration.playerId,
      cardId: card.instanceId,
      amount: charged.length,
      slot: slot ?? undefined,
    });
    declaration.resolved = true;
    return;
  }

  if (declaration.kind === "useAbility") {
    if (!declaration.sourceCardId) {
      declaration.resolved = true;
      return;
    }

    const slot = getCardCurrentSlot(state, declaration.sourceCardId);
    const card = slot ? state.players[declaration.playerId].field[slot].card : null;
    declaration.resolved = true;

    if (!card) {
      state.logs.push(`[RESOLVE] useAbility 해결 실패: 카드 없음`);
      return;
    }

    state.logs.push(`[RESOLVE] ${declaration.playerId} 능력 사용 해결: ${card.name}`);
    pushEvent(state, {
      type: "ABILITY_USED",
      playerId: declaration.playerId,
      cardId: card.instanceId,
      slot: slot ?? undefined,
      payload: {
        sourceEffectId: declaration.sourceEffectId,
        declaredTargets: declaration.declaredTargets,
      },
    });
    return;
  }

  if (declaration.kind === "attack") {
    if (!declaration.sourceCardId) { declaration.resolved = true; return; }
    state.battle.isActive = true;
    state.battle.attackDeclarationId = declaration.id;
    state.battle.attackerPlayerId = declaration.playerId;
    state.battle.defenderPlayerId = getOpponent(declaration.playerId);
    state.battle.attackerCardId = declaration.sourceCardId;
    state.battle.defenderCardId = undefined;
    state.battle.supportAttackers = [];
    state.battle.supportDefenders = [];
    state.battle.battleEndedByBothPass = false;
    declaration.resolved = true;
    state.logs.push(`[RESOLVE] ${declaration.playerId} 공격 선언 해결: ${declaration.sourceCardId}`);
    pushEvent(state, { type: "ATTACK_DECLARATION_RESOLVED", playerId: declaration.playerId, cardId: declaration.sourceCardId });
    return;
  }

  declaration.resolved = true;
  state.logs.push(`[RESOLVE] 미구현 선언 자동 해결: ${declaration.kind}`);
}

export function clearBattleState(state: GameState): void {
  state.battle.isActive = false;
  state.battle.attackDeclarationId = undefined;
  state.battle.attackerPlayerId = undefined;
  state.battle.defenderPlayerId = undefined;
  state.battle.attackerCardId = undefined;
  state.battle.defenderCardId = undefined;
  state.battle.supportAttackers = [];
  state.battle.supportDefenders = [];
  state.battle.battleEndedByBothPass = false;
}

function getCardAp(card: CardRef): number { return card.ap ?? card.power ?? 0; }
function getCardDp(card: CardRef): number { return card.dp ?? card.hp ?? card.power ?? 0; }
function getCardDmg(card: CardRef): number { return card.dmg ?? card.damage ?? 0; }

function millTopDeck(state: GameState, playerId: PlayerID, amount: number): number {
  let milled = 0;
  for (let i = 0; i < amount; i += 1) {
    const card = state.players[playerId].deck.shift();
    if (!card) break;
    moveCardToDiscard(state, playerId, card);
    milled += 1;
    pushEvent(state, { type: "CARD_MILLED", playerId, cardId: card.instanceId, amount: 1 });
  }
  return milled;
}

export function resolveBattleCore(state: GameState): void {
  if (!state.battle.isActive) return;
  const attackerPlayerId = state.battle.attackerPlayerId;
  const defenderPlayerId = state.battle.defenderPlayerId;
  const attackerCardId = state.battle.attackerCardId;
  const defenderCardId = state.battle.defenderCardId ?? null;
  if (!attackerPlayerId || !defenderPlayerId || !attackerCardId) { clearBattleState(state); return; }

  const attackerSlot = getCardCurrentSlot(state, attackerCardId);
  if (!attackerSlot) { clearBattleState(state); return; }
  const attacker = state.players[attackerPlayerId].field[attackerSlot].card;
  if (!attacker) { clearBattleState(state); return; }
  attacker.isTapped = true;

  if (!defenderCardId) {
    const dmg = getCardDmg(attacker);
    const milled = millTopDeck(state, defenderPlayerId, dmg);
    state.logs.push(`[BATTLE] ${attackerPlayerId}의 ${attacker.name} 직접 공격, ${defenderPlayerId} 덱 ${milled}장 파기`);
    pushEvent(state, { type: "DIRECT_ATTACK_RESOLVED", playerId: attackerPlayerId, cardId: attacker.instanceId, amount: milled });
    clearBattleState(state);
    return;
  }

  const defenderSlot = getCardCurrentSlot(state, defenderCardId);
  if (!defenderSlot) { clearBattleState(state); return; }
  const defender = state.players[defenderPlayerId].field[defenderSlot].card;
  if (!defender) { clearBattleState(state); return; }

  const attackerDown = getCardAp(defender) > getCardDp(attacker);
  const defenderDown = getCardAp(attacker) > getCardDp(defender);
  if (defenderDown) defender.isTapped = true;
  if (attackerDown) attacker.isTapped = true;

  state.logs.push(`[BATTLE] ${attacker.name} AP:${getCardAp(attacker)} / DP:${getCardDp(attacker)} vs ${defender.name} AP:${getCardAp(defender)} / DP:${getCardDp(defender)}`);
  if (defenderDown && attackerDown) {
    state.logs.push("[BATTLE] 결과: 공격자/방어자 둘 다 다운");
    pushEvent(state, { type: "BATTLE_BOTH_DOWN", playerId: attackerPlayerId, cardId: attacker.instanceId, relatedCardId: defender.instanceId });
  } else if (defenderDown) {
    state.logs.push("[BATTLE] 결과: 방어자 다운");
    pushEvent(state, { type: "BATTLE_DEFENDER_DOWN", playerId: attackerPlayerId, cardId: attacker.instanceId, relatedCardId: defender.instanceId });
  } else if (attackerDown) {
    state.logs.push("[BATTLE] 결과: 공격자 다운");
    pushEvent(state, { type: "BATTLE_ATTACKER_DOWN", playerId: defenderPlayerId, cardId: defender.instanceId, relatedCardId: attacker.instanceId });
  } else {
    state.logs.push("[BATTLE] 결과: 양측 모두 다운하지 않음");
    pushEvent(state, { type: "BATTLE_NO_DOWN", playerId: attackerPlayerId, cardId: attacker.instanceId, relatedCardId: defender.instanceId });
  }
  clearBattleState(state);
}

export function checkWinner(state: GameState): PlayerID | null {
  if (state.winner) return state.winner;
  for (const playerId of ["P1","P2"] as const) {
    if (state.players[playerId].deck.length === 0) {
      state.winner = getOpponent(playerId);
      return state.winner;
    }
  }
  return null;
}