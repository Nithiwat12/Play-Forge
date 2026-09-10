import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore";
import { api } from "../../services/api";
import { disconnectSocket } from "../../services/socket";
import { Button } from "./Button";

export function Navbar() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  async function handleLogout() {
    try {
      await api.post("/auth/logout");
    } catch {
      // Even if the request fails, clear local state so the user isn't stuck.
    }
    disconnectSocket();
    logout();
    navigate("/login");
  }

  return (
    <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-6 sm:py-4">
        <Link to="/home" className="text-base font-semibold text-white sm:text-lg">
          Play-Forge
        </Link>
        {user && (
          <nav className="flex flex-wrap items-center gap-3 sm:gap-4">
            <Link to="/home" className="text-sm text-slate-300 hover:text-white">
              คลังเกม
            </Link>
            <Link to="/history" className="text-sm text-slate-300 hover:text-white">
              ประวัติ
            </Link>
            <span className="hidden text-sm text-slate-500 sm:inline">{user.username}</span>
            <Button variant="secondary" onClick={handleLogout}>
              ออกจากระบบ
            </Button>
          </nav>
        )}
      </div>
    </header>
  );
}
