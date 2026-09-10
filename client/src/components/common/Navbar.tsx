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
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link to="/home" className="text-lg font-semibold text-white">
          🎲 แพลตฟอร์มเกมกระดาน
        </Link>
        {user && (
          <nav className="flex items-center gap-4">
            <Link to="/home" className="text-sm text-slate-300 hover:text-white">
              คลังเกม
            </Link>
            <Link to="/history" className="text-sm text-slate-300 hover:text-white">
              ประวัติ
            </Link>
            <span className="text-sm text-slate-500">{user.username}</span>
            <Button variant="secondary" onClick={handleLogout}>
              ออกจากระบบ
            </Button>
          </nav>
        )}
      </div>
    </header>
  );
}
