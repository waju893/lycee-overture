interface HandPanelProps {
  title: string;
  cardIds: string[];
  revealCards?: boolean;
}

export function HandPanel(props: HandPanelProps) {
  return (
    <div
      style={{
        border: "1px solid #2b3a55",
        borderRadius: 8,
        padding: 12,
        background: "#18263d",
        color: "#ffffff",
      }}
    >
      <strong style={{ color: "#ffffff" }}>{props.title}</strong>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
        {props.cardIds.length === 0 && (
          <span style={{ color: "#ffffff" }}>손패 없음</span>
        )}

        {props.cardIds.map((cardId) => (
          <div
            key={cardId}
            style={{
              minWidth: 72,
              padding: 8,
              border: "1px solid #2b3a55",
              borderRadius: 6,
              background: "#24395c",
              color: "#ffffff",
              textAlign: "center",
            }}
          >
            {props.revealCards ? cardId : "비공개"}
          </div>
        ))}
      </div>
    </div>
  );
}