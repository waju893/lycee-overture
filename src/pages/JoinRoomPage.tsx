import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { joinLocalRoom, normalizeRoomId } from "../lib/localRoom";

export default function JoinRoomPage() {
  const navigate = useNavigate();
  const [roomId, setRoomId] = useState("");
  const [error, setError] = useState("");

  function handleJoin() {
    const normalized = normalizeRoomId(roomId);
    if (!normalized) {
      setError("Room ID를 입력해줘.");
      return;
    }

    const result = joinLocalRoom(normalized);
    if (!result.ok) {
      setError(result.reason);
      return;
    }

    setError("");
    navigate(`/room/${result.room.roomId}?seat=${result.seat}`);
  }

  return (
    <div style={pageStyle}>
      <div style={containerStyle}>
        <h1 style={{ margin: 0 }}>방 참가</h1>

        <div style={cardStyle}>
          <p style={{ marginTop: 0 }}>
            생성된 Room ID를 입력하면 빈 좌석으로 자동 참가해.
          </p>
          <p style={{ marginBottom: 0 }}>
            현재 구현은 같은 브라우저의 탭 간 동기화 기준이야.
          </p>
        </div>

        <div style={cardStyle}>
          <div style={labelStyle}>Room ID</div>
          <input
            value={roomId}
            onChange={(event) => {
              setRoomId(normalizeRoomId(event.target.value));
              setError("");
            }}
            placeholder="예: AB12CD"
            style={inputStyle}
          />
          {error ? <div style={errorStyle}>{error}</div> : null}
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button type="button" style={primaryButtonStyle} onClick={handleJoin}>
            참가
          </button>

          <Link to="/" style={secondaryLinkStyle}>
            뒤로 가기
          </Link>
        </div>
      </div>
    </div>
  );
}

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#2f2f2f",
  color: "#ffffff",
  padding: "24px",
  boxSizing: "border-box",
};

const containerStyle: React.CSSProperties = {
  maxWidth: "960px",
  margin: "0 auto",
  display: "flex",
  flexDirection: "column",
  gap: "16px",
};

const cardStyle: React.CSSProperties = {
  border: "1px solid #555",
  borderRadius: "12px",
  padding: "16px",
  background: "#3a3a3a",
  lineHeight: 1.6,
};

const labelStyle: React.CSSProperties = {
  fontWeight: 700,
  marginBottom: 10,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "320px",
  padding: "12px 14px",
  borderRadius: "10px",
  border: "1px solid #777",
  background: "#232323",
  color: "#fff",
  boxSizing: "border-box",
  fontSize: "16px",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const errorStyle: React.CSSProperties = {
  marginTop: 10,
  color: "#ff9b9b",
  fontWeight: 700,
};

const primaryButtonStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "12px 16px",
  borderRadius: "10px",
  background: "#4f7cff",
  color: "#fff",
  border: "none",
  cursor: "pointer",
  fontWeight: 700,
};

const secondaryLinkStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "12px 16px",
  borderRadius: "10px",
  background: "#555",
  color: "#fff",
  textDecoration: "none",
  fontWeight: 700,
};
