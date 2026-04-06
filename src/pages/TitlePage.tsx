import { Link } from "react-router-dom";

const buttonStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "68px",
  borderRadius: "16px",
  border: "1px solid #374151",
  background: "#1f2937",
  color: "#f9fafb",
  fontSize: "20px",
  fontWeight: 700,
  textDecoration: "none",
  boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
};

export default function TitlePage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #111827 0%, #0f172a 100%)",
        color: "#f3f4f6",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "720px",
          background: "rgba(31, 41, 55, 0.92)",
          border: "1px solid #374151",
          borderRadius: "24px",
          padding: "40px 32px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <h1 style={{ margin: 0, fontSize: "40px" }}>Lycee Overture</h1>
          <p style={{ margin: "12px 0 0", color: "#9ca3af", fontSize: "16px" }}>
            메인 메뉴
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gap: "16px",
          }}
        >
          <Link to="/deck" style={buttonStyle}>
            덱 편성
          </Link>

          <Link to="/room/create" style={buttonStyle}>
            방 생성
          </Link>

          <Link to="/room/join" style={buttonStyle}>
            방 참가
          </Link>
        </div>
      </div>
    </div>
  );
}