import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./routes/ProtectedRoute";
import { api } from "./services/api";
import { useAuthStore } from "./stores/authStore";
import type { User } from "./types";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { Home } from "./pages/Home";
import { GamePage } from "./pages/GamePage";
import { CreateRoom } from "./pages/CreateRoom";
import { JoinRoom } from "./pages/JoinRoom";
import { Lobby } from "./pages/Lobby";
import { PlayPage } from "./pages/PlayPage";
import { HistoryPage } from "./pages/HistoryPage";
import { GameResult } from "./pages/GameResult";

export function App() {
  const { token, setUser, logout } = useAuthStore();

  // Revalidates the persisted token on load and refreshes the cached
  // user - if the token is stale/invalid the response interceptor in
  // services/api.ts already handles logging the user out on a 401.
  useEffect(() => {
    if (!token) return;
    api
      .get<{ user: User }>("/auth/me")
      .then(({ data }) => setUser(data.user))
      .catch(() => logout());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/home" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      <Route
        path="/home"
        element={
          <ProtectedRoute>
            <Home />
          </ProtectedRoute>
        }
      />
      <Route
        path="/games/:gameSlug"
        element={
          <ProtectedRoute>
            <GamePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/games/:gameSlug/create"
        element={
          <ProtectedRoute>
            <CreateRoom />
          </ProtectedRoute>
        }
      />
      <Route
        path="/games/:gameSlug/join"
        element={
          <ProtectedRoute>
            <JoinRoom />
          </ProtectedRoute>
        }
      />
      <Route
        path="/lobby/:roomCode"
        element={
          <ProtectedRoute>
            <Lobby />
          </ProtectedRoute>
        }
      />
      <Route
        path="/play/:roomCode"
        element={
          <ProtectedRoute>
            <PlayPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/history"
        element={
          <ProtectedRoute>
            <HistoryPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/result/:gameSessionId"
        element={
          <ProtectedRoute>
            <GameResult />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
  );
}
