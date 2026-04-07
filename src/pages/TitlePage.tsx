import { Link } from "react-router-dom";

export default function TitlePage() {
  const buttonStyle: React.CSSProperties = {
    display: "inline-block",
    width: "220px",
    padding: "14px 18px",
    borderRadius: "12px",
    background: "#4f7cff",
    color: "#ffffff",
    textDecoration: "none",
    fontWeight: 700,
    textAlign: "center",
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#2f2f2f",
        color: "#ffffff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "960px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "20px",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "40px" }}>Lycee Overture</h1>
        <p style={{ margin: 0, opacity: 0.9 }}>
          덱 편성 / 방 생성 / 방 참가
        </p>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "14px",
            marginTop: "12px",
          }}
        >
          <Link to="/deck-builder" style={buttonStyle}>
            덱 편성
          </Link>
          <Link to="/create-room" style={buttonStyle}>
            방 생성
          </Link>
          <Link to="/join-room" style={buttonStyle}>
            방 참가
          </Link>
          <Link
            to="/practice"
            style={{ ...buttonStyle, background: "#2f9e44" }}
          >
            연습 모드
          </Link>
        </div>
      </div>
    </div>
  );
}
