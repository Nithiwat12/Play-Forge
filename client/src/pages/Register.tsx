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
      setError(extractErrorMessage(err, "Could not create account"));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-sm">
        <h1 className="mb-1 text-2xl font-semibold text-white">Create an account</h1>
        <p className="mb-6 text-sm text-slate-400">Join the platform to start playing.</p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            id="username"
            label="Username"
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
            label="Email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          <Input
            id="password"
            type="password"
            label="Password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <Button type="submit" isLoading={isLoading} className="mt-2 w-full">
            Create account
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-400">
          Already have an account?{" "}
          <Link to="/login" className="text-brand-400 hover:text-brand-300">
            Log in
          </Link>
        </p>
      </Card>
    </div>
  );
}
