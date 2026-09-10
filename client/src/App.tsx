import { Suspense, lazy, useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./routes/ProtectedRoute";
import { Spinner } from "./components/common/Spinner";
import { api } from "./services/api";
import { useAuthStore } from "./stores/authStore";
import type { User } from "./types";

// Route-level code splitting: each page only downloads once the user
// actually navigates to it, instead of all of them landing in one big
// bundle the browser has to fetch and parse before anything renders.
// Login/Register stay eager since they're almost always the very first
// screen someone sees (nothing to gain from lazy-loading the first paint).
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
const Home = lazy(() => import("./pages/Home").then((m) => ({ default: m.Home })));
const GamePage = lazy(() => import("./pages/GamePage").then((m) => ({ default: m.GamePage })));
const CreateRoom = lazy(() => import("./pages/CreateRoom").then((m) => ({ default: m.CreateRoom })));
const JoinRoom = lazy(() => import("./pages/JoinRoom").then((m) => ({ default: m.JoinRoom })));
const Lobby = lazy(() => import("./pages/Lobby").then((m) => ({ default: m.Lobby })));
const PlayPage = lazy(() => import("./pages/PlayPage").then((m) => ({ default: m.PlayPage })));
const HistoryPage = lazy(() => import("./pages/HistoryPage").then((m) => ({ default: m.HistoryPage })));
const GameResult = lazy(() => import("./pages/GameResult").then((m) => ({ default: m.GameResult })));

function PageFallback() {
  return <Spinner className="mt-24" />;
}

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
    <Suspense fallback={<PageFallback />}>
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
    </Suspense>
  );
}
