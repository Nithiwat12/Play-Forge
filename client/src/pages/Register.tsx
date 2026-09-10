import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api, extractErrorMessage } from "../services/api";
import { useAuthStore } from "../stores/authStore";
import { Button } from "../components/common/Button";
import { Input } from "../components/common/Input";
import { Card } from "../components/common/Card";
import type { User } from "../types";

export function Register() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);
    try {
      const { data } = await api.post<{ user: User; token: string }>("/auth/register", {
        username,
        email,
        password,
      });
      setAuth(data.user, data.token);
      navigate("/home");
    } catch (err) {
      setError(extractErrorMessage(err, "สมัครสมาชิกไม่สำเร็จ"));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <h1 className="mb-1 text-2xl font-semibold text-white">สร้างบัญชีใหม่</h1>
        <p className="mb-6 text-sm text-slate-400">สมัครสมาชิกเพื่อเริ่มเล่น</p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            id="username"
            label="ชื่อผู้ใช้"
            required
            minLength={3}
            maxLength={20}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
          />
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
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <Button type="submit" isLoading={isLoading} className="mt-2 w-full">
            สร้างบัญชี
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-400">
          มีบัญชีอยู่แล้ว?{" "}
          <Link to="/login" className="text-brand-400 hover:text-brand-300">
            เข้าสู่ระบบ
          </Link>
        </p>
      </Card>
    </div>
  );
}
