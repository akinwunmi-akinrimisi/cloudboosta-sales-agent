/**
 * Login screen for the Sarah Dashboard.
 *
 * Renders a centered card with a token input field. On submit, validates
 * the token by attempting a real API call to /live. If successful, the
 * token is persisted in localStorage and the onLogin callback fires.
 */

import { useState } from "react";
import { apiFetch, setToken, clearToken } from "../api";

export default function Login({ onLogin }) {
  const [token, setTokenValue] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!token.trim()) {
      setError("Please enter a token");
      return;
    }

    setLoading(true);
    setError("");

    // Temporarily store the token so apiFetch can use it
    setToken(token.trim());

    try {
      await apiFetch("/live");
      // Token is valid -- already persisted by setToken above
      onLogin();
    } catch {
      clearToken();
      setError("Invalid token -- please check and try again");
      setTokenValue("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="w-full max-w-sm">
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-8">
          {/* Branding */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-blue-600 mb-4">
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Sarah Dashboard
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Cloudboosta Sales Agent Monitor
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="token"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
              >
                API Token
              </label>
              <input
                id="token"
                type="password"
                value={token}
                onChange={(e) => setTokenValue(e.target.value)}
                placeholder="Enter your dashboard token"
                autoComplete="off"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-sm"
              />
            </div>

            {error && (
              <p className="text-red-500 text-sm" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              {loading ? "Verifying..." : "Sign In"}
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-xs text-gray-400 dark:text-gray-500">
          Token is stored locally and sent as a bearer header.
        </p>
      </div>
    </div>
  );
}
