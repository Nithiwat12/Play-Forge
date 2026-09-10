import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, extractErrorMessage } from "../services/api";
import { useAuthStore } from "../stores/authStore";
import { Button } from "../components/common/Button";
import { Input } from "../components/common/Input";
import { Card } from "../components/common/Card";
import type { User } from "../types";

export function Login() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const { data } = await api.post<{ user: User; token: string }>("/auth/login", {
        email,
        password,
      });
      setAuth(data.user, data.token);
      navigate("/home");
    } catch (err) {
      setError(extractErrorMessage(err, "เข้าสู่ระบบไม่สำเร็จ"));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <h1 className="mb-1 text-2xl font-semibold text-white">ยินดีต้อนรับกลับมา</h1>
        <p className="mb-6 text-sm text-slate-400">เข้าสู่ระบบเพื่อร่วมเล่นเกม</p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            id="email"
            type="email"
            label="อีเมล"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          <Input
            id="password"
            type="password"
            label="รหัสผ่าน"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <Button type="submit" isLoading={isLoading} className="mt-2 w-full">
            เข้าสู่ระบบ
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-400">
          ยังไม่มีบัญชี?{" "}
          <Link to="/register" className="text-brand-400 hover:text-brand-300">
            สมัครสมาชิก
          </Link>
        </p>
      </Card>
    </div>
  );
}
