# Command Centre Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the 3-tab dashboard into a full operational command centre with 4 views: Command Centre (home), Pipeline (enhanced), Strategy (enhanced), and Lead Detail (full-page intelligence).

**Architecture:** Backend-first approach — add new FastAPI endpoints, then build frontend components against them. The Command Centre aggregates data from leads, call_logs, and pipeline_logs tables into a single polling endpoint. Lead Detail uses the existing lead endpoint enhanced with call_stats. Navigation uses React state (no router library needed — the app is single-page with 4 views).

**Tech Stack:** React 19 + Tailwind 3.4 + Recharts 3 + Vite 6 (frontend), FastAPI + Supabase/PostgreSQL (backend). Dark theme with glass-card design system.

**Spec:** `docs/superpowers/specs/2026-03-30-command-centre-dashboard-design.md`

---

## File Structure

### Backend (modify)
- `execution/backend/main.py` — Add 3 endpoints: `/api/dashboard/command-centre`, `/api/dashboard/call-now/{lead_id}`, enhance `/api/dashboard/lead/{lead_id}` and `/api/dashboard/strategy`

### Frontend (modify)
- `execution/dashboard/src/api.js` — Add `apiPost()` for POST requests
- `execution/dashboard/src/constants.js` — Add new constants (POLL_COMMAND, funnel stage colors, formatRelativeTime, formatDateTime)
- `execution/dashboard/src/App.jsx` — New 4-view navigation with Lead Detail routing
- `execution/dashboard/src/components/Pipeline.jsx` — Add search/filter, enhanced cards, remove side panel
- `execution/dashboard/src/components/LeadCard.jsx` — Add persona, programme, follow-up badges
- `execution/dashboard/src/components/RecentCallsTable.jsx` — Add persona, strategy, programme columns + click-to-navigate
- `execution/dashboard/src/components/StrategyAnalytics.jsx` — Add daily outcomes chart + persona table

### Frontend (create)
- `execution/dashboard/src/components/CommandCentre.jsx` — Main home view orchestrating all panels
- `execution/dashboard/src/components/CallQueuePanel.jsx` — Queued leads with call buttons
- `execution/dashboard/src/components/LeadFunnel.jsx` — Pipeline funnel visualization
- `execution/dashboard/src/components/ActivityFeed.jsx` — Recent activity scrollable feed
- `execution/dashboard/src/components/LeadDetail.jsx` — Full-page lead intelligence view
- `execution/dashboard/src/components/CallTimeline.jsx` — Call history cards with transcript/recording
- `execution/dashboard/src/components/QuickActions.jsx` — Action buttons for lead operations

### Frontend (delete)
- `execution/dashboard/src/components/LeadSidePanel.jsx` — Replaced by LeadDetail full page
- `execution/dashboard/src/components/LiveView.jsx` — Replaced by CommandCentre

---

## Task 1: Backend — New Command Centre Endpoint

**Files:**
- Modify: `execution/backend/main.py` (add endpoint after line 760)

- [ ] **Step 1: Add the command-centre endpoint**

Add this endpoint to `main.py` after the existing `dashboard_strategy` endpoint (around line 760):

```python
@app.get("/api/dashboard/command-centre")
@limiter.limit("60/minute")
async def dashboard_command_centre(request: Request, _token: str = Depends(verify_bearer_token)):
    """Command centre: stats, active call, queue, funnel, activity feed, recent calls."""

    # 1. Total leads count
    total_result = supabase.table("leads").select("id", count="exact").execute()
    total_leads = total_result.count or 0

    # 2. Queued count
    queued_result = supabase.table("leads").select("id", count="exact").eq("status", "queued").execute()
    queued_count = queued_result.count or 0

    # 3. Active call
    active_result = (
        supabase.table("leads")
        .select("id, name, phone, status, programme_recommended, last_strategy_used, last_call_at, detected_persona")
        .in_("status", ["calling", "in_call"])
        .limit(1)
        .execute()
    )
    active_call = active_result.data[0] if active_result.data else None

    # 4. Call queue — next 10 leads to call
    queue_result = (
        supabase.table("leads")
        .select("id, name, phone, priority, retry_count, next_call_type, next_call_at, status")
        .in_("status", ["queued", "new"])
        .order("priority", desc=True)
        .order("created_at")
        .limit(10)
        .execute()
    )
    queue = queue_result.data or []

    # 5. Funnel counts
    funnel_result = supabase.table("leads").select("status").execute()
    funnel_data = {"new": 0, "queued": 0, "in_progress": 0, "follow_up": 0, "committed": 0, "closed": 0}
    in_progress_statuses = {"calling", "in_call"}
    closed_statuses = {"declined", "not_qualified", "do_not_contact", "failed"}
    committed_statuses = {"committed", "payment_sent"}
    for row in (funnel_result.data or []):
        s = row["status"]
        if s == "new":
            funnel_data["new"] += 1
        elif s == "queued":
            funnel_data["queued"] += 1
        elif s in in_progress_statuses:
            funnel_data["in_progress"] += 1
        elif s == "follow_up":
            funnel_data["follow_up"] += 1
        elif s in committed_statuses:
            funnel_data["committed"] += 1
        elif s in closed_statuses:
            funnel_data["closed"] += 1

    # 6. Activity feed — recent pipeline_logs + call_logs merged
    pipeline_activity = (
        supabase.table("pipeline_logs")
        .select("lead_id, event, details, created_at")
        .order("created_at", desc=True)
        .limit(15)
        .execute()
    )
    call_activity = (
        supabase.table("call_logs")
        .select("lead_id, outcome, duration_seconds, created_at")
        .order("created_at", desc=True)
        .limit(15)
        .execute()
    )

    # Merge and sort — need lead names for display
    lead_ids = set()
    for row in (pipeline_activity.data or []):
        if row.get("lead_id"):
            lead_ids.add(row["lead_id"])
    for row in (call_activity.data or []):
        if row.get("lead_id"):
            lead_ids.add(row["lead_id"])

    lead_names = {}
    if lead_ids:
        names_result = supabase.table("leads").select("id, name").in_("id", list(lead_ids)).execute()
        for row in (names_result.data or []):
            lead_names[row["id"]] = row["name"]

    activity = []
    for row in (pipeline_activity.data or []):
        details = row.get("details") or {}
        activity.append({
            "type": "status_change",
            "lead_name": lead_names.get(row.get("lead_id"), "Unknown"),
            "detail": f"Status changed to {details.get('new_status', row.get('event', 'unknown'))}",
            "timestamp": row["created_at"],
        })
    for row in (call_activity.data or []):
        dur = row.get("duration_seconds") or 0
        mins = dur // 60
        secs = dur % 60
        outcome = row.get("outcome") or "no outcome"
        activity.append({
            "type": "call",
            "lead_name": lead_names.get(row.get("lead_id"), "Unknown"),
            "detail": f"Called — {mins}m{secs:02d}s — {outcome}",
            "timestamp": row["created_at"],
        })

    # Sort by timestamp descending, take top 20
    activity.sort(key=lambda x: x["timestamp"] or "", reverse=True)
    activity = activity[:20]

    # 7. Today's calls (existing logic from dashboard_live)
    recent_result = (
        supabase.table("todays_calls")
        .select("*")
        .order("started_at", desc=True)
        .limit(15)
        .execute()
    )
    recent_calls = recent_result.data or []

    # 8. Today's stats
    stats_result = supabase.table("todays_calls").select("outcome").execute()
    all_today = stats_result.data or []
    total_today = len(all_today)
    connected = sum(1 for r in all_today if r.get("outcome") is not None)
    committed = sum(1 for r in all_today if r.get("outcome") == "committed")
    conversion_rate = round(committed / connected * 100, 1) if connected > 0 else 0

    return {
        "stats": {
            "total_leads": total_leads,
            "queued": queued_count,
            "todays_calls": total_today,
            "connected": connected,
            "committed": committed,
            "conversion_rate": conversion_rate,
        },
        "active_call": active_call,
        "queue": queue,
        "funnel": funnel_data,
        "activity": activity,
        "recent_calls": recent_calls,
    }
```

- [ ] **Step 2: Verify endpoint works**

Run: `curl -s https://sarah-api.srv1297445.hstgr.cloud/api/dashboard/command-centre -H "Authorization: Bearer $DASHBOARD_SECRET_KEY" | python -m json.tool | head -30`

Expected: JSON with stats, active_call, queue, funnel, activity, recent_calls fields.

- [ ] **Step 3: Commit**

```bash
git add execution/backend/main.py
git commit -m "feat(api): add command-centre endpoint with stats, queue, funnel, activity feed"
```

---

## Task 2: Backend — Enhance Lead Detail + Strategy + Call-Now Endpoints

**Files:**
- Modify: `execution/backend/main.py`

- [ ] **Step 1: Enhance lead detail endpoint**

Replace the existing `dashboard_lead_detail` endpoint (around line 763) with this enhanced version:

```python
@app.get("/api/dashboard/lead/{lead_id}")
@limiter.limit("60/minute")
async def dashboard_lead_detail(request: Request, lead_id: str, _token: str = Depends(verify_bearer_token)):
    """Full lead details, call history, and aggregated call stats."""
    try:
        lead_result = (
            supabase.table("leads")
            .select("*")
            .eq("id", lead_id)
            .limit(1)
            .execute()
        )
    except Exception as exc:
        logger.warning("dashboard_lead_detail: DB error for lead %s: %s", lead_id, exc)
        raise HTTPException(status_code=404, detail="Lead not found")
    if not lead_result.data:
        raise HTTPException(status_code=404, detail="Lead not found")

    # Fetch call history
    calls_result = (
        supabase.table("call_logs")
        .select("*")
        .eq("lead_id", lead_id)
        .order("created_at", desc=True)
        .execute()
    )
    calls = calls_result.data or []

    # Compute call_stats
    total_calls = len(calls)
    total_duration = sum(c.get("duration_seconds") or 0 for c in calls)
    objections_seen = list(set(
        c.get("closing_strategy_used")
        for c in calls
        if c.get("closing_strategy_used")
    ))

    return {
        "lead": lead_result.data[0],
        "calls": calls,
        "call_stats": {
            "total_calls": total_calls,
            "total_duration_seconds": total_duration,
            "objections_seen": objections_seen,
        },
    }
```

- [ ] **Step 2: Enhance strategy endpoint**

Replace the existing `dashboard_strategy` endpoint with:

```python
@app.get("/api/dashboard/strategy")
@limiter.limit("60/minute")
async def dashboard_strategy(request: Request, _token: str = Depends(verify_bearer_token)):
    """Strategy performance, daily outcomes, and persona breakdown."""
    # Existing strategy data
    strat_result = supabase.table("strategy_performance").select("*").execute()

    # Daily outcomes (last 14 days)
    from datetime import date, timedelta
    fourteen_days_ago = (date.today() - timedelta(days=14)).isoformat()
    daily_result = (
        supabase.table("call_logs")
        .select("created_at, outcome")
        .gte("created_at", fourteen_days_ago)
        .execute()
    )
    daily_map = {}
    for row in (daily_result.data or []):
        if not row.get("created_at"):
            continue
        day = row["created_at"][:10]
        if day not in daily_map:
            daily_map[day] = {"date": day, "committed": 0, "follow_up": 0, "declined": 0, "no_answer": 0, "other": 0}
        outcome = (row.get("outcome") or "other").lower()
        if outcome in daily_map[day]:
            daily_map[day][outcome] += 1
        else:
            daily_map[day]["other"] += 1
    daily_outcomes = sorted(daily_map.values(), key=lambda x: x["date"])

    # Persona performance
    persona_result = (
        supabase.table("call_logs")
        .select("detected_persona, outcome")
        .not_.is_("detected_persona", "null")
        .execute()
    )
    persona_map = {}
    for row in (persona_result.data or []):
        p = row.get("detected_persona") or "unknown"
        if p not in persona_map:
            persona_map[p] = {"persona": p, "total_calls": 0, "committed_count": 0}
        persona_map[p]["total_calls"] += 1
        if row.get("outcome") == "committed":
            persona_map[p]["committed_count"] += 1
    persona_performance = []
    for p in persona_map.values():
        p["conversion_rate"] = round(p["committed_count"] / p["total_calls"] * 100, 1) if p["total_calls"] > 0 else 0
        persona_performance.append(p)
    persona_performance.sort(key=lambda x: x["conversion_rate"], reverse=True)

    return {
        "strategies": strat_result.data or [],
        "daily_outcomes": daily_outcomes,
        "persona_performance": persona_performance,
    }
```

- [ ] **Step 3: Add call-now endpoint**

Add this new endpoint:

```python
@app.post("/api/dashboard/call-now/{lead_id}")
@limiter.limit("1/2minutes")
@limiter.limit("200/day")
async def call_now(request: Request, lead_id: str, _token: str = Depends(verify_bearer_token)):
    """Quick-call trigger from dashboard. Reuses initiate-call safety checks."""
    lead = (
        supabase.table("leads")
        .select("*")
        .eq("id", lead_id)
        .single()
        .execute()
    )
    if not lead.data:
        raise HTTPException(status_code=404, detail="Lead not found")

    lead_data = lead.data

    if await is_call_active():
        raise HTTPException(status_code=409, detail="Another call is already active")

    if lead_data["status"] in ("do_not_contact", "declined"):
        raise HTTPException(status_code=403, detail="Lead is do-not-contact or declined")

    if not is_safe_destination(lead_data["phone"]):
        raise HTTPException(status_code=403, detail="Blocked destination")

    if not await check_daily_limit():
        raise HTTPException(status_code=429, detail="Daily call limit reached")

    call_context = determine_call_type(lead_data)
    call_type = call_context["call_type"]
    webinar = call_context["webinar"]
    is_returning = call_context["is_returning"]

    # Pull previous call context for returning leads
    previous_notes = ""
    if is_returning:
        prev_calls = (
            supabase.table("call_logs")
            .select("summary, outcome, detected_persona, closing_strategy_used")
            .eq("lead_id", lead_id)
            .order("ended_at", desc=True)
            .limit(3)
            .execute()
        )
        if prev_calls.data:
            notes_parts = [pc["summary"] for pc in prev_calls.data if pc.get("summary")]
            previous_notes = " | ".join(notes_parts)

    dynamic_vars = {
        "lead_name": lead_data["name"],
        "lead_location": lead_data.get("location", "unknown"),
        "lead_email": lead_data.get("email", ""),
        "call_type": call_type,
        "is_returning_lead": "yes" if is_returning else "no",
        "webinar_date": webinar["date_iso"] if webinar else "",
        "webinar_topic": webinar["topic"] if webinar else "",
        "webinar_summary": webinar["summary"] if webinar else "",
        "webinars_invited": ",".join(lead_data.get("webinars_invited") or []),
        "previous_call_notes": previous_notes,
        "detected_persona": lead_data.get("detected_persona", ""),
        "programme_recommended": lead_data.get("programme_recommended", ""),
    }

    from_number = os.environ.get("TWILIO_PHONE_NUMBER", "+17404943597")
    call = retell_client.call.create_phone_call(
        from_number=from_number,
        to_number=lead_data["phone"],
        metadata={"lead_id": lead_id},
        retell_llm_dynamic_variables=dynamic_vars,
    )

    supabase.table("leads").update({"status": "calling"}).eq("id", lead_id).execute()
    logger.info("Dashboard call-now: %s -> %s", call.call_id, lead_data["phone"][:4] + "****")

    return {"call_id": call.call_id, "status": "calling"}
```

- [ ] **Step 4: Commit**

```bash
git add execution/backend/main.py
git commit -m "feat(api): enhance lead detail with call_stats, add strategy daily/persona data, add call-now endpoint"
```

---

## Task 3: Frontend — Update api.js and constants.js

**Files:**
- Modify: `execution/dashboard/src/api.js`
- Modify: `execution/dashboard/src/constants.js`

- [ ] **Step 1: Add apiPost to api.js**

Add this function after the existing `apiFetch` function in `api.js`:

```javascript
/**
 * Authenticated POST request to a dashboard API endpoint.
 *
 * @param {string} path - Path segment appended to /api/dashboard.
 * @param {object} [body] - Optional JSON body.
 * @returns {Promise<object>} Parsed JSON response.
 */
export async function apiPost(path, body = {}) {
  const token = getToken();
  const res = await fetch(`/api/dashboard${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (res.status === 401) {
    clearToken();
    window.location.reload();
    return;
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `API error: ${res.status}`);
  }

  return res.json();
}
```

- [ ] **Step 2: Add new constants to constants.js**

Add these after the existing exports in `constants.js`:

```javascript
/** Polling interval for the command centre view (ms). */
export const POLL_COMMAND = 5000;

/** Funnel stage definitions with colors. */
export const FUNNEL_STAGES = [
  { key: "new", label: "New", color: "#3b82f6" },
  { key: "queued", label: "Queued", color: "#8b5cf6" },
  { key: "in_progress", label: "In Progress", color: "#f97316" },
  { key: "follow_up", label: "Follow Up", color: "#60a5fa" },
  { key: "committed", label: "Committed", color: "#22c55e" },
  { key: "closed", label: "Closed", color: "#52525b" },
];

/** Status badge colors for lead detail view. */
export const STATUS_COLORS = {
  new: "bg-blue-500/15 border-blue-500/30 text-blue-500",
  queued: "bg-violet-500/15 border-violet-500/30 text-violet-500",
  calling: "bg-orange-500/15 border-orange-500/30 text-orange-500",
  in_call: "bg-orange-500/15 border-orange-500/30 text-orange-500",
  follow_up: "bg-blue-400/15 border-blue-400/30 text-blue-400",
  committed: "bg-green-500/15 border-green-500/30 text-green-500",
  declined: "bg-red-500/15 border-red-500/30 text-red-500",
  not_qualified: "bg-zinc-500/15 border-zinc-500/30 text-zinc-400",
  payment_sent: "bg-green-500/15 border-green-500/30 text-green-500",
};

/**
 * Format an ISO timestamp as a relative time string.
 * @param {string|null} isoString
 * @returns {string}
 */
export function formatRelativeTime(isoString) {
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

/**
 * Format an ISO timestamp as "Mar 30, 11:42 AM".
 * @param {string|null} isoString
 * @returns {string}
 */
export function formatDateTime(isoString) {
  if (!isoString) return "";
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString([], { month: "short", day: "numeric" }) + ", " + formatTime(isoString);
  } catch {
    return "";
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add execution/dashboard/src/api.js execution/dashboard/src/constants.js
git commit -m "feat(dashboard): add apiPost, new constants for command centre"
```

---

## Task 4: Frontend — New App.jsx with 4-View Navigation

**Files:**
- Rewrite: `execution/dashboard/src/App.jsx`

- [ ] **Step 1: Rewrite App.jsx**

Replace the entire `App.jsx` with:

```jsx
import { useState } from "react";
import { getToken, clearToken } from "./api";
import Login from "./components/Login";
import CommandCentre from "./components/CommandCentre";
import Pipeline from "./components/Pipeline";
import StrategyAnalytics from "./components/StrategyAnalytics";
import LeadDetail from "./components/LeadDetail";

const TABS = [
  {
    key: "command",
    label: "Command Centre",
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zM14 13a1 1 0 011-1h4a1 1 0 011 1v6a1 1 0 01-1 1h-4a1 1 0 01-1-1v-6z" />
      </svg>
    ),
  },
  {
    key: "pipeline",
    label: "Pipeline",
    icon: (
      <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 4v16M15 4v16M4 9h16M4 15h16" />
      </svg>
    ),
  },
  {
    key: "strategy",
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
  const [activeTab, setActiveTab] = useState("command");
  const [selectedLeadId, setSelectedLeadId] = useState(null);
  const [previousTab, setPreviousTab] = useState("command");

  if (!authenticated) {
    return <Login onLogin={() => setAuthenticated(true)} />;
  }

  function handleLogout() {
    clearToken();
    setAuthenticated(false);
  }

  function navigateToLead(leadId) {
    setPreviousTab(activeTab);
    setSelectedLeadId(leadId);
    setActiveTab("lead-detail");
  }

  function navigateBack() {
    setSelectedLeadId(null);
    setActiveTab(previousTab);
  }

  function handleTabClick(tabKey) {
    setSelectedLeadId(null);
    setActiveTab(tabKey);
  }

  return (
    <div className="flex h-screen bg-base overflow-hidden">
      {/* Icon Sidebar */}
      <nav className="w-14 flex-shrink-0 bg-surface border-r border-glass-border flex flex-col items-center py-4 gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white text-sm font-bold mb-4">
          C
        </div>

        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleTabClick(tab.key)}
            title={tab.label}
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
              activeTab === tab.key
                ? "bg-orange-500/15 border border-orange-500/30 text-orange-500"
                : "text-zinc-600 hover:text-zinc-400 hover:bg-glass-fill"
            }`}
          >
            {tab.icon}
          </button>
        ))}

        <div className="flex-1" />

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
        {activeTab === "command" && <CommandCentre onNavigateToLead={navigateToLead} />}
        {activeTab === "pipeline" && <Pipeline onNavigateToLead={navigateToLead} />}
        {activeTab === "strategy" && <StrategyAnalytics />}
        {activeTab === "lead-detail" && selectedLeadId && (
          <LeadDetail leadId={selectedLeadId} onBack={navigateBack} onNavigateToLead={navigateToLead} />
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add execution/dashboard/src/App.jsx
git commit -m "feat(dashboard): new 4-view navigation with lead detail routing"
```

---

## Task 5: Frontend — Command Centre View

**Files:**
- Create: `execution/dashboard/src/components/CommandCentre.jsx`
- Create: `execution/dashboard/src/components/CallQueuePanel.jsx`
- Create: `execution/dashboard/src/components/LeadFunnel.jsx`
- Create: `execution/dashboard/src/components/ActivityFeed.jsx`

- [ ] **Step 1: Create CommandCentre.jsx**

```jsx
import { useState, useCallback, useEffect } from "react";
import { apiFetch } from "../api";
import { useInterval } from "../hooks/useInterval";
import { POLL_COMMAND } from "../constants";
import ActiveCallCard from "./ActiveCallCard";
import StatCard from "./StatCard";
import CallQueuePanel from "./CallQueuePanel";
import LeadFunnel from "./LeadFunnel";
import ActivityFeed from "./ActivityFeed";
import RecentCallsTable from "./RecentCallsTable";

const DEFAULT_DATA = {
  stats: { total_leads: 0, queued: 0, todays_calls: 0, connected: 0, committed: 0, conversion_rate: 0 },
  active_call: null,
  queue: [],
  funnel: { new: 0, queued: 0, in_progress: 0, follow_up: 0, committed: 0, closed: 0 },
  activity: [],
  recent_calls: [],
};

export default function CommandCentre({ onNavigateToLead }) {
  const [data, setData] = useState(DEFAULT_DATA);
  const [error, setError] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const result = await apiFetch("/command-centre");
      if (result) {
        setData(result);
        setError(null);
      }
    } catch (err) {
      setError(err.message || "Failed to fetch command centre data");
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useInterval(fetchData, POLL_COMMAND);

  const s = data.stats;

  return (
    <div className="space-y-5">
      {error && (
        <div className="flex items-center justify-between glass-card border-red-500/30 px-4 py-2.5 text-sm">
          <span className="text-red-400">{error}</span>
          <button onClick={fetchData} className="text-red-400 hover:text-red-300 font-mono text-xs ml-4">Retry</button>
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Total Leads" value={s.total_leads} color="blue" />
        <StatCard label="Queued" value={s.queued} color="purple" />
        <StatCard label="Today's Calls" value={s.todays_calls} color="blue" />
        <StatCard label="Connected" value={s.connected} color="green" />
        <StatCard label="Committed" value={s.committed} color="yellow" />
        <StatCard label="Conversion" value={`${s.conversion_rate}%`} color="purple" />
      </div>

      {/* Active Call + Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <ActiveCallCard call={data.active_call} />
        <CallQueuePanel queue={data.queue} onNavigateToLead={onNavigateToLead} />
      </div>

      {/* Funnel + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <LeadFunnel funnel={data.funnel} />
        <ActivityFeed activity={data.activity} />
      </div>

      {/* Today's Calls */}
      <RecentCallsTable calls={data.recent_calls} onNavigateToLead={onNavigateToLead} />
    </div>
  );
}
```

- [ ] **Step 2: Create CallQueuePanel.jsx**

```jsx
import { useState } from "react";
import { apiPost } from "../api";
import { maskPhone, formatRelativeTime } from "../constants";

export default function CallQueuePanel({ queue, onNavigateToLead }) {
  const [callingId, setCallingId] = useState(null);
  const [callError, setCallError] = useState(null);

  async function handleCall(leadId) {
    setCallingId(leadId);
    setCallError(null);
    try {
      await apiPost(`/call-now/${leadId}`);
    } catch (err) {
      setCallError(err.message || "Call failed");
    } finally {
      setCallingId(null);
    }
  }

  if (!queue || queue.length === 0) {
    return (
      <div className="glass-card p-5">
        <h3 className="label-mono text-zinc-400 mb-3">Call Queue</h3>
        <p className="text-sm text-zinc-600 text-center py-6">No leads in queue</p>
      </div>
    );
  }

  return (
    <div className="glass-card p-5">
      <h3 className="label-mono text-zinc-400 mb-3">Call Queue</h3>
      {callError && (
        <p className="text-xs text-red-400 mb-2">{callError}</p>
      )}
      <div className="space-y-2 max-h-[300px] overflow-y-auto">
        {queue.map((lead) => (
          <div key={lead.id} className="flex items-center justify-between bg-white/[0.02] rounded-lg border border-glass-border px-3 py-2 hover:border-glass-border-hover transition-colors">
            <button
              type="button"
              onClick={() => onNavigateToLead(lead.id)}
              className="flex-1 text-left min-w-0"
            >
              <p className="text-sm font-medium text-zinc-200 truncate">{lead.name}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-zinc-500 font-mono">{maskPhone(lead.phone)}</span>
                {lead.priority > 1 && (
                  <span className="text-xs font-mono text-orange-500">P{lead.priority}</span>
                )}
                {lead.retry_count > 0 && (
                  <span className="text-xs font-mono text-zinc-500">retry {lead.retry_count}</span>
                )}
                {lead.next_call_type && (
                  <span className="text-xs font-mono text-blue-400">{lead.next_call_type}</span>
                )}
              </div>
            </button>
            <button
              onClick={() => handleCall(lead.id)}
              disabled={callingId === lead.id}
              className="ml-2 px-3 py-1.5 rounded-lg text-xs font-mono font-medium bg-green-500/15 border border-green-500/30 text-green-500 hover:bg-green-500/25 disabled:opacity-50 transition-colors flex-shrink-0"
            >
              {callingId === lead.id ? "..." : "Call"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create LeadFunnel.jsx**

```jsx
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { FUNNEL_STAGES } from "../constants";

function FunnelTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-zinc-800 border border-glass-border rounded-lg shadow-xl px-3 py-2 text-sm">
      <p className="font-medium text-zinc-100">{d.label}</p>
      <p className="text-zinc-400">{d.count} leads</p>
    </div>
  );
}

export default function LeadFunnel({ funnel }) {
  const chartData = FUNNEL_STAGES.map((stage) => ({
    label: stage.label,
    count: funnel[stage.key] || 0,
    color: stage.color,
  }));

  const total = chartData.reduce((sum, d) => sum + d.count, 0);

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="label-mono text-zinc-400">Lead Funnel</h3>
        <span className="text-xs text-zinc-500 font-mono">{total} total</span>
      </div>

      {total === 0 ? (
        <p className="text-sm text-zinc-600 text-center py-6">No leads yet</p>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#71717a" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#71717a" }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip content={<FunnelTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
            <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={36}>
              {chartData.map((entry, idx) => (
                <Cell key={idx} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Create ActivityFeed.jsx**

```jsx
import { formatRelativeTime } from "../constants";

function ActivityIcon({ type }) {
  if (type === "call") {
    return (
      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-500/15 border border-green-500/30 flex items-center justify-center">
        <svg className="w-3 h-3 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
        </svg>
      </div>
    );
  }
  return (
    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500/15 border border-blue-500/30 flex items-center justify-center">
      <svg className="w-3 h-3 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    </div>
  );
}

export default function ActivityFeed({ activity }) {
  return (
    <div className="glass-card p-5">
      <h3 className="label-mono text-zinc-400 mb-3">Activity Feed</h3>

      {!activity || activity.length === 0 ? (
        <p className="text-sm text-zinc-600 text-center py-6">No recent activity</p>
      ) : (
        <div className="space-y-2 max-h-[300px] overflow-y-auto">
          {activity.map((item, idx) => (
            <div key={idx} className="flex items-start gap-2.5 py-1.5">
              <ActivityIcon type={item.type} />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-zinc-300 truncate">
                  <span className="font-medium">{item.lead_name}</span>
                  {" "}
                  <span className="text-zinc-500">{item.detail}</span>
                </p>
                <p className="text-xs text-zinc-600 font-mono mt-0.5">{formatRelativeTime(item.timestamp)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Verify Command Centre renders**

Run: `cd execution/dashboard && npm run dev`

Open http://localhost:5173 — the Command Centre tab should be the default view showing stats, active call, queue, funnel, activity feed, and calls table.

- [ ] **Step 6: Commit**

```bash
git add execution/dashboard/src/components/CommandCentre.jsx execution/dashboard/src/components/CallQueuePanel.jsx execution/dashboard/src/components/LeadFunnel.jsx execution/dashboard/src/components/ActivityFeed.jsx
git commit -m "feat(dashboard): command centre view with stats, queue, funnel, activity feed"
```

---

## Task 6: Frontend — Lead Detail View

**Files:**
- Create: `execution/dashboard/src/components/LeadDetail.jsx`
- Create: `execution/dashboard/src/components/CallTimeline.jsx`
- Create: `execution/dashboard/src/components/QuickActions.jsx`

- [ ] **Step 1: Create CallTimeline.jsx**

```jsx
import { useState } from "react";
import { formatDateTime, formatDuration } from "../constants";
import OutcomeBadge from "./OutcomeBadge";

function TranscriptViewer({ transcript }) {
  const [expanded, setExpanded] = useState(false);
  if (!transcript) return <p className="text-xs text-zinc-600 italic">No transcript</p>;

  const isLong = transcript.length > 300;
  const display = expanded || !isLong ? transcript : transcript.slice(0, 300) + "...";

  return (
    <div>
      <pre className="text-xs text-zinc-400 whitespace-pre-wrap bg-white/[0.02] border border-glass-border rounded-lg p-3 max-h-80 overflow-y-auto">
        {display}
      </pre>
      {isLong && (
        <button onClick={() => setExpanded(!expanded)} className="mt-1 text-xs text-orange-500 hover:text-orange-400 font-mono">
          {expanded ? "Show less" : "Show full transcript"}
        </button>
      )}
    </div>
  );
}

export default function CallTimeline({ calls }) {
  const [expandedId, setExpandedId] = useState(null);

  if (!calls || calls.length === 0) {
    return <p className="text-sm text-zinc-600 italic py-4">No call records yet</p>;
  }

  const sorted = [...calls].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

  return (
    <div className="space-y-3">
      {sorted.map((call, idx) => {
        const isExpanded = expandedId === call.id;
        const num = sorted.length - idx;

        return (
          <div key={call.id} className="glass-card overflow-hidden">
            {/* Header — always visible */}
            <button
              type="button"
              onClick={() => setExpandedId(isExpanded ? null : call.id)}
              className="w-full text-left px-4 py-3 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
            >
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs font-mono text-zinc-500">#{num}</span>
                <span className="text-sm text-zinc-300">{formatDateTime(call.started_at || call.created_at)}</span>
                <span className="text-xs font-mono text-zinc-500">{formatDuration(call.duration_seconds)}</span>
                <OutcomeBadge outcome={call.outcome} />
              </div>
              <svg className={`w-4 h-4 text-zinc-500 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Expanded details */}
            {isExpanded && (
              <div className="px-4 pb-4 space-y-3 border-t border-glass-border pt-3">
                {/* Badges */}
                <div className="flex flex-wrap gap-2">
                  {call.closing_strategy_used && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono font-medium bg-violet-500/15 border border-violet-500/30 text-violet-500">
                      {call.closing_strategy_used.replace(/_/g, " ")}
                    </span>
                  )}
                  {call.detected_persona && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono font-medium bg-blue-500/15 border border-blue-500/30 text-blue-500">
                      {call.detected_persona.replace(/_/g, " ")}
                    </span>
                  )}
                  {call.disconnection_reason && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono font-medium bg-zinc-500/15 border border-zinc-500/30 text-zinc-400">
                      {call.disconnection_reason.replace(/_/g, " ")}
                    </span>
                  )}
                </div>

                {/* Summary */}
                {call.summary && (
                  <div>
                    <p className="label-mono mb-1">Summary</p>
                    <p className="text-sm text-zinc-400 leading-relaxed">{call.summary}</p>
                  </div>
                )}

                {/* Recording */}
                {call.recording_url && (
                  <div>
                    <p className="label-mono mb-1">Recording</p>
                    <audio controls src={call.recording_url} className="w-full h-8" preload="none" />
                  </div>
                )}

                {/* Transcript */}
                <div>
                  <p className="label-mono mb-1">Transcript</p>
                  <TranscriptViewer transcript={call.transcript} />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Create QuickActions.jsx**

```jsx
import { useState } from "react";
import { apiPost } from "../api";

export default function QuickActions({ leadId, leadStatus, onRefresh }) {
  const [calling, setCalling] = useState(false);
  const [error, setError] = useState(null);

  const canCall = !["do_not_contact", "calling", "in_call"].includes(leadStatus);

  async function handleCallNow() {
    setCalling(true);
    setError(null);
    try {
      await apiPost(`/call-now/${leadId}`);
      if (onRefresh) onRefresh();
    } catch (err) {
      setError(err.message || "Call failed");
    } finally {
      setCalling(false);
    }
  }

  return (
    <div className="glass-card p-4">
      <h3 className="label-mono text-zinc-400 mb-3">Quick Actions</h3>
      {error && <p className="text-xs text-red-400 mb-2">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleCallNow}
          disabled={!canCall || calling}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-green-500/15 border border-green-500/30 text-green-500 hover:bg-green-500/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {calling ? "Calling..." : "Call Now"}
        </button>
        <button
          disabled
          className="px-4 py-2 rounded-lg text-sm font-medium bg-blue-500/15 border border-blue-500/30 text-blue-400 opacity-40 cursor-not-allowed"
          title="Coming soon"
        >
          Schedule Follow-up
        </button>
        <button
          disabled
          className="px-4 py-2 rounded-lg text-sm font-medium bg-zinc-500/15 border border-zinc-500/30 text-zinc-400 opacity-40 cursor-not-allowed"
          title="Coming soon"
        >
          Add Note
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create LeadDetail.jsx**

```jsx
import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "../api";
import { maskPhone, formatDuration, formatRelativeTime, STATUS_COLORS } from "../constants";
import OutcomeBadge from "./OutcomeBadge";
import CallTimeline from "./CallTimeline";
import QuickActions from "./QuickActions";

export default function LeadDetail({ leadId, onBack }) {
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
      setError(err.message || "Failed to load lead");
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => { fetchLead(); }, [fetchLead]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-700 border-t-orange-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16 space-y-3">
        <p className="text-sm text-red-400">{error}</p>
        <button onClick={fetchLead} className="text-sm text-orange-500 hover:text-orange-400 font-mono">Retry</button>
        <br />
        <button onClick={onBack} className="text-sm text-zinc-500 hover:text-zinc-300 font-mono mt-2">Go Back</button>
      </div>
    );
  }

  const lead = data?.lead;
  const calls = data?.calls || [];
  const stats = data?.call_stats || {};

  if (!lead) return null;

  const statusClass = STATUS_COLORS[lead.status] || "bg-zinc-500/15 border-zinc-500/30 text-zinc-400";

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Header */}
      <div className="flex items-start gap-4">
        <button
          onClick={onBack}
          className="mt-1 p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-glass-fill transition-colors flex-shrink-0"
          title="Go back"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-zinc-50">{lead.name}</h1>
            <OutcomeBadge outcome={lead.outcome || lead.status} />
            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono font-medium border ${statusClass}`}>
              {lead.status?.replace(/_/g, " ")}
            </span>
          </div>
          <div className="flex items-center gap-4 mt-1.5 text-sm text-zinc-500 flex-wrap">
            <span className="font-mono">{maskPhone(lead.phone)}</span>
            {lead.email && <span>{lead.email}</span>}
            {lead.location && <span>{lead.location}</span>}
            {lead.source && <span className="font-mono text-xs">via {lead.source}</span>}
          </div>
        </div>
      </div>

      {/* Two-column grid: Profile + Call Intelligence */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Profile Card */}
        <div className="glass-card p-5 space-y-3">
          <h3 className="label-mono text-zinc-400">Profile</h3>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
            {lead.detected_persona && (
              <>
                <dt className="text-zinc-500">Persona</dt>
                <dd>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono font-medium bg-blue-500/15 border border-blue-500/30 text-blue-500">
                    {lead.detected_persona.replace(/_/g, " ")}
                  </span>
                </dd>
              </>
            )}
            {lead.programme_recommended && (
              <>
                <dt className="text-zinc-500">Programme</dt>
                <dd className="text-zinc-200">{lead.programme_recommended}</dd>
              </>
            )}
            {lead.motivation && (
              <>
                <dt className="text-zinc-500">Motivation</dt>
                <dd className="text-zinc-200">{lead.motivation}</dd>
              </>
            )}
            {lead.current_role && (
              <>
                <dt className="text-zinc-500">Current Role</dt>
                <dd className="text-zinc-200">{lead.current_role}</dd>
              </>
            )}
            {lead.experience_level && (
              <>
                <dt className="text-zinc-500">Experience</dt>
                <dd className="text-zinc-200">{lead.experience_level}</dd>
              </>
            )}
            {lead.country && (
              <>
                <dt className="text-zinc-500">Country</dt>
                <dd className="text-zinc-200">{lead.country}</dd>
              </>
            )}
            {lead.currency && (
              <>
                <dt className="text-zinc-500">Currency</dt>
                <dd className="text-zinc-200 font-mono">{lead.currency}</dd>
              </>
            )}
            <dt className="text-zinc-500">Priority</dt>
            <dd className="text-zinc-200 font-mono">{lead.priority ?? 1}</dd>
            {lead.notes && (
              <>
                <dt className="text-zinc-500">Notes</dt>
                <dd className="text-zinc-300 col-span-2 text-xs leading-relaxed bg-white/[0.02] rounded-lg p-2 border border-glass-border">{lead.notes}</dd>
              </>
            )}
          </dl>
        </div>

        {/* Call Intelligence Card */}
        <div className="glass-card p-5 space-y-3">
          <h3 className="label-mono text-zinc-400">Call Intelligence</h3>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
            <dt className="text-zinc-500">Total Calls</dt>
            <dd className="text-zinc-200 font-mono">{stats.total_calls || 0}</dd>

            <dt className="text-zinc-500">Total Talk Time</dt>
            <dd className="text-zinc-200 font-mono">{formatDuration(stats.total_duration_seconds || 0)}</dd>

            <dt className="text-zinc-500">Last Called</dt>
            <dd className="text-zinc-200">{formatRelativeTime(lead.last_call_at) || "Never"}</dd>

            {lead.next_call_at && (
              <>
                <dt className="text-zinc-500">Next Call</dt>
                <dd className="text-zinc-200">
                  {new Date(lead.next_call_at).toLocaleDateString([], { month: "short", day: "numeric" })}
                  {lead.next_call_type && <span className="text-blue-400 ml-1 font-mono text-xs">({lead.next_call_type})</span>}
                </dd>
              </>
            )}

            <dt className="text-zinc-500">Retries</dt>
            <dd className="text-zinc-200 font-mono">{lead.retry_count ?? 0} / {lead.max_retries ?? 2}</dd>

            {lead.last_strategy_used && (
              <>
                <dt className="text-zinc-500">Last Strategy</dt>
                <dd>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono font-medium bg-violet-500/15 border border-violet-500/30 text-violet-500">
                    {lead.last_strategy_used.replace(/_/g, " ")}
                  </span>
                </dd>
              </>
            )}

            {lead.follow_up_at && (
              <>
                <dt className="text-zinc-500">Follow-up</dt>
                <dd className="text-zinc-200">{new Date(lead.follow_up_at).toLocaleDateString([], { month: "short", day: "numeric" })}</dd>
              </>
            )}

            {(lead.webinars_invited?.length > 0) && (
              <>
                <dt className="text-zinc-500">Webinars Invited</dt>
                <dd className="text-zinc-200 font-mono text-xs">{lead.webinars_invited.join(", ")}</dd>
              </>
            )}

            {stats.objections_seen?.length > 0 && (
              <>
                <dt className="text-zinc-500">Strategies Used</dt>
                <dd className="flex flex-wrap gap-1">
                  {stats.objections_seen.map((o) => (
                    <span key={o} className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-red-500/10 border border-red-500/20 text-red-400">
                      {o.replace(/_/g, " ")}
                    </span>
                  ))}
                </dd>
              </>
            )}
          </dl>
        </div>
      </div>

      {/* Quick Actions */}
      <QuickActions leadId={leadId} leadStatus={lead.status} onRefresh={fetchLead} />

      {/* Call History Timeline */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h3 className="label-mono text-zinc-400">Call History</h3>
          <span className="inline-flex items-center justify-center bg-white/[0.06] border border-glass-border rounded-full px-2 text-xs font-mono text-zinc-400">
            {calls.length}
          </span>
        </div>
        <CallTimeline calls={calls} />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify Lead Detail renders**

Navigate to Pipeline tab → click a lead card. Should navigate to the full-page Lead Detail view with profile, call intelligence, quick actions, and call timeline.

- [ ] **Step 5: Commit**

```bash
git add execution/dashboard/src/components/LeadDetail.jsx execution/dashboard/src/components/CallTimeline.jsx execution/dashboard/src/components/QuickActions.jsx
git commit -m "feat(dashboard): lead detail view with profile, call intelligence, timeline, quick actions"
```

---

## Task 7: Frontend — Enhance Pipeline + LeadCard + RecentCallsTable

**Files:**
- Modify: `execution/dashboard/src/components/Pipeline.jsx`
- Modify: `execution/dashboard/src/components/LeadCard.jsx`
- Modify: `execution/dashboard/src/components/RecentCallsTable.jsx`
- Delete: `execution/dashboard/src/components/LeadSidePanel.jsx`
- Delete: `execution/dashboard/src/components/LiveView.jsx`

- [ ] **Step 1: Rewrite Pipeline.jsx with search/filter, no side panel**

Replace entire `Pipeline.jsx`:

```jsx
import { useState, useEffect, useCallback, useMemo } from "react";
import { apiFetch } from "../api";
import { useInterval } from "../hooks/useInterval";
import { KANBAN_COLUMNS, POLL_PIPELINE } from "../constants";
import KanbanColumn from "./KanbanColumn";
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

export default function Pipeline({ onNavigateToLead }) {
  const [leads, setLeads] = useState([]);
  const [search, setSearch] = useState("");
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

  const filtered = useMemo(() => {
    if (!search.trim()) return leads;
    const q = search.toLowerCase();
    return leads.filter(
      (l) =>
        (l.name || "").toLowerCase().includes(q) ||
        (l.phone || "").includes(q) ||
        (l.programme_recommended || "").toLowerCase().includes(q)
    );
  }, [leads, search]);

  const columns = KANBAN_COLUMNS.map((col) => ({
    ...col,
    leads: filtered.filter((lead) => col.statuses.includes(lead.status)),
  }));

  return (
    <div className="space-y-4">
      {error && (
        <div className="glass-card border-red-500/30 px-4 py-3 text-sm text-red-400">{error}</div>
      )}

      {/* Search bar */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search leads..."
            className="w-full pl-10 pr-3 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-600 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-colors"
          />
        </div>
        {search && (
          <span className="self-center text-xs text-zinc-500 font-mono">{filtered.length} results</span>
        )}
      </div>

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
              onLeadClick={onNavigateToLead}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Enhance LeadCard.jsx with persona, programme, follow-up badges**

Replace entire `LeadCard.jsx`:

```jsx
import { maskPhone, formatRelativeTime } from "../constants";
import OutcomeBadge from "./OutcomeBadge";

export default function LeadCard({ lead, onClick }) {
  return (
    <button
      type="button"
      onClick={() => onClick(lead.id)}
      className="w-full text-left bg-white/[0.03] rounded-lg border border-glass-border p-3 cursor-pointer hover:border-glass-border-hover hover:bg-white/[0.05] transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500/30"
    >
      <p className="font-medium text-sm text-zinc-100 truncate">{lead.name || "Unknown"}</p>
      <p className="text-xs text-zinc-500 font-mono mt-0.5">{maskPhone(lead.phone)}</p>

      {/* Badges row */}
      <div className="flex flex-wrap gap-1 mt-2">
        {lead.programme_recommended && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-blue-500/10 border border-blue-500/20 text-blue-400 truncate max-w-[140px]">
            {lead.programme_recommended}
          </span>
        )}
        {lead.detected_persona && (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-violet-500/10 border border-violet-500/20 text-violet-400">
            {lead.detected_persona.replace(/_/g, " ")}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-zinc-600 font-mono">{formatRelativeTime(lead.updated_at)}</span>
        <div className="flex items-center gap-1.5">
          {lead.retry_count > 0 && (
            <span className="inline-flex items-center rounded-full bg-orange-500/15 border border-orange-500/30 text-orange-500 px-1.5 text-xs font-mono">
              {lead.retry_count}
            </span>
          )}
        </div>
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

- [ ] **Step 3: Enhance RecentCallsTable with extra columns + click-to-navigate**

Replace entire `RecentCallsTable.jsx`:

```jsx
import { useState } from "react";
import { formatTime, formatDuration } from "../constants";
import OutcomeBadge from "./OutcomeBadge";
import EmptyState from "./EmptyState";

export default function RecentCallsTable({ calls, onNavigateToLead }) {
  const [expandedId, setExpandedId] = useState(null);

  if (!calls || calls.length === 0) {
    return (
      <div className="glass-card">
        <EmptyState title="No calls yet today" message="Recent calls will appear here once the dialer starts." />
      </div>
    );
  }

  return (
    <div className="glass-card overflow-hidden">
      <div className="px-4 py-3 border-b border-glass-border">
        <h3 className="label-mono text-zinc-400">Today's Calls</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="table-auto w-full text-sm">
          <thead>
            <tr className="border-b border-glass-border text-left">
              <th className="px-4 py-2 label-mono">Time</th>
              <th className="px-4 py-2 label-mono">Lead</th>
              <th className="px-4 py-2 label-mono">Duration</th>
              <th className="px-4 py-2 label-mono">Outcome</th>
              <th className="px-4 py-2 label-mono hidden lg:table-cell">Persona</th>
              <th className="px-4 py-2 label-mono hidden lg:table-cell">Strategy</th>
              <th className="px-4 py-2 label-mono w-8"></th>
            </tr>
          </thead>
          <tbody>
            {calls.map((call) => {
              const isExpanded = expandedId === call.id;
              return (
                <CallRow
                  key={call.id}
                  call={call}
                  expanded={isExpanded}
                  onToggle={() => setExpandedId(isExpanded ? null : call.id)}
                  onNavigateToLead={onNavigateToLead}
                />
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CallRow({ call, expanded, onToggle, onNavigateToLead }) {
  return (
    <>
      <tr onClick={onToggle} className="border-b border-glass-border cursor-pointer hover:bg-white/[0.02] transition-colors">
        <td className="px-4 py-2.5 text-zinc-400 font-mono text-xs whitespace-nowrap">{formatTime(call.started_at)}</td>
        <td className="px-4 py-2.5">
          {onNavigateToLead && call.lead_id ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onNavigateToLead(call.lead_id); }}
              className="font-medium text-zinc-200 hover:text-orange-400 transition-colors"
            >
              {call.lead_name || "Unknown"}
            </button>
          ) : (
            <span className="font-medium text-zinc-200">{call.lead_name || "Unknown"}</span>
          )}
        </td>
        <td className="px-4 py-2.5 text-zinc-400 font-mono tabular-nums text-xs">{formatDuration(call.duration_seconds)}</td>
        <td className="px-4 py-2.5"><OutcomeBadge outcome={call.outcome} /></td>
        <td className="px-4 py-2.5 hidden lg:table-cell text-xs text-zinc-500 font-mono">{call.detected_persona?.replace(/_/g, " ") || "—"}</td>
        <td className="px-4 py-2.5 hidden lg:table-cell text-xs text-zinc-500 font-mono">{call.closing_strategy_used?.replace(/_/g, " ") || "—"}</td>
        <td className="px-4 py-2.5 text-zinc-600">
          <svg className={`w-4 h-4 transition-transform ${expanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-white/[0.02]">
          <td colSpan={7} className="px-4 py-3">
            <div className="space-y-2 text-sm">
              <div>
                <p className="label-mono mb-1">Summary</p>
                <p className="text-zinc-400 text-xs">{call.summary || "No summary available"}</p>
              </div>
              {call.recording_url && (
                <div>
                  <p className="label-mono mb-1">Recording</p>
                  <audio controls src={call.recording_url} className="w-full max-w-md" preload="none" />
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
```

- [ ] **Step 4: Delete old files**

```bash
rm execution/dashboard/src/components/LeadSidePanel.jsx
rm execution/dashboard/src/components/LiveView.jsx
```

- [ ] **Step 5: Verify Pipeline and all navigation works**

Run: `cd execution/dashboard && npm run dev`

Test:
1. Command Centre loads as home
2. Click a lead name in the calls table → navigates to Lead Detail
3. Click back → returns to Command Centre
4. Switch to Pipeline → Kanban renders with enhanced cards
5. Search bar filters leads
6. Click a kanban card → navigates to Lead Detail
7. Click back → returns to Pipeline

- [ ] **Step 6: Commit**

```bash
git add -A execution/dashboard/src/components/
git commit -m "feat(dashboard): enhanced pipeline with search, richer cards, remove side panel, enhanced calls table"
```

---

## Task 8: Frontend — Enhance Strategy Analytics

**Files:**
- Modify: `execution/dashboard/src/components/StrategyAnalytics.jsx`

- [ ] **Step 1: Add daily outcomes chart + persona table**

Replace the entire `StrategyAnalytics.jsx` with the enhanced version. Keep all existing code and add two new sections after the strategy table:

1. **Daily Outcomes Chart** — Stacked bar chart showing committed/follow_up/declined/no_answer per day (last 14 days)
2. **Persona Performance Table** — Table showing persona, total calls, committed count, conversion rate

Add these imports at the top (merge with existing):

```jsx
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  ResponsiveContainer, Cell, Legend,
} from "recharts";
```

After the existing strategy table `</div>`, add:

```jsx
      {/* Daily Outcomes Chart */}
      {dailyOutcomes.length > 0 && (
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold mb-4 text-zinc-100">Outcomes Over Time (14 days)</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={dailyOutcomes} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#71717a" }} axisLine={false} tickLine={false} tickFormatter={(v) => v.slice(5)} />
              <YAxis tick={{ fontSize: 11, fill: "#71717a" }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ backgroundColor: "#27272a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "8px", fontSize: "12px" }} />
              <Legend wrapperStyle={{ fontSize: "12px" }} />
              <Bar dataKey="committed" stackId="a" fill="#22c55e" radius={[0, 0, 0, 0]} />
              <Bar dataKey="follow_up" stackId="a" fill="#3b82f6" />
              <Bar dataKey="declined" stackId="a" fill="#ef4444" />
              <Bar dataKey="no_answer" stackId="a" fill="#71717a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Persona Performance */}
      {personaPerf.length > 0 && (
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold mb-4 text-zinc-100">Persona Performance</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-glass-border">
                  <th className="text-left px-4 py-3 label-mono">Persona</th>
                  <th className="text-right px-4 py-3 label-mono">Total Calls</th>
                  <th className="text-right px-4 py-3 label-mono">Committed</th>
                  <th className="text-right px-4 py-3 label-mono">Conversion</th>
                </tr>
              </thead>
              <tbody>
                {personaPerf.map((p, idx) => (
                  <tr key={p.persona} className={`border-b border-glass-border ${idx % 2 === 1 ? "bg-white/[0.01]" : ""}`}>
                    <td className="px-4 py-3 font-semibold text-zinc-200">{p.persona.replace(/_/g, " ")}</td>
                    <td className="px-4 py-3 text-right text-zinc-400 font-mono">{p.total_calls}</td>
                    <td className="px-4 py-3 text-right text-zinc-400 font-mono">{p.committed_count}</td>
                    <td className={`px-4 py-3 text-right font-mono font-medium ${rateTextClass(p.conversion_rate)}`}>{p.conversion_rate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
```

Update the data fetching to include the new fields. Change the state and fetch:

```jsx
const [strategies, setStrategies] = useState([]);
const [dailyOutcomes, setDailyOutcomes] = useState([]);
const [personaPerf, setPersonaPerf] = useState([]);

const fetchStrategy = useCallback(async () => {
  try {
    const data = await apiFetch("/strategy");
    setStrategies(data.strategies || []);
    setDailyOutcomes(data.daily_outcomes || []);
    setPersonaPerf(data.persona_performance || []);
    setError(null);
  } catch (err) {
    setError(err.message || "Failed to load strategy data");
  }
}, []);
```

- [ ] **Step 2: Verify Strategy tab renders with new charts**

Open Strategy tab — should show existing bar chart + table, plus new daily outcomes stacked bar chart and persona performance table.

- [ ] **Step 3: Commit**

```bash
git add execution/dashboard/src/components/StrategyAnalytics.jsx
git commit -m "feat(dashboard): strategy tab with daily outcomes chart and persona performance table"
```

---

## Task 9: Deploy

**Files:**
- Backend: `execution/backend/main.py`
- Frontend: build and deploy

- [ ] **Step 1: Build the frontend**

```bash
cd execution/dashboard && npm run build
```

Expected: `dist/` directory created with built assets.

- [ ] **Step 2: Deploy backend + frontend to server**

```bash
# Copy updated backend
scp -o StrictHostKeyChecking=no execution/backend/main.py root@72.61.201.148:/docker/sarah-backend/main.py

# Copy built frontend
scp -r -o StrictHostKeyChecking=no execution/dashboard/dist/* root@72.61.201.148:/docker/sarah-backend/static/

# Rebuild and restart
ssh -o StrictHostKeyChecking=no root@72.61.201.148 "cd /docker/sarah-backend && docker compose up -d --build"
```

- [ ] **Step 3: Verify deployment**

```bash
curl -s https://sarah-api.srv1297445.hstgr.cloud/health
```

Expected: `{"status":"ok","agent":"Sarah"}`

Open https://sarah-api.srv1297445.hstgr.cloud in browser, log in with dashboard token, verify command centre loads.

- [ ] **Step 4: Final commit and push**

```bash
git add -A
git commit -m "feat: command centre dashboard — build and deploy"
git push
```
