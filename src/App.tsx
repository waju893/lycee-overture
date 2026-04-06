import { BrowserRouter, Routes, Route } from "react-router-dom";
import TitlePage from "./pages/TitlePage";
import DeckBuilderPage from "./pages/DeckBuilderPage";
import CreateRoomPage from "./pages/CreateRoomPage";
import JoinRoomPage from "./pages/JoinRoomPage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<TitlePage />} />
        <Route path="/deck" element={<DeckBuilderPage />} />
        <Route path="/room/create" element={<CreateRoomPage />} />
        <Route path="/room/join" element={<JoinRoomPage />} />
      </Routes>
    </BrowserRouter>
  );
}