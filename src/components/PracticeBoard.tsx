import { useEffect, useMemo, useState, type CSSProperties } from "react";
import type { CardRef, FieldSlot, GameState, PlayerID } from "../game/GameTypes";
import { CARD_META_BY_CODE } from "../lib/cards";
import {
  getCardImageCandidates,
  markCardImageFailed,
  markCardImageResolved,
} from "../config/cardImage";

const FIELD_RENDER_ORDER: FieldSlot[] = [
  "DF_LEFT",
  "DF_CENTER",
  "DF_RIGHT",
  "AF_LEFT",
  "AF_CENTER",
  "AF_RIGHT",
];

function getCardLabel(card: CardRef): string {
  const ap = card.ap ?? card.power ?? 0;
  const dp = card.dp ?? card.hp ?? card.power ?? 0;
  const dmg = card.dmg ?? card.damage ?? 0;
  const flags: string[] = [];

  if (card.isTapped) flags.push("DOWN");

  return `${card.name} AP ${ap} / DP ${dp} / DMG ${dmg}${
    flags.length ? ` [${flags.join(", ")}]` : ""
  }`;
}

function getFieldCellLabel(cell: GameState["players"]["P1"]["field"][FieldSlot]): string {
  const lines: string[] = [];

  if (cell.card) {
    lines.push(`캐릭터: ${getCardLabel(cell.card)}`);
  }

  if (cell.attachedItem) {
    lines.push(`아이템: ${cell.attachedItem.name}`);
  }

  if (cell.area) {
    lines.push(`에리어: ${cell.area.name}`);
  }

  return lines.length > 0 ? lines.join("\n") : "비어 있음";
}

function getCardCodeCandidates(card: CardRef): string[] {
  const rawValues = [
    card.cardNo,
    card.sameNameKey,
    (card as { code?: string }).code,
    (card as { baseCode?: string }).baseCode,
  ];

  const normalized = rawValues
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((value) => value.trim().toUpperCase());

  const expanded = new Set<string>();

  for (const value of normalized) {
    expanded.add(value);
    expanded.add(value.replace(/\s+/g, ""));
    expanded.add(value.replace(/_/g, "-"));
    expanded.add(value.replace(/-/g, ""));
  }

  return Array.from(expanded);
}

function getCardCode(card: CardRef): string {
  return getCardCodeCandidates(card)[0] ?? "";
}

function getCardMeta(card: CardRef) {
  const candidates = getCardCodeCandidates(card);

  for (const candidate of candidates) {
    const found = CARD_META_BY_CODE[candidate];
    if (found) return found;
  }

  return undefined;
}

function getCardMetaAttributeList(card: CardRef): string[] {
  const meta = getCardMeta(card);

  if (Array.isArray(meta?.attributesList)) {
    return meta.attributesList.map((value) => String(value));
  }

  if (Array.isArray((meta as { attributes_list?: unknown[] } | undefined)?.attributes_list)) {
    return ((meta as { attributes_list?: unknown[] }).attributes_list ?? []).map((value) => String(value));
  }

  return [meta?.attribute, meta?.color]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .map((value) => String(value));
}

function getCardMetaUseTargetList(card: CardRef): unknown[] {
  const meta = getCardMeta(card);
  if (Array.isArray(meta?.useTarget)) return meta.useTarget;
  if (typeof meta?.useTarget === "string" || typeof meta?.useTarget === "number") {
    return [meta.useTarget];
  }
  return [];
}


function getPrimaryActionLabel(card: CardRef): string {
  switch (card.cardType) {
    case "character":
      return "등장";
    case "area":
      return "배치";
    case "item":
      return "장비";
    case "event":
      return "사용";
    default:
      return "이동";
  }
}

function shuffleCards<T>(cards: T[]): T[] {
  const next = [...cards];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function expandCompactAttributeString(rawValue: string): string[] {
  const compact = rawValue.replace(/[\s\+＋,\/|，・\(\)\[\]\{\}]+/g, "");
  if (!compact) return [];

  const directMap: Record<string, string> = {
    "日": "sun",
    "일": "sun",
    "月": "moon",
    "월": "moon",
    "花": "flower",
    "화": "flower",
    "雪": "snow",
    "설": "snow",
    "宙": "cosmos",
    "주": "cosmos",
    "無": "star",
    "무": "star",
  };

  const chars = Array.from(compact);
  const directExpanded: string[] = [];
  let hasUnknownDirectChar = false;

  for (const ch of chars) {
    const mapped = directMap[ch];
    if (!mapped) {
      hasUnknownDirectChar = true;
      break;
    }
    directExpanded.push(mapped);
  }

  if (!hasUnknownDirectChar && directExpanded.length > 0) {
    return directExpanded;
  }

  const englishTokens = ["flower", "cosmos", "space", "moon", "snow", "star", "none", "sun"];
  const lowered = compact.toLowerCase();
  const englishExpanded: string[] = [];
  let cursor = 0;
  let hasUnknownEnglishChunk = false;

  while (cursor < lowered.length) {
    let matchedToken = "";

    for (const token of englishTokens) {
      if (lowered.startsWith(token, cursor)) {
        matchedToken = token;
        break;
      }
    }

    if (!matchedToken) {
      hasUnknownEnglishChunk = true;
      break;
    }

    englishExpanded.push(normalizeAttributeValue(matchedToken));
    cursor += matchedToken.length;
  }

  if (!hasUnknownEnglishChunk && englishExpanded.length > 0) {
    return englishExpanded;
  }

  const parsed = Number(lowered);
  if (Number.isFinite(parsed) && parsed > 0) {
    return Array.from({ length: Math.trunc(parsed) }, () => "generic");
  }

  return [normalizeAttributeValue(rawValue)];
}

function parseAttributeValues(rawValue: unknown): string[] {
  if (typeof rawValue === "number") {
    return rawValue > 0 ? Array.from({ length: Math.trunc(rawValue) }, () => "generic") : [];
  }

  if (typeof rawValue !== "string") return [];

  const trimmed = rawValue.trim();
  if (!trimmed || trimmed === "0") return [];

  const tokenized = trimmed
    .split(/[\s\+＋,\/|，・]+/)
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  if (tokenized.length > 1) {
    return tokenized.flatMap((value) => expandCompactAttributeString(value));
  }

  return expandCompactAttributeString(trimmed);
}

function getCardUseTargetRequirements(card: CardRef): string[] {
  const rawTargets = getCardMetaUseTargetList(card);

  return rawTargets.flatMap((value) => {
    if (typeof value === "string") {
      const trimmed = value.trim();

      if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
        const inner = trimmed.slice(1, -1).trim();
        if (!inner) return [];

        return inner
          .split(",")
          .map((part) => part.trim().replace(/^['"]|['"]$/g, ""))
          .filter((part) => part.length > 0)
          .flatMap((part) => parseAttributeValues(part));
      }
    }

    return parseAttributeValues(value);
  });
}

function getCardUseTargetRequirementMap(card: CardRef): Record<string, number> {
  const requirements = getCardUseTargetRequirements(card);
  const result: Record<string, number> = {};

  for (const requirement of requirements) {
    const normalized = normalizeAttributeValue(requirement);
    result[normalized] = (result[normalized] ?? 0) + 1;
  }

  return result;
}

function getCardUseTargetTotalRequired(card: CardRef): number {
  return getCardUseTargetRequirements(card).length;
}

function getCardUseTargetLabel(card: CardRef): string {
  const requirements = getCardUseTargetRequirements(card);
  return requirements.length > 0 ? requirements.join(" / ") : "0";
}

function getResolvedCostAttributeCounts(selectedCostCards: SelectedCostCardState[]): Record<string, number> {
  const result: Record<string, number> = {};

  for (const entry of selectedCostCards) {
    for (const rawValue of entry.attributes) {
      const normalized = normalizeAttributeValue(rawValue);
      if (!normalized) continue;
      result[normalized] = (result[normalized] ?? 0) + 1;
    }
  }

  return result;
}

function canPayCardUseTarget(card: CardRef, selectedCostCards: SelectedCostCardState[]): boolean {
  const requiredMap = getCardUseTargetRequirementMap(card);
  const resolvedMap = getResolvedCostAttributeCounts(selectedCostCards);

  for (const [attribute, requiredValue] of Object.entries(requiredMap)) {
    if ((resolvedMap[attribute] ?? 0) < requiredValue) {
      return false;
    }
  }

  return true;
}

type CostAttributeSelectionState = {
  cardId: string;
  pendingValues: string[];
  resolvedValues: string[];
};

type SelectedCostCardState = {
  cardId: string;
  attributes: string[];
};

function normalizeAttributeValue(value: string): string {
  const normalized = value.trim().toLowerCase();

  switch (normalized) {
    case "sun":
    case "日":
    case "일":
      return "sun";
    case "moon":
    case "月":
    case "월":
      return "moon";
    case "flower":
    case "花":
    case "화":
      return "flower";
    case "snow":
    case "雪":
    case "설":
      return "snow";
    case "cosmos":
    case "space":
    case "宙":
    case "주":
      return "cosmos";
    case "star":
    case "none":
    case "無":
    case "무":
      return "star";
    default:
      return normalized;
  }
}

function getAttributeDisplayLabel(value: string): string {
  const normalized = normalizeAttributeValue(value);

  switch (normalized) {
    case "snow":
      return "설";
    case "moon":
      return "월";
    case "flower":
      return "화";
    case "cosmos":
      return "주";
    case "sun":
      return "일";
    case "star":
    case "space":
      return "무";
    default:
      return value;
  }
}

function getCardCostAttributeOptions(card: CardRef): string[] {
  const baseValues = getCardMetaAttributeList(card);

  const normalizedSeen = new Set<string>();
  const result: string[] = [];

  for (const rawValue of baseValues) {
    for (const parsedValue of parseAttributeValues(rawValue)) {
      const normalized = normalizeAttributeValue(parsedValue);
      if (!normalized || normalizedSeen.has(normalized)) continue;

      normalizedSeen.add(normalized);
      result.push(normalized);
    }
  }

  return result;
}

function getCardExValue(card: CardRef): number {
  const meta = getCardMeta(card);
  const parsed = Number(meta?.ex ?? 0);

  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.trunc(parsed));
}

function buildAutoSelectedCostCardState(cardId: string, card: CardRef): SelectedCostCardState {
  const options = getCardCostAttributeOptions(card);
  const exValue = getCardExValue(card);
  const autoValue = options[0];
  const attributes =
    autoValue && exValue > 0 ? Array.from({ length: exValue }, () => autoValue) : [];

  return {
    cardId,
    attributes,
  };
}

type CardActionMenuState =
  | {
      kind: "deck" | "discard";
      playerId: PlayerID;
      cardId: string;
    }
  | null;

type HandCardActionMenuState =
  | {
      playerId: PlayerID;
      cardId: string;
    }
  | null;

type CostModalSource = "hand" | "deck" | "discard";

type CostModalState =
  | {
      playerId: PlayerID;
      cardId: string;
      source: CostModalSource;
      selectedCostCards: SelectedCostCardState[];
      pendingAttributeSelection: CostAttributeSelectionState | null;
    }
  | null;

type RandomRecoveryPromptState =
  | {
      playerId: PlayerID;
      value: string;
    }
  | null;

type RandomRecoveryResultState =
  | {
      playerId: PlayerID;
      cards: CardRef[];
      confirmedBySelf: boolean;
      confirmedByOpponent: boolean;
    }
  | null;

function CardImage({
  card,
  clickable,
  onClick,
}: {
  card: CardRef;
  clickable: boolean;
  onClick: () => void;
}) {
  const cardCode = getCardCode(card);
  const candidates = useMemo(() => getCardImageCandidates(cardCode), [cardCode]);
  const [candidateIndex, setCandidateIndex] = useState(0);

  useEffect(() => {
    setCandidateIndex(0);
  }, [cardCode, candidates]);

  const currentSrc = candidates[candidateIndex] ?? "";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!clickable}
      title={getCardLabel(card)}
      style={{
        ...cardImageButtonStyle,
        cursor: clickable ? "pointer" : "default",
        opacity: clickable ? 1 : 0.96,
      }}
    >
      <div style={cardImageFrameStyle}>
        {currentSrc ? (
          <img
            src={currentSrc}
            alt={card.name}
            loading="lazy"
            decoding="async"
            draggable={false}
            onLoad={() => {
              markCardImageResolved(cardCode, currentSrc);
            }}
            onError={() => {
              markCardImageFailed(currentSrc);
              setCandidateIndex((prev) => prev + 1);
            }}
            style={cardImageStyle}
          />
        ) : (
          <div style={cardImageFallbackStyle}>이미지 없음</div>
        )}
      </div>

      <div style={cardTextWrapStyle}>
        <div style={cardNameStyle}>{card.name}</div>
        <div style={cardCodeStyle}>{cardCode || card.instanceId}</div>
      </div>
    </button>
  );
}

type CardPileModalState =
  | {
      kind: "discard" | "deck";
      playerId: PlayerID;
      label: string;
    }
  | null;

type DeckMenuState =
  | {
      playerId: PlayerID;
    }
  | null;

function HandCardActionOverlay({
  card,
  onClose,
  onPrimaryAction,
  onDeclareAction,
  onMoveToDeckTop,
  onMoveToDeckBottom,
}: {
  card: CardRef;
  onClose: () => void;
  onPrimaryAction: () => void;
  onDeclareAction: () => void;
  onMoveToDeckTop: () => void;
  onMoveToDeckBottom: () => void;
}) {
  return (
    <div style={handCardActionOverlayStyle} data-deck-menu-keep="true">
      <button type="button" style={cardActionButtonStyle} onClick={onPrimaryAction}>
        {getPrimaryActionLabel(card)}
      </button>
      <button type="button" style={cardActionButtonStyle} onClick={onDeclareAction}>
        패 선언
      </button>
      <button type="button" style={cardActionButtonStyle} onClick={onMoveToDeckTop}>
        덱 맨 위로
      </button>
      <button type="button" style={cardActionButtonStyle} onClick={onMoveToDeckBottom}>
        덱 맨 아래로
      </button>
      <button type="button" style={cardActionCloseButtonStyle} onClick={onClose}>
        닫기
      </button>
    </div>
  );
}

function findSourceCard(
  gameState: GameState,
  playerId: PlayerID,
  source: CostModalSource,
  cardId: string,
): CardRef | undefined {
  const player = gameState.players[playerId];

  switch (source) {
    case "hand":
      return player.hand.find((card) => card.instanceId === cardId);
    case "deck":
      return player.deck.find((card) => card.instanceId === cardId);
    case "discard":
      return player.discard.find((card) => card.instanceId === cardId);
    default:
      return undefined;
  }
}

function CostPaymentModal({
  state,
  gameState,
  onToggleCostCard,
  onChoosePendingAttribute,
  onCancelPendingAttributeSelection,
  onConfirm,
  onFreeConfirm,
  onCancel,
}: {
  state: CostModalState;
  gameState: GameState;
  onToggleCostCard: (cardId: string) => void;
  onChoosePendingAttribute: (value: string) => void;
  onCancelPendingAttributeSelection: () => void;
  onConfirm: () => void;
  onFreeConfirm: () => void;
  onCancel: () => void;
}) {
  if (!state) return null;

  const player = gameState.players[state.playerId];
  const actionCard = findSourceCard(gameState, state.playerId, state.source, state.cardId);
  if (!actionCard) return null;

  const requiredCount = getCardUseTargetTotalRequired(actionCard);
  const requiredLabel = getCardUseTargetLabel(actionCard);
  const selectedCards = state.selectedCostCards
    .map((entry) => {
      const card = player.hand.find((candidate) => candidate.instanceId === entry.cardId);
      if (!card) return null;
      return {
        card,
        attributes: entry.attributes,
      };
    })
    .filter(
      (
        entry,
      ): entry is {
        card: CardRef;
        attributes: string[];
      } => Boolean(entry),
    );
  const selectedCostCardIdSet = new Set(state.selectedCostCards.map((entry) => entry.cardId));
  const availableHandCards = player.hand.filter((card) => card.instanceId !== state.cardId);
  const requiredAttributeMap = getCardUseTargetRequirementMap(actionCard);
  const resolvedAttributeMap = getResolvedCostAttributeCounts(state.selectedCostCards);
  const canConfirm = canPayCardUseTarget(actionCard, state.selectedCostCards);

  return (
    <div style={costModalOverlayStyle}>
      <div style={costBackdropDimStyle} />
      <div style={costModalCardStyle} data-deck-menu-keep="true">
        <div style={costModalTitleStyle}>코스트 지불</div>
        <div style={costModalLineStyle}>
          사용 카드: {actionCard.name}
          {state.source === "deck" ? " (덱)" : state.source === "discard" ? " (쓰레기통)" : " (패)"}
        </div>
        <div style={costModalLineStyle}>요구 코스트: {requiredLabel} (미만 불가, 이상/초과 가능)</div>

        <div style={costModalSectionTitleStyle}>코스트로 지불하는 카드</div>
        <div style={costSelectedGridStyle}>
          {selectedCards.length === 0 ? (
            <div style={emptyHintStyle}>선택된 코스트 카드가 없습니다.</div>
          ) : (
            selectedCards.map(({ card, attributes }) => (
              <div key={`selected-${card.instanceId}`} style={costCardStackStyle}>
                <CardImage
                  card={card}
                  clickable={true}
                  onClick={() => onToggleCostCard(card.instanceId)}
                />
                {attributes.length > 0 ? (
                  <div style={costAttributeBadgeWrapStyle}>
                    {attributes.map((value, index) => (
                      <div key={`${card.instanceId}-${value}-${index}`} style={costAttributeBadgeStyle}>
                        {getAttributeDisplayLabel(value)}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ))
          )}
        </div>

        <div style={costModalSectionTitleStyle}>현재 보유중인 패</div>
        <div style={costAvailableGridStyle}>
          {availableHandCards.length === 0 ? (
            <div style={emptyHintStyle}>지불할 수 있는 패가 없습니다.</div>
          ) : (
            availableHandCards.map((card) => {
              const isSelected = selectedCostCardIdSet.has(card.instanceId);
              const pendingSelection =
                state.pendingAttributeSelection?.cardId === card.instanceId
                  ? state.pendingAttributeSelection
                  : null;

              return (
                <div
                  key={`available-${card.instanceId}`}
                  style={{
                    ...costCardStackStyle,
                    opacity: isSelected ? 0.45 : 1,
                    transition: "opacity 0.15s ease",
                  }}
                >
                  <CardImage
                    card={card}
                    clickable={true}
                    onClick={() => onToggleCostCard(card.instanceId)}
                  />
                  {pendingSelection ? (
                    <div style={costAttributePromptOverlayStyle}>
                      <div style={costAttributePromptCardStyle}>
                        <div style={costAttributePromptTitleStyle}>
                          EX {pendingSelection.resolvedValues.length + 1} /{" "}
                          {pendingSelection.resolvedValues.length + pendingSelection.pendingValues.length}
                        </div>
                        <div style={costAttributePromptButtonWrapStyle}>
                          {getCardCostAttributeOptions(card).map((value) => (
                            <button
                              key={`${card.instanceId}-${value}`}
                              type="button"
                              style={costAttributePromptButtonStyle}
                              onClick={() => onChoosePendingAttribute(value)}
                            >
                              {getAttributeDisplayLabel(value)}
                            </button>
                          ))}
                          <button
                            type="button"
                            style={costAttributePromptCancelButtonStyle}
                            onClick={onCancelPendingAttributeSelection}
                          >
                            취소
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>

        <div style={costFooterStyle}>
          <div style={costFooterInfoWrapStyle}>
            <div style={costFooterHintStyle}>
              발생 attribute 총합 {Object.values(resolvedAttributeMap).reduce((sum, value) => sum + value, 0)} / 요구 최소치 {requiredCount}
            </div>
            <div style={costFooterSummaryStyle}>
              요구:{" "}
              {Object.keys(requiredAttributeMap).length === 0
                ? "없음"
                : Object.entries(requiredAttributeMap)
                    .map(
                      ([attribute, value]) =>
                        `${getAttributeDisplayLabel(attribute)} ${value}이상`,
                    )
                    .join(" / ")}
              <br />
              현재 발생:{" "}
              {Object.keys(resolvedAttributeMap).length === 0
                ? "없음"
                : Object.entries(resolvedAttributeMap)
                    .map(
                      ([attribute, value]) =>
                        `${getAttributeDisplayLabel(attribute)} ${value}`,
                    )
                    .join(" / ")}
              <br />
              선택 카드:{" "}
              {selectedCards.length === 0
                ? "없음"
                : selectedCards
                    .map(
                      ({ card, attributes }) =>
                        `${card.name}: ${
                          attributes.length > 0
                            ? attributes.map((value) => getAttributeDisplayLabel(value)).join(" / ")
                            : "없음"
                        }`,
                    )
                    .join(" | ")}
            </div>
          </div>
          <div style={costFooterButtonsStyle}>
            <button type="button" style={freeConfirmButtonStyle} onClick={onFreeConfirm}>
              무료 {getPrimaryActionLabel(actionCard)}
            </button>
            <button
              type="button"
              style={canConfirm ? confirmButtonStyle : disabledConfirmButtonStyle}
              onClick={onConfirm}
              disabled={!canConfirm}
            >
              {getPrimaryActionLabel(actionCard)}
            </button>
            <button type="button" style={modalCloseButtonStyle} onClick={onCancel}>
              취소
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}


function FieldSlotImage({
  cell,
  slot,
  onClick,
}: {
  cell: GameState["players"]["P1"]["field"][FieldSlot];
  slot: FieldSlot;
  onClick: () => void;
}) {
  const attachedItems =
    (cell as any).attachedItems ??
    (cell.attachedItem ? [cell.attachedItem] : []);

  const itemCount = attachedItems.length;

  const primaryCard = cell.card ?? cell.area ?? cell.attachedItem ?? null;
  const primaryCode = primaryCard ? getCardCode(primaryCard) : "";
  const primaryCandidates = useMemo(
    () => (primaryCode ? getCardImageCandidates(primaryCode) : []),
    [primaryCode],
  );
  const [primaryIndex, setPrimaryIndex] = useState(0);

  useEffect(() => {
    setPrimaryIndex(0);
  }, [primaryCode, primaryCandidates]);

  const renderMiniThumb = (card: CardRef, kind: string) => {
    const code = getCardCode(card);
    const src = getCardImageCandidates(code)[0] ?? "";

    return (
      <div key={`${kind}-${card.instanceId}`} style={fieldMiniThumbWrapStyle} title={`${kind}: ${card.name}`}>
        {src ? (
          <img
            src={src}
            alt={`${kind} ${card.name}`}
            loading="lazy"
            decoding="async"
            draggable={false}
            style={fieldMiniThumbImageStyle}
          />
        ) : (
          <div style={fieldMiniThumbFallbackStyle}>{kind}</div>
        )}
        <div style={fieldMiniThumbLabelStyle}>{kind}</div>
      </div>
    );
  };

  const extraThumbs: JSX.Element[] = [];
  if (cell.card && cell.area) extraThumbs.push(renderMiniThumb(cell.area, "에리어"));
  if (cell.card && cell.attachedItem) extraThumbs.push(renderMiniThumb(cell.attachedItem, "아이템"));
  if (!cell.card && cell.area && cell.attachedItem) extraThumbs.push(renderMiniThumb(cell.attachedItem, "아이템"));

  return (
    <button
      type="button"
      style={fieldSlotImageButtonStyle}
      onClick={onClick}
      title={primaryCard ? `${slot} / ${primaryCard.name}` : slot}
    >
      <div style={fieldSlotTitleBadgeStyle}>{slot}</div>
      <div style={fieldSlotImageFrameStyle}>
        {primaryCard && primaryCandidates[primaryIndex] ? (
          <img
            src={primaryCandidates[primaryIndex]}
            alt={primaryCard.name}
            loading="lazy"
            decoding="async"
            draggable={false}
            onLoad={() => {
              markCardImageResolved(primaryCode, primaryCandidates[primaryIndex]);
            }}
            onError={() => {
              markCardImageFailed(primaryCandidates[primaryIndex]);
              setPrimaryIndex((prev) => prev + 1);
            }}
            style={fieldSlotImageStyle}
          />
        ) : (
          <div style={fieldEmptyFrameStyle}>비어 있음</div>
        )}
      </div>
      {extraThumbs.length > 0 ? <div style={fieldMiniThumbTrayStyle}>{extraThumbs}</div> : null}
    </button>
  );
}


function DeckPilePreview({
  cards,
  title,
  onClick,
}: {
  cards: CardRef[];
  title: string;
  onClick: () => void;
}) {
  const previewCards = cards.slice(-4);

  return (
    <button type="button" style={deckPilePreviewButtonStyle} onClick={onClick}>
      <div style={deckPilePreviewFrameStyle}>
        {previewCards.length === 0 ? (
          <div style={deckPileEmptyFrameStyle} />
        ) : (
          previewCards.map((card, index) => {
            const code = getCardCode(card);
            const src = getCardImageCandidates(code)[0] ?? "";
            const offset = index * 6;

            return (
              <div
                key={`${title}-${card.instanceId}`}
                style={{
                  ...deckPilePreviewCardWrapStyle,
                  top: offset,
                  left: offset,
                  zIndex: index + 1,
                }}
                title={card.name}
              >
                {src ? (
                  <img
                    src={src}
                    alt={card.name}
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                    style={deckPilePreviewImageStyle}
                  />
                ) : (
                  <div style={deckPilePreviewFallbackStyle} />
                )}
              </div>
            );
          })
        )}
      </div>
    </button>
  );
}

type PlayerAreaProps = {
  label: string;
  playerId: PlayerID;
  state: GameState;
  isPerspectivePlayer: boolean;
  isDeckMenuOpen: boolean;
  activeHandCardAction: HandCardActionMenuState;
  onHandCardClick: (playerId: PlayerID, cardId: string) => void;
  onHandPrimaryAction: (playerId: PlayerID, card: CardRef) => void;
  onHandDeclareAction: (playerId: PlayerID, cardId: string) => void;
  onMoveHandCardToDeckTop: (playerId: PlayerID, cardId: string) => void;
  onMoveHandCardToDeckBottom: (playerId: PlayerID, cardId: string) => void;
  onCloseHandCardAction: () => void;
  onFieldClick: (playerId: PlayerID, slot: FieldSlot) => void;
  onOpenPile: (
    kind: "discard" | "deck",
    playerId: PlayerID,
    label: string,
  ) => void;
  onToggleDeckMenu: (playerId: PlayerID) => void;
  onDrawFromDeck: (playerId: PlayerID) => void;
  onDamageFromDeck: (playerId: PlayerID) => void;
  onShuffleDeck: (playerId: PlayerID) => void;
};

function PlayerArea({
  label,
  playerId,
  state,
  isPerspectivePlayer,
  isDeckMenuOpen,
  activeHandCardAction,
  onHandCardClick,
  onHandPrimaryAction,
  onHandDeclareAction,
  onMoveHandCardToDeckTop,
  onMoveHandCardToDeckBottom,
  onCloseHandCardAction,
  onFieldClick,
  onOpenPile,
  onToggleDeckMenu,
  onDrawFromDeck,
  onDamageFromDeck,
  onShuffleDeck,
}: PlayerAreaProps) {
  const player = state.players[playerId];
  const frontSlots: FieldSlot[] = isPerspectivePlayer
    ? ["AF_LEFT", "AF_CENTER", "AF_RIGHT"]
    : ["DF_LEFT", "DF_CENTER", "DF_RIGHT"];
  const backSlots: FieldSlot[] = isPerspectivePlayer
    ? ["DF_LEFT", "DF_CENTER", "DF_RIGHT"]
    : ["AF_LEFT", "AF_CENTER", "AF_RIGHT"];

  return (
    <div style={panelStyle}>
      <div style={sectionTitleStyle}>{label}</div>

      <div style={metaRowStyle}>
        <span>덱 {player.deck.length}</span>
        <span>패 {player.hand.length}</span>
        <span>쓰레기통 {player.discard.length}</span>
        <span>현재 턴 {state.turn.activePlayer === playerId ? "예" : "아니오"}</span>
      </div>

      <div style={fieldGridStyle}>
        {frontSlots.map((typedSlot) => {
          const card = player.field[typedSlot].card;
          return (
            <FieldSlotImage
              key={`${playerId}-${typedSlot}`}
              cell={player.field[typedSlot]}
              slot={typedSlot}
              onClick={() => onFieldClick(playerId, typedSlot)}
            />
          );
        })}

        {isDeckMenuOpen ? (
          <div style={pileMenuCellStyle} data-deck-menu-keep="true">
            <button
              type="button"
              style={miniActionButtonStyle}
              onClick={() => onDrawFromDeck(playerId)}
            >
              드로우
            </button>
            <button
              type="button"
              style={miniActionButtonStyle}
              onClick={() => onDamageFromDeck(playerId)}
            >
              대미지
            </button>
            <button
              type="button"
              style={miniActionButtonStyle}
              onClick={() => onShuffleDeck(playerId)}
            >
              셔플
            </button>
            <button
              type="button"
              style={miniActionButtonStyle}
              onClick={() => onOpenPile("deck", playerId, label)}
            >
              덱 보기
            </button>
          </div>
        ) : (
          <DeckPilePreview
            cards={player.deck}
            title="덱"
            onClick={() => onToggleDeckMenu(playerId)}
          />
        )}

        {backSlots.map((typedSlot) => {
          const card = player.field[typedSlot].card;
          return (
            <FieldSlotImage
              key={`${playerId}-${typedSlot}`}
              cell={player.field[typedSlot]}
              slot={typedSlot}
              onClick={() => onFieldClick(playerId, typedSlot)}
            />
          );
        })}

        <DeckPilePreview
          cards={player.discard}
          title="쓰레기통"
          onClick={() => onOpenPile("discard", playerId, label)}
        />
      </div>

      <div style={sectionMinorTitleStyle}>
        손패 {isPerspectivePlayer ? "(카드 클릭으로 행동 선택)" : "(연습 모드에서 확인 가능)"}
      </div>

      <div style={handGridStyle}>
        {player.hand.length === 0 ? (
          <div style={emptyHintStyle}>손패가 없습니다.</div>
        ) : (
          player.hand.map((card) => {
            const isActionOpen =
              activeHandCardAction?.playerId === playerId &&
              activeHandCardAction.cardId === card.instanceId;

            return (
              <div
                key={card.instanceId}
                style={pileCardStackStyle}
                data-deck-menu-keep={isActionOpen ? "true" : undefined}
              >
                <div
                  style={{
                    opacity: isActionOpen ? 0.42 : 1,
                    transition: "opacity 0.15s ease",
                  }}
                >
                  <CardImage
                    card={card}
                    clickable={isPerspectivePlayer}
                    onClick={() => onHandCardClick(playerId, card.instanceId)}
                  />
                </div>

                {isActionOpen ? (
                  <HandCardActionOverlay
                    card={card}
                    onClose={onCloseHandCardAction}
                    onPrimaryAction={() => onHandPrimaryAction(playerId, card)}
                    onDeclareAction={() => onHandDeclareAction(playerId, card.instanceId)}
                    onMoveToDeckTop={() => onMoveHandCardToDeckTop(playerId, card.instanceId)}
                    onMoveToDeckBottom={() => onMoveHandCardToDeckBottom(playerId, card.instanceId)}
                  />
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function CardActionOverlay({
  card,
  state,
  onClose,
  onPrimaryAction,
  onMoveToHand,
}: {
  card: CardRef;
  state: CardActionMenuState;
  onClose: () => void;
  onPrimaryAction: (card: CardRef, source: "deck" | "discard", playerId: PlayerID) => void;
  onMoveToHand: (cardId: string, source: "deck" | "discard", playerId: PlayerID) => void;
}) {
  if (!state) return null;

  return (
    <div style={cardActionOverlayStyle} data-deck-menu-keep="true">
      <button
        type="button"
        style={cardActionButtonStyle}
        onClick={() => onPrimaryAction(card, state.kind, state.playerId)}
      >
        {getPrimaryActionLabel(card)}
      </button>
      <button
        type="button"
        style={cardActionButtonStyle}
        onClick={() => onMoveToHand(state.cardId, state.kind, state.playerId)}
      >
        손패로
      </button>
      <button type="button" style={cardActionCloseButtonStyle} onClick={onClose}>
        닫기
      </button>
    </div>
  );
}

function RandomRecoveryPromptModal({
  isOpen,
  discardCount,
  value,
  onValueChange,
  onConfirm,
  onClose,
}: {
  isOpen: boolean;
  discardCount: number;
  value: string;
  onValueChange: (value: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}) {
  if (!isOpen) return null;

  const parsedCount = Number(value);
  const hasInput = value.trim().length > 0;
  const exceedsDiscardCount = hasInput && Number.isFinite(parsedCount) && parsedCount > discardCount;
  const isInvalidCount =
    !hasInput || !Number.isInteger(parsedCount) || parsedCount <= 0 || exceedsDiscardCount;

  return (
    <div style={subModalOverlayStyle} onClick={onClose}>
      <div style={subModalCardStyle} onClick={(event) => event.stopPropagation()}>
        <div style={subModalTitleStyle}>몇 장을 회복하시겠습니까?</div>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={value}
          onChange={(event) => onValueChange(event.target.value.replace(/\D/g, ""))}
          style={numberInputStyle}
          placeholder="숫자만 입력"
          autoFocus
        />
        {exceedsDiscardCount ? (
          <div style={errorMessageStyle}>
            회복하려는 카드의 수가 쓰레기통의 매수보다 많습니다.
          </div>
        ) : (
          <div style={subModalHintStyle}>현재 쓰레기통 매수: {discardCount}장</div>
        )}
        <div style={subModalButtonRowStyle}>
          <button
            type="button"
            style={isInvalidCount ? disabledConfirmButtonStyle : confirmButtonStyle}
            onClick={onConfirm}
            disabled={isInvalidCount}
          >
            확인
          </button>
          <button type="button" style={modalCloseButtonStyle} onClick={onClose}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

function RandomRecoveryResultModal({
  isOpen,
  selfLabel,
  opponentLabel,
  result,
  onConfirmSelf,
  onConfirmOpponent,
}: {
  isOpen: boolean;
  selfLabel: string;
  opponentLabel: string;
  result: RandomRecoveryResultState;
  onConfirmSelf: () => void;
  onConfirmOpponent: () => void;
}) {
  if (!isOpen || !result) return null;

  return (
    <div style={modalOverlayStyle}>
      <div style={resultModalCardStyle}>
        <div style={modalHeaderStyle}>
          <div>
            <div style={modalTitleStyle}>무작위 회복 결과</div>
            <div style={modalSubTitleStyle}>해당 카드들을 해당 순서대로 회복했습니다.</div>
          </div>
        </div>

        <div style={resultGridStyle}>
          {result.cards.map((card, index) => (
            <div key={`${card.instanceId}-${index}`} style={pileItemWrapStyle}>
              <div style={pileOrderStyle}>{index + 1}</div>
              <CardImage card={card} clickable={false} onClick={() => undefined} />
            </div>
          ))}
        </div>

        <div style={resultConfirmRowStyle}>
          <button
            type="button"
            style={result.confirmedBySelf ? confirmedButtonStyle : confirmButtonStyle}
            onClick={onConfirmSelf}
            disabled={result.confirmedBySelf}
          >
            {selfLabel} 확인
          </button>
          <button
            type="button"
            style={result.confirmedByOpponent ? confirmedButtonStyle : confirmButtonStyle}
            onClick={onConfirmOpponent}
            disabled={result.confirmedByOpponent}
          >
            {opponentLabel} 확인
          </button>
        </div>
      </div>
    </div>
  );
}

function CardPileModal({
  gameState,
  state,
  activeCardAction,
  recoveryMode,
  recoverySelection,
  onToggleRecoveryMode,
  onOpenRandomRecoveryPrompt,
  onToggleRecoveryCard,
  onCommitRecovery,
  onClose,
  onCardClick,
  onPrimaryAction,
  onMoveToHand,
}: {
  gameState: GameState;
  state: CardPileModalState;
  activeCardAction: CardActionMenuState;
  recoveryMode: boolean;
  recoverySelection: string[];
  onToggleRecoveryMode: () => void;
  onOpenRandomRecoveryPrompt: () => void;
  onToggleRecoveryCard: (cardId: string) => void;
  onCommitRecovery: () => void;
  onClose: () => void;
  onCardClick: (kind: "deck" | "discard", playerId: PlayerID, cardId: string) => void;
  onPrimaryAction: (card: CardRef, source: "deck" | "discard", playerId: PlayerID) => void;
  onMoveToHand: (cardId: string, source: "deck" | "discard", playerId: PlayerID) => void;
}) {
  useEffect(() => {
    if (!state) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [state, onClose]);

  if (!state) return null;

  const pileTitle = state.kind === "deck" ? "덱" : "쓰레기통";
  const pileSubtitle =
    state.kind === "deck"
      ? "덱 맨 위부터 아래 방향 순서대로 표시"
      : recoveryMode
        ? "회복할 카드를 누른 순서대로 선택"
        : "카드가 놓인 순서대로 표시";
  const cards =
    state.kind === "deck"
      ? gameState.players[state.playerId].deck
      : gameState.players[state.playerId].discard;

  return (
    <div style={modalOverlayStyle} onClick={onClose}>
      <div style={modalCardStyle} onClick={(event) => event.stopPropagation()}>
        <div style={modalHeaderStyle}>
          <div>
            <div style={modalTitleStyle}>
              {state.label} {pileTitle}
            </div>
            <div style={modalSubTitleStyle}>{pileSubtitle}</div>
          </div>

          <div style={modalHeaderButtonsStyle}>
            {state.kind === "discard" ? (
              <>
                <button
                  type="button"
                  style={recoveryMode ? recoveryToggleActiveButtonStyle : recoveryToggleButtonStyle}
                  onClick={onToggleRecoveryMode}
                  disabled={!recoveryMode && activeCardAction !== null}
                >
                  {recoveryMode ? `회복 실행 (${recoverySelection.length})` : "회복"}
                </button>
                <button
                  type="button"
                  style={randomRecoveryButtonStyle}
                  onClick={onOpenRandomRecoveryPrompt}
                  disabled={recoveryMode || activeCardAction !== null || cards.length === 0}
                >
                  무작위 회복
                </button>
              </>
            ) : null}
            <button type="button" style={modalCloseButtonStyle} onClick={onClose}>
              닫기
            </button>
          </div>
        </div>

        {cards.length === 0 ? (
          <div style={emptyHintStyle}>{pileTitle}이 비어 있습니다.</div>
        ) : (
          <div style={pileGridStyle}>
            {cards.map((card, index) => {
              const isActionOpen =
                activeCardAction?.playerId === state.playerId &&
                activeCardAction?.kind === state.kind &&
                activeCardAction?.cardId === card.instanceId;
              const recoveryOrder =
                recoverySelection.findIndex((id) => id === card.instanceId) + 1;
              const isRecoverySelected = recoveryOrder > 0;

              return (
                <div key={`${state.kind}-${card.instanceId}-${index}`} style={pileItemWrapStyle}>
                  <div style={pileOrderStyle}>{index + 1}</div>
                  <div style={pileCardStackStyle}>
                    <div
                      style={{
                        opacity: isActionOpen ? 0.48 : isRecoverySelected ? 0.62 : 1,
                        transition: "opacity 0.15s ease",
                      }}
                    >
                      <CardImage
                        card={card}
                        clickable={true}
                        onClick={() => {
                          if (recoveryMode && state.kind === "discard") {
                            onToggleRecoveryCard(card.instanceId);
                            return;
                          }
                          onCardClick(state.kind, state.playerId, card.instanceId);
                        }}
                      />
                    </div>

                    {isRecoverySelected ? (
                      <div style={recoveryOrderBadgeStyle}>{recoveryOrder}</div>
                    ) : null}

                    {isActionOpen && !recoveryMode ? (
                      <CardActionOverlay
                        card={card}
                        state={activeCardAction}
                        onClose={() => onCardClick(state.kind, state.playerId, "")}
                        onPrimaryAction={onPrimaryAction}
                        onMoveToHand={onMoveToHand}
                      />
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {recoveryMode && state.kind === "discard" ? (
          <div style={recoveryFooterStyle}>
            <div style={recoveryHintStyle}>
              선택한 카드 {recoverySelection.length}장을 누른 순서대로 덱 아래로 되돌립니다.
            </div>
            <button
              type="button"
              style={recoveryExecuteButtonStyle}
              onClick={onCommitRecovery}
              disabled={recoverySelection.length === 0}
            >
              회복 실행
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

interface PracticeBoardProps {
  state: GameState;
  perspective: PlayerID;
  onHandPrimaryAction?: (playerId: PlayerID, card: CardRef, costCardIds: string[]) => void;
  onHandDeclareAction?: (playerId: PlayerID, cardId: string) => void;
  onMoveHandCardToDeckTop?: (playerId: PlayerID, cardId: string) => void;
  onMoveHandCardToDeckBottom?: (playerId: PlayerID, cardId: string) => void;
  onFieldClick: (playerId: PlayerID, slot: FieldSlot) => void;
  onDrawFromDeck?: (playerId: PlayerID) => void;
  onDamageFromDeck?: (playerId: PlayerID) => void;
  onShuffleDeck?: (playerId: PlayerID) => void;
  onPrimaryCardAction?: (
    playerId: PlayerID,
    card: CardRef,
    source: "deck" | "discard",
    costCardIds: string[],
  ) => void;
  onPileCharacterDeclareAction?: (
    playerId: PlayerID,
    card: CardRef,
    source: "deck" | "discard",
    costCardIds: string[],
  ) => void;
  onMoveCardToHand?: (playerId: PlayerID, cardId: string, source: "deck" | "discard") => void;
  onRecoverCardsToDeckBottom?: (playerId: PlayerID, cardIdsInOrder: string[]) => void;
}

export default function PracticeBoard({
  state,
  perspective,
  onHandPrimaryAction,
  onHandDeclareAction,
  onMoveHandCardToDeckTop,
  onMoveHandCardToDeckBottom,
  onFieldClick,
  onDrawFromDeck,
  onDamageFromDeck,
  onShuffleDeck,
  onPrimaryCardAction,
  onPileCharacterDeclareAction,
  onMoveCardToHand,
  onRecoverCardsToDeckBottom,
}: PracticeBoardProps) {
  const opponent = perspective === "P1" ? "P2" : "P1";
  const [pileModalState, setPileModalState] = useState<CardPileModalState>(null);
  const [deckMenuState, setDeckMenuState] = useState<DeckMenuState>(null);
  const [cardActionState, setCardActionState] = useState<CardActionMenuState>(null);
  const [handCardActionState, setHandCardActionState] = useState<HandCardActionMenuState>(null);
  const [costModalState, setCostModalState] = useState<CostModalState>(null);
  const [recoverySelection, setRecoverySelection] = useState<string[]>([]);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [randomRecoveryPrompt, setRandomRecoveryPrompt] =
    useState<RandomRecoveryPromptState>(null);
  const [randomRecoveryResult, setRandomRecoveryResult] =
    useState<RandomRecoveryResultState>(null);

  useEffect(() => {
    const handleGlobalPointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-deck-menu-keep='true']")) return;
      setDeckMenuState(null);
      setCardActionState(null);
      setHandCardActionState(null);
    };

    window.addEventListener("mousedown", handleGlobalPointerDown);
    return () => {
      window.removeEventListener("mousedown", handleGlobalPointerDown);
    };
  }, []);

  useEffect(() => {
    if (!pileModalState || pileModalState.kind !== "discard") {
      setRecoveryMode(false);
      setRecoverySelection([]);
      return;
    }

    const discardIds = new Set(
      state.players[pileModalState.playerId].discard.map((card) => card.instanceId),
    );
    setRecoverySelection((prev) => prev.filter((id) => discardIds.has(id)));

    if (randomRecoveryPrompt?.playerId === pileModalState.playerId) {
      const discardCount = state.players[pileModalState.playerId].discard.length;
      const parsedCount = Number(randomRecoveryPrompt.value);
      if (Number.isFinite(parsedCount) && parsedCount > discardCount) {
        setRandomRecoveryPrompt((prev) =>
          prev ? { ...prev, value: String(discardCount) } : prev,
        );
      }
    }
  }, [pileModalState, randomRecoveryPrompt?.playerId, randomRecoveryPrompt?.value, state.players]);

  useEffect(() => {
    setHandCardActionState((prev) => {
      if (!prev) return prev;
      const stillExists = state.players[prev.playerId].hand.some((card) => card.instanceId === prev.cardId);
      return stillExists ? prev : null;
    });

    setCostModalState((prev) => {
      if (!prev) return prev;
      const player = state.players[prev.playerId];
      const actionCardExists = Boolean(
        findSourceCard(state, prev.playerId, prev.source, prev.cardId),
      );
      if (!actionCardExists) return null;

      const handIds = new Set(player.hand.map((card) => card.instanceId));
      const selectedCostCards = prev.selectedCostCards.filter((entry) => handIds.has(entry.cardId));
      const pendingAttributeSelection =
        prev.pendingAttributeSelection && handIds.has(prev.pendingAttributeSelection.cardId)
          ? prev.pendingAttributeSelection
          : null;

      return {
        ...prev,
        selectedCostCards,
        pendingAttributeSelection,
      };
    });
  }, [state.players]);

  const closePileModal = () => {
    setPileModalState(null);
    setCardActionState(null);
    setRecoveryMode(false);
    setRecoverySelection([]);
    setRandomRecoveryPrompt(null);
  };

  const toggleDeckMenu = (playerId: PlayerID) => {
    setDeckMenuState((prev) => (prev?.playerId === playerId ? null : { playerId }));
  };

  const handleCardClick = (kind: "deck" | "discard", playerId: PlayerID, cardId: string) => {
    if (!cardId) {
      setCardActionState(null);
      return;
    }

    setCardActionState((prev) => {
      if (prev?.kind === kind && prev.playerId === playerId && prev.cardId === cardId) {
        return null;
      }

      return { kind, playerId, cardId };
    });
    setHandCardActionState(null);
  };

  const handleHandCardClick = (playerId: PlayerID, cardId: string) => {
    setHandCardActionState((prev) => {
      if (prev?.playerId === playerId && prev.cardId === cardId) {
        return null;
      }
      return { playerId, cardId };
    });
    setCardActionState(null);
    setDeckMenuState(null);
  };

  const toggleRecoveryMode = () => {
    if (!pileModalState || pileModalState.kind !== "discard") return;

    if (recoveryMode) {
      if (recoverySelection.length > 0) {
        onRecoverCardsToDeckBottom?.(pileModalState.playerId, recoverySelection);
      }
      setRecoveryMode(false);
      setRecoverySelection([]);
      setCardActionState(null);
      return;
    }

    if (cardActionState) return;
    setRecoveryMode(true);
    setRecoverySelection([]);
  };

  const toggleRecoveryCard = (cardId: string) => {
    if (!recoveryMode) return;

    setRecoverySelection((prev) => {
      const exists = prev.includes(cardId);
      if (exists) {
        return prev.filter((id) => id !== cardId);
      }
      if (prev.length >= 60) return prev;
      return [...prev, cardId];
    });
  };

  const openRandomRecoveryPrompt = () => {
    if (!pileModalState || pileModalState.kind !== "discard") return;
    if (cardActionState || recoveryMode) return;

    setRandomRecoveryPrompt({
      playerId: pileModalState.playerId,
      value: "",
    });
  };

  const handleRandomRecoveryConfirm = () => {
    if (!pileModalState || pileModalState.kind !== "discard" || !randomRecoveryPrompt) return;

    const discardCards = state.players[pileModalState.playerId].discard;
    const recoverCount = Number(randomRecoveryPrompt.value);

    if (!Number.isInteger(recoverCount) || recoverCount <= 0 || recoverCount > discardCards.length) {
      return;
    }

    const recoveredCards = shuffleCards(discardCards).slice(0, recoverCount);
    if (recoveredCards.length === 0) return;

    onRecoverCardsToDeckBottom?.(
      pileModalState.playerId,
      recoveredCards.map((card) => card.instanceId),
    );

    setRandomRecoveryResult({
      playerId: pileModalState.playerId,
      cards: recoveredCards,
      confirmedBySelf: false,
      confirmedByOpponent: false,
    });
    closePileModal();
  };

  const confirmRandomRecoveryBySelf = () => {
    setRandomRecoveryResult((prev) => {
      if (!prev) return prev;
      const next = { ...prev, confirmedBySelf: true };
      if (next.confirmedBySelf && next.confirmedByOpponent) {
        return null;
      }
      return next;
    });
  };

  const confirmRandomRecoveryByOpponent = () => {
    setRandomRecoveryResult((prev) => {
      if (!prev) return prev;
      const next = { ...prev, confirmedByOpponent: true };
      if (next.confirmedBySelf && next.confirmedByOpponent) {
        return null;
      }
      return next;
    });
  };

  const discardCountForPrompt =
    randomRecoveryPrompt ? state.players[randomRecoveryPrompt.playerId].discard.length : 0;

  return (
    <>
      <div style={boardLayoutStyle} data-deck-menu-keep="true">
        <PlayerArea
          label={`상단 플레이어 (${opponent})`}
          playerId={opponent}
          state={state}
          isPerspectivePlayer={false}
          isDeckMenuOpen={deckMenuState?.playerId === opponent}
          activeHandCardAction={handCardActionState}
          onHandCardClick={handleHandCardClick}
          onHandPrimaryAction={(playerId, card) => {
            setCostModalState({
              playerId,
              cardId: card.instanceId,
              source: "hand",
              selectedCostCards: [],
              pendingAttributeSelection: null,
            });
            setHandCardActionState(null);
          }}
          onHandDeclareAction={(playerId, cardId) => {
            onHandDeclareAction?.(playerId, cardId);
            setHandCardActionState(null);
          }}
          onMoveHandCardToDeckTop={(playerId, cardId) => {
            onMoveHandCardToDeckTop?.(playerId, cardId);
            setHandCardActionState(null);
          }}
          onMoveHandCardToDeckBottom={(playerId, cardId) => {
            onMoveHandCardToDeckBottom?.(playerId, cardId);
            setHandCardActionState(null);
          }}
          onCloseHandCardAction={() => setHandCardActionState(null)}
          onFieldClick={onFieldClick}
          onOpenPile={(kind, playerId, label) => {
            setPileModalState({
              kind,
              playerId,
              label,
            });
            setCardActionState(null);
            setHandCardActionState(null);
            setRecoveryMode(false);
            setRecoverySelection([]);
            setRandomRecoveryPrompt(null);
          }}
          onToggleDeckMenu={toggleDeckMenu}
          onDrawFromDeck={(playerId) => onDrawFromDeck?.(playerId)}
          onDamageFromDeck={(playerId) => onDamageFromDeck?.(playerId)}
          onShuffleDeck={(playerId) => onShuffleDeck?.(playerId)}
        />
        <PlayerArea
          label={`하단 플레이어 (${perspective})`}
          playerId={perspective}
          state={state}
          isPerspectivePlayer={true}
          isDeckMenuOpen={deckMenuState?.playerId === perspective}
          activeHandCardAction={handCardActionState}
          onHandCardClick={handleHandCardClick}
          onHandPrimaryAction={(playerId, card) => {
            setCostModalState({
              playerId,
              cardId: card.instanceId,
              source: "hand",
              selectedCostCards: [],
              pendingAttributeSelection: null,
            });
            setHandCardActionState(null);
          }}
          onHandDeclareAction={(playerId, cardId) => {
            onHandDeclareAction?.(playerId, cardId);
            setHandCardActionState(null);
          }}
          onMoveHandCardToDeckTop={(playerId, cardId) => {
            onMoveHandCardToDeckTop?.(playerId, cardId);
            setHandCardActionState(null);
          }}
          onMoveHandCardToDeckBottom={(playerId, cardId) => {
            onMoveHandCardToDeckBottom?.(playerId, cardId);
            setHandCardActionState(null);
          }}
          onCloseHandCardAction={() => setHandCardActionState(null)}
          onFieldClick={onFieldClick}
          onOpenPile={(kind, playerId, label) => {
            setPileModalState({
              kind,
              playerId,
              label,
            });
            setCardActionState(null);
            setHandCardActionState(null);
            setRecoveryMode(false);
            setRecoverySelection([]);
            setRandomRecoveryPrompt(null);
          }}
          onToggleDeckMenu={toggleDeckMenu}
          onDrawFromDeck={(playerId) => onDrawFromDeck?.(playerId)}
          onDamageFromDeck={(playerId) => onDamageFromDeck?.(playerId)}
          onShuffleDeck={(playerId) => onShuffleDeck?.(playerId)}
        />
      </div>

      <CardPileModal
        gameState={state}
        state={pileModalState}
        activeCardAction={cardActionState}
        recoveryMode={recoveryMode}
        recoverySelection={recoverySelection}
        onToggleRecoveryMode={toggleRecoveryMode}
        onOpenRandomRecoveryPrompt={openRandomRecoveryPrompt}
        onToggleRecoveryCard={toggleRecoveryCard}
        onCommitRecovery={toggleRecoveryMode}
        onClose={closePileModal}
        onCardClick={handleCardClick}
        onPrimaryAction={(card, source, playerId) => {
          setCostModalState({
            playerId,
            cardId: card.instanceId,
            source,
            selectedCostCards: [],
            pendingAttributeSelection: null,
          });
          setCardActionState(null);
        }}
        onMoveToHand={(cardId, source, playerId) => {
          onMoveCardToHand?.(playerId, cardId, source);
          setCardActionState(null);
        }}
      />

      <CostPaymentModal
        state={costModalState}
        gameState={state}
        onToggleCostCard={(cardId) => {
          setCostModalState((prev) => {
            if (!prev) return prev;
            if (prev.pendingAttributeSelection) return prev;

            const exists = prev.selectedCostCards.some((entry) => entry.cardId === cardId);
            if (exists) {
              return {
                ...prev,
                selectedCostCards: prev.selectedCostCards.filter((entry) => entry.cardId !== cardId),
                pendingAttributeSelection:
                  prev.pendingAttributeSelection?.cardId === cardId
                    ? null
                    : prev.pendingAttributeSelection,
              };
            }

            const player = state.players[prev.playerId];
            const selectedCard = player.hand.find((card) => card.instanceId === cardId);
            if (!selectedCard) return prev;

            const attributeOptions = getCardCostAttributeOptions(selectedCard);
            const exValue = getCardExValue(selectedCard);

            if (attributeOptions.length <= 1 || exValue <= 0) {
              return {
                ...prev,
                selectedCostCards: [
                  ...prev.selectedCostCards,
                  buildAutoSelectedCostCardState(cardId, selectedCard),
                ],
              };
            }

            return {
              ...prev,
              pendingAttributeSelection: {
                cardId,
                pendingValues: Array.from({ length: exValue }, () => ""),
                resolvedValues: [],
              },
            };
          });
        }}
        onChoosePendingAttribute={(value) => {
          setCostModalState((prev) => {
            if (!prev?.pendingAttributeSelection) return prev;

            const pending = prev.pendingAttributeSelection;
            const nextResolvedValues = [...pending.resolvedValues, value];
            const remainingCount = Math.max(0, pending.pendingValues.length - 1);

            if (remainingCount === 0) {
              return {
                ...prev,
                selectedCostCards: [
                  ...prev.selectedCostCards,
                  {
                    cardId: pending.cardId,
                    attributes: nextResolvedValues,
                  },
                ],
                pendingAttributeSelection: null,
              };
            }

            return {
              ...prev,
              pendingAttributeSelection: {
                ...pending,
                resolvedValues: nextResolvedValues,
                pendingValues: pending.pendingValues.slice(1),
              },
            };
          });
        }}
        onCancelPendingAttributeSelection={() => {
          setCostModalState((prev) =>
            prev
              ? {
                  ...prev,
                  pendingAttributeSelection: null,
                }
              : prev,
          );
        }}
        onConfirm={() => {
          if (!costModalState) return;
          const actionCard = findSourceCard(
            state,
            costModalState.playerId,
            costModalState.source,
            costModalState.cardId,
          );
          if (!actionCard) return;

          const costCardIds = costModalState.selectedCostCards.map((entry) => entry.cardId);

          if (costModalState.source === "hand") {
            onHandPrimaryAction?.(costModalState.playerId, actionCard, costCardIds);
          } else if (actionCard.cardType === "character") {
            if (onPileCharacterDeclareAction) {
              onPileCharacterDeclareAction(
                costModalState.playerId,
                actionCard,
                costModalState.source,
                costCardIds,
              );
            } else {
              onPrimaryCardAction?.(
                costModalState.playerId,
                actionCard,
                costModalState.source,
                costCardIds,
              );
            }
          } else {
            onPrimaryCardAction?.(
              costModalState.playerId,
              actionCard,
              costModalState.source,
              costCardIds,
            );
          }

          setCostModalState(null);
        }}
        onFreeConfirm={() => {
          if (!costModalState) return;
          const actionCard = findSourceCard(
            state,
            costModalState.playerId,
            costModalState.source,
            costModalState.cardId,
          );
          if (!actionCard) return;

          const costCardIds: string[] = [];

          if (costModalState.source === "hand") {
            onHandPrimaryAction?.(costModalState.playerId, actionCard, costCardIds);
          } else if (actionCard.cardType === "character") {
            if (onPileCharacterDeclareAction) {
              onPileCharacterDeclareAction(
                costModalState.playerId,
                actionCard,
                costModalState.source,
                costCardIds,
              );
            } else {
              onPrimaryCardAction?.(
                costModalState.playerId,
                actionCard,
                costModalState.source,
                costCardIds,
              );
            }
          } else {
            onPrimaryCardAction?.(
              costModalState.playerId,
              actionCard,
              costModalState.source,
              costCardIds,
            );
          }

          setCostModalState(null);
        }}
        onCancel={() => setCostModalState(null)}
      />

      <RandomRecoveryPromptModal
        isOpen={randomRecoveryPrompt !== null}
        discardCount={discardCountForPrompt}
        value={randomRecoveryPrompt?.value ?? ""}
        onValueChange={(value) => {
          setRandomRecoveryPrompt((prev) => (prev ? { ...prev, value } : prev));
        }}
        onConfirm={handleRandomRecoveryConfirm}
        onClose={() => setRandomRecoveryPrompt(null)}
      />

      <RandomRecoveryResultModal
        isOpen={randomRecoveryResult !== null}
        selfLabel={perspective}
        opponentLabel={opponent}
        result={randomRecoveryResult}
        onConfirmSelf={confirmRandomRecoveryBySelf}
        onConfirmOpponent={confirmRandomRecoveryByOpponent}
      />
    </>
  );
}

const boardLayoutStyle: CSSProperties = {
  display: "grid",
  gap: 16,
};

const panelStyle: CSSProperties = {
  background: "#182233",
  border: "1px solid #2a3850",
  borderRadius: 12,
  padding: 16,
};

const metaRowStyle: CSSProperties = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
  color: "#b9c3d6",
};

const fieldGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(120px, 140px))",
  gap: 10,
  marginTop: 12,
  marginBottom: 16,
  alignItems: "start",
};

const sectionTitleStyle: CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  marginBottom: 10,
};

const sectionMinorTitleStyle: CSSProperties = {
  fontSize: 16,
  fontWeight: 600,
  marginTop: 10,
};

const slotTitleStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
  marginBottom: 6,
};

const slotBodyStyle: CSSProperties = {
  fontSize: 13,
  lineHeight: 1.45,
  color: "#d9e2f2",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
};

const slotButtonStyle: CSSProperties = {
  background: "#0f1724",
  border: "1px solid #33435e",
  borderRadius: 10,
  padding: 12,
  color: "#ffffff",
  textAlign: "left",
  minHeight: 110,
  cursor: "pointer",
};

const fieldSlotImageButtonStyle: CSSProperties = {
  position: "relative",
  background: "#0f1724",
  border: "1px solid #33435e",
  borderRadius: 10,
  padding: 6,
  color: "#ffffff",
  width: "100%",
  cursor: "pointer",
};

const fieldSlotTitleBadgeStyle: CSSProperties = {
  position: "absolute",
  top: 8,
  left: 8,
  zIndex: 2,
  background: "rgba(15, 23, 36, 0.86)",
  border: "1px solid rgba(148, 163, 184, 0.75)",
  borderRadius: 9999,
  padding: "3px 7px",
  fontSize: 10,
  fontWeight: 800,
  lineHeight: 1,
};

const fieldSlotImageFrameStyle: CSSProperties = {
  width: "100%",
  aspectRatio: "63 / 88",
  borderRadius: 8,
  overflow: "hidden",
  background: "#0b1220",
};

const fieldSlotImageStyle: CSSProperties = {
  display: "block",
  width: "100%",
  height: "100%",
  objectFit: "cover",
};

const fieldEmptyFrameStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#7c8aa5",
  fontSize: 12,
  fontWeight: 700,
};

const fieldMiniThumbTrayStyle: CSSProperties = {
  position: "absolute",
  right: 8,
  bottom: 8,
  display: "flex",
  gap: 6,
  zIndex: 2,
};

const fieldMiniThumbWrapStyle: CSSProperties = {
  position: "relative",
  width: 34,
  height: 48,
  borderRadius: 6,
  overflow: "hidden",
  border: "1px solid rgba(148, 163, 184, 0.82)",
  background: "rgba(15, 23, 36, 0.92)",
};

const fieldMiniThumbImageStyle: CSSProperties = {
  display: "block",
  width: "100%",
  height: "100%",
  objectFit: "cover",
};

const fieldMiniThumbFallbackStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#e5e7eb",
  fontSize: 10,
  fontWeight: 800,
};

const fieldMiniThumbLabelStyle: CSSProperties = {
  position: "absolute",
  left: 0,
  right: 0,
  bottom: 0,
  background: "rgba(15, 23, 36, 0.86)",
  color: "#ffffff",
  fontSize: 9,
  fontWeight: 800,
  lineHeight: 1.1,
  textAlign: "center",
  padding: "2px 0",
};

const pileCellButtonStyle: CSSProperties = {
  background: "#24324a",
  border: "1px solid #4a7cff",
  borderRadius: 10,
  padding: 12,
  color: "#ffffff",
  textAlign: "left",
  minHeight: 110,
  cursor: "pointer",
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
};

const pileCellTitleStyle: CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
};

const pileCellBodyStyle: CSSProperties = {
  fontSize: 13,
  color: "#dbeafe",
};

const deckPilePreviewButtonStyle: CSSProperties = {
  position: "relative",
  background: "#0f1724",
  border: "1px solid #4a7cff",
  borderRadius: 10,
  padding: 6,
  width: "100%",
  aspectRatio: "63 / 88",
  cursor: "pointer",
  overflow: "hidden",
};

const deckPilePreviewFrameStyle: CSSProperties = {
  position: "relative",
  width: "100%",
  height: "100%",
};

const deckPilePreviewCardWrapStyle: CSSProperties = {
  position: "absolute",
  width: "calc(100% - 18px)",
  height: "calc(100% - 18px)",
  borderRadius: 8,
  overflow: "hidden",
  boxShadow: "0 2px 6px rgba(0,0,0,0.35)",
  background: "#0b1220",
};

const deckPilePreviewImageStyle: CSSProperties = {
  display: "block",
  width: "100%",
  height: "100%",
  objectFit: "cover",
};

const deckPilePreviewFallbackStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  background: "#111827",
};

const deckPileEmptyFrameStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  borderRadius: 8,
  background: "#111827",
};

const pileMenuCellStyle: CSSProperties = {
  background: "#24324a",
  border: "1px solid #4a7cff",
  borderRadius: 10,
  padding: 8,
  aspectRatio: "63 / 88",
  minHeight: 0,
  display: "grid",
  gap: 6,
  alignContent: "stretch",
};

const miniActionButtonStyle: CSSProperties = {
  background: "#111827",
  border: "1px solid #3e5379",
  borderRadius: 8,
  color: "#ffffff",
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 13,
  padding: "7px 10px",
  width: "100%",
};

const handGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
  gap: 10,
  marginTop: 8,
};

const cardImageButtonStyle: CSSProperties = {
  background: "#111827",
  border: "1px solid #3e5379",
  borderRadius: 10,
  padding: 8,
  color: "#ffffff",
  textAlign: "left",
  width: "100%",
};

const cardImageFrameStyle: CSSProperties = {
  width: "100%",
  aspectRatio: "63 / 88",
  borderRadius: 8,
  overflow: "hidden",
  background: "#0b1220",
};

const cardImageStyle: CSSProperties = {
  display: "block",
  width: "100%",
  height: "100%",
  objectFit: "cover",
};

const cardImageFallbackStyle: CSSProperties = {
  width: "100%",
  height: "100%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#9ca3af",
  fontSize: 12,
};

const cardTextWrapStyle: CSSProperties = {
  marginTop: 8,
};

const cardNameStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: "#f9fafb",
  lineHeight: 1.35,
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
  wordBreak: "break-word",
};

const cardCodeStyle: CSSProperties = {
  marginTop: 4,
  fontSize: 11,
  color: "#9ca3af",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const emptyHintStyle: CSSProperties = {
  color: "#9fb0ca",
  padding: "6px 2px",
};

const modalOverlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(3, 8, 18, 0.74)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
  zIndex: 1000,
};

const costModalOverlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
  zIndex: 1200,
};

const costBackdropDimStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  background: "rgba(3, 8, 18, 0.48)",
};

const subModalOverlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(3, 8, 18, 0.58)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 24,
  zIndex: 1100,
};

const modalCardStyle: CSSProperties = {
  width: "min(1200px, 100%)",
  maxHeight: "min(88vh, 1000px)",
  overflow: "auto",
  background: "#182233",
  border: "1px solid #2a3850",
  borderRadius: 16,
  padding: 20,
  boxSizing: "border-box",
};

const costModalCardStyle: CSSProperties = {
  position: "relative",
  width: "min(1100px, 100%)",
  maxHeight: "min(88vh, 1000px)",
  overflow: "auto",
  background: "#182233",
  border: "1px solid #2a3850",
  borderRadius: 16,
  padding: 20,
  boxSizing: "border-box",
};

const subModalCardStyle: CSSProperties = {
  width: "min(420px, 100%)",
  background: "#182233",
  border: "1px solid #2a3850",
  borderRadius: 16,
  padding: 20,
  boxSizing: "border-box",
};

const resultModalCardStyle: CSSProperties = {
  width: "min(900px, 100%)",
  maxHeight: "min(88vh, 1000px)",
  overflow: "auto",
  background: "#182233",
  border: "1px solid #2a3850",
  borderRadius: 16,
  padding: 20,
  boxSizing: "border-box",
};

const modalHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 16,
  marginBottom: 16,
  flexWrap: "wrap",
};

const modalHeaderButtonsStyle: CSSProperties = {
  display: "flex",
  gap: 10,
  alignItems: "center",
  flexWrap: "wrap",
};

const modalTitleStyle: CSSProperties = {
  fontSize: 22,
  fontWeight: 700,
  color: "#ffffff",
};

const modalSubTitleStyle: CSSProperties = {
  marginTop: 4,
  color: "#b9c3d6",
};

const costModalTitleStyle: CSSProperties = {
  fontSize: 22,
  fontWeight: 700,
  color: "#ffffff",
  marginBottom: 10,
};

const costModalLineStyle: CSSProperties = {
  color: "#dbeafe",
  marginBottom: 16,
};

const costModalSectionTitleStyle: CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
  color: "#ffffff",
  marginBottom: 10,
  marginTop: 12,
};

const costSelectedGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
  gap: 12,
  minHeight: 120,
};

const costAvailableGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
  gap: 12,
};

const costFooterStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
  marginTop: 18,
};

const costFooterInfoWrapStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
  minWidth: 0,
  flex: 1,
};

const costFooterHintStyle: CSSProperties = {
  color: "#b9c3d6",
};

const costFooterSummaryStyle: CSSProperties = {
  color: "#9fb0ca",
  fontSize: 12,
  lineHeight: 1.5,
  wordBreak: "break-word",
};

const costCardStackStyle: CSSProperties = {
  position: "relative",
};

const costAttributeBadgeWrapStyle: CSSProperties = {
  position: "absolute",
  left: 8,
  right: 8,
  bottom: 8,
  display: "flex",
  flexWrap: "wrap",
  gap: 6,
  pointerEvents: "none",
};

const costAttributeBadgeStyle: CSSProperties = {
  background: "rgba(15, 23, 36, 0.74)",
  border: "1px solid rgba(147, 197, 253, 0.78)",
  borderRadius: 9999,
  color: "#ffffff",
  fontSize: 11,
  fontWeight: 700,
  lineHeight: 1,
  padding: "5px 8px",
};

const costAttributePromptOverlayStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 10,
  background: "rgba(15, 23, 36, 0.22)",
};

const costAttributePromptCardStyle: CSSProperties = {
  width: "100%",
  background: "rgba(15, 23, 36, 0.82)",
  border: "1px solid rgba(147, 197, 253, 0.78)",
  borderRadius: 12,
  padding: 10,
  boxSizing: "border-box",
  backdropFilter: "blur(1px)",
};

const costAttributePromptTitleStyle: CSSProperties = {
  color: "#ffffff",
  fontSize: 12,
  fontWeight: 800,
  marginBottom: 8,
  textAlign: "center",
};

const costAttributePromptButtonWrapStyle: CSSProperties = {
  display: "grid",
  gap: 6,
};

const costAttributePromptButtonStyle: CSSProperties = {
  background: "rgba(29, 78, 216, 0.86)",
  border: "1px solid rgba(147, 197, 253, 0.78)",
  borderRadius: 8,
  color: "#ffffff",
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 12,
  padding: "7px 8px",
  width: "100%",
};

const costAttributePromptCancelButtonStyle: CSSProperties = {
  background: "rgba(55, 65, 81, 0.86)",
  border: "1px solid rgba(156, 163, 175, 0.78)",
  borderRadius: 8,
  color: "#ffffff",
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 12,
  padding: "7px 8px",
  width: "100%",
};

const costFooterButtonsStyle: CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const subModalTitleStyle: CSSProperties = {
  fontSize: 20,
  fontWeight: 700,
  color: "#ffffff",
  marginBottom: 14,
};

const subModalHintStyle: CSSProperties = {
  color: "#b9c3d6",
  marginTop: 10,
};

const modalCloseButtonStyle: CSSProperties = {
  background: "#24324a",
  color: "#ffffff",
  border: "1px solid #3e5379",
  borderRadius: 10,
  padding: "10px 14px",
  cursor: "pointer",
  fontWeight: 700,
};

const freeConfirmButtonStyle: CSSProperties = {
  background: "#0f766e",
  color: "#ffffff",
  border: "1px solid #5eead4",
  borderRadius: 10,
  padding: "10px 14px",
  cursor: "pointer",
  fontWeight: 800,
};

const recoveryToggleButtonStyle: CSSProperties = {
  background: "#24324a",
  color: "#ffffff",
  border: "1px solid #60a5fa",
  borderRadius: 10,
  padding: "10px 14px",
  cursor: "pointer",
  fontWeight: 700,
};

const recoveryToggleActiveButtonStyle: CSSProperties = {
  background: "#1d4ed8",
  color: "#ffffff",
  border: "1px solid #93c5fd",
  borderRadius: 10,
  padding: "10px 14px",
  cursor: "pointer",
  fontWeight: 700,
};

const randomRecoveryButtonStyle: CSSProperties = {
  background: "#14532d",
  color: "#ffffff",
  border: "1px solid #86efac",
  borderRadius: 10,
  padding: "10px 14px",
  cursor: "pointer",
  fontWeight: 700,
};

const numberInputStyle: CSSProperties = {
  width: "100%",
  background: "#0f1724",
  color: "#ffffff",
  border: "1px solid #3e5379",
  borderRadius: 10,
  padding: "12px 14px",
  fontSize: 16,
  boxSizing: "border-box",
};

const subModalButtonRowStyle: CSSProperties = {
  display: "flex",
  gap: 10,
  justifyContent: "flex-end",
  marginTop: 16,
  flexWrap: "wrap",
};

const confirmButtonStyle: CSSProperties = {
  background: "#1d4ed8",
  color: "#ffffff",
  border: "1px solid #93c5fd",
  borderRadius: 10,
  padding: "10px 14px",
  cursor: "pointer",
  fontWeight: 700,
};

const disabledConfirmButtonStyle: CSSProperties = {
  ...confirmButtonStyle,
  opacity: 0.45,
  cursor: "not-allowed",
};

const confirmedButtonStyle: CSSProperties = {
  background: "#374151",
  color: "#d1d5db",
  border: "1px solid #6b7280",
  borderRadius: 10,
  padding: "10px 14px",
  cursor: "default",
  fontWeight: 700,
};

const errorMessageStyle: CSSProperties = {
  marginTop: 10,
  color: "#fca5a5",
  fontWeight: 700,
  lineHeight: 1.5,
};

const pileGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
  gap: 12,
};

const resultGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
  gap: 12,
};

const pileItemWrapStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const pileOrderStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: "#dbeafe",
  textAlign: "center",
};

const pileCardStackStyle: CSSProperties = {
  position: "relative",
};

const cardActionOverlayStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "grid",
  gridTemplateRows: "repeat(3, auto)",
  gap: 8,
  alignContent: "center",
  justifyItems: "stretch",
  padding: 10,
  boxSizing: "border-box",
};

const handCardActionOverlayStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "grid",
  gridTemplateRows: "repeat(5, auto)",
  gap: 8,
  alignContent: "center",
  justifyItems: "stretch",
  padding: 10,
  boxSizing: "border-box",
};

const cardActionButtonStyle: CSSProperties = {
  background: "rgba(15, 23, 36, 0.82)",
  border: "1px solid rgba(96, 165, 250, 0.82)",
  borderRadius: 8,
  color: "#ffffff",
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 13,
  padding: "8px 10px",
  width: "100%",
};

const cardActionCloseButtonStyle: CSSProperties = {
  background: "rgba(36, 50, 74, 0.78)",
  border: "1px solid rgba(148, 163, 184, 0.62)",
  borderRadius: 8,
  color: "#ffffff",
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 12,
  padding: "7px 10px",
  width: "100%",
};

const recoveryOrderBadgeStyle: CSSProperties = {
  position: "absolute",
  top: 8,
  right: 8,
  minWidth: 24,
  height: 24,
  borderRadius: 9999,
  background: "rgba(29, 78, 216, 0.92)",
  color: "#ffffff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 800,
  fontSize: 12,
  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.35)",
};

const recoveryFooterStyle: CSSProperties = {
  marginTop: 16,
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  flexWrap: "wrap",
};

const recoveryHintStyle: CSSProperties = {
  color: "#b9c3d6",
};

const recoveryExecuteButtonStyle: CSSProperties = {
  background: "#1d4ed8",
  color: "#ffffff",
  border: "1px solid #93c5fd",
  borderRadius: 10,
  padding: "10px 14px",
  cursor: "pointer",
  fontWeight: 700,
};

const resultConfirmRowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "flex-end",
  gap: 10,
  marginTop: 18,
  flexWrap: "wrap",
};
