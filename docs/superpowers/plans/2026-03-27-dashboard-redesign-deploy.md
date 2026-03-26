# Dashboard Dark Glass Redesign + Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign Sarah Dashboard with Dark Glass aesthetic (icon sidebar, Space Grotesk + IBM Plex Mono, frosted glass cards) and deploy alongside FastAPI backend in a single Docker container.

**Architecture:** Static React build served by FastAPI via StaticFiles mount. Multi-stage Dockerfile: Node 20 builds the dashboard, Python 3.12-slim runs the backend with built assets copied in. Same domain, no CORS needed for dashboard.

**Tech Stack:** React 19, Vite, Tailwind CSS 3, Recharts 3, FastAPI, Docker multi-stage, Traefik (existing)

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `execution/dashboard/index.html` | Modify | Add Google Fonts preconnect + stylesheet links |
| `execution/dashboard/tailwind.config.js` | Modify | Custom colors, fonts, glass utilities |
| `execution/dashboard/src/index.css` | Modify | CSS variables, base dark styles, glass classes, pulse animation |
| `execution/dashboard/src/constants.js` | Modify | Update OUTCOME_COLORS to Dark Glass palette |
| `execution/dashboard/src/App.jsx` | Modify | Icon sidebar layout replacing top bar |
| `execution/dashboard/src/components/Login.jsx` | Modify | Dark Glass login screen |
| `execution/dashboard/src/components/StatCard.jsx` | Modify | Glass card with mono labels |
| `execution/dashboard/src/components/ActiveCallCard.jsx` | Modify | Orange-bordered live card with pulse |
| `execution/dashboard/src/components/EmptyState.jsx` | Modify | Dark empty state |
| `execution/dashboard/src/components/OutcomeBadge.jsx` | Modify | Translucent pill badges |
| `execution/dashboard/src/components/LiveView.jsx` | Modify | Dark error banner, layout order |
| `execution/dashboard/src/components/RecentCallsTable.jsx` | Modify | Dark glass table |
| `execution/dashboard/src/components/Pipeline.jsx` | Modify | Dark glass kanban + column colors |
| `execution/dashboard/src/components/KanbanColumn.jsx` | Modify | Glass column cards |
| `execution/dashboard/src/components/LeadCard.jsx` | Modify | Compact glass lead cards |
| `execution/dashboard/src/components/LeadSidePanel.jsx` | Modify | Slide-in glass panel |
| `execution/dashboard/src/components/StrategyAnalytics.jsx` | Modify | Dark Recharts theme |
| `execution/backend/main.py` | Modify | Add StaticFiles mount + SPA catch-all |
| `execution/backend/Dockerfile` | Modify | Multi-stage Node + Python |
| `execution/backend/docker-compose.yml` | Modify | Updated build context |

---

### Task 1: Design System Foundation (index.html, tailwind.config.js, index.css)

**Files:**
- Modify: `execution/dashboard/index.html`
- Modify: `execution/dashboard/tailwind.config.js`
- Modify: `execution/dashboard/src/index.css`

- [ ] **Step 1: Add Google Fonts to index.html**

Replace `execution/dashboard/index.html` with:

```html
<!DOCTYPE html>
<html lang="en" class="dark">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Sarah Dashboard — Cloudboosta</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap"
      rel="stylesheet"
    />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 2: Update tailwind.config.js with Dark Glass tokens**

Replace `execution/dashboard/tailwind.config.js` with:

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["'Space Grotesk'", "system-ui", "sans-serif"],
        mono: ["'IBM Plex Mono'", "ui-monospace", "monospace"],
      },
      colors: {
        glass: {
          fill: "rgba(255,255,255,0.04)",
          border: "rgba(255,255,255,0.08)",
          "border-hover": "rgba(255,255,255,0.12)",
          "fill-hover": "rgba(255,255,255,0.06)",
        },
        surface: "#18181b",
        base: "#09090b",
      },
    },
  },
  plugins: [],
};
```

- [ ] **Step 3: Replace index.css with Dark Glass base styles**

Replace `execution/dashboard/src/index.css` with:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  html {
    background-color: #09090b;
    color: #fafafa;
  }

  body {
    font-family: 'Space Grotesk', system-ui, sans-serif;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }
}

@layer components {
  .glass-card {
    @apply bg-glass-fill border border-glass-border rounded-xl transition-colors;
    backdrop-filter: blur(8px);
  }

  .glass-card-hover:hover {
    @apply border-glass-border-hover bg-glass-fill-hover;
  }

  .label-mono {
    @apply font-mono text-[11px] font-medium uppercase tracking-[1.5px] text-zinc-500;
  }

  .value-lg {
    @apply font-sans text-[28px] font-bold text-zinc-50 tabular-nums;
  }
}

@layer utilities {
  @keyframes pulse-glow {
    0%, 100% { box-shadow: 0 0 4px currentColor; opacity: 1; }
    50% { box-shadow: 0 0 10px currentColor; opacity: 0.6; }
  }

  .animate-pulse-glow {
    animation: pulse-glow 2s ease-in-out infinite;
  }
}
```

- [ ] **Step 4: Verify the build compiles**

Run:
```bash
cd execution/dashboard && npm run build
```
Expected: Build succeeds with no errors.

- [ ] **Step 5: Commit**

```bash
git add execution/dashboard/index.html execution/dashboard/tailwind.config.js execution/dashboard/src/index.css
git commit -m "feat(dashboard): add Dark Glass design system — fonts, tokens, glass utilities"
```

---

### Task 2: Update constants.js — Dark Glass outcome colors

**Files:**
- Modify: `execution/dashboard/src/constants.js`

- [ ] **Step 1: Replace OUTCOME_COLORS and OUTCOME_DEFAULT**

In `execution/dashboard/src/constants.js`, replace the `OUTCOME_COLORS` and `OUTCOME_DEFAULT` constants:

Old:
```javascript
/** Tailwind class mappings for outcome badges. */
export const OUTCOME_COLORS = {
  committed: { bg: "bg-green-100", text: "text-green-800", dot: "bg-green-500" },
  follow_up: { bg: "bg-yellow-100", text: "text-yellow-800", dot: "bg-yellow-500" },
  declined: { bg: "bg-red-100", text: "text-red-800", dot: "bg-red-500" },
  no_answer: { bg: "bg-gray-100", text: "text-gray-600", dot: "bg-gray-400" },
  voicemail: { bg: "bg-gray-100", text: "text-gray-600", dot: "bg-gray-400" },
  busy: { bg: "bg-gray-100", text: "text-gray-600", dot: "bg-gray-400" },
};

/** Default gray style for unknown outcomes. */
export const OUTCOME_DEFAULT = { bg: "bg-gray-100", text: "text-gray-600", dot: "bg-gray-400" };
```

New:
```javascript
/** Dark Glass badge styles: translucent bg + colored border + colored text. */
export const OUTCOME_COLORS = {
  committed: {
    bg: "bg-green-500/15 border border-green-500/30",
    text: "text-green-500",
    dot: "bg-green-500",
  },
  follow_up: {
    bg: "bg-blue-500/15 border border-blue-500/30",
    text: "text-blue-500",
    dot: "bg-blue-500",
  },
  declined: {
    bg: "bg-red-500/15 border border-red-500/30",
    text: "text-red-500",
    dot: "bg-red-500",
  },
  no_answer: {
    bg: "bg-zinc-500/15 border border-zinc-500/30",
    text: "text-zinc-400",
    dot: "bg-zinc-500",
  },
  voicemail: {
    bg: "bg-zinc-500/15 border border-zinc-500/30",
    text: "text-zinc-400",
    dot: "bg-zinc-500",
  },
  busy: {
    bg: "bg-zinc-500/15 border border-zinc-500/30",
    text: "text-zinc-400",
    dot: "bg-zinc-500",
  },
};

/** Default style for unknown outcomes. */
export const OUTCOME_DEFAULT = {
  bg: "bg-zinc-500/15 border border-zinc-500/30",
  text: "text-zinc-400",
  dot: "bg-zinc-500",
};
```

- [ ] **Step 2: Commit**

```bash
git add execution/dashboard/src/constants.js
git commit -m "feat(dashboard): update outcome colors to Dark Glass palette"
```

---

### Task 3: OutcomeBadge + EmptyState — Dark Glass atoms

**Files:**
- Modify: `execution/dashboard/src/components/OutcomeBadge.jsx`
- Modify: `execution/dashboard/src/components/EmptyState.jsx`

- [ ] **Step 1: Update OutcomeBadge.jsx**

Replace the full file content:

```jsx
import { OUTCOME_COLORS, OUTCOME_DEFAULT } from "../constants";

export default function OutcomeBadge({ outcome }) {
  if (!outcome) return null;

  const colors = OUTCOME_COLORS[outcome.toLowerCase()] || OUTCOME_DEFAULT;
  const label = outcome.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md font-mono text-[11px] font-medium ${colors.bg} ${colors.text}`}
    >
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${colors.dot}`} aria-hidden="true" />
      {label}
    </span>
  );
}
```

- [ ] **Step 2: Update EmptyState.jsx**

Replace the full file content:

```jsx
function DefaultIcon() {
  return (
    <svg
      className="mx-auto h-12 w-12 text-zinc-700"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
      />
    </svg>
  );
}

export default function EmptyState({
  icon,
  title = "No data yet",
  message = "Analytics will appear after Sarah's first calls.",
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      {icon || <DefaultIcon />}
      <h3 className="mt-4 text-sm font-medium text-zinc-500">{title}</h3>
      <p className="mt-1 text-sm text-zinc-600 text-center max-w-sm">{message}</p>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add execution/dashboard/src/components/OutcomeBadge.jsx execution/dashboard/src/components/EmptyState.jsx
git commit -m "feat(dashboard): Dark Glass OutcomeBadge and EmptyState"
```

---

### Task 4: App.jsx — Icon Sidebar Layout

**Files:**
- Modify: `execution/dashboard/src/App.jsx`

- [ ] **Step 1: Replace App.jsx with icon sidebar layout**

Replace full file content of `execution/dashboard/src/App.jsx`:

```jsx
import { useState } from "react";
import { getToken, clearToken } from "./api";
import Login from "./components/Login";
import LiveView from "./components/LiveView";
import Pipeline from "./components/Pipeline";
import StrategyAnalytics from "./components/StrategyAnalytics";

const TABS = [
  {
    label: "Live",
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
  {
    label: "Pipeline",
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 4v16M15 4v16M4 9h16M4 15h16" />
      </svg>
    ),
  },
  {
    label: "Strategy",
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 12h4l3-9 4 18 3-9h4" />
      </svg>
    ),
  },
];

export default function App() {
  const [authenticated, setAuthenticated] = useState(!!getToken());
  const [activeTab, setActiveTab] = useState(0);

  if (!authenticated) {
    return <Login onLogin={() => setAuthenticated(true)} />;
  }

  function handleLogout() {
    clearToken();
    setAuthenticated(false);
  }

  return (
    <div className="flex h-screen bg-base overflow-hidden">
      {/* Icon Sidebar */}
      <nav className="w-14 flex-shrink-0 bg-surface border-r border-glass-border flex flex-col items-center py-4 gap-3">
        {/* Logo */}
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white text-sm font-bold mb-4">
          S
        </div>

        {/* Tab icons */}
        {TABS.map((tab, i) => (
          <button
            key={tab.label}
            onClick={() => setActiveTab(i)}
            title={tab.label}
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
              activeTab === i
                ? "bg-orange-500/15 border border-orange-500/30 text-orange-500"
                : "text-zinc-600 hover:text-zinc-400 hover:bg-glass-fill"
            }`}
          >
            {tab.icon}
          </button>
        ))}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Logout */}
        <button
          onClick={handleLogout}
          title="Logout"
          className="w-9 h-9 rounded-lg flex items-center justify-center text-zinc-600 hover:text-zinc-400 hover:bg-glass-fill transition-colors"
        >
          <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
        </button>
      </nav>

      {/* Content area */}
      <main className="flex-1 overflow-y-auto p-6">
        {activeTab === 0 && <LiveView />}
        {activeTab === 1 && <Pipeline />}
        {activeTab === 2 && <StrategyAnalytics />}
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd execution/dashboard && npm run build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add execution/dashboard/src/App.jsx
git commit -m "feat(dashboard): icon sidebar layout with Dark Glass styling"
```

---

### Task 5: Login.jsx — Dark Glass login screen

**Files:**
- Modify: `execution/dashboard/src/components/Login.jsx`

- [ ] **Step 1: Replace Login.jsx**

Replace full file content of `execution/dashboard/src/components/Login.jsx`:

```jsx
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
    setToken(token.trim());

    try {
      await apiFetch("/live");
      onLogin();
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
          {/* Branding */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 mb-4">
              <span className="text-white text-lg font-bold">S</span>
            </div>
            <h1 className="text-xl font-semibold text-zinc-50">
              Sarah Dashboard
            </h1>
            <p className="mt-1 text-sm text-zinc-500">
              Cloudboosta Sales Agent
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="token"
                className="label-mono block mb-2"
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
                className="w-full px-3 py-2.5 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-colors text-sm font-mono"
              />
            </div>

            {error && (
              <p className="text-red-400 text-sm font-mono" role="alert">
                {error}
              </p>
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
```

- [ ] **Step 2: Commit**

```bash
git add execution/dashboard/src/components/Login.jsx
git commit -m "feat(dashboard): Dark Glass login screen"
```

---

### Task 6: StatCard + ActiveCallCard — Live View atoms

**Files:**
- Modify: `execution/dashboard/src/components/StatCard.jsx`
- Modify: `execution/dashboard/src/components/ActiveCallCard.jsx`

- [ ] **Step 1: Replace StatCard.jsx**

```jsx
const COLOR_MAP = {
  blue: "text-blue-500",
  green: "text-green-500",
  yellow: "text-orange-500",
  purple: "text-violet-500",
};

export default function StatCard({ label, value, subtitle, color = "blue" }) {
  const valueColor = COLOR_MAP[color] || COLOR_MAP.blue;

  return (
    <div className="glass-card glass-card-hover p-4">
      <p className="label-mono">{label}</p>
      <p className={`value-lg mt-1 ${valueColor}`}>{value}</p>
      {subtitle && (
        <p className="text-xs text-zinc-600 mt-1">{subtitle}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Replace ActiveCallCard.jsx**

```jsx
import { useState, useEffect } from "react";
import { maskPhone, formatDuration } from "../constants";

export default function ActiveCallCard({ call }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!call?.last_call_at) {
      setElapsed(0);
      return;
    }

    function tick() {
      const start = new Date(call.last_call_at).getTime();
      const now = Date.now();
      setElapsed(Math.max(0, Math.floor((now - start) / 1000)));
    }

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [call?.last_call_at]);

  if (!call) {
    return null;
  }

  const isInCall = call.status === "in_call";

  return (
    <div
      className={`glass-card p-5 ${
        isInCall
          ? "border-orange-500/30 shadow-lg shadow-orange-500/5"
          : "border-amber-500/20"
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          {/* Pulse dot */}
          <span className="relative flex h-3 w-3 mt-1.5">
            <span
              className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isInCall ? "bg-green-500 animate-ping" : "bg-amber-400 animate-pulse"
              }`}
            />
            <span
              className={`relative inline-flex h-3 w-3 rounded-full ${
                isInCall ? "bg-green-500" : "bg-amber-400"
              }`}
              style={isInCall ? { boxShadow: "0 0 8px #22c55e" } : {}}
            />
          </span>

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="label-mono text-orange-500">
                {isInCall ? "LIVE CALL" : "CALLING"}
              </span>
            </div>
            <h2 className="text-lg font-semibold text-zinc-50">
              {call.name || "Unknown Lead"}
            </h2>
            <p className="text-sm text-zinc-500">
              {maskPhone(call.phone)}
            </p>

            <div className="flex flex-wrap items-center gap-2 mt-2">
              {call.programme_recommended && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono font-medium bg-blue-500/15 border border-blue-500/30 text-blue-500">
                  {call.programme_recommended}
                </span>
              )}
              {call.last_strategy_used && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono font-medium bg-violet-500/15 border border-violet-500/30 text-violet-500">
                  {call.last_strategy_used}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Duration timer */}
        <div className="text-right">
          <p className="text-2xl font-mono font-bold text-zinc-50 tabular-nums">
            {formatDuration(elapsed)}
          </p>
          <p className="label-mono mt-1">Duration</p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add execution/dashboard/src/components/StatCard.jsx execution/dashboard/src/components/ActiveCallCard.jsx
git commit -m "feat(dashboard): Dark Glass StatCard and ActiveCallCard"
```

---

### Task 7: LiveView + RecentCallsTable — Dark Glass Live tab

**Files:**
- Modify: `execution/dashboard/src/components/LiveView.jsx`
- Modify: `execution/dashboard/src/components/RecentCallsTable.jsx`

- [ ] **Step 1: Replace LiveView.jsx**

```jsx
import { useState, useCallback, useEffect } from "react";
import { apiFetch } from "../api";
import { useInterval } from "../hooks/useInterval";
import { POLL_LIVE } from "../constants";
import ActiveCallCard from "./ActiveCallCard";
import StatCard from "./StatCard";
import RecentCallsTable from "./RecentCallsTable";

const DEFAULT_DATA = {
  active_call: null,
  recent_calls: [],
  today_stats: { total_calls: 0, connected: 0, committed: 0, conversion_rate: 0 },
};

export default function LiveView() {
  const [data, setData] = useState(DEFAULT_DATA);
  const [error, setError] = useState(null);

  const fetchLive = useCallback(async () => {
    try {
      const result = await apiFetch("/live");
      if (result) {
        setData(result);
        setError(null);
      }
    } catch (err) {
      setError(err.message || "Failed to fetch live data");
    }
  }, []);

  useEffect(() => { fetchLive(); }, [fetchLive]);
  useInterval(fetchLive, POLL_LIVE);

  const stats = data.today_stats;

  return (
    <div className="space-y-5">
      {error && (
        <div className="flex items-center justify-between glass-card border-red-500/30 px-4 py-2.5 text-sm">
          <span className="text-red-400">{error}</span>
          <button onClick={fetchLive} className="text-red-400 hover:text-red-300 font-mono text-xs ml-4">
            Retry
          </button>
        </div>
      )}

      <ActiveCallCard call={data.active_call} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Calls" value={stats.total_calls} color="blue" />
        <StatCard label="Connected" value={stats.connected} color="green" />
        <StatCard label="Committed" value={stats.committed} color="yellow" />
        <StatCard label="Conversion Rate" value={`${stats.conversion_rate}%`} color="purple" />
      </div>

      <RecentCallsTable calls={data.recent_calls} />
    </div>
  );
}
```

- [ ] **Step 2: Replace RecentCallsTable.jsx**

```jsx
import { useState } from "react";
import { formatTime, formatDuration } from "../constants";
import OutcomeBadge from "./OutcomeBadge";
import EmptyState from "./EmptyState";

export default function RecentCallsTable({ calls }) {
  const [expandedId, setExpandedId] = useState(null);

  if (!calls || calls.length === 0) {
    return (
      <div className="glass-card">
        <EmptyState
          title="No calls yet today"
          message="Recent calls will appear here once the auto-dialer starts."
        />
      </div>
    );
  }

  function toggleRow(id) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  return (
    <div className="glass-card overflow-hidden">
      <div className="px-4 py-3 border-b border-glass-border">
        <h3 className="label-mono text-zinc-400">Recent Calls</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="table-auto w-full text-sm">
          <thead>
            <tr className="border-b border-glass-border text-left">
              <th className="px-4 py-2 label-mono">Time</th>
              <th className="px-4 py-2 label-mono">Lead</th>
              <th className="px-4 py-2 label-mono">Duration</th>
              <th className="px-4 py-2 label-mono">Outcome</th>
            </tr>
          </thead>
          <tbody>
            {calls.map((call) => (
              <CallRow
                key={call.id}
                call={call}
                expanded={expandedId === call.id}
                onToggle={() => toggleRow(call.id)}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CallRow({ call, expanded, onToggle }) {
  return (
    <>
      <tr
        onClick={onToggle}
        className="border-b border-glass-border cursor-pointer hover:bg-white/[0.02] transition-colors"
      >
        <td className="px-4 py-2.5 text-zinc-400 font-mono text-xs whitespace-nowrap">
          {formatTime(call.started_at)}
        </td>
        <td className="px-4 py-2.5 font-medium text-zinc-200">
          {call.lead_name || "Unknown"}
        </td>
        <td className="px-4 py-2.5 text-zinc-400 font-mono tabular-nums text-xs">
          {formatDuration(call.duration_seconds)}
        </td>
        <td className="px-4 py-2.5">
          <OutcomeBadge outcome={call.outcome} />
        </td>
      </tr>

      {expanded && (
        <tr className="bg-white/[0.02]">
          <td colSpan={4} className="px-4 py-3">
            <div className="space-y-3 text-sm">
              <div>
                <p className="label-mono mb-1">Summary</p>
                <p className="text-zinc-400 text-xs">{call.summary || "No summary available"}</p>
              </div>
              {call.recording_url && (
                <div>
                  <p className="label-mono mb-1">Recording</p>
                  <audio controls src={call.recording_url} className="w-full max-w-md" preload="none">
                    Your browser does not support audio playback.
                  </audio>
                </div>
              )}
              <div className="flex flex-wrap gap-4 text-xs text-zinc-600">
                {call.closing_strategy_used && (
                  <span>Strategy: <span className="text-zinc-400">{call.closing_strategy_used}</span></span>
                )}
                {call.detected_persona && (
                  <span>Persona: <span className="text-zinc-400">{call.detected_persona}</span></span>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
```

- [ ] **Step 3: Verify build**

Run: `cd execution/dashboard && npm run build`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add execution/dashboard/src/components/LiveView.jsx execution/dashboard/src/components/RecentCallsTable.jsx
git commit -m "feat(dashboard): Dark Glass LiveView and RecentCallsTable"
```

---

### Task 8: Pipeline + KanbanColumn + LeadCard — Dark Glass Pipeline tab

**Files:**
- Modify: `execution/dashboard/src/components/Pipeline.jsx`
- Modify: `execution/dashboard/src/components/KanbanColumn.jsx`
- Modify: `execution/dashboard/src/components/LeadCard.jsx`

- [ ] **Step 1: Replace Pipeline.jsx**

```jsx
import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "../api";
import { useInterval } from "../hooks/useInterval";
import { KANBAN_COLUMNS, POLL_PIPELINE } from "../constants";
import KanbanColumn from "./KanbanColumn";
import LeadSidePanel from "./LeadSidePanel";
import EmptyState from "./EmptyState";

const COLUMN_COLORS = {
  new: "border-blue-500",
  queued: "border-violet-500",
  in_progress: "border-orange-500",
  follow_up: "border-blue-400",
  committed: "border-green-500",
  closed: "border-zinc-600",
};

const COLUMN_ACCENT = {
  new: "text-blue-500",
  queued: "text-violet-500",
  in_progress: "text-orange-500",
  follow_up: "text-blue-400",
  committed: "text-green-500",
  closed: "text-zinc-500",
};

export default function Pipeline() {
  const [leads, setLeads] = useState([]);
  const [selectedLeadId, setSelectedLeadId] = useState(null);
  const [error, setError] = useState(null);

  const fetchPipeline = useCallback(async () => {
    try {
      const data = await apiFetch("/pipeline");
      if (data && data.leads) setLeads(data.leads);
      setError(null);
    } catch (err) {
      setError(err.message || "Failed to load pipeline");
    }
  }, []);

  useEffect(() => { fetchPipeline(); }, [fetchPipeline]);
  useInterval(fetchPipeline, POLL_PIPELINE);

  const columns = KANBAN_COLUMNS.map((col) => ({
    ...col,
    leads: leads.filter((lead) => col.statuses.includes(lead.status)),
  }));

  return (
    <div className="space-y-4">
      {error && (
        <div className="glass-card border-red-500/30 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {leads.length === 0 && !error ? (
        <EmptyState title="No leads in pipeline" message="Import leads via CSV to get started." />
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {columns.map((col) => (
            <KanbanColumn
              key={col.key}
              label={col.label}
              leads={col.leads}
              count={col.leads.length}
              colorClass={COLUMN_COLORS[col.key] || "border-zinc-600"}
              accentClass={COLUMN_ACCENT[col.key] || "text-zinc-500"}
              onLeadClick={setSelectedLeadId}
            />
          ))}
        </div>
      )}

      {selectedLeadId !== null && (
        <LeadSidePanel leadId={selectedLeadId} onClose={() => setSelectedLeadId(null)} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Replace KanbanColumn.jsx**

```jsx
import LeadCard from "./LeadCard";

export default function KanbanColumn({ label, leads, count, colorClass, accentClass, onLeadClick }) {
  return (
    <div className="min-w-[250px] flex-shrink-0 flex flex-col glass-card">
      {/* Accent border */}
      <div className={`border-t-2 ${colorClass} rounded-t-xl`} />

      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <h3 className={`text-sm font-semibold ${accentClass}`}>{label}</h3>
        <span className="inline-flex items-center justify-center bg-white/[0.06] border border-glass-border rounded-full px-2 text-xs font-mono text-zinc-400 min-w-[20px]">
          {count}
        </span>
      </div>

      {/* Cards */}
      <div className="px-2 pb-2 space-y-2 overflow-y-auto max-h-[calc(100vh-200px)]">
        {leads.map((lead) => (
          <LeadCard key={lead.id} lead={lead} onClick={onLeadClick} />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Replace LeadCard.jsx**

```jsx
import { maskPhone } from "../constants";
import OutcomeBadge from "./OutcomeBadge";

function relativeTime(isoString) {
  if (!isoString) return "";
  try {
    const diff = Date.now() - new Date(isoString).getTime();
    if (diff < 0) return "just now";
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  } catch {
    return "";
  }
}

export default function LeadCard({ lead, onClick }) {
  return (
    <button
      type="button"
      onClick={() => onClick(lead.id)}
      className="w-full text-left bg-white/[0.03] rounded-lg border border-glass-border p-3 cursor-pointer hover:border-glass-border-hover hover:bg-white/[0.05] transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500/30"
    >
      <p className="font-medium text-sm text-zinc-100 truncate">
        {lead.name || "Unknown"}
      </p>
      <p className="text-xs text-zinc-500 font-mono mt-0.5">
        {maskPhone(lead.phone)}
      </p>

      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-zinc-600 font-mono">
          {relativeTime(lead.updated_at)}
        </span>
        {lead.retry_count > 0 && (
          <span className="inline-flex items-center rounded-full bg-orange-500/15 border border-orange-500/30 text-orange-500 px-1.5 text-xs font-mono">
            {lead.retry_count}
          </span>
        )}
      </div>

      {lead.outcome && (
        <div className="mt-2">
          <OutcomeBadge outcome={lead.outcome} />
        </div>
      )}
    </button>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add execution/dashboard/src/components/Pipeline.jsx execution/dashboard/src/components/KanbanColumn.jsx execution/dashboard/src/components/LeadCard.jsx
git commit -m "feat(dashboard): Dark Glass Pipeline, KanbanColumn, LeadCard"
```

---

### Task 9: LeadSidePanel — Dark Glass slide-in panel

**Files:**
- Modify: `execution/dashboard/src/components/LeadSidePanel.jsx`

- [ ] **Step 1: Replace LeadSidePanel.jsx**

```jsx
import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "../api";
import { maskPhone, formatDuration, formatTime } from "../constants";
import OutcomeBadge from "./OutcomeBadge";

function sortCallsDesc(calls) {
  return [...calls].sort(
    (a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime()
  );
}

function formatDateTime(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString([], { month: "short", day: "numeric" }) + " " + formatTime(iso);
  } catch {
    return "";
  }
}

function TranscriptViewer({ transcript }) {
  const [expanded, setExpanded] = useState(false);
  if (!transcript) {
    return <p className="text-xs text-zinc-600 italic">No transcript available</p>;
  }
  const isLong = transcript.length > 200;
  const displayText = expanded || !isLong ? transcript : transcript.slice(0, 200) + "...";

  return (
    <div>
      <pre className="text-xs text-zinc-400 whitespace-pre-wrap bg-white/[0.02] border border-glass-border rounded-lg p-3 max-h-64 overflow-y-auto">
        {displayText}
      </pre>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="mt-1 text-xs text-orange-500 hover:text-orange-400 font-mono focus:outline-none"
        >
          {expanded ? "Show less" : "Show full transcript"}
        </button>
      )}
    </div>
  );
}

function CallRecord({ call }) {
  return (
    <div className="glass-card p-3 space-y-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-zinc-300">{formatDateTime(call.started_at)}</span>
          <span className="text-xs text-zinc-500 font-mono">{formatDuration(call.duration_seconds)}</span>
        </div>
        <OutcomeBadge outcome={call.outcome} />
      </div>

      {(call.closing_strategy_used || call.detected_persona) && (
        <div className="flex flex-wrap gap-3 text-xs text-zinc-600">
          {call.closing_strategy_used && (
            <span>Strategy: <span className="text-zinc-400">{call.closing_strategy_used.replace(/_/g, " ")}</span></span>
          )}
          {call.detected_persona && (
            <span>Persona: <span className="text-zinc-400">{call.detected_persona}</span></span>
          )}
        </div>
      )}

      {call.summary && (
        <p className="text-xs text-zinc-400 leading-relaxed">{call.summary}</p>
      )}

      <div>
        <p className="label-mono mb-1">Transcript</p>
        <TranscriptViewer transcript={call.transcript} />
      </div>

      <div>
        <p className="label-mono mb-1">Recording</p>
        {call.recording_url ? (
          <audio controls src={call.recording_url} className="w-full h-8" preload="none">
            Your browser does not support the audio element.
          </audio>
        ) : (
          <p className="text-xs text-zinc-600 italic">No recording available</p>
        )}
      </div>
    </div>
  );
}

export default function LeadSidePanel({ leadId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchLead = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/lead/" + leadId);
      setData(res);
    } catch (err) {
      setError(err.message || "Failed to load lead details");
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => { fetchLead(); }, [fetchLead]);

  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const lead = data?.lead;
  const calls = data?.calls || [];
  const sortedCalls = sortCallsDesc(calls);

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} aria-hidden="true" />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-lg bg-surface border-l border-glass-border shadow-2xl z-50 overflow-y-auto"
           style={{ backdropFilter: "blur(12px)" }}>
        {/* Header */}
        <div className="sticky top-0 bg-surface/90 border-b border-glass-border px-5 py-4 z-10"
             style={{ backdropFilter: "blur(12px)" }}>
          <div className="flex items-start justify-between">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-zinc-50 truncate">
                {loading ? "Loading..." : lead?.name || "Unknown"}
              </h2>
              {lead && (
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <span className="text-sm text-zinc-500 font-mono">{maskPhone(lead.phone)}</span>
                  <OutcomeBadge outcome={lead.outcome || lead.status} />
                </div>
              )}
              {lead?.email && (
                <p className="text-sm text-zinc-500 mt-0.5">{lead.email}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="ml-4 p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-glass-fill focus:outline-none transition-colors"
              aria-label="Close panel"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-6">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-700 border-t-orange-500" />
            </div>
          )}

          {error && !loading && (
            <div className="text-center py-8 space-y-3">
              <p className="text-sm text-red-400">{error}</p>
              <button onClick={fetchLead} className="text-sm text-orange-500 hover:text-orange-400 font-mono focus:outline-none">
                Retry
              </button>
            </div>
          )}

          {lead && !loading && !error && (
            <>
              <section className="space-y-2">
                <h3 className="label-mono text-zinc-400">Lead Details</h3>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  {lead.location && (
                    <>
                      <dt className="text-zinc-500">Location</dt>
                      <dd className="text-zinc-200">{lead.location}</dd>
                    </>
                  )}
                  {lead.country && (
                    <>
                      <dt className="text-zinc-500">Country</dt>
                      <dd className="text-zinc-200">{lead.country}</dd>
                    </>
                  )}
                  {lead.programme_recommended && (
                    <>
                      <dt className="text-zinc-500">Programme</dt>
                      <dd className="text-zinc-200">{lead.programme_recommended}</dd>
                    </>
                  )}
                  {lead.outcome && (
                    <>
                      <dt className="text-zinc-500">Outcome</dt>
                      <dd><OutcomeBadge outcome={lead.outcome} /></dd>
                    </>
                  )}
                  {lead.priority != null && (
                    <>
                      <dt className="text-zinc-500">Priority</dt>
                      <dd className="text-zinc-200">{lead.priority}</dd>
                    </>
                  )}
                  {lead.retry_count != null && (
                    <>
                      <dt className="text-zinc-500">Retries</dt>
                      <dd className="text-zinc-200">{lead.retry_count}</dd>
                    </>
                  )}
                  {lead.source && (
                    <>
                      <dt className="text-zinc-500">Source</dt>
                      <dd className="text-zinc-200">{lead.source}</dd>
                    </>
                  )}
                </dl>
              </section>

              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <h3 className="label-mono text-zinc-400">Call History</h3>
                  <span className="inline-flex items-center justify-center bg-white/[0.06] border border-glass-border rounded-full px-2 text-xs font-mono text-zinc-400">
                    {sortedCalls.length}
                  </span>
                </div>

                {sortedCalls.length === 0 ? (
                  <p className="text-sm text-zinc-600 italic">No call records yet</p>
                ) : (
                  <div className="space-y-3">
                    {sortedCalls.map((call) => (
                      <CallRecord key={call.id} call={call} />
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add execution/dashboard/src/components/LeadSidePanel.jsx
git commit -m "feat(dashboard): Dark Glass LeadSidePanel"
```

---

### Task 10: StrategyAnalytics — Dark Glass charts and table

**Files:**
- Modify: `execution/dashboard/src/components/StrategyAnalytics.jsx`

- [ ] **Step 1: Replace StrategyAnalytics.jsx**

```jsx
import { useState, useEffect, useCallback } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  ResponsiveContainer, Cell,
} from "recharts";
import { apiFetch } from "../api";
import { useInterval } from "../hooks/useInterval";
import { POLL_STRATEGY } from "../constants";
import EmptyState from "./EmptyState";

function rateColor(rate) {
  if (rate >= 40) return "#22c55e";
  if (rate >= 20) return "#3b82f6";
  return "#71717a";
}

function rateTextClass(rate) {
  if (rate >= 40) return "text-green-500";
  if (rate >= 20) return "text-blue-500";
  return "text-zinc-500";
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-zinc-800 border border-glass-border rounded-lg shadow-xl px-3 py-2 text-sm">
      <p className="font-medium text-zinc-100">{label}</p>
      <p className="text-zinc-400">
        Conversion: <span className="font-semibold text-zinc-200">{d.conversion_rate}%</span>
      </p>
      <p className="text-zinc-400">
        {d.committed_count} committed / {d.total_calls} calls
      </p>
    </div>
  );
}

export default function StrategyAnalytics() {
  const [strategies, setStrategies] = useState([]);
  const [error, setError] = useState(null);

  const fetchStrategy = useCallback(async () => {
    try {
      const data = await apiFetch("/strategy");
      setStrategies(data.strategies || []);
      setError(null);
    } catch (err) {
      setError(err.message || "Failed to load strategy data");
    }
  }, []);

  useEffect(() => { fetchStrategy(); }, [fetchStrategy]);
  useInterval(fetchStrategy, POLL_STRATEGY);

  const errorBanner = error ? (
    <div className="glass-card border-red-500/30 px-4 py-3 text-sm flex items-center justify-between">
      <span className="text-red-400">{error}</span>
      <button onClick={fetchStrategy} className="ml-4 text-red-400 hover:text-red-300 font-mono text-xs">Retry</button>
    </div>
  ) : null;

  if (strategies.length === 0 && !error) {
    return (
      <div className="space-y-6">
        {errorBanner}
        <EmptyState
          title="No call data yet"
          message="Analytics will appear after Sarah's first calls. Start the auto-dialer to begin collecting data."
        />
      </div>
    );
  }

  const totalCalls = strategies.reduce((sum, s) => sum + s.total_calls, 0);
  const totalCommitted = strategies.reduce((sum, s) => sum + s.committed_count, 0);
  const weightedRate = totalCalls > 0 ? Number(((totalCommitted / totalCalls) * 100).toFixed(1)) : 0;
  const totalPersonas = strategies.reduce((sum, s) => sum + (s.personas_seen || 0), 0);

  return (
    <div className="space-y-6">
      {errorBanner}

      {/* Bar chart card */}
      <div className="glass-card p-6">
        <h2 className="text-lg font-semibold mb-4 text-zinc-100">Conversion Rate by Strategy</h2>
        <ResponsiveContainer width="100%" height={Math.max(200, strategies.length * 50)}>
          <BarChart layout="vertical" data={strategies} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.05)" />
            <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 12, fill: "#71717a" }} axisLine={{ stroke: "rgba(255,255,255,0.08)" }} tickLine={false} />
            <YAxis type="category" dataKey="strategy" width={160} tick={{ fontSize: 12, fill: "#a1a1aa" }} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
            <Bar dataKey="conversion_rate" radius={[0, 4, 4, 0]} barSize={24}>
              {strategies.map((entry, idx) => (
                <Cell key={idx} fill={rateColor(entry.conversion_rate)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Totals table card */}
      <div className="glass-card p-6">
        <h2 className="text-lg font-semibold mb-4 text-zinc-100">Strategy Performance Summary</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-glass-border">
                <th className="text-left px-4 py-3 label-mono">Strategy</th>
                <th className="text-right px-4 py-3 label-mono">Total Calls</th>
                <th className="text-right px-4 py-3 label-mono">Committed</th>
                <th className="text-right px-4 py-3 label-mono">Conversion</th>
                <th className="text-right px-4 py-3 label-mono">Personas</th>
              </tr>
            </thead>
            <tbody>
              {strategies.map((s, idx) => (
                <tr key={s.strategy} className={`border-b border-glass-border ${idx % 2 === 1 ? "bg-white/[0.01]" : ""}`}>
                  <td className="px-4 py-3 font-semibold text-zinc-200">{s.strategy}</td>
                  <td className="px-4 py-3 text-right text-zinc-400 font-mono">{s.total_calls}</td>
                  <td className="px-4 py-3 text-right text-zinc-400 font-mono">{s.committed_count}</td>
                  <td className={`px-4 py-3 text-right font-mono font-medium ${rateTextClass(s.conversion_rate)}`}>{s.conversion_rate}%</td>
                  <td className="px-4 py-3 text-right text-zinc-400 font-mono">{s.personas_seen}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-zinc-700 font-semibold">
                <td className="px-4 py-3 text-zinc-100">All Strategies</td>
                <td className="px-4 py-3 text-right text-zinc-200 font-mono">{totalCalls}</td>
                <td className="px-4 py-3 text-right text-zinc-200 font-mono">{totalCommitted}</td>
                <td className={`px-4 py-3 text-right font-mono ${rateTextClass(weightedRate)}`}>{weightedRate}%</td>
                <td className="px-4 py-3 text-right text-zinc-200 font-mono">{totalPersonas}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify full dashboard build**

Run: `cd execution/dashboard && npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 3: Commit**

```bash
git add execution/dashboard/src/components/StrategyAnalytics.jsx
git commit -m "feat(dashboard): Dark Glass StrategyAnalytics with dark Recharts theme"
```

---

### Task 11: FastAPI static file serving

**Files:**
- Modify: `execution/backend/main.py`

- [ ] **Step 1: Add static file imports and SPA serving**

At the top of `execution/backend/main.py`, add to existing imports:

```python
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
```

Then at the **very end** of the file (after all existing route definitions), add:

```python
# ---------------------------------------------------------------------------
# Dashboard SPA — serve built React app (must be LAST)
# ---------------------------------------------------------------------------
_static_dir = os.path.join(os.path.dirname(__file__), "static")

if os.path.isdir(_static_dir):
    # Serve Vite's hashed assets at /assets/
    _assets_dir = os.path.join(_static_dir, "assets")
    if os.path.isdir(_assets_dir):
        app.mount("/assets", StaticFiles(directory=_assets_dir), name="static-assets")

    @app.get("/{path:path}")
    async def serve_spa(path: str):
        """Serve the React SPA — fall back to index.html for client-side routing."""
        file_path = os.path.join(_static_dir, path)
        if path and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(_static_dir, "index.html"))
```

- [ ] **Step 2: Add production URL to CORS origins**

In `execution/backend/main.py`, find the CORS middleware block and add the production URL:

Old:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        DASHBOARD_ORIGIN,
        "http://localhost:3000",
        "http://localhost:5173",
    ],
```

New:
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        DASHBOARD_ORIGIN,
        "http://localhost:3000",
        "http://localhost:5173",
        "https://sarah-api.srv1297445.hstgr.cloud",
    ],
```

- [ ] **Step 3: Commit**

```bash
git add execution/backend/main.py
git commit -m "feat(backend): serve dashboard SPA from FastAPI static files"
```

---

### Task 12: Multi-stage Dockerfile + docker-compose

**Files:**
- Modify: `execution/backend/Dockerfile`
- Modify: `execution/backend/docker-compose.yml`

- [ ] **Step 1: Update docker-compose.yml with build context**

Replace `execution/backend/docker-compose.yml`:

```yaml
services:
  sarah-backend:
    build:
      context: ../
      dockerfile: backend/Dockerfile
    restart: unless-stopped
    labels:
      - traefik.enable=true
      - traefik.http.routers.sarah-backend.rule=Host(`sarah-api.${TRAEFIK_HOST}`)
      - traefik.http.routers.sarah-backend.entrypoints=websecure
      - traefik.http.routers.sarah-backend.tls.certresolver=letsencrypt
      - traefik.http.services.sarah-backend.loadbalancer.server.port=8000
    env_file:
      - .env
    environment:
      - PORT=8000
```

Note: The build context is now `../` (the `execution/` directory) so the Dockerfile can access both `backend/` and `dashboard/`.

- [ ] **Step 2: Replace Dockerfile with multi-stage build**

Since the build context is `execution/`, all COPY paths are relative to that directory.

Replace `execution/backend/Dockerfile`:

```dockerfile
# Stage 1: Build React dashboard
FROM node:20-alpine AS dashboard-build
WORKDIR /build
COPY dashboard/package.json dashboard/package-lock.json ./
RUN npm ci
COPY dashboard/ ./
RUN npm run build

# Stage 2: Python backend + built dashboard
FROM python:3.12-slim
WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .

# Copy built dashboard into static/ directory
COPY --from=dashboard-build /build/dist ./static/

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
```

- [ ] **Step 3: Commit**

```bash
git add execution/backend/Dockerfile execution/backend/docker-compose.yml
git commit -m "feat(deploy): multi-stage Dockerfile — Node build + Python runtime"
```

---

### Task 13: Deploy to VPS

**Files:** No code changes — deployment commands only.

- [ ] **Step 1: Push changes to remote**

```bash
git push origin main
```

- [ ] **Step 2: SSH into VPS and pull latest code**

```bash
ssh root@72.61.201.148
cd /path/to/sarah-backend  # wherever the docker-compose is running
git pull origin main
```

- [ ] **Step 3: Rebuild and restart the container**

```bash
docker compose down
docker compose build --no-cache
docker compose up -d
```

- [ ] **Step 4: Verify deployment**

```bash
# Health check
curl https://sarah-api.srv1297445.hstgr.cloud/health

# Dashboard serves (should return HTML)
curl -s https://sarah-api.srv1297445.hstgr.cloud/ | head -5

# API still works
curl -s https://sarah-api.srv1297445.hstgr.cloud/api/dashboard/live \
  -H "Authorization: Bearer YOUR_TOKEN" | head -1
```

- [ ] **Step 5: Open dashboard in browser and verify**

Open `https://sarah-api.srv1297445.hstgr.cloud/` in a browser:
- Login screen appears with Dark Glass styling
- After token entry, icon sidebar shows with 3 tabs
- Live View, Pipeline, and Strategy Analytics all render correctly
