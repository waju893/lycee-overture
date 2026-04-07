import { Link } from "react-router-dom";

export default function CreateRoomPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#2f2f2f",
        color: "#ffffff",
        padding: "24px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          maxWidth: "960px",
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        <h1 style={{ margin: 0 }}>방 생성</h1>

        <div
          style={{
            border: "1px solid #555",
            borderRadius: "12px",
            padding: "16px",
            background: "#3a3a3a",
          }}
        >
          <p style={{ marginTop: 0 }}>
            아직 실제 온라인 방 생성 기능은 연결되지 않았어.
          </p>
          <p style={{ marginBottom: 0 }}>
            지금은 아래 버튼으로 연습 모드 보드에 들어가서 엔진을 테스트할 수 있어.
          </p>
        </div>

        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <Link
            to="/practice"
            style={{
              display: "inline-block",
              padding: "12px 16px",
              borderRadius: "10px",
              background: "#4f7cff",
              color: "#fff",
              textDecoration: "none",
              fontWeight: 700,
            }}
          >
            연습 모드
          </Link>

          <Link
            to="/"
            style={{
              display: "inline-block",
              padding: "12px 16px",
              borderRadius: "10px",
              background: "#555",
              color: "#fff",
              textDecoration: "none",
              fontWeight: 700,
            }}
          >
            뒤로 가기
          </Link>
        </div>
      </div>
    </div>
  );
}
