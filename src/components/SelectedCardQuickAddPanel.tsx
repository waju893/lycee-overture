import type { CSSProperties } from "react";
import type { CardMeta } from "../types/card";

interface SelectedCardQuickAddPanelProps {
  selectedCard: CardMeta | null;
  onAddOne: () => void;
  onAddFour: () => void;
  validationMessage?: string;
}

export default function SelectedCardQuickAddPanel({
  selectedCard,
  onAddOne,
  onAddFour,
  validationMessage,
}: SelectedCardQuickAddPanelProps) {
  return (
    <div className="detail-panel" style={panelStyle}>
      <button type="button" className="filter-select" onClick={onAddOne} disabled={!selectedCard}>
        선택 카드 +1
      </button>
      <button type="button" className="filter-select" onClick={onAddFour} disabled={!selectedCard}>
        선택 카드 +4
      </button>
      <div style={selectedTextStyle}>현재 선택: {selectedCard ? selectedCard.code : "없음"}</div>
      {validationMessage ? <div style={errorTextStyle}>{validationMessage}</div> : null}
    </div>
  );
}

const panelStyle: CSSProperties = {
  padding: "12px",
  display: "flex",
  flexWrap: "wrap",
  gap: "8px",
};

const selectedTextStyle: CSSProperties = {
  alignSelf: "center",
  color: "#9ca3af",
  fontSize: "13px",
};

const errorTextStyle: CSSProperties = {
  width: "100%",
  color: "#fca5a5",
  fontSize: "13px",
};
