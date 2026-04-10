import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { setToken, clearToken } from "../api";

export default function Login() {
  const [token, setTokenValue] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    if (!token.trim()) {
      setError("Please enter a token");
      return;
    }

    setLoading(true);
    setError("");

    try {
      setToken(token.trim());
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token.trim()}`,
        },
        body: JSON.stringify({ token: token.trim() }),
      });
      if (!res.ok) throw new Error("Invalid token");
      login(token.trim());
      navigate("/");
    } catch {
      clearToken();
      setError("Invalid token");
      setTokenValue("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-base px-4">
      <div className="w-full max-w-sm">
        <div className="glass-card p-8">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 mb-4">
              <span className="text-white text-lg font-bold">J</span>
            </div>
            <h1 className="text-xl font-semibold text-zinc-50">John CRM</h1>
            <p className="mt-1 text-sm text-zinc-500">Cloudboosta Sales Agent</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="token" className="label-mono block mb-2">
                API Token
              </label>
              <input
                id="token"
                type="password"
                value={token}
                onChange={(e) => setTokenValue(e.target.value)}
                placeholder="Enter your dashboard token"
                autoComplete="off"
                className="w-full px-3 py-2.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-colors text-sm font-mono"
              />
            </div>

            {error && (
              <p className="text-red-400 text-sm font-mono" role="alert">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-400 hover:to-orange-500 disabled:from-zinc-700 disabled:to-zinc-700 disabled:text-zinc-500 text-white px-4 py-2.5 rounded-lg text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-orange-500/50"
            >
              {loading ? "Verifying..." : "Sign In"}
            </button>
          </form>
        </div>
        <p className="mt-4 text-center text-xs text-zinc-600">
          Token is stored locally and sent as a bearer header.
        </p>
      </div>
    </div>
  );
}
