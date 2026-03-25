# Phase 8: Dashboard - Research

**Researched:** 2026-03-25
**Domain:** React 19 SPA dashboard with polling, Tailwind CSS, Recharts, FastAPI backend API
**Confidence:** HIGH

## Summary

Phase 8 builds a 3-tab React SPA dashboard (Live View, Pipeline kanban, Strategy Analytics) with bearer token auth, polling data from 3 FastAPI endpoints. The existing scaffold at `execution/dashboard/` has correct structure (App.jsx, 3 component stubs, Tailwind configured, Vite configured) but pins **outdated** dependency versions (React 18.3, Vite 5.4, Recharts 2.12) that must be upgraded to match locked decisions (React 19, Vite 6, Recharts 3). The backend has 3 dashboard API stubs in `main.py` (lines 625-651) that need real Supabase queries, and 3 SQL views in `004_views.sql` (pipeline_snapshot, strategy_performance, todays_calls) are already deployed and ready.

The dashboard is architecturally simple: stateless React components polling JSON endpoints on intervals (5s for live, 30s for pipeline/strategy). No WebSocket, no state management library, no router needed. The primary complexity is in the UI: rich active call cards, kanban columns with click-to-expand side panels, horizontal bar charts, and consistent outcome color coding. The frontend-design skill governs visual quality -- no Bootstrap or Material UI.

**Primary recommendation:** Upgrade package.json dependencies first (React 19, Vite 6, Recharts 3, plugin-react 4.3.x), then implement backend API endpoints using existing SQL views, then build frontend components tab-by-tab with a shared auth/polling infrastructure layer.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Active call card:** Rich card with lead name, masked phone, status badge (calling/in_call), duration timer, programme recommended, current strategy. Green pulsing indicator when live. When no active call: grey "No Active Call" with countdown to next dial check.
- **Today's stats:** 4 stat cards in a row: Total Calls, Connected (talked), Committed, Conversion Rate. Powered by todays_calls SQL view.
- **Recent calls list:** Compact table of last 10 calls today: time, name, duration, outcome badge (color-coded: green=committed, yellow=follow_up, red=declined, grey=no_answer). Click row to expand with transcript snippet, recording player, call details.
- **Polling:** Every 5 seconds for active call + recent calls. Stats refresh on same interval. Every 30 seconds for pipeline and analytics.
- **Pipeline:** 6 columns (New, Queued, In Progress, Follow-Up, Committed, Closed). Lead cards with side panel on click.
- **Strategy Analytics:** Horizontal bar chart (Recharts BarChart) + totals table. Friendly empty states.
- **Dashboard API:** GET /api/dashboard/live, GET /api/dashboard/pipeline, GET /api/dashboard/strategy -- all protected by bearer token auth.
- **Auth:** Bearer token with localStorage, simple login screen. No username/password.
- **Tech Stack:** React 19 + Vite 6 + Tailwind 3.4 + Recharts 3. No Bootstrap/Material UI.

### Claude's Discretion
- Color palette, typography, spacing (frontend-design skill guides these)
- Component structure (how to split into React components)
- State management approach (useState/useEffect vs library)
- How to implement polling (setInterval vs custom hook)
- Tab navigation implementation
- Recording player component (HTML5 audio or library)
- How to mask phone numbers in display

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DASH-01 | Live View tab showing active call card, recent calls list, and today's stats (polls every 5s) | Polling via useInterval custom hook. Backend /api/dashboard/live endpoint queries todays_calls view + active lead check. Duration timer via local useState + setInterval. |
| DASH-02 | Pipeline tab with kanban view of leads grouped by status | Backend /api/dashboard/pipeline returns leads grouped into 6 kanban columns. Frontend renders horizontal scroll kanban with lead cards. |
| DASH-03 | Pipeline tab: click any lead to view full transcript, call recording, and call details | Side panel slides in from right. Backend returns full lead + call_logs data. HTML5 audio element for recording player. |
| DASH-04 | Strategy Analytics tab with conversion rate by strategy bar chart and totals table | Recharts 3 BarChart with layout="vertical" for horizontal bars. Backend queries strategy_performance SQL view. |
| DASH-05 | Bearer token authentication using DASHBOARD_SECRET_KEY (single operator) | Fetch wrapper adds Authorization: Bearer header. localStorage for token persistence. 401 response redirects to login. |
| DASH-06 | Responsive web layout using React 19 + Vite 6 + Tailwind 3.4 + Recharts 3 | Upgrade existing scaffold from React 18/Vite 5/Recharts 2 to locked versions. Tailwind 3.4 with PostCSS (already configured). |
| BACK-04 | Dashboard API endpoints returning live view, pipeline, and analytics data | 3 FastAPI GET endpoints already stubbed. Implement real Supabase queries using existing SQL views. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react | ^19.0.0 (19.2.4 current) | UI framework | Locked decision. Latest stable. |
| react-dom | ^19.0.0 (19.2.4 current) | DOM rendering | Must match React version. |
| vite | ^6.2.0 (6.2.6 latest 6.x) | Build tool + dev server | Locked decision. Not Vite 7/8 -- stability. |
| tailwindcss | ^3.4.4 | Utility CSS | Locked decision. Not v4 -- breaking config changes. |
| recharts | ^3.0.0 (3.8.0 current) | Charts | Locked decision. v3 has internal animation, no react-smooth dep. |
| @supabase/supabase-js | ^2.45.0 | Supabase client (unused -- dashboard reads go through FastAPI) | Already in package.json. May be useful for direct reads if needed. |

### Supporting (Dev Dependencies)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @vitejs/plugin-react | ^4.3.0 (4.3.4 latest for Vite 6) | React fast refresh in Vite | Required. Peer dep includes vite@^6.0.0. |
| autoprefixer | ^10.4.19 | PostCSS autoprefixing | Required for Tailwind 3.4 PostCSS pipeline. |
| postcss | ^8.4.38 | CSS processing | Required for Tailwind 3.4. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Simple tab state (useState) | React Router | Router adds bundle size, URL routing unnecessary for single-operator 3-tab SPA. Use simple useState(0) -- already scaffolded in App.jsx. |
| Custom useInterval hook | useSWR / react-query | SWR/react-query add caching, retry, dedup but are overkill for 3 simple polling endpoints. Custom hook is ~15 lines. |
| HTML5 `<audio>` | react-player / plyr | Native audio element is sufficient for single-file playback. No library needed. |
| useState + useEffect | zustand / jotai | State management library unnecessary. 3 tabs with independent data, no shared state beyond auth token. |

**Installation (upgrade from existing scaffold):**
```bash
cd execution/dashboard
npm install react@^19.0.0 react-dom@^19.0.0 recharts@^3.0.0
npm install -D vite@^6.2.0 @vitejs/plugin-react@^4.3.0 tailwindcss@^3.4.4 postcss@^8.4.38 autoprefixer@^10.4.19
```

## Architecture Patterns

### Recommended Project Structure
```
execution/dashboard/
├── index.html                  # Entry point (exists)
├── package.json                # Dependencies (needs upgrade)
├── vite.config.js              # Vite config with proxy (exists, port needs update)
├── tailwind.config.js          # Tailwind config (exists)
├── postcss.config.js           # PostCSS config (exists)
└── src/
    ├── main.jsx                # React root (exists)
    ├── index.css               # Tailwind directives (exists)
    ├── App.jsx                 # Tab navigation + auth gate (exists, needs auth)
    ├── api.js                  # Fetch wrapper with bearer token (NEW)
    ├── hooks/
    │   └── useInterval.js      # Declarative setInterval hook (NEW)
    ├── components/
    │   ├── Login.jsx           # Token input screen (NEW)
    │   ├── LiveView.jsx        # Active call + stats + recent (exists, stub)
    │   ├── Pipeline.jsx        # Kanban board (exists, stub)
    │   ├── StrategyAnalytics.jsx # Chart + table (exists, stub)
    │   ├── ActiveCallCard.jsx  # Hero card with pulse indicator (NEW)
    │   ├── StatCard.jsx        # Reusable stat card (NEW)
    │   ├── RecentCallsTable.jsx # Expandable rows table (NEW)
    │   ├── KanbanColumn.jsx    # Single pipeline column (NEW)
    │   ├── LeadCard.jsx        # Card inside kanban column (NEW)
    │   ├── LeadSidePanel.jsx   # Slide-in detail panel (NEW)
    │   ├── OutcomeBadge.jsx    # Color-coded badge (NEW, shared)
    │   └── EmptyState.jsx      # Friendly empty state (NEW, shared)
    └── constants.js            # Colors, status mappings, intervals (NEW)
```

### Pattern 1: Authenticated Fetch Wrapper
**What:** Single module wrapping native fetch() with bearer token injection and error handling.
**When to use:** Every API call to /api/dashboard/*.
**Example:**
```javascript
// src/api.js
const API_BASE = "/api/dashboard";

export function getToken() {
  return localStorage.getItem("dashboard_token");
}

export function setToken(token) {
  localStorage.setItem("dashboard_token", token);
}

export function clearToken() {
  localStorage.removeItem("dashboard_token");
}

export async function apiFetch(path) {
  const token = getToken();
  if (!token) throw new Error("No auth token");

  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (res.status === 401) {
    clearToken();
    window.location.reload();
    throw new Error("Unauthorized");
  }

  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}
```

### Pattern 2: useInterval Custom Hook (Dan Abramov Pattern)
**What:** Declarative setInterval that respects React lifecycle, supports dynamic delay, and can be paused with null.
**When to use:** All polling (5s for live, 30s for pipeline/strategy).
**Example:**
```javascript
// src/hooks/useInterval.js
import { useEffect, useRef } from "react";

export function useInterval(callback, delay) {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delay === null) return;
    const id = setInterval(() => savedCallback.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}
```

### Pattern 3: Polling Data Hook
**What:** Combines useInterval with useState for a complete fetch-on-interval pattern.
**When to use:** Each tab's data fetching.
**Example:**
```javascript
// Usage in LiveView.jsx
const [data, setData] = useState({ active_call: null, recent_calls: [], today_stats: {} });
const [error, setError] = useState(null);

const fetchLive = useCallback(async () => {
  try {
    const result = await apiFetch("/live");
    setData(result);
    setError(null);
  } catch (err) {
    setError(err.message);
  }
}, []);

useEffect(() => { fetchLive(); }, [fetchLive]); // Initial fetch
useInterval(fetchLive, 5000); // Poll every 5s
```

### Pattern 4: Kanban Status Grouping
**What:** Map 14 lead statuses into 6 kanban columns on the frontend.
**When to use:** Pipeline tab rendering.
**Example:**
```javascript
// src/constants.js
export const KANBAN_COLUMNS = [
  { key: "new", label: "New", statuses: ["new"] },
  { key: "queued", label: "Queued", statuses: ["queued"] },
  { key: "in_progress", label: "In Progress", statuses: ["calling", "in_call"] },
  { key: "follow_up", label: "Follow-Up", statuses: ["follow_up"] },
  { key: "committed", label: "Committed", statuses: ["committed", "payment_sent"] },
  { key: "closed", label: "Closed", statuses: ["declined", "not_qualified", "do_not_contact", "failed"] },
];

export const OUTCOME_COLORS = {
  committed: { bg: "bg-green-100", text: "text-green-800", dot: "bg-green-500" },
  follow_up: { bg: "bg-yellow-100", text: "text-yellow-800", dot: "bg-yellow-500" },
  declined: { bg: "bg-red-100", text: "text-red-800", dot: "bg-red-500" },
  no_answer: { bg: "bg-gray-100", text: "text-gray-600", dot: "bg-gray-400" },
  voicemail: { bg: "bg-gray-100", text: "text-gray-600", dot: "bg-gray-400" },
};
```

### Pattern 5: Horizontal Bar Chart (Recharts 3)
**What:** Recharts BarChart with layout="vertical" for horizontal strategy bars.
**When to use:** Strategy Analytics tab.
**Example:**
```jsx
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";

// data = [{ strategy: "Doctor Frame", conversion_rate: 45.2, total_calls: 12 }, ...]
<ResponsiveContainer width="100%" height={300}>
  <BarChart layout="vertical" data={data}>
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis type="number" domain={[0, 100]} unit="%" />
    <YAxis type="category" dataKey="strategy" width={140} />
    <Tooltip />
    <Bar dataKey="conversion_rate" fill="#3b82f6" radius={[0, 4, 4, 0]} />
  </BarChart>
</ResponsiveContainer>
```

### Anti-Patterns to Avoid
- **Polling without cleanup:** Always clear intervals on unmount. The useInterval hook handles this automatically.
- **Storing token in React state only:** Token must persist in localStorage. State alone loses auth on page refresh.
- **Supabase client in frontend with service key:** Dashboard reads go through FastAPI with bearer auth, NOT direct Supabase queries with the service key. The anon key is acceptable for direct reads per RLS policy (DATA-07), but the CONTEXT.md architecture routes through FastAPI.
- **Using React Router for 3 tabs:** Over-engineering. useState(0) with conditional rendering is already scaffolded and sufficient.
- **Fetching full transcript for every lead in pipeline:** Fetch details only when side panel opens (on click). Pipeline list should return lightweight data.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Polling interval | Raw setInterval in useEffect | useInterval hook | Stale closure bugs, cleanup edge cases, React strict mode double-mount |
| Chart rendering | Canvas/SVG drawing code | Recharts BarChart | Axis labels, tooltips, responsive sizing, accessibility |
| CSS utility classes | Custom CSS or styled-components | Tailwind 3.4 classes | Consistency, dark mode, responsive breakpoints out of the box |
| Audio playback | Custom audio controls | HTML5 `<audio controls>` | Browser-native, accessible, no bundle size cost |
| Phone masking | Regex-based masking | Simple function: `phone.slice(0,4) + "****" + phone.slice(-2)` | Straightforward, but use a reusable function to keep consistent |

**Key insight:** The dashboard has zero novel UI patterns. Active call cards, kanban boards, stat cards, and bar charts are all well-solved problems. The value is in clean execution, not invention.

## Common Pitfalls

### Pitfall 1: Recharts 2 to 3 Breaking Changes
**What goes wrong:** Existing scaffold pins recharts@^2.12.0. Upgrading to 3.x removes react-smooth, recharts-scale dependencies, and changes internal state exposure.
**Why it happens:** Recharts 3 rewrote state management. CategoricalChartState no longer exists in event handlers.
**How to avoid:** Since this is a fresh implementation (stubs only), just install recharts@^3.0.0 directly. No migration needed -- stubs have zero Recharts code.
**Warning signs:** Import errors for react-smooth, missing activeIndex prop warnings.

### Pitfall 2: Vite Dev Server Port Mismatch
**What goes wrong:** Existing vite.config.js sets `server.port: 3000` but CORS in main.py allows `localhost:5173` as default and `localhost:3000` as fallback.
**Why it happens:** The scaffold was created before the backend CORS was finalized.
**How to avoid:** Set vite.config.js port to 5173 to match DASHBOARD_ORIGIN default, or keep 3000 since it is also allowed. Either works -- be consistent.
**Warning signs:** CORS errors in browser console when fetching /api/dashboard/*.

### Pitfall 3: React 18 to 19 createRoot API Change
**What goes wrong:** React 19 deprecates some patterns from 18 (forwardRef changes, Context API changes).
**Why it happens:** React 19 compiler and Actions API changed some internals.
**How to avoid:** For this dashboard (no forwardRef, no Context providers needed), the upgrade is transparent. Just update package.json versions. The existing main.jsx using createRoot is already correct for React 19.
**Warning signs:** Console deprecation warnings about forwardRef (unlikely in this codebase).

### Pitfall 4: Stale Polling Data After Tab Switch
**What goes wrong:** User switches from Live View to Pipeline. Live View interval keeps running, wasting network requests.
**Why it happens:** Component stays mounted if using display:none instead of conditional rendering.
**How to avoid:** The existing App.jsx uses conditional rendering (`{activeTab === 0 && <LiveView />}`), which unmounts inactive tabs and stops their intervals. Keep this pattern.
**Warning signs:** Network tab showing /api/dashboard/live requests while on Pipeline tab.

### Pitfall 5: Empty State Handling
**What goes wrong:** Dashboard shows "undefined" or blank white space when no calls exist (Wave 0 initial state).
**Why it happens:** API returns empty arrays/null. Components don't check for empty data.
**How to avoid:** Every data-displaying component must check `data.length === 0` and render a friendly EmptyState component with the messaging specified in CONTEXT.md.
**Warning signs:** Broken layout, "NaN%" conversion rate, empty charts with only axes.

### Pitfall 6: call_logs Column Name Mismatch
**What goes wrong:** main.py call_analyzed handler writes to `call_summary` but the table column is named `summary` (001_tables.sql line 92). The todays_calls view references `cl.summary`.
**Why it happens:** Naming inconsistency between backend code and schema.
**How to avoid:** The dashboard reads from the todays_calls view which uses `cl.summary`. The backend's call_analyzed write to `call_summary` may silently fail (Supabase ignores unknown columns in updates). Verify the column names match when implementing the /live endpoint. If `call_summary` write is broken, the summary field will always be null in dashboard -- cosmetic only, not blocking.
**Warning signs:** Summary always showing as null/empty in recent calls despite call_analyzed events firing.

## Code Examples

### Backend: /api/dashboard/live Implementation
```python
# Replace the stub in main.py (line 625-631)
@app.get("/api/dashboard/live")
@limiter.limit("60/minute")
async def dashboard_live(request: Request, _token: str = Depends(verify_bearer_token)):
    """Current active call + recent calls + today's stats."""
    # Active call: lead with status 'calling' or 'in_call'
    active = (
        supabase.table("leads")
        .select("id, name, phone, status, programme_recommended, last_strategy_used, last_call_at")
        .in_("status", ["calling", "in_call"])
        .limit(1)
        .execute()
    )
    active_call = active.data[0] if active.data else None

    # Recent calls: from todays_calls view, limit 10
    recent = (
        supabase.table("todays_calls")
        .select("*")
        .limit(10)
        .execute()
    )

    # Today's stats: aggregate from todays_calls
    all_today = supabase.table("todays_calls").select("outcome").execute()
    total = len(all_today.data)
    connected = sum(1 for r in all_today.data if r.get("outcome") is not None)
    committed = sum(1 for r in all_today.data if r.get("outcome") == "committed")
    rate = round(committed / connected * 100, 1) if connected > 0 else 0

    return {
        "active_call": active_call,
        "recent_calls": recent.data,
        "today_stats": {
            "total_calls": total,
            "connected": connected,
            "committed": committed,
            "conversion_rate": rate,
        },
    }
```

### Backend: /api/dashboard/pipeline Implementation
```python
# Replace the stub in main.py (line 633-642)
@app.get("/api/dashboard/pipeline")
@limiter.limit("60/minute")
async def dashboard_pipeline(request: Request, _token: str = Depends(verify_bearer_token)):
    """Leads grouped by status for kanban view."""
    leads = (
        supabase.table("leads")
        .select("id, name, phone, status, updated_at, retry_count, programme_recommended, last_call_at, outcome")
        .order("updated_at", desc=True)
        .execute()
    )
    return {"leads": leads.data}
```

### Backend: /api/dashboard/strategy Implementation
```python
# Replace the stub in main.py (line 644-651)
@app.get("/api/dashboard/strategy")
@limiter.limit("60/minute")
async def dashboard_strategy(request: Request, _token: str = Depends(verify_bearer_token)):
    """Strategy performance data from SQL view."""
    strategies = (
        supabase.table("strategy_performance")
        .select("*")
        .execute()
    )
    return {"strategies": strategies.data}
```

### Backend: /api/dashboard/lead/{lead_id} (New -- for side panel)
```python
@app.get("/api/dashboard/lead/{lead_id}")
@limiter.limit("60/minute")
async def dashboard_lead_detail(request: Request, lead_id: str, _token: str = Depends(verify_bearer_token)):
    """Full lead details + call history for side panel."""
    lead = (
        supabase.table("leads")
        .select("*")
        .eq("id", lead_id)
        .single()
        .execute()
    )
    if not lead.data:
        raise HTTPException(status_code=404, detail="Lead not found")

    calls = (
        supabase.table("call_logs")
        .select("*")
        .eq("lead_id", lead_id)
        .order("started_at", desc=True)
        .execute()
    )
    return {"lead": lead.data, "calls": calls.data}
```

### Frontend: Phone Number Masking
```javascript
// Mask phone: +17405085360 -> +174****60
export function maskPhone(phone) {
  if (!phone || phone.length < 6) return phone || "";
  return phone.slice(0, 4) + "****" + phone.slice(-2);
}
```

### Frontend: Duration Formatting
```javascript
// Format seconds to mm:ss or hh:mm:ss
export function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| recharts 2 + react-smooth | recharts 3 (internal animation) | 2025 | Smaller bundle, no external animation dep |
| React 18 forwardRef | React 19 ref as prop | Dec 2024 | Simpler component APIs (not relevant here -- no forwarded refs) |
| Vite 5 | Vite 6 (Environment API) | Nov 2024 | Minor migration, `postcss-load-config` v6 |
| @vitejs/plugin-react 4 | plugin-react 4.3.4 (supports Vite 6) | 2025 | Peer dep expanded to include vite@^6.0.0 |
| Tailwind v3 PostCSS | Tailwind v4 Vite plugin | Jan 2025 | NOT adopting v4 -- locked to v3.4 for stability |

**Deprecated/outdated in existing scaffold:**
- `react@^18.3.1` -> Upgrade to `react@^19.0.0`
- `react-dom@^18.3.1` -> Upgrade to `react-dom@^19.0.0`
- `recharts@^2.12.0` -> Upgrade to `recharts@^3.0.0`
- `vite@^5.4.0` -> Upgrade to `vite@^6.2.0`
- `@vitejs/plugin-react@^4.3.0` -> Keep (compatible with Vite 6), but specify `^4.3.4`

## Existing Code Inventory

### Files That Need Changes
| File | Current State | What Needs to Happen |
|------|--------------|---------------------|
| `execution/dashboard/package.json` | Outdated deps (React 18, Vite 5, Recharts 2) | Upgrade all versions per locked decisions |
| `execution/dashboard/vite.config.js` | Port 3000, proxy /api to :8000 | Change port to 5173 (match DASHBOARD_ORIGIN default) |
| `execution/dashboard/src/App.jsx` | 3-tab shell, no auth | Add auth gate (show Login if no token) |
| `execution/dashboard/src/components/LiveView.jsx` | Placeholder stub | Full implementation: ActiveCallCard, StatCards, RecentCallsTable |
| `execution/dashboard/src/components/Pipeline.jsx` | Placeholder stub | Full implementation: KanbanBoard, LeadCards, SidePanel |
| `execution/dashboard/src/components/StrategyAnalytics.jsx` | Placeholder stub | Full implementation: BarChart, TotalsTable, EmptyState |
| `execution/backend/main.py` lines 625-651 | 3 stub endpoints | Implement real Supabase queries |

### Files That Are Fine As-Is
| File | Why No Changes |
|------|---------------|
| `tailwind.config.js` | Already configured for JSX content paths, dark mode |
| `postcss.config.js` | Standard tailwindcss + autoprefixer |
| `index.html` | Correct title, dark mode body class |
| `src/main.jsx` | createRoot pattern works for React 19 |
| `src/index.css` | Tailwind directives correct |

### SQL Views Ready for Dashboard
| View | Purpose | Used By |
|------|---------|---------|
| `todays_calls` | Today's call logs joined with lead names/phones | /api/dashboard/live |
| `pipeline_snapshot` | Lead counts by status | /api/dashboard/pipeline (optional -- or query leads directly) |
| `strategy_performance` | Conversion rates by strategy | /api/dashboard/strategy |

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Manual browser testing (no automated test framework in dashboard scaffold) |
| Config file | none -- see Wave 0 |
| Quick run command | `cd execution/dashboard && npm run dev` (visual verification) |
| Full suite command | Manual: open browser, verify all 3 tabs render, auth works, polling updates |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DASH-01 | Live View renders active call + stats + recent calls | manual | Visual check in browser | N/A |
| DASH-02 | Pipeline kanban shows leads in 6 columns | manual | Visual check in browser | N/A |
| DASH-03 | Click lead opens side panel with transcript + recording | manual | Click test in browser | N/A |
| DASH-04 | Strategy bar chart renders with data | manual | Visual check in browser | N/A |
| DASH-05 | Bearer token auth blocks unauthenticated access | smoke | `curl -s http://localhost:8000/api/dashboard/live` should return 403/401 | N/A |
| DASH-06 | Layout responsive, correct stack versions | smoke | `cd execution/dashboard && npm ls react vite recharts tailwindcss` | N/A |
| BACK-04 | API endpoints return real data | smoke | `curl -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/dashboard/live` | N/A |

### Sampling Rate
- **Per task commit:** `cd execution/dashboard && npm run build` (verifies no build errors)
- **Per wave merge:** Manual browser testing of all 3 tabs
- **Phase gate:** All 3 tabs render correctly, auth works, polling active, empty states display properly

### Wave 0 Gaps
- [ ] No automated test framework -- acceptable for single-operator dashboard. Phase 9 (TEST-01 through TEST-04) will validate dashboard as part of end-to-end testing with real call data.
- [ ] Build verification: `npm run build` must pass without errors after implementation.

## Open Questions

1. **call_logs.summary vs call_summary column name**
   - What we know: Schema defines `summary TEXT`, but main.py call_analyzed writes to `call_summary`. The todays_calls view reads `cl.summary`.
   - What's unclear: Whether the Supabase client silently ignores the mismatched column name or returns an error.
   - Recommendation: Verify column name in call_analyzed handler. Fix to `summary` if needed. Low priority -- cosmetic data only.

2. **Vite dev proxy vs direct FastAPI CORS**
   - What we know: vite.config.js has `proxy: { "/api": "http://localhost:8000" }`. CORS also allows localhost:5173.
   - What's unclear: Whether to use Vite proxy (same-origin in dev) or direct cross-origin fetch with CORS.
   - Recommendation: Use Vite proxy for dev (simpler, no CORS issues). For production, serve dashboard as static files from FastAPI or reverse proxy.

3. **Pipeline endpoint: full leads or just summaries?**
   - What we know: Kanban needs lightweight cards (name, phone, status, retry_count). Side panel needs full details + call history.
   - What's unclear: Whether to return all lead fields in pipeline endpoint or create a separate detail endpoint.
   - Recommendation: Pipeline endpoint returns summary fields. New /api/dashboard/lead/{id} endpoint returns full details + call_logs on demand (side panel click). This keeps polling efficient.

## Sources

### Primary (HIGH confidence)
- [React v19 release blog](https://react.dev/blog/2024/12/05/react-19) -- Official release notes
- [React 19.2 release](https://react.dev/blog/2025/10/01/react-19-2) -- Latest stable 19.2.4
- [Vite 6 announcement](https://vite.dev/blog/announcing-vite6) -- Release blog
- [Vite 6 migration guide](https://v6.vite.dev/guide/migration) -- Breaking changes from v5
- [Recharts 3.0 migration guide](https://github.com/recharts/recharts/wiki/3.0-migration-guide) -- Breaking changes, removed props
- [Recharts BarChart API](https://recharts.github.io/en-US/api/BarChart/) -- layout="vertical" for horizontal bars
- [Tailwind CSS v3 Vite guide](https://v3.tailwindcss.com/docs/guides/vite) -- PostCSS setup (not v4 plugin)
- Existing codebase: main.py, 004_views.sql, package.json, App.jsx (direct inspection)

### Secondary (MEDIUM confidence)
- [@vitejs/plugin-react v4.3.4 peer deps](https://www.npmjs.com/package/@vitejs/plugin-react) -- Supports vite@^4.2.0 || ^5.0.0 || ^6.0.0
- [Dan Abramov useInterval pattern](https://overreacted.io/making-setinterval-declarative-with-react-hooks/) -- Declarative polling hook
- [Jason Watmore bearer token fetch pattern](https://jasonwatmore.com/react-fetch-add-bearer-token-authorization-header-to-http-request) -- Auth fetch wrapper

### Tertiary (LOW confidence)
- Vite 6.2.6 as latest 6.x patch -- inferred from GitHub releases page (v6.2.7 may exist, search showed mixed results)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all versions verified against npm and official docs
- Architecture: HIGH -- patterns are well-established (polling, fetch wrapper, kanban), existing scaffold confirms structure
- Pitfalls: HIGH -- Recharts 3 migration guide and Vite 6 migration guide are official, column name mismatch verified in codebase
- Backend API: HIGH -- SQL views exist and are verified, Supabase Python client querying views is documented

**Research date:** 2026-03-25
**Valid until:** 2026-04-25 (30 days -- stable stack, no fast-moving changes expected)
