interface FieldCardView {
  id: string;
  lane?: number | null;
  isTapped?: boolean;
}

interface FieldRowProps {
  title: string;
  cards: FieldCardView[];
}

export function FieldRow(props: FieldRowProps) {
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
        {props.cards.length === 0 && (
          <span style={{ color: "#ffffff" }}>필드 비어 있음</span>
        )}

        {props.cards.map((card) => (
          <div
            key={card.id}
            style={{
              minWidth: 88,
              padding: 8,
              border: "1px solid #2b3a55",
              borderRadius: 6,
              background: "#24395c",
              color: "#ffffff",
            }}
          >
            <div>{card.id}</div>
            <div style={{ fontSize: 12, marginTop: 4, color: "#ffffff" }}>
              lane: {card.lane ?? "-"}
            </div>
            <div style={{ fontSize: 12, color: "#ffffff" }}>
              {card.isTapped ? "행동 완료" : "미행동"}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}