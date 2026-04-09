import { BrowserRouter, Route, Routes } from "react-router-dom";
import CreateRoomPage from "./pages/CreateRoomPage";
import DeckBuilderPage from "./pages/DeckBuilderPage";
import JoinRoomPage from "./pages/JoinRoomPage";
import PracticeBoard from "./pages/PracticeBoard";
import ReplayPage from "./pages/ReplayPage";
import RoomGamePage from "./pages/RoomGamePage";
import TitlePage from "./pages/TitlePage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<TitlePage />} />
        <Route path="/deck-builder" element={<DeckBuilderPage />} />
        <Route path="/create-room" element={<CreateRoomPage />} />
        <Route path="/join-room" element={<JoinRoomPage />} />
        <Route path="/practice" element={<PracticeBoard />} />
        <Route path="/room/:roomId" element={<RoomGamePage />} />
        <Route path="/replay" element={<ReplayPage />} />
      </Routes>
    </BrowserRouter>
  );
}
