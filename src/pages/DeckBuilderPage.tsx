import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import "../App.css";
import { CARD_META } from "../lib/cards";
import type { CardMeta } from "../types/card";
import CardGrid from "../components/CardGrid";
import CardDetailPanel from "../components/CardDetailPanel";
import {
  mergeDeckEntries,
  removeCardFromDeck,
  summarizeDeck,
} from "../lib/deck";
import type { DeckEntry } from "../lib/deck";
import { canAddCard, validateDeck } from "../lib/deckRules";

const ALL_ATTRIBUTES = "ALL";
const ALL_TYPES = "ALL";
const ALL_KEYEFFECTS = "ALL";
const CARDS_PER_PAGE = 24;

const DETAIL_FIXED_WIDTH = 500;
const MAIN_GAP = 20;
const MAIN_SIDE_BUFFER = 60;

const ATTRIBUTE_DISPLAY_LABELS: Record<string, string> = {
  snow: "설",
  moon: "월",
  flower: "화",
  cosmos: "주",
  sun: "일",
  star: "무",
};

const ATTRIBUTE_ORDER: Record<string, number> = {
  snow: 0,
  moon: 1,
  flower: 2,
  cosmos: 3,
  sun: 4,
  star: 5,
};

const TYPE_DISPLAY_LABELS: Record<string, string> = {
  character: "캐릭터",
  event: "이벤트",
  item: "아이템",
  area: "에리어",
};

const TYPE_ORDER: Record<string, number> = {
  character: 0,
  event: 1,
  item: 2,
  area: 3,
};

const KEY_EFFECT_CODE_LABELS: Record<number, string> = {
  2: "step",
  3: "sidestep",
  4: "order step",
  5: "jump",
  6: "aggressive",
  7: "engage",
  8: "assist",
  9: "order change",
  10: "recovery",
  11: "leader",
  12: "supporter",
  13: "penalty",
  14: "gots",
  15: "bonus",
  16: "charge",
  17: "turn recovery",
  18: "surprise",
  19: "principal",
  20: "convert",
};

const KEY_EFFECT_DISPLAY_LABELS: Record<number, string> = {
  2: "스텝",
  3: "사이드스텝",
  4: "오더 스텝",
  5: "점프",
  6: "어그레시브",
  7: "인게이지",
  8: "어시스트",
  9: "오더 체인지",
  10: "리커버리",
  11: "리더",
  12: "서포터",
  13: "페널티",
  14: "갓츠",
  15: "보너스",
  16: "차지",
  17: "턴 리커버리",
  18: "서프라이즈",
  19: "프린시펄",
  20: "컨버트",
};

const CURRENT_DECK_STORAGE_KEY = "lycee-current-deck";
const CURRENT_DECK_NAME_STORAGE_KEY = "lycee-current-deck-name";
const SAVED_DECKS_STORAGE_KEY = "lycee-saved-decks";

function sanitizeNaturalNumberInput(value: string): string {
  return value.replace(/[^\d]/g, "");
}

function parseNaturalNumber(value: string): number | null {
  if (value.trim() === "") return null;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0) return null;
  return n;
}

function normalizeAttributeValue(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeTypeValue(value: string): string {
  return value.trim().toLowerCase();
}

function getAttributeDisplayLabel(value: string): string {
  const normalized = normalizeAttributeValue(value);
  return ATTRIBUTE_DISPLAY_LABELS[normalized] ?? value;
}

function getTypeDisplayLabel(value: string): string {
  const normalized = normalizeTypeValue(value);
  return TYPE_DISPLAY_LABELS[normalized] ?? value;
}

function sortAttributesForDisplay(values: string[]): string[] {
  return [...values].sort((a, b) => {
    const aKey = normalizeAttributeValue(a);
    const bKey = normalizeAttributeValue(b);

    const aOrder = ATTRIBUTE_ORDER[aKey] ?? Number.MAX_SAFE_INTEGER;
    const bOrder = ATTRIBUTE_ORDER[bKey] ?? Number.MAX_SAFE_INTEGER;

    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.localeCompare(b);
  });
}

function sortTypesForDisplay(values: string[]): string[] {
  return [...values].sort((a, b) => {
    const aKey = normalizeTypeValue(a);
    const bKey = normalizeTypeValue(b);

    const aOrder = TYPE_ORDER[aKey] ?? Number.MAX_SAFE_INTEGER;
    const bOrder = TYPE_ORDER[bKey] ?? Number.MAX_SAFE_INTEGER;

    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.localeCompare(b);
  });
}

function getUseTargetCostValue(useTarget?: CardMeta["useTarget"]): number {
  if (useTarget === 0 || useTarget == null) return 0;

  if (Array.isArray(useTarget)) {
    return useTarget.length;
  }

  if (typeof useTarget === "string") {
    const cleaned = useTarget.replace(/\s+/g, "").replace(/[\/,，・]/g, "");
    if (!cleaned || cleaned === "0") return 0;
    return cleaned.length;
  }

  return 0;
}

function normalizeUseTargetLabel(useTarget?: CardMeta["useTarget"]): string {
  if (useTarget === 0 || useTarget == null) return "0";

  if (Array.isArray(useTarget)) {
    if (useTarget.length === 0) return "0";
    return useTarget.join(" / ");
  }

  const text = String(useTarget).trim();
  return text || "0";
}

function readDeckEntriesFromStorage(key: string): DeckEntry[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return mergeDeckEntries(
      parsed
        .filter((item) => item && typeof item === "object")
        .map((item) => ({
          code: String((item as DeckEntry).code ?? ""),
          qty: Number((item as DeckEntry).qty ?? 0),
        }))
    );
  } catch {
    return [];
  }
}

function readSavedDecksFromStorage(): Record<string, DeckEntry[]> {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(SAVED_DECKS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};

    const result: Record<string, DeckEntry[]> = {};
    for (const [name, entries] of Object.entries(parsed)) {
      if (!Array.isArray(entries)) continue;
      result[name] = mergeDeckEntries(
        entries
          .filter((item) => item && typeof item === "object")
          .map((item) => ({
            code: String((item as DeckEntry).code ?? ""),
            qty: Number((item as DeckEntry).qty ?? 0),
          }))
      );
    }
    return result;
  } catch {
    return {};
  }
}

function readDeckNameFromStorage(): string {
  if (typeof window === "undefined") return "내 덱";

  try {
    const raw = window.localStorage.getItem(CURRENT_DECK_NAME_STORAGE_KEY);
    return raw?.trim() || "내 덱";
  } catch {
    return "내 덱";
  }
}

function preloadImagePair(code: string) {
  const img = new Image();
  img.decoding = "async";
  img.src = `/cards/${code}.webp`;
  img.onerror = () => {
    const pngImg = new Image();
    pngImg.decoding = "async";
    pngImg.src = `/cards/${code}.png`;
  };
}

type NaturalNumberInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
};

function NaturalNumberInput({
  value,
  onChange,
  placeholder,
}: NaturalNumberInputProps) {
  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(sanitizeNaturalNumberInput(e.target.value))}
      className="filter-select"
    />
  );
}

export default function DeckBuilderPage() {
  const [search, setSearch] = useState("");
  const [attributeFilter, setAttributeFilter] = useState(ALL_ATTRIBUTES);
  const [typeFilter, setTypeFilter] = useState(ALL_TYPES);
  const [keyeffectFilter, setKeyeffectFilter] = useState(ALL_KEYEFFECTS);

  const [minEx, setMinEx] = useState("");
  const [minAp, setMinAp] = useState("");
  const [minDp, setMinDp] = useState("");
  const [minSp, setMinSp] = useState("");
  const [minDmg, setMinDmg] = useState("");

  const [minUseTargetCost, setMinUseTargetCost] = useState("");
  const [maxUseTargetCost, setMaxUseTargetCost] = useState("");

  const [selectedCard, setSelectedCard] = useState<CardMeta | null>(
    CARD_META[0] ?? null
  );

  const [deckEntries, setDeckEntries] = useState<DeckEntry[]>(() =>
    readDeckEntriesFromStorage(CURRENT_DECK_STORAGE_KEY)
  );
  const [deckName, setDeckName] = useState<string>(() => readDeckNameFromStorage());
  const [savedDecks, setSavedDecks] = useState<Record<string, DeckEntry[]>>(() =>
    readSavedDecksFromStorage()
  );
  const [selectedSavedDeck, setSelectedSavedDeck] = useState<string>("");
  const [clickToAddMode, setClickToAddMode] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [windowWidth, setWindowWidth] = useState<number>(
    typeof window !== "undefined" ? window.innerWidth : 1600
  );
  const [deckActionMessage, setDeckActionMessage] = useState<string>("");
  const [isDetailCollapsed, setIsDetailCollapsed] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const onResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
    };
  }, []);

  const cardByCode = useMemo(() => {
    return Object.fromEntries(
      CARD_META.map((card) => [card.code.toUpperCase(), card])
    );
  }, []);

  const attributes = useMemo(() => {
    const values = Array.from(
      new Set(
        CARD_META.flatMap((card) =>
          Array.isArray(card.attributesList) ? card.attributesList : []
        )
      )
    )
      .filter(Boolean)
      .map((value) => String(value));

    return [ALL_ATTRIBUTES, ...sortAttributesForDisplay(values)];
  }, []);

  const types = useMemo(() => {
    const values = Array.from(
      new Set(CARD_META.map((card) => card.type).filter(Boolean))
    ) as string[];

    return [ALL_TYPES, ...sortTypesForDisplay(values)];
  }, []);

  const keyeffects = useMemo(() => {
    const values = Array.from(
      new Set(
        CARD_META.flatMap((card) => {
          const base = card.keyEffects ?? card.keyeffects ?? [];
          const leaderEffect = card.leader ? [11] : [];
          return [...base, ...leaderEffect];
        })
      )
    ).sort((a, b) => a - b);

    return [ALL_KEYEFFECTS, ...values.map(String)];
  }, []);

  const filteredCards = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    const exMin = parseNaturalNumber(minEx);
    const apMin = parseNaturalNumber(minAp);
    const dpMin = parseNaturalNumber(minDp);
    const spMin = parseNaturalNumber(minSp);
    const dmgMin = parseNaturalNumber(minDmg);

    const useTargetCostMin = parseNaturalNumber(minUseTargetCost);
    const useTargetCostMax = parseNaturalNumber(maxUseTargetCost);

    const selectedKeyeffect =
      keyeffectFilter === ALL_KEYEFFECTS ? null : Number(keyeffectFilter);

    return CARD_META.filter((card) => {
      const useTargetCost = getUseTargetCostValue(card.useTarget);
      const effects = [
        ...(card.keyEffects ?? card.keyeffects ?? []),
        ...(card.leader ? [11] : []),
      ];
      const cardAttributes = Array.isArray(card.attributesList)
        ? card.attributesList.map((v) => String(v).toLowerCase())
        : [];

      const matchesSearch =
        keyword.length === 0 ||
        card.name.toLowerCase().includes(keyword) ||
        card.code.toLowerCase().includes(keyword) ||
        (card.kana ?? "").toLowerCase().includes(keyword) ||
        normalizeUseTargetLabel(card.useTarget).toLowerCase().includes(keyword) ||
        cardAttributes.some((attr) => attr.includes(keyword));

      const matchesAttribute =
        attributeFilter === ALL_ATTRIBUTES ||
        cardAttributes.includes(attributeFilter.toLowerCase());

      const matchesType = typeFilter === ALL_TYPES || card.type === typeFilter;

      const matchesKeyeffect =
        selectedKeyeffect == null || effects.includes(selectedKeyeffect);

      const matchesEx =
        exMin == null || (card.ex ?? Number.NEGATIVE_INFINITY) >= exMin;

      const matchesAp =
        apMin == null || (card.ap ?? Number.NEGATIVE_INFINITY) >= apMin;

      const matchesDp =
        dpMin == null || (card.dp ?? Number.NEGATIVE_INFINITY) >= dpMin;

      const matchesSp =
        spMin == null || (card.sp ?? Number.NEGATIVE_INFINITY) >= spMin;

      const matchesDmg =
        dmgMin == null || (card.dmg ?? Number.NEGATIVE_INFINITY) >= dmgMin;

      const matchesUseTargetCostMin =
        useTargetCostMin == null || useTargetCost >= useTargetCostMin;

      const matchesUseTargetCostMax =
        useTargetCostMax == null || useTargetCost <= useTargetCostMax;

      return (
        matchesSearch &&
        matchesAttribute &&
        matchesType &&
        matchesKeyeffect &&
        matchesEx &&
        matchesAp &&
        matchesDp &&
        matchesSp &&
        matchesDmg &&
        matchesUseTargetCostMin &&
        matchesUseTargetCostMax
      );
    });
  }, [
    search,
    attributeFilter,
    typeFilter,
    keyeffectFilter,
    minEx,
    minAp,
    minDp,
    minSp,
    minDmg,
    minUseTargetCost,
    maxUseTargetCost,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredCards.length / CARDS_PER_PAGE));

  const pagedCards = useMemo(() => {
    const start = (currentPage - 1) * CARDS_PER_PAGE;
    return filteredCards.slice(start, start + CARDS_PER_PAGE);
  }, [filteredCards, currentPage]);

  const nextPageCards = useMemo(() => {
    const start = currentPage * CARDS_PER_PAGE;
    return filteredCards.slice(start, start + CARDS_PER_PAGE);
  }, [filteredCards, currentPage]);

  const deckSummary = useMemo(() => summarizeDeck(deckEntries), [deckEntries]);
  const deckValidation = useMemo(() => validateDeck(deckEntries), [deckEntries]);

  const selectedCardAddPreview = useMemo(() => {
    if (!selectedCard) return null;
    return canAddCard(deckEntries, selectedCard.code, 1);
  }, [deckEntries, selectedCard]);

  const savedDeckNames = useMemo(() => {
    return Object.keys(savedDecks).sort((a, b) => a.localeCompare(b));
  }, [savedDecks]);

  const shouldUseEqualColumns =
    windowWidth <= DETAIL_FIXED_WIDTH * 2 + MAIN_GAP + MAIN_SIDE_BUFFER;

  const mainGridColumns = shouldUseEqualColumns
    ? "minmax(0, 1fr) minmax(0, 1fr)"
    : `minmax(0, 1fr) ${DETAIL_FIXED_WIDTH}px`;

  useEffect(() => {
    setCurrentPage(1);
  }, [
    search,
    attributeFilter,
    typeFilter,
    keyeffectFilter,
    minEx,
    minAp,
    minDp,
    minSp,
    minDmg,
    minUseTargetCost,
    maxUseTargetCost,
  ]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (pagedCards.length === 0) {
      setSelectedCard(null);
      return;
    }

    if (!selectedCard) {
      setSelectedCard(pagedCards[0]);
      return;
    }

    const stillExists = filteredCards.some((card) => card.id === selectedCard.id);
    if (!stillExists) {
      setSelectedCard(pagedCards[0]);
    }
  }, [pagedCards, filteredCards, selectedCard]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      CURRENT_DECK_STORAGE_KEY,
      JSON.stringify(mergeDeckEntries(deckEntries))
    );
  }, [deckEntries]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(CURRENT_DECK_NAME_STORAGE_KEY, deckName);
  }, [deckName]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SAVED_DECKS_STORAGE_KEY, JSON.stringify(savedDecks));
  }, [savedDecks]);

  useEffect(() => {
    if (!deckActionMessage) return;

    const timer = window.setTimeout(() => {
      setDeckActionMessage("");
    }, 2500);

    return () => {
      window.clearTimeout(timer);
    };
  }, [deckActionMessage]);

  useEffect(() => {
    const preloadTargets = [...pagedCards, ...nextPageCards];
    const seen = new Set<string>();

    preloadTargets.forEach((card, index) => {
      if (!card?.code) return;
      const code = card.code.toUpperCase();
      if (seen.has(code)) return;
      seen.add(code);

      if (index < 16) {
        preloadImagePair(code);
      }
    });
  }, [pagedCards, nextPageCards]);

  useEffect(() => {
    if (!selectedCard?.code) return;
    preloadImagePair(selectedCard.code.toUpperCase());
  }, [selectedCard]);

  const tryAddCardToDeck = (
    code: string,
    qty: number,
    options?: { clearMessageOnSuccess?: boolean }
  ) => {
    const result = canAddCard(deckEntries, code, qty);

    if (!result.ok) {
      setDeckActionMessage(
        result.issues[0]?.message ?? "덱 규칙 위반으로 추가할 수 없습니다."
      );
      return false;
    }

    setDeckEntries(result.nextEntries);

    if (options?.clearMessageOnSuccess !== false) {
      setDeckActionMessage("");
    }

    return true;
  };

  const handleSelectCard = (card: CardMeta) => {
    setSelectedCard(card);
    preloadImagePair(card.code.toUpperCase());

    if (clickToAddMode) {
      tryAddCardToDeck(card.code, 1, { clearMessageOnSuccess: true });
    }
  };

  const handleResetFilters = () => {
    setSearch("");
    setAttributeFilter(ALL_ATTRIBUTES);
    setTypeFilter(ALL_TYPES);
    setKeyeffectFilter(ALL_KEYEFFECTS);
    setMinEx("");
    setMinAp("");
    setMinDp("");
    setMinSp("");
    setMinDmg("");
    setMinUseTargetCost("");
    setMaxUseTargetCost("");
    setCurrentPage(1);
  };

  const handleAddSelectedCard = (qty: number) => {
    if (!selectedCard) return;
    tryAddCardToDeck(selectedCard.code, qty, { clearMessageOnSuccess: true });
  };

  const handleDeckEntryIncrease = (code: string) => {
    tryAddCardToDeck(code, 1, { clearMessageOnSuccess: true });
  };

  const handleDeckEntryDecrease = (code: string) => {
    setDeckEntries((prev) => removeCardFromDeck(prev, code, 1));
    setDeckActionMessage("");
  };

  const handleDeckEntryRemove = (code: string) => {
    const target = deckEntries.find(
      (entry) => entry.code.toUpperCase() === code.toUpperCase()
    );
    if (!target) return;
    setDeckEntries((prev) => removeCardFromDeck(prev, code, target.qty));
    setDeckActionMessage("");
  };

  const handleClearDeck = () => {
    setDeckEntries([]);
    setDeckActionMessage("");
  };

  const handleSaveDeck = () => {
    if (!deckValidation.isValid) {
      setDeckActionMessage(
        deckValidation.issues[0]?.message ?? "유효하지 않은 덱은 저장할 수 없습니다."
      );
      return;
    }

    const trimmedName = deckName.trim() || "내 덱";
    setSavedDecks((prev) => ({
      ...prev,
      [trimmedName]: mergeDeckEntries(deckEntries),
    }));
    setDeckName(trimmedName);
    setSelectedSavedDeck(trimmedName);
    setDeckActionMessage(`덱 저장 완료: ${trimmedName}`);
  };

  const handleLoadDeck = () => {
    if (!selectedSavedDeck || !savedDecks[selectedSavedDeck]) return;
    setDeckEntries(mergeDeckEntries(savedDecks[selectedSavedDeck]));
    setDeckName(selectedSavedDeck);
    setDeckActionMessage("");
  };

  const handleDeleteSavedDeck = () => {
    if (!selectedSavedDeck) return;

    setSavedDecks((prev) => {
      const next = { ...prev };
      delete next[selectedSavedDeck];
      return next;
    });

    if (deckName === selectedSavedDeck) {
      setDeckName("내 덱");
    }

    setSelectedSavedDeck("");
    setDeckActionMessage("");
  };

  return (
    <div
      className="app-shell"
      style={{
        minHeight: "100vh",
        width: "calc(100vw - 24px)",
        maxWidth: "none",
        margin: "0 auto",
        overflowY: "auto",
        overflowX: "hidden",
      }}
    >
      <style>{`
        .app-shell {
          max-width: none !important;
        }

        .main-layout {
          width: 100% !important;
        }

        .left-panel .card-grid {
          grid-template-columns: repeat(4, minmax(180px, 1fr)) !important;
        }

        @media (max-width: 1500px) {
          .left-panel .card-grid {
            grid-template-columns: repeat(3, minmax(180px, 1fr)) !important;
          }
        }

        @media (max-width: 1180px) {
          .left-panel .card-grid {
            grid-template-columns: repeat(2, minmax(180px, 1fr)) !important;
          }
        }
      `}</style>

      <header className="topbar">
        <div
          style={{
            display: "flex",
            gap: "12px",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1>Lycee Card Database</h1>
            <p className="subtitle">
              카드 검색 + 다중 속성 필터 + 기본능력 + 능력치/코스트 필터 + 덱 빌더
            </p>
          </div>

          <Link
            to="/"
            className="filter-select"
            style={{
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 700,
            }}
          >
            타이틀로
          </Link>
        </div>
      </header>

      <section className="toolbar">
        <input
          type="text"
          placeholder="카드명 / 코드 / 대상 / 속성 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="search-input"
        />

        <select
          value={attributeFilter}
          onChange={(e) => setAttributeFilter(e.target.value)}
          className="filter-select"
        >
          {attributes.map((attribute) => (
            <option key={attribute} value={attribute}>
              {attribute === ALL_ATTRIBUTES
                ? "모든 속성"
                : getAttributeDisplayLabel(attribute)}
            </option>
          ))}
        </select>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="filter-select"
        >
          {types.map((type) => (
            <option key={type} value={type}>
              {type === ALL_TYPES ? "모든 타입" : getTypeDisplayLabel(type)}
            </option>
          ))}
        </select>

        <select
          value={keyeffectFilter}
          onChange={(e) => setKeyeffectFilter(e.target.value)}
          className="filter-select"
        >
          {keyeffects.map((value) => {
            if (value === ALL_KEYEFFECTS) {
              return (
                <option key={value} value={value}>
                  모든 기본능력
                </option>
              );
            }

            const n = Number(value);

            return (
              <option key={value} value={value}>
                {KEY_EFFECT_DISPLAY_LABELS[n] ??
                  KEY_EFFECT_CODE_LABELS[n] ??
                  "미정의"}
              </option>
            );
          })}
        </select>

        <NaturalNumberInput value={minEx} onChange={setMinEx} placeholder="EX" />
        <NaturalNumberInput value={minAp} onChange={setMinAp} placeholder="AP" />
        <NaturalNumberInput value={minDp} onChange={setMinDp} placeholder="DP" />
        <NaturalNumberInput value={minSp} onChange={setMinSp} placeholder="SP" />
        <NaturalNumberInput value={minDmg} onChange={setMinDmg} placeholder="DMG" />

        <NaturalNumberInput
          value={minUseTargetCost}
          onChange={setMinUseTargetCost}
          placeholder="코스트 이상"
        />

        <NaturalNumberInput
          value={maxUseTargetCost}
          onChange={setMaxUseTargetCost}
          placeholder="코스트 이하"
        />

        <button
          type="button"
          onClick={handleResetFilters}
          className="filter-select"
        >
          필터 초기화
        </button>
      </section>

      <main
        className="main-layout"
        style={{
          display: "grid",
          gridTemplateColumns: mainGridColumns,
          gap: `${MAIN_GAP}px`,
          alignItems: "start",
          width: "100%",
        }}
      >
        <section
          className="left-panel"
          style={{
            display: "flex",
            flexDirection: "column",
            minHeight: "1220px",
            overflow: "hidden",
            minWidth: 0,
          }}
        >
          <div className="panel-header">
            <h2>카드 목록</h2>
            <div
              style={{
                display: "flex",
                gap: "8px",
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <span className="count-badge">{filteredCards.length}장</span>
              <span className="count-badge">
                {currentPage} / {totalPages} 페이지
              </span>
              <label
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "13px",
                  color: "#d1d5db",
                }}
              >
                <input
                  type="checkbox"
                  checked={clickToAddMode}
                  onChange={(e) => setClickToAddMode(e.target.checked)}
                />
                카드 클릭 시 덱에 +1
              </label>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: "8px",
              marginBottom: "10px",
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              className="filter-select"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
            >
              처음
            </button>
            <button
              type="button"
              className="filter-select"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              이전 페이지
            </button>
            <button
              type="button"
              className="filter-select"
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              다음 페이지
            </button>
            <button
              type="button"
              className="filter-select"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
            >
              마지막
            </button>
          </div>

          <div
            style={{
              flex: 1,
              minHeight: 0,
              maxHeight: "1080px",
              overflowY: "scroll",
              overflowX: "hidden",
              paddingRight: "8px",
              scrollbarWidth: "auto",
            }}
          >
            <CardGrid
              cards={pagedCards}
              selectedCardId={selectedCard?.id}
              onSelect={handleSelectCard}
            />
          </div>
        </section>

        <section
          style={{
            minWidth: 0,
            width: "100%",
            display: "grid",
            gridTemplateRows: "auto auto",
            gap: "16px",
            alignItems: "start",
          }}
        >
          <section
            style={{
              minWidth: 0,
              width: "100%",
              overflow: "visible",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            <CardDetailPanel
              card={selectedCard}
              isCollapsed={isDetailCollapsed}
              onToggleCollapse={() => setIsDetailCollapsed((prev) => !prev)}
              quickAdd={{
                onAddOne: () => handleAddSelectedCard(1),
                onAddFour: () => handleAddSelectedCard(4),
                selectedCode: selectedCard?.code,
                disabled: !selectedCard,
                validationMessage:
                  selectedCardAddPreview && !selectedCardAddPreview.ok
                    ? selectedCardAddPreview.issues[0]?.message
                    : undefined,
              }}
            />

          </section>

          <section
            className="detail-panel"
            style={{
              minWidth: 0,
              width: "100%",
              overflow: "visible",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              className="panel-header"
              style={{
                marginBottom: "12px",
                alignItems: "center",
              }}
            >
              <h2>덱 빌더</h2>
            </div>

            {deckActionMessage && (
              <div
                style={{
                  marginBottom: "12px",
                  padding: "10px 12px",
                  borderRadius: "10px",
                  border: "1px solid #7f1d1d",
                  background: "rgba(127, 29, 29, 0.28)",
                  color: "#fecaca",
                  fontSize: "13px",
                }}
              >
                {deckActionMessage}
              </div>
            )}

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: "8px",
                marginBottom: "10px",
                alignItems: "center",
              }}
            >
              <input
                type="text"
                value={deckName}
                onChange={(e) => setDeckName(e.target.value)}
                placeholder="덱 이름"
                className="search-input"
                style={{ minWidth: 0 }}
              />
              <span className="count-badge">{deckSummary.totalCards}장</span>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: "8px",
                marginBottom: "10px",
              }}
            >
              <button type="button" className="filter-select" onClick={handleSaveDeck}>
                저장
              </button>
              <button type="button" className="filter-select" onClick={handleLoadDeck}>
                불러오기
              </button>
              <button type="button" className="filter-select" onClick={handleClearDeck}>
                전체 삭제
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: "8px",
                marginBottom: "12px",
              }}
            >
              <select
                value={selectedSavedDeck}
                onChange={(e) => setSelectedSavedDeck(e.target.value)}
                className="filter-select"
                style={{ minWidth: 0 }}
              >
                <option value="">저장된 덱 선택</option>
                {savedDeckNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>

              <button
                type="button"
                className="filter-select"
                onClick={handleDeleteSavedDeck}
                disabled={!selectedSavedDeck}
              >
                저장본 삭제
              </button>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: "8px",
                marginBottom: "12px",
              }}
            >
              <div className="detail-meta-item">
                <span className="label">총 카드</span>
                <span className="value">{deckSummary.totalCards}</span>
              </div>
              <div className="detail-meta-item">
                <span className="label">총 EX</span>
                <span className="value">{deckSummary.totalEx}</span>
              </div>
              <div className="detail-meta-item">
                <span className="label">평균 AP</span>
                <span className="value">{deckSummary.averageAp.toFixed(2)}</span>
              </div>
              <div className="detail-meta-item">
                <span className="label">평균 DP</span>
                <span className="value">{deckSummary.averageDp.toFixed(2)}</span>
              </div>
              <div className="detail-meta-item">
                <span className="label">평균 SP</span>
                <span className="value">{deckSummary.averageSp.toFixed(2)}</span>
              </div>
              <div className="detail-meta-item">
                <span className="label">평균 DMG</span>
                <span className="value">{deckSummary.averageDmg.toFixed(2)}</span>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                gap: "12px",
                flexWrap: "wrap",
                marginBottom: "12px",
                color: "#d1d5db",
                fontSize: "13px",
              }}
            >
              <span>
                타입:{" "}
                {sortTypesForDisplay(Object.keys(deckSummary.byType))
                  .map((key) => `${getTypeDisplayLabel(key)} ${deckSummary.byType[key]}`)
                  .join(" / ") || "없음"}
              </span>
              <span>
                속성:{" "}
                {sortAttributesForDisplay(Object.keys(deckSummary.byAttribute))
                  .map(
                    (key) =>
                      `${getAttributeDisplayLabel(key)} ${deckSummary.byAttribute[key]}`
                  )
                  .join(" / ") || "없음"}
              </span>
            </div>

            <div
              style={{
                marginBottom: "12px",
                padding: "10px 12px",
                borderRadius: "12px",
                border: `1px solid ${deckValidation.isValid ? "#14532d" : "#7f1d1d"}`,
                background: deckValidation.isValid
                  ? "rgba(20, 83, 45, 0.28)"
                  : "rgba(127, 29, 29, 0.28)",
                color: deckValidation.isValid ? "#bbf7d0" : "#fecaca",
                fontSize: "13px",
              }}
            >
              <div
                style={{
                  fontWeight: 700,
                  marginBottom: deckValidation.isValid ? 0 : "8px",
                }}
              >
                {deckValidation.isValid
                  ? "덱 규칙 검사 통과"
                  : `덱 규칙 위반 ${deckValidation.issues.length}건`}
              </div>

              {!deckValidation.isValid && (
                <ul style={{ margin: 0, paddingLeft: "18px" }}>
                  {deckValidation.issues.map((issue, index) => (
                    <li key={`${issue.code}-${issue.cardCode ?? "deck"}-${index}`}>
                      {issue.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                borderTop: "1px solid #374151",
                paddingTop: "10px",
              }}
            >
              {deckEntries.length === 0 ? (
                <div className="empty-state">덱이 비어 있습니다.</div>
              ) : (
                deckEntries.map((entry) => {
                  const code = entry.code.toUpperCase();
                  const card = cardByCode[code];

                  return (
                    <div
                      key={code}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr auto auto auto auto",
                        gap: "8px",
                        alignItems: "center",
                        padding: "8px 10px",
                        border: "1px solid #374151",
                        borderRadius: "10px",
                        background: "#111827",
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: 700,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {card?.name ?? code}
                        </div>
                        <div style={{ fontSize: "12px", color: "#9ca3af" }}>{code}</div>
                      </div>

                      <span className="count-badge">x{entry.qty}</span>

                      <button
                        type="button"
                        className="filter-select"
                        style={{ minWidth: "42px", padding: "8px 10px" }}
                        onClick={() => handleDeckEntryIncrease(code)}
                      >
                        +
                      </button>

                      <button
                        type="button"
                        className="filter-select"
                        style={{ minWidth: "42px", padding: "8px 10px" }}
                        onClick={() => handleDeckEntryDecrease(code)}
                      >
                        -
                      </button>

                      <button
                        type="button"
                        className="filter-select"
                        style={{ padding: "8px 10px" }}
                        onClick={() => handleDeckEntryRemove(code)}
                      >
                        제거
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </section>
      </main>
    </div>
  );
}
