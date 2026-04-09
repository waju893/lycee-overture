import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createLocalRoom, type RoomSeat } from "../lib/localRoom";

export default function CreateRoomPage() {
  const navigate = useNavigate();
  const [seat, setSeat] = useState<RoomSeat>("P1");
  const [lastRoomId, setLastRoomId] = useState<string>("");

  const roomUrl = useMemo(() => {
    return lastRoomId ? `/room/${lastRoomId}?seat=${seat}` : "";
  }, [lastRoomId, seat]);

  function handleCreate() {
    const room = createLocalRoom(seat);
    setLastRoomId(room.roomId);
    navigate(`/room/${room.roomId}?seat=${seat}`);
  }

  return (
    <div style={pageStyle}>
      <div style={containerStyle}>
        <h1 style={{ margin: 0 }}>방 생성</h1>

        <div style={cardStyle}>
          <p style={{ marginTop: 0 }}>
            이번 단계는 <strong>로컬 2탭 동기화용 방</strong>이야.
          </p>
          <p style={{ marginBottom: 0 }}>
            같은 브라우저에서 탭 2개를 열고, 한쪽은 방 생성, 다른 쪽은 방 참가를 누르면 Room ID 기준으로 상태가 동기화돼.
          </p>
        </div>

        <div style={cardStyle}>
          <div style={labelStyle}>생성 좌석</div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button
              type="button"
              style={seat === "P1" ? primaryButtonStyle : secondaryButtonStyle}
              onClick={() => setSeat("P1")}
            >
              P1로 생성
            </button>
            <button
              type="button"
              style={seat === "P2" ? primaryButtonStyle : secondaryButtonStyle}
              onClick={() => setSeat("P2")}
            >
              P2로 생성
            </button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button type="button" style={primaryButtonStyle} onClick={handleCreate}>
            Room 생성 후 입장
          </button>

          <Link to="/practice" style={secondaryLinkStyle}>
            연습 모드
          </Link>

          <Link to="/" style={secondaryLinkStyle}>
            뒤로 가기
          </Link>
        </div>

        {lastRoomId ? (
          <div style={roomInfoStyle}>
            <div style={labelStyle}>방 생성 완료</div>
            <div>Room ID: <strong>{lastRoomId}</strong></div>
            <div>입장 경로: {roomUrl}</div>
          </div>
        ) : null}
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

const secondaryButtonStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "12px 16px",
  borderRadius: "10px",
  background: "#555",
  color: "#fff",
  border: "1px solid #777",
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

const roomInfoStyle: React.CSSProperties = {
  border: "1px solid #4f7cff",
  borderRadius: "12px",
  padding: "16px",
  background: "#24324a",
  color: "#ffffff",
  lineHeight: 1.7,
};
