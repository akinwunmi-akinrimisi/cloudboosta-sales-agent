# Dashboard CRM Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expand the 3-tab dashboard into a 14-page CRM with URL routing, 45 API endpoints, 10 database views, and schema migrations — while keeping existing functionality intact.

**Architecture:** New `dashboard_routes.py` FastAPI router at `/api/*` replaces old `/api/dashboard/*` endpoints. React app migrates from tab-based state to `react-router-dom` routes. Database gets 9 new columns, 9 new lead statuses, and 10 views. Built in Pre-Sprint + 5 Sprints, each delivering working software.

**Tech Stack:** Python 3.11 / FastAPI / Supabase / slowapi (backend), React 19 / react-router-dom v7 / Tailwind CSS / Recharts / Lucide React (frontend). Anthropic `frontend-design` skill for all UI work.

**Design Spec:** `docs/superpowers/specs/2026-04-10-dashboard-crm-overhaul-design.md`

---

## File Map

### New Files

| File | Responsibility |
|------|---------------|
| `execution/backend/schema/007_dashboard_migration.sql` | New columns, statuses, state machine update |
| `execution/backend/schema/008_dashboard_views.sql` | 10 views + 5 indexes |
| `execution/backend/dashboard_routes.py` | All 45 new API endpoints as FastAPI APIRouter |
| `execution/dashboard/src/AuthContext.jsx` | React context for token + auth state |
| `execution/dashboard/src/Layout.jsx` | Sidebar + topbar shell wrapping all pages |
| `execution/dashboard/src/pages/Home.jsx` | Home dashboard (stats, live call, dialer, health) |
| `execution/dashboard/src/pages/Leads.jsx` | Lead list with search, filter, CSV import |
| `execution/dashboard/src/pages/LeadDetailPage.jsx` | Lead detail with tabs (wraps existing LeadDetail) |
| `execution/dashboard/src/pages/PipelinePage.jsx` | Kanban board (wraps existing Pipeline) |
| `execution/dashboard/src/pages/Outreach.jsx` | Outreach queue, delivery log, replies |
| `execution/dashboard/src/pages/Bookings.jsx` | Cal.com bookings calendar + list |
| `execution/dashboard/src/pages/Calls.jsx` | Call history with transcript slide-out |
| `execution/dashboard/src/pages/FollowUps.jsx` | Follow-up queue grouped by urgency |
| `execution/dashboard/src/pages/Committed.jsx` | Committed leads + payment tracking |
| `execution/dashboard/src/pages/Enrolled.jsx` | Enrolled students + CSV export |
| `execution/dashboard/src/pages/Analytics.jsx` | 6 chart sections (wraps existing StrategyAnalytics) |
| `execution/dashboard/src/pages/Activity.jsx` | Pipeline activity log |
| `execution/dashboard/src/pages/Errors.jsx` | Error log with nav badge |
| `execution/dashboard/src/pages/Settings.jsx` | Settings with 5 tabs |
| `execution/dashboard/src/components/DataTable.jsx` | Reusable sortable/paginated table |
| `execution/dashboard/src/components/FilterBar.jsx` | Reusable filter dropdowns + search |
| `execution/dashboard/src/components/StatusBadge.jsx` | Colored pills for all 23 statuses |
| `execution/dashboard/src/components/LoadingSkeleton.jsx` | Shimmer loading placeholders |
| `execution/dashboard/src/components/Sidebar.jsx` | Navigation sidebar component |
| `execution/dashboard/src/components/Topbar.jsx` | Top bar with page title + indicators |

### Modified Files

| File | Changes |
|------|---------|
| `execution/backend/main.py:90-101` | Add PUT/DELETE to CORS allow_methods |
| `execution/backend/main.py:56` | Import and include new router |
| `execution/dashboard/src/api.js` | Change prefix from `/api/dashboard` to `/api`, add apiPut/apiDelete |
| `execution/dashboard/src/main.jsx` | Wrap App in BrowserRouter |
| `execution/dashboard/src/App.jsx` | Replace tab-based nav with Routes |
| `execution/dashboard/src/constants.js` | Add new status colors for 9 new statuses |
| `execution/dashboard/package.json` | Add react-router-dom, lucide-react |

---

## PRE-SPRINT: Schema Migration + Infrastructure

### Task 1: Database Migration — New Columns and Statuses

**Files:**
- Create: `execution/backend/schema/007_dashboard_migration.sql`

This migration adds columns and statuses needed by the CRM dashboard. It must run BEFORE any views or API endpoints are built.

- [ ] **Step 1: Write the migration SQL**

```sql
-- 007_dashboard_migration.sql
-- CRM Dashboard schema migration:
--   1. Add first_name/last_name split to leads
--   2. Add enrichment and scheduling columns
--   3. Add objections_raised and sentiment to call_logs
--   4. Add status column to pipeline_logs
--   5. Expand leads status CHECK to 23 statuses
--   6. Update state machine trigger

-- ============================================================================
-- 1. SPLIT name INTO first_name + last_name
-- ============================================================================

ALTER TABLE leads ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_name TEXT;

-- Populate from existing name column (split on first space)
UPDATE leads
SET first_name = split_part(name, ' ', 1),
    last_name = CASE
      WHEN position(' ' in name) > 0 THEN substring(name from position(' ' in name) + 1)
      ELSE ''
    END
WHERE first_name IS NULL;

-- ============================================================================
-- 2. ADD ENRICHMENT + SCHEDULING COLUMNS TO leads
-- ============================================================================

ALTER TABLE leads ADD COLUMN IF NOT EXISTS has_whatsapp BOOLEAN DEFAULT FALSE;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS has_email BOOLEAN DEFAULT FALSE;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS timezone TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS call_scheduled_at TIMESTAMPTZ;

-- Backfill has_email from existing email column
UPDATE leads SET has_email = TRUE WHERE email IS NOT NULL AND email != '';

-- ============================================================================
-- 3. ADD COLUMNS TO call_logs
-- ============================================================================

ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS objections_raised TEXT[] DEFAULT '{}';
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS sentiment TEXT;

-- ============================================================================
-- 4. ADD status COLUMN TO pipeline_logs
-- ============================================================================

ALTER TABLE pipeline_logs ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'success';

-- ============================================================================
-- 5. EXPAND leads STATUS CHECK CONSTRAINT (14 -> 23 statuses)
-- ============================================================================

ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_status_check;
ALTER TABLE leads ADD CONSTRAINT leads_status_check CHECK (status IN (
    'new', 'enriched', 'outreach_sent', 'outreach_no_response',
    'call_scheduled', 'queued', 'calling', 'in_call',
    'committed', 'follow_up', 'follow_up_scheduled',
    'payment_pending', 'enrolled',
    'declined', 'not_qualified',
    'no_answer', 'voicemail', 'busy', 'exhausted', 'invalid_number',
    'payment_sent', 'do_not_contact', 'failed'
));

-- ============================================================================
-- 6. UPDATE STATE MACHINE TRIGGER (add new transitions)
-- ============================================================================

DROP TRIGGER IF EXISTS trg_enforce_lead_status ON leads;
DROP FUNCTION IF EXISTS enforce_lead_status_transition();

CREATE OR REPLACE FUNCTION enforce_lead_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    valid_transitions JSONB := '{
        "new": ["enriched", "queued", "failed"],
        "enriched": ["outreach_sent", "queued"],
        "outreach_sent": ["outreach_no_response", "call_scheduled", "queued"],
        "outreach_no_response": ["queued"],
        "call_scheduled": ["queued"],
        "queued": ["calling"],
        "calling": ["in_call", "no_answer", "voicemail", "busy", "failed", "invalid_number"],
        "in_call": ["committed", "follow_up", "follow_up_scheduled", "declined", "not_qualified"],
        "committed": ["payment_pending", "payment_sent"],
        "payment_pending": ["enrolled"],
        "follow_up": ["queued", "follow_up_scheduled"],
        "follow_up_scheduled": ["queued"],
        "no_answer": ["queued", "declined", "exhausted"],
        "voicemail": ["queued", "declined", "exhausted"],
        "busy": ["queued", "declined", "exhausted"]
    }'::JSONB;
    allowed JSONB;
BEGIN
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;

    IF NEW.status = 'do_not_contact' THEN
        NEW.updated_at := NOW();
        RETURN NEW;
    END IF;

    allowed := valid_transitions -> OLD.status;

    IF allowed IS NULL OR NOT allowed ? NEW.status THEN
        RAISE EXCEPTION 'Invalid status transition: % -> % (not permitted by state machine)',
            OLD.status, NEW.status;
    END IF;

    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_lead_status
    BEFORE UPDATE OF status ON leads
    FOR EACH ROW
    EXECUTE FUNCTION enforce_lead_status_transition();
```

Save this to `execution/backend/schema/007_dashboard_migration.sql`.

- [ ] **Step 2: Commit**

```bash
git add execution/backend/schema/007_dashboard_migration.sql
git commit -m "feat: schema migration 007 — name split, enrichment columns, 23 statuses, state machine"
```

> **Note:** Do NOT run this against the database yet. It will be run via n8n Postgres node or direct psql when ready. The SQL is written to be idempotent (IF NOT EXISTS, IF EXISTS).

---

### Task 2: Database Views

**Files:**
- Create: `execution/backend/schema/008_dashboard_views.sql`

10 views powering all dashboard API endpoints. Uses actual column names from the schema (`duration_seconds` not `duration_ms`, `detected_persona` aliased as `lead_persona`, `name` still works via existing column).

- [ ] **Step 1: Write the views SQL**

```sql
-- 008_dashboard_views.sql
-- 10 dashboard views + 5 indexes.
-- Run AFTER 007_dashboard_migration.sql.
-- All views use CREATE OR REPLACE for idempotency.

-- ============================================================
-- VIEW 1: dashboard_today (feature AS-01)
-- ============================================================
CREATE OR REPLACE VIEW dashboard_today AS
SELECT
  (SELECT COUNT(*) FROM call_logs WHERE started_at::DATE = CURRENT_DATE) as calls_today,
  (SELECT COUNT(*) FROM call_logs WHERE started_at::DATE = CURRENT_DATE AND outcome = 'committed') as commitments_today,
  (SELECT COUNT(*) FROM call_logs WHERE started_at::DATE = CURRENT_DATE AND outcome = 'follow_up') as follow_ups_today,
  (SELECT COUNT(*) FROM call_logs WHERE started_at::DATE = CURRENT_DATE AND outcome = 'declined') as declines_today,
  (SELECT COUNT(*) FROM call_logs WHERE started_at::DATE = CURRENT_DATE AND outcome IN ('no_answer','voicemail','busy')) as no_answers_today,
  (SELECT ROUND(AVG(duration_seconds), 0) FROM call_logs WHERE started_at::DATE = CURRENT_DATE AND duration_seconds > 0) as avg_duration_sec,
  (SELECT ROUND(
    COUNT(*) FILTER (WHERE outcome NOT IN ('no_answer','voicemail','busy'))::DECIMAL /
    NULLIF(COUNT(*), 0) * 100, 1
  ) FROM call_logs WHERE started_at::DATE = CURRENT_DATE) as pickup_rate_pct,
  (SELECT COUNT(*) FROM pipeline_logs WHERE created_at::DATE = CURRENT_DATE AND event LIKE '%outreach_sent%') as outreach_sent_today,
  (SELECT COUNT(*) FROM leads WHERE status = 'call_scheduled' AND call_scheduled_at::DATE = CURRENT_DATE) as bookings_today;

-- ============================================================
-- VIEW 2: leads_by_status (feature LM-04)
-- Replaces pipeline_snapshot. Kept simpler (status + count only).
-- ============================================================
CREATE OR REPLACE VIEW leads_by_status AS
SELECT status, COUNT(*) as count
FROM leads
WHERE status != 'do_not_contact'
GROUP BY status
ORDER BY CASE status
  WHEN 'new' THEN 1
  WHEN 'enriched' THEN 2
  WHEN 'outreach_sent' THEN 3
  WHEN 'outreach_no_response' THEN 4
  WHEN 'call_scheduled' THEN 5
  WHEN 'queued' THEN 6
  WHEN 'calling' THEN 7
  WHEN 'in_call' THEN 8
  WHEN 'committed' THEN 9
  WHEN 'follow_up' THEN 10
  WHEN 'follow_up_scheduled' THEN 11
  WHEN 'payment_pending' THEN 12
  WHEN 'enrolled' THEN 13
  WHEN 'declined' THEN 14
  WHEN 'no_answer' THEN 15
  WHEN 'voicemail' THEN 16
  WHEN 'busy' THEN 17
  WHEN 'exhausted' THEN 18
  WHEN 'invalid_number' THEN 19
  ELSE 20
END;

-- ============================================================
-- VIEW 3: strategy_performance (feature AS-02)
-- Replaces existing view. Now groups by persona too.
-- ============================================================
CREATE OR REPLACE VIEW strategy_performance AS
SELECT
  closing_strategy_used as strategy,
  detected_persona as persona,
  COUNT(*) as total_calls,
  COUNT(*) FILTER (WHERE outcome = 'committed') as commitments,
  COUNT(*) FILTER (WHERE outcome = 'follow_up') as follow_ups,
  COUNT(*) FILTER (WHERE outcome = 'declined') as declines,
  ROUND(COUNT(*) FILTER (WHERE outcome = 'committed')::DECIMAL /
    NULLIF(COUNT(*), 0) * 100, 1) as conversion_pct,
  ROUND(AVG(duration_seconds), 0) as avg_duration_sec
FROM call_logs
WHERE closing_strategy_used IS NOT NULL
GROUP BY closing_strategy_used, detected_persona
ORDER BY conversion_pct DESC;

-- ============================================================
-- VIEW 4: strategy_persona_heatmap (feature AS-03)
-- ============================================================
CREATE OR REPLACE VIEW strategy_persona_heatmap AS
SELECT
  closing_strategy_used as strategy,
  detected_persona as persona,
  COUNT(*) as calls,
  ROUND(COUNT(*) FILTER (WHERE outcome = 'committed')::DECIMAL /
    NULLIF(COUNT(*), 0) * 100, 1) as conversion_pct
FROM call_logs
WHERE closing_strategy_used IS NOT NULL AND detected_persona IS NOT NULL
GROUP BY closing_strategy_used, detected_persona;

-- ============================================================
-- VIEW 5: daily_trends (feature AS-04, last 30 days)
-- ============================================================
CREATE OR REPLACE VIEW daily_trends AS
SELECT
  d::DATE as date,
  COALESCE(c.calls, 0) as calls,
  COALESCE(c.commitments, 0) as commitments,
  COALESCE(c.follow_ups, 0) as follow_ups,
  COALESCE(c.avg_duration_sec, 0) as avg_duration_sec,
  COALESCE(c.pickup_rate, 0) as pickup_rate
FROM generate_series(CURRENT_DATE - 29, CURRENT_DATE, '1 day') d
LEFT JOIN (
  SELECT
    started_at::DATE as day,
    COUNT(*) as calls,
    COUNT(*) FILTER (WHERE outcome = 'committed') as commitments,
    COUNT(*) FILTER (WHERE outcome = 'follow_up') as follow_ups,
    ROUND(AVG(duration_seconds), 0) as avg_duration_sec,
    ROUND(COUNT(*) FILTER (WHERE outcome NOT IN ('no_answer','voicemail','busy'))::DECIMAL /
      NULLIF(COUNT(*), 0) * 100, 1) as pickup_rate
  FROM call_logs
  WHERE started_at >= CURRENT_DATE - 29
  GROUP BY started_at::DATE
) c ON d::DATE = c.day
ORDER BY date;

-- ============================================================
-- VIEW 6: follow_up_queue (feature CO-07)
-- ============================================================
CREATE OR REPLACE VIEW follow_up_queue AS
SELECT
  l.id, l.first_name, l.last_name, l.name, l.phone, l.email, l.follow_up_at,
  l.detected_persona, l.programme_recommended,
  l.follow_up_at - NOW() as time_until_follow_up,
  cl.summary as last_call_summary,
  cl.closing_strategy_used as last_strategy,
  cl.objections_raised as last_objections
FROM leads l
LEFT JOIN LATERAL (
  SELECT summary, closing_strategy_used, objections_raised
  FROM call_logs WHERE lead_id = l.id
  ORDER BY started_at DESC LIMIT 1
) cl ON true
WHERE l.status IN ('follow_up', 'follow_up_scheduled')
  AND l.follow_up_at IS NOT NULL
ORDER BY l.follow_up_at ASC;

-- ============================================================
-- VIEW 7: retry_queue (feature CO-08)
-- ============================================================
CREATE OR REPLACE VIEW retry_queue AS
SELECT
  id, first_name, last_name, name, phone, status,
  retry_count, max_retries,
  last_call_at,
  CASE WHEN status = 'busy' THEN last_call_at + INTERVAL '60 minutes'
       ELSE last_call_at + INTERVAL '1 day'
  END as next_retry_at
FROM leads
WHERE status IN ('no_answer', 'voicemail', 'busy')
  AND retry_count < max_retries
ORDER BY last_call_at ASC;

-- ============================================================
-- VIEW 8: outreach_log (feature OM-03)
-- ============================================================
CREATE OR REPLACE VIEW outreach_log AS
SELECT
  pl.created_at, pl.lead_id,
  l.first_name, l.last_name, l.name, l.phone, l.email,
  pl.details->>'channel' as channel,
  pl.details->>'message_id' as message_id,
  pl.details->>'delivery_status' as delivery_status,
  pl.status
FROM pipeline_logs pl
JOIN leads l ON pl.lead_id = l.id
WHERE pl.event IN ('outreach_sent', 'outreach_delivered', 'outreach_failed',
                    'new -> outreach_sent', 'enriched -> outreach_sent')
ORDER BY pl.created_at DESC;

-- ============================================================
-- VIEW 9: funnel_conversion (feature AS-06)
-- ============================================================
CREATE OR REPLACE VIEW funnel_conversion AS
SELECT
  (SELECT COUNT(*) FROM leads) as total_imported,
  (SELECT COUNT(*) FROM leads WHERE status NOT IN ('new')) as enriched,
  (SELECT COUNT(*) FROM leads WHERE status NOT IN ('new','enriched')) as outreach_sent,
  (SELECT COUNT(*) FROM leads WHERE status IN ('call_scheduled','calling','in_call',
    'committed','follow_up','follow_up_scheduled','declined','payment_pending','enrolled')) as responded,
  (SELECT COUNT(*) FROM leads WHERE status IN ('call_scheduled','calling','in_call',
    'committed','follow_up','follow_up_scheduled','payment_pending','enrolled')) as booked_or_called,
  (SELECT COUNT(*) FROM call_logs WHERE duration_seconds > 60) as calls_completed,
  (SELECT COUNT(*) FROM leads WHERE status IN ('committed','payment_pending','enrolled')) as committed,
  (SELECT COUNT(*) FROM leads WHERE status = 'enrolled') as enrolled;

-- ============================================================
-- VIEW 10: objection_frequency (feature AS-05)
-- ============================================================
CREATE OR REPLACE VIEW objection_frequency AS
SELECT
  unnest(objections_raised) as objection,
  COUNT(*) as frequency,
  COUNT(*) FILTER (WHERE outcome = 'committed') as resolved_to_commit,
  COUNT(*) FILTER (WHERE outcome = 'follow_up') as resolved_to_follow_up
FROM call_logs
WHERE objections_raised IS NOT NULL AND array_length(objections_raised, 1) > 0
GROUP BY unnest(objections_raised)
ORDER BY frequency DESC;

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_call_logs_date ON call_logs((started_at::DATE));
CREATE INDEX IF NOT EXISTS idx_call_logs_outcome ON call_logs(outcome);
CREATE INDEX IF NOT EXISTS idx_pipeline_logs_event ON pipeline_logs(event, created_at);
CREATE INDEX IF NOT EXISTS idx_leads_follow_up ON leads(follow_up_at) WHERE status IN ('follow_up','follow_up_scheduled');
CREATE INDEX IF NOT EXISTS idx_leads_retry ON leads(last_call_at) WHERE status IN ('no_answer','voicemail','busy');
```

Save this to `execution/backend/schema/008_dashboard_views.sql`.

- [ ] **Step 2: Commit**

```bash
git add execution/backend/schema/008_dashboard_views.sql
git commit -m "feat: schema 008 — 10 dashboard views + 5 indexes for CRM"
```

---

### Task 3: CORS Update — Allow PUT and DELETE

**Files:**
- Modify: `execution/backend/main.py:99`

- [ ] **Step 1: Update CORS allow_methods**

In `execution/backend/main.py`, change line 99 from:

```python
    allow_methods=["GET", "POST"],
```

to:

```python
    allow_methods=["GET", "POST", "PUT", "DELETE"],
```

- [ ] **Step 2: Commit**

```bash
git add execution/backend/main.py
git commit -m "fix: CORS allow PUT/DELETE for dashboard settings and schedule endpoints"
```

---

### Task 4: Update Frontend API Client

**Files:**
- Modify: `execution/dashboard/src/api.js`

Change the prefix from `/api/dashboard` to `/api` and add `apiPut()` and `apiDelete()` methods. Keep backward compatibility for existing components by making the prefix configurable.

- [ ] **Step 1: Rewrite api.js**

Replace the entire contents of `execution/dashboard/src/api.js` with:

```js
/**
 * Authenticated fetch wrapper for CRM dashboard API calls.
 *
 * All endpoints require a bearer token stored in localStorage.
 * On 401 responses, the token is cleared and the page is reloaded.
 */

const TOKEN_KEY = "dashboard_token";

/** Retrieve the stored dashboard token. */
export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

/** Store the dashboard authentication token. */
export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

/** Remove the stored token (logout / expiry). */
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

/**
 * Core fetch wrapper with auth, error handling, and 401 redirect.
 *
 * @param {string} path - API path (e.g. "/leads", "/calls/live").
 * @param {object} options - fetch options (method, body, headers).
 * @returns {Promise<object>} Parsed JSON response.
 */
async function request(path, options = {}) {
  const token = getToken();
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
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

/** GET request. */
export function apiFetch(path) {
  return request(path);
}

/** POST request with JSON body. */
export function apiPost(path, body = {}) {
  return request(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** PUT request with JSON body. */
export function apiPut(path, body = {}) {
  return request(path, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

/** DELETE request. */
export function apiDelete(path) {
  return request(path, { method: "DELETE" });
}

/**
 * Upload a file via multipart form data.
 *
 * @param {string} path - API path (e.g. "/leads/import").
 * @param {File} file - The file to upload.
 * @returns {Promise<object>} Parsed JSON response.
 */
export async function apiUpload(path, file) {
  const token = getToken();
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`/api${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });

  if (res.status === 401) {
    clearToken();
    window.location.reload();
    return;
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Upload error: ${res.status}`);
  }

  return res.json();
}
```

- [ ] **Step 2: Update existing component imports**

The existing components use `apiFetch("/live")`, `apiFetch("/command-centre")`, etc. which previously resolved to `/api/dashboard/live`. Now they resolve to `/api/live`, `/api/command-centre`.

We need to keep the old endpoints working in `main.py` during the transition. They already exist and won't be removed until Sprint 5. But we also need to add matching new routes. For now, the existing components will keep calling the old paths — we'll update them as each sprint replaces them.

**Temporary bridge:** Add a `legacyFetch` export for existing components:

Add this to the bottom of `api.js`:

```js
/**
 * Legacy fetch for existing components still using /api/dashboard/* paths.
 * Remove after all components are migrated to new routes.
 */
export function legacyFetch(path) {
  const token = getToken();
  return fetch(`/api/dashboard${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  }).then((res) => {
    if (res.status === 401) {
      clearToken();
      window.location.reload();
      return;
    }
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  });
}

export function legacyPost(path, body = {}) {
  const token = getToken();
  return fetch(`/api/dashboard${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  }).then((res) => {
    if (res.status === 401) {
      clearToken();
      window.location.reload();
      return;
    }
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  });
}
```

- [ ] **Step 3: Update existing components to use legacy imports**

In each of these files, change the import from `apiFetch` / `apiPost` to `legacyFetch` / `legacyPost`:

**`execution/dashboard/src/components/CommandCentre.jsx:2`:**
```js
// Before
import { apiFetch } from "../api";
// After
import { legacyFetch as apiFetch } from "../api";
```

**`execution/dashboard/src/components/Pipeline.jsx`** — same pattern.

**`execution/dashboard/src/components/StrategyAnalytics.jsx`** — same pattern.

**`execution/dashboard/src/components/LeadDetail.jsx`** — same pattern for both `apiFetch` and `apiPost`:
```js
import { legacyFetch as apiFetch, legacyPost as apiPost } from "../api";
```

**`execution/dashboard/src/components/Login.jsx:2`:**
```js
// Before
import { apiFetch, setToken, clearToken } from "../api";
// After
import { legacyFetch as apiFetch, setToken, clearToken } from "../api";
```

This ensures existing components keep working with the old `/api/dashboard/*` routes while new pages use the new `/api/*` routes.

- [ ] **Step 4: Commit**

```bash
git add execution/dashboard/src/api.js execution/dashboard/src/components/CommandCentre.jsx execution/dashboard/src/components/Pipeline.jsx execution/dashboard/src/components/StrategyAnalytics.jsx execution/dashboard/src/components/LeadDetail.jsx execution/dashboard/src/components/Login.jsx
git commit -m "feat: api.js migration — new /api/* prefix + legacy bridge for existing components"
```

---

### Task 5: Install Frontend Dependencies

**Files:**
- Modify: `execution/dashboard/package.json`

- [ ] **Step 1: Install packages**

```bash
cd execution/dashboard && npm install react-router-dom lucide-react
```

`recharts` is already installed (`^3.0.0` in package.json).

- [ ] **Step 2: Commit**

```bash
git add execution/dashboard/package.json execution/dashboard/package-lock.json
git commit -m "feat: add react-router-dom and lucide-react for CRM dashboard"
```

---

### Task 6: Add New Status Colors to Constants

**Files:**
- Modify: `execution/dashboard/src/constants.js:128-138`

- [ ] **Step 1: Extend STATUS_COLORS**

In `execution/dashboard/src/constants.js`, replace the `STATUS_COLORS` object (lines 128-138) with:

```js
export const STATUS_COLORS = {
  new: "bg-blue-500/15 border-blue-500/30 text-blue-500",
  enriched: "bg-cyan-500/15 border-cyan-500/30 text-cyan-500",
  outreach_sent: "bg-purple-500/15 border-purple-500/30 text-purple-500",
  outreach_no_response: "bg-purple-400/15 border-purple-400/30 text-purple-400",
  call_scheduled: "bg-teal-500/15 border-teal-500/30 text-teal-500",
  queued: "bg-violet-500/15 border-violet-500/30 text-violet-500",
  calling: "bg-orange-500/15 border-orange-500/30 text-orange-500",
  in_call: "bg-orange-500/15 border-orange-500/30 text-orange-500",
  committed: "bg-green-500/15 border-green-500/30 text-green-500",
  follow_up: "bg-blue-400/15 border-blue-400/30 text-blue-400",
  follow_up_scheduled: "bg-blue-400/15 border-blue-400/30 text-blue-400",
  payment_pending: "bg-amber-500/15 border-amber-500/30 text-amber-500",
  payment_sent: "bg-green-500/15 border-green-500/30 text-green-500",
  enrolled: "bg-emerald-500/15 border-emerald-500/30 text-emerald-500",
  declined: "bg-red-500/15 border-red-500/30 text-red-500",
  not_qualified: "bg-zinc-500/15 border-zinc-500/30 text-zinc-400",
  no_answer: "bg-zinc-500/15 border-zinc-500/30 text-zinc-400",
  voicemail: "bg-zinc-500/15 border-zinc-500/30 text-zinc-400",
  busy: "bg-zinc-500/15 border-zinc-500/30 text-zinc-400",
  exhausted: "bg-zinc-600/15 border-zinc-600/30 text-zinc-500",
  invalid_number: "bg-red-600/15 border-red-600/30 text-red-400",
  do_not_contact: "bg-red-700/15 border-red-700/30 text-red-300",
  failed: "bg-zinc-600/15 border-zinc-600/30 text-zinc-500",
};
```

- [ ] **Step 2: Extend KANBAN_COLUMNS**

Replace the `KANBAN_COLUMNS` array (lines 9-20) with:

```js
export const KANBAN_COLUMNS = [
  { key: "new", label: "New", statuses: ["new"] },
  { key: "enriched", label: "Enriched", statuses: ["enriched"] },
  { key: "outreach", label: "Outreach", statuses: ["outreach_sent", "outreach_no_response"] },
  { key: "scheduled", label: "Scheduled", statuses: ["call_scheduled"] },
  { key: "queued", label: "Queued", statuses: ["queued"] },
  { key: "in_progress", label: "In Progress", statuses: ["calling", "in_call"] },
  { key: "committed", label: "Committed", statuses: ["committed", "payment_pending", "payment_sent"] },
  { key: "follow_up", label: "Follow Up", statuses: ["follow_up", "follow_up_scheduled"] },
  { key: "enrolled", label: "Enrolled", statuses: ["enrolled"] },
  {
    key: "closed",
    label: "Closed",
    statuses: ["declined", "not_qualified", "do_not_contact", "failed", "exhausted", "invalid_number"],
  },
];
```

- [ ] **Step 3: Commit**

```bash
git add execution/dashboard/src/constants.js
git commit -m "feat: extend status colors and kanban columns for 23 lead statuses"
```

---

### Task 7: Create Auth Context

**Files:**
- Create: `execution/dashboard/src/AuthContext.jsx`

Shared auth state so any component can check authentication and log out.

- [ ] **Step 1: Create AuthContext**

```jsx
import { createContext, useContext, useState, useCallback } from "react";
import { getToken, setToken as storeToken, clearToken } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [authenticated, setAuthenticated] = useState(!!getToken());

  const login = useCallback((token) => {
    storeToken(token);
    setAuthenticated(true);
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setAuthenticated(false);
  }, []);

  return (
    <AuthContext.Provider value={{ authenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
```

Save to `execution/dashboard/src/AuthContext.jsx`.

- [ ] **Step 2: Commit**

```bash
git add execution/dashboard/src/AuthContext.jsx
git commit -m "feat: AuthContext — shared auth state for route-based dashboard"
```

---

### Task 8: Create Dashboard API Router Scaffold

**Files:**
- Create: `execution/backend/dashboard_routes.py`
- Modify: `execution/backend/main.py:56`

This creates the new router with auth middleware. Sprint 1 will add the first endpoints. Later sprints add the rest.

- [ ] **Step 1: Create the router file**

```python
"""CRM Dashboard API Router.

All endpoints require Bearer token matching DASHBOARD_SECRET_KEY.
Organized by module: leads, outreach, calls, analytics, post-call, system.
"""

import logging
import os

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from slowapi import Limiter
from slowapi.util import get_remote_address
from typing import Optional

from supabase_client import supabase

logger = logging.getLogger("sarah.dashboard")

router = APIRouter(prefix="/api", tags=["dashboard-v2"])

# ---------------------------------------------------------------------------
# Auth — same pattern as main.py
# ---------------------------------------------------------------------------
DASHBOARD_SECRET_KEY = os.environ.get("DASHBOARD_SECRET_KEY", "")
bearer_scheme = HTTPBearer(auto_error=True)


async def verify_token(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> str:
    if not DASHBOARD_SECRET_KEY:
        raise HTTPException(status_code=500, detail="Server misconfigured")
    if credentials.credentials != DASHBOARD_SECRET_KEY:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return credentials.credentials


# ---------------------------------------------------------------------------
# Rate limiter — shares the same limiter instance as main.py
# (imported and attached in main.py via app.state.limiter)
# ---------------------------------------------------------------------------
limiter = Limiter(key_func=get_remote_address)


# ===================================================================
# MODULE 4: ANALYTICS
# ===================================================================

@router.get("/analytics/today")
@limiter.limit("30/minute")
async def analytics_today(request: Request, _t: str = Depends(verify_token)):
    """Today's overview stats from dashboard_today view."""
    result = supabase.table("dashboard_today").select("*").execute()
    if result.data:
        return result.data[0]
    return {
        "calls_today": 0, "commitments_today": 0, "follow_ups_today": 0,
        "declines_today": 0, "no_answers_today": 0, "avg_duration_sec": 0,
        "pickup_rate_pct": 0, "outreach_sent_today": 0, "bookings_today": 0,
    }


# ===================================================================
# MODULE 3: CALL OPERATIONS
# ===================================================================

@router.get("/calls/live")
@limiter.limit("60/minute")
async def calls_live(request: Request, _t: str = Depends(verify_token)):
    """Currently active call (if any)."""
    result = (
        supabase.table("leads")
        .select("id, name, first_name, last_name, phone, status, programme_recommended, last_strategy_used, last_call_at, detected_persona")
        .in_("status", ["calling", "in_call"])
        .limit(1)
        .execute()
    )
    return {"active_call": result.data[0] if result.data else None}


@router.get("/dialer/status")
@limiter.limit("30/minute")
async def dialer_status(request: Request, _t: str = Depends(verify_token)):
    """Auto-dialer current status."""
    # Next lead in queue
    next_lead_result = (
        supabase.table("leads")
        .select("id, name, phone, priority")
        .eq("status", "queued")
        .order("priority", desc=True)
        .order("created_at", desc=False)
        .limit(1)
        .execute()
    )
    next_lead = next_lead_result.data[0] if next_lead_result.data else None

    # Today's call count
    today_calls = (
        supabase.table("call_logs")
        .select("id", count="exact")
        .gte("started_at", "today")
        .execute()
    )

    # Active schedule
    schedule_result = (
        supabase.table("dial_schedules")
        .select("*")
        .eq("is_active", True)
        .limit(1)
        .execute()
    )
    schedule = schedule_result.data[0] if schedule_result.data else None

    return {
        "running": False,  # Will be wired to actual dialer state later
        "schedule": schedule,
        "next_lead": next_lead,
        "calls_today": today_calls.count or 0,
        "calls_remaining": 200 - (today_calls.count or 0),
    }


@router.get("/calls")
@limiter.limit("20/minute")
async def calls_list(
    request: Request,
    _t: str = Depends(verify_token),
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    outcome: Optional[str] = None,
    strategy: Optional[str] = None,
    lead_id: Optional[str] = None,
    sort_by: str = Query("started_at"),
    sort_order: str = Query("desc"),
):
    """Paginated call history."""
    query = supabase.table("call_logs").select(
        "id, lead_id, retell_call_id, started_at, ended_at, duration_seconds, "
        "outcome, closing_strategy_used, detected_persona, summary, recording_url, "
        "from_number, to_number",
        count="exact",
    )
    if outcome:
        query = query.eq("outcome", outcome)
    if strategy:
        query = query.eq("closing_strategy_used", strategy)
    if lead_id:
        query = query.eq("lead_id", lead_id)

    desc = sort_order == "desc"
    query = query.order(sort_by, desc=desc)
    offset = (page - 1) * per_page
    query = query.range(offset, offset + per_page - 1)
    result = query.execute()

    return {
        "calls": result.data or [],
        "total": result.count or 0,
        "page": page,
        "per_page": per_page,
    }


@router.get("/calls/{call_id}")
@limiter.limit("30/minute")
async def call_detail(request: Request, call_id: str, _t: str = Depends(verify_token)):
    """Full call record with transcript."""
    result = (
        supabase.table("call_logs")
        .select("*")
        .eq("id", call_id)
        .limit(1)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Call not found")
    return result.data[0]


# ===================================================================
# MODULE 6: SYSTEM
# ===================================================================

@router.get("/health/services")
@limiter.limit("10/minute")
async def health_services(request: Request, _t: str = Depends(verify_token)):
    """Check connectivity to all external services."""
    import httpx

    checks = {}

    # Supabase
    try:
        supabase.table("leads").select("id").limit(1).execute()
        checks["supabase"] = "up"
    except Exception:
        checks["supabase"] = "down"

    # Retell
    try:
        from retell_config import retell_client
        retell_client.agent.list()
        checks["retell"] = "up"
    except Exception:
        checks["retell"] = "down"

    # n8n
    n8n_base = os.environ.get("N8N_WEBHOOK_BASE", "")
    if n8n_base:
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                r = await client.get(n8n_base.rstrip("/").replace("/webhook", "") + "/healthz")
                checks["n8n"] = "up" if r.status_code < 500 else "down"
        except Exception:
            checks["n8n"] = "down"
    else:
        checks["n8n"] = "unknown"

    # OpenClaw
    openclaw_url = os.environ.get("OPENCLAW_API_URL", "")
    if openclaw_url:
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                r = await client.get(openclaw_url.rstrip("/") + "/instance/connectionState",
                                     headers={"apikey": os.environ.get("OPENCLAW_API_KEY", "")})
                checks["openclaw"] = "up" if r.status_code == 200 else "down"
        except Exception:
            checks["openclaw"] = "down"
    else:
        checks["openclaw"] = "unknown"

    # Cal.com
    cal_url = os.environ.get("CAL_COM_URL", "")
    if cal_url:
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                r = await client.get(cal_url.rstrip("/") + "/api/v1/me",
                                     headers={"Authorization": f"Bearer {os.environ.get('CAL_COM_API_KEY', '')}"})
                checks["calcom"] = "up" if r.status_code == 200 else "down"
        except Exception:
            checks["calcom"] = "down"
    else:
        checks["calcom"] = "unknown"

    return checks


@router.post("/auth/login")
async def auth_login(request: Request):
    """Validate dashboard token."""
    body = await request.json()
    token = body.get("token", "")
    if not DASHBOARD_SECRET_KEY:
        raise HTTPException(status_code=500, detail="Server misconfigured")
    if token != DASHBOARD_SECRET_KEY:
        raise HTTPException(status_code=401, detail="Invalid token")
    return {"authenticated": True}
```

Save to `execution/backend/dashboard_routes.py`.

- [ ] **Step 2: Import router in main.py**

In `execution/backend/main.py`, after line 56 (`app = FastAPI(...)`), add:

```python
from dashboard_routes import router as dashboard_v2_router
```

Then after the rate limiter setup (after line 63), add:

```python
app.include_router(dashboard_v2_router)
```

Also share the limiter with the router. After `app.state.limiter = limiter`, add:

```python
# Share limiter with dashboard router
from dashboard_routes import limiter as dashboard_limiter
dashboard_limiter._storage = limiter._storage
```

- [ ] **Step 3: Commit**

```bash
git add execution/backend/dashboard_routes.py execution/backend/main.py
git commit -m "feat: dashboard_routes.py scaffold — analytics, calls, health, auth endpoints"
```

---

## SPRINT 1: Foundation + Home + Auth

### Task 9: Build Sidebar Navigation Component

**Files:**
- Create: `execution/dashboard/src/components/Sidebar.jsx`

Use the Anthropic `frontend-design` skill for this component. Invoke `/frontend-design` before writing.

- [ ] **Step 1: Create Sidebar component**

```jsx
import { useLocation, Link } from "react-router-dom";
import {
  LayoutDashboard, Users, Columns3, Send, CalendarDays, Phone,
  Clock, CheckCircle, GraduationCap, BarChart3, Activity, AlertTriangle,
  Settings, LogOut,
} from "lucide-react";
import { useAuth } from "../AuthContext";

const NAV_ITEMS = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/leads", label: "Leads", icon: Users },
  { path: "/pipeline", label: "Pipeline", icon: Columns3 },
  { path: "/outreach", label: "Outreach", icon: Send },
  { path: "/bookings", label: "Bookings", icon: CalendarDays },
  { path: "/calls", label: "Calls", icon: Phone },
  { path: "/follow-ups", label: "Follow-ups", icon: Clock },
  { path: "/committed", label: "Committed", icon: CheckCircle },
  { path: "/enrolled", label: "Enrolled", icon: GraduationCap },
  { path: "/analytics", label: "Analytics", icon: BarChart3 },
  { path: "/activity", label: "Activity", icon: Activity },
  { path: "/errors", label: "Errors", icon: AlertTriangle },
];

const SETTINGS_ITEM = { path: "/settings", label: "Settings", icon: Settings };

export default function Sidebar({ collapsed, errorCount = 0 }) {
  const location = useLocation();
  const { logout } = useAuth();

  function isActive(path) {
    if (path === "/") return location.pathname === "/";
    return location.pathname.startsWith(path);
  }

  return (
    <nav
      className={`flex-shrink-0 bg-surface border-r border-glass-border flex flex-col py-4 transition-all ${
        collapsed ? "w-14 items-center" : "w-60 px-3"
      }`}
    >
      {/* Logo */}
      <div className={`flex items-center gap-2 mb-6 ${collapsed ? "justify-center" : "px-2"}`}>
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
          J
        </div>
        {!collapsed && (
          <span className="text-sm font-semibold text-zinc-300">John CRM</span>
        )}
      </div>

      {/* Nav items */}
      <div className="flex-1 flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              title={collapsed ? item.label : undefined}
              className={`flex items-center gap-2.5 rounded-lg transition-colors ${
                collapsed ? "w-9 h-9 justify-center mx-auto" : "px-2.5 py-2"
              } ${
                active
                  ? "bg-orange-500/15 border border-orange-500/30 text-orange-500"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-glass-fill"
              }`}
            >
              <Icon size={18} className="flex-shrink-0" />
              {!collapsed && <span className="text-sm">{item.label}</span>}
              {item.path === "/errors" && errorCount > 0 && (
                <span className={`${collapsed ? "absolute -top-1 -right-1" : "ml-auto"} bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center`}>
                  {errorCount > 9 ? "9+" : errorCount}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* Divider */}
      <div className="border-t border-glass-border my-2" />

      {/* Settings */}
      <Link
        to={SETTINGS_ITEM.path}
        title={collapsed ? SETTINGS_ITEM.label : undefined}
        className={`flex items-center gap-2.5 rounded-lg transition-colors ${
          collapsed ? "w-9 h-9 justify-center mx-auto" : "px-2.5 py-2"
        } ${
          isActive(SETTINGS_ITEM.path)
            ? "bg-orange-500/15 border border-orange-500/30 text-orange-500"
            : "text-zinc-500 hover:text-zinc-300 hover:bg-glass-fill"
        }`}
      >
        <Settings size={18} />
        {!collapsed && <span className="text-sm">Settings</span>}
      </Link>

      {/* Logout */}
      <button
        onClick={logout}
        title={collapsed ? "Logout" : undefined}
        className={`flex items-center gap-2.5 rounded-lg transition-colors mt-1 ${
          collapsed ? "w-9 h-9 justify-center mx-auto" : "px-2.5 py-2"
        } text-zinc-600 hover:text-zinc-400 hover:bg-glass-fill`}
      >
        <LogOut size={18} />
        {!collapsed && <span className="text-sm">Logout</span>}
      </button>
    </nav>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add execution/dashboard/src/components/Sidebar.jsx
git commit -m "feat: Sidebar nav component — 13 routes + error badge + logout"
```

---

### Task 10: Build Topbar Component

**Files:**
- Create: `execution/dashboard/src/components/Topbar.jsx`

- [ ] **Step 1: Create Topbar component**

```jsx
import { Phone, Radio } from "lucide-react";

export default function Topbar({ title, dialerRunning = false, callActive = false }) {
  return (
    <header className="h-14 flex-shrink-0 border-b border-glass-border flex items-center justify-between px-6">
      <h1 className="text-lg font-semibold text-zinc-100">{title}</h1>

      <div className="flex items-center gap-4">
        {/* Active call indicator */}
        {callActive && (
          <div className="flex items-center gap-1.5 text-orange-500 text-sm">
            <Phone size={14} className="animate-pulse" />
            <span className="font-mono text-xs">LIVE</span>
          </div>
        )}

        {/* Dialer status */}
        <div className="flex items-center gap-1.5 text-sm">
          <span
            className={`w-2 h-2 rounded-full ${
              dialerRunning ? "bg-green-500 animate-pulse" : "bg-zinc-600"
            }`}
          />
          <span className={dialerRunning ? "text-green-500" : "text-zinc-500"}>
            {dialerRunning ? "Dialer Active" : "Dialer Idle"}
          </span>
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add execution/dashboard/src/components/Topbar.jsx
git commit -m "feat: Topbar component — page title, dialer status, active call indicator"
```

---

### Task 11: Build Layout Shell

**Files:**
- Create: `execution/dashboard/src/Layout.jsx`

- [ ] **Step 1: Create Layout component**

```jsx
import { useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import { apiFetch } from "./api";

const PAGE_TITLES = {
  "/": "Dashboard",
  "/leads": "Leads",
  "/pipeline": "Pipeline",
  "/outreach": "Outreach",
  "/bookings": "Bookings",
  "/calls": "Calls",
  "/follow-ups": "Follow-ups",
  "/committed": "Committed",
  "/enrolled": "Enrolled",
  "/analytics": "Analytics",
  "/activity": "Activity",
  "/errors": "Errors",
  "/settings": "Settings",
};

export default function Layout() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(window.innerWidth < 1200);
  const [callActive, setCallActive] = useState(false);
  const [dialerRunning, setDialerRunning] = useState(false);

  // Responsive sidebar
  useEffect(() => {
    function handleResize() {
      setCollapsed(window.innerWidth < 1200);
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Poll live call + dialer status for topbar indicators
  useEffect(() => {
    let mounted = true;

    async function poll() {
      try {
        const liveData = await apiFetch("/calls/live");
        if (mounted) setCallActive(!!liveData?.active_call);
      } catch {}
      try {
        const dialerData = await apiFetch("/dialer/status");
        if (mounted) setDialerRunning(!!dialerData?.running);
      } catch {}
    }

    poll();
    const interval = setInterval(poll, 10000);
    return () => { mounted = false; clearInterval(interval); };
  }, []);

  // Derive page title from path
  const basePath = "/" + (location.pathname.split("/")[1] || "");
  const title = PAGE_TITLES[basePath] || "Dashboard";

  return (
    <div className="flex h-screen bg-base overflow-hidden">
      <Sidebar collapsed={collapsed} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Topbar title={title} dialerRunning={dialerRunning} callActive={callActive} />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add execution/dashboard/src/Layout.jsx
git commit -m "feat: Layout shell — sidebar + topbar + outlet for page routing"
```

---

### Task 12: Build Loading Skeleton Component

**Files:**
- Create: `execution/dashboard/src/components/LoadingSkeleton.jsx`

- [ ] **Step 1: Create LoadingSkeleton component**

```jsx
export function SkeletonCard({ className = "" }) {
  return (
    <div className={`glass-card p-4 animate-pulse ${className}`}>
      <div className="h-3 w-20 bg-zinc-700 rounded mb-3" />
      <div className="h-6 w-16 bg-zinc-700 rounded" />
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 py-3 animate-pulse">
      <div className="h-4 w-32 bg-zinc-700 rounded" />
      <div className="h-4 w-24 bg-zinc-700 rounded" />
      <div className="h-4 w-16 bg-zinc-700 rounded" />
      <div className="h-4 w-20 bg-zinc-700 rounded" />
    </div>
  );
}

export function SkeletonTable({ rows = 5 }) {
  return (
    <div className="space-y-1">
      {Array.from({ length: rows }, (_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add execution/dashboard/src/components/LoadingSkeleton.jsx
git commit -m "feat: LoadingSkeleton — shimmer placeholders for cards, rows, tables"
```

---

### Task 13: Build StatusBadge Component

**Files:**
- Create: `execution/dashboard/src/components/StatusBadge.jsx`

- [ ] **Step 1: Create StatusBadge component**

```jsx
import { STATUS_COLORS } from "../constants";

export default function StatusBadge({ status }) {
  const colors = STATUS_COLORS[status] || "bg-zinc-500/15 border-zinc-500/30 text-zinc-400";
  const label = (status || "unknown").replace(/_/g, " ");

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border ${colors}`}>
      {label}
    </span>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add execution/dashboard/src/components/StatusBadge.jsx
git commit -m "feat: StatusBadge — colored pills for all 23 lead statuses"
```

---

### Task 14: Build Home Page

**Files:**
- Create: `execution/dashboard/src/pages/Home.jsx`

This is the main operator view — replaces the existing CommandCentre as the default route. Uses the Anthropic `frontend-design` skill.

- [ ] **Step 1: Create Home page**

```jsx
import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { apiFetch, apiPost } from "../api";
import { useInterval } from "../hooks/useInterval";
import { formatDuration, formatTime } from "../constants";
import StatusBadge from "../components/StatusBadge";
import { SkeletonCard, SkeletonTable } from "../components/LoadingSkeleton";
import EmptyState from "../components/EmptyState";
import { Play, Pause, Square, Phone } from "lucide-react";

export default function Home() {
  const [stats, setStats] = useState(null);
  const [liveCall, setLiveCall] = useState(null);
  const [dialer, setDialer] = useState(null);
  const [health, setHealth] = useState(null);
  const [recentCalls, setRecentCalls] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    try {
      const [statsData, liveData, dialerData, healthData, callsData] = await Promise.all([
        apiFetch("/analytics/today"),
        apiFetch("/calls/live"),
        apiFetch("/dialer/status"),
        apiFetch("/health/services"),
        apiFetch("/calls?per_page=10&sort_by=started_at&sort_order=desc"),
      ]);
      setStats(statsData);
      setLiveCall(liveData?.active_call);
      setDialer(dialerData);
      setHealth(healthData);
      setRecentCalls(callsData?.calls || []);
    } catch (err) {
      console.error("Home fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);
  useInterval(fetchAll, 10000);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 8 }, (_, i) => <SkeletonCard key={i} />)}
        </div>
        <SkeletonTable rows={5} />
      </div>
    );
  }

  const statCards = [
    { label: "Calls Today", value: stats?.calls_today ?? 0 },
    { label: "Pick-up Rate", value: `${stats?.pickup_rate_pct ?? 0}%` },
    { label: "Commitments", value: stats?.commitments_today ?? 0 },
    { label: "Follow-ups", value: stats?.follow_ups_today ?? 0 },
    { label: "Declines", value: stats?.declines_today ?? 0 },
    { label: "Avg Duration", value: formatDuration(stats?.avg_duration_sec) },
    { label: "Outreach Sent", value: stats?.outreach_sent_today ?? 0 },
    { label: "Bookings", value: stats?.bookings_today ?? 0 },
  ];

  return (
    <div className="space-y-6">
      {/* Section 1: Today's Stats */}
      <div className="grid grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div key={card.label} className="glass-card p-4">
            <p className="label-mono text-zinc-500 text-xs mb-1">{card.label}</p>
            <p className="text-2xl font-semibold text-zinc-100">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Section 2: Live Call + Dialer */}
      <div className="grid grid-cols-2 gap-4">
        {/* Live call */}
        <div className="glass-card p-5">
          <h3 className="label-mono text-zinc-500 text-xs mb-3">Live Call</h3>
          {liveCall ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Phone size={16} className="text-orange-500 animate-pulse" />
                <span className="text-zinc-100 font-medium">{liveCall.name}</span>
              </div>
              <p className="text-zinc-500 text-sm font-mono">{liveCall.phone}</p>
              {liveCall.last_strategy_used && (
                <p className="text-zinc-400 text-sm">Strategy: {liveCall.last_strategy_used}</p>
              )}
            </div>
          ) : (
            <p className="text-zinc-600 text-sm">Waiting for next call</p>
          )}
        </div>

        {/* Dialer controls */}
        <div className="glass-card p-5">
          <h3 className="label-mono text-zinc-500 text-xs mb-3">Auto-Dialer</h3>
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={() => apiPost("/dialer/start")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/15 border border-green-500/30 text-green-500 text-sm hover:bg-green-500/25 transition-colors"
            >
              <Play size={14} /> Start
            </button>
            <button
              onClick={() => apiPost("/dialer/pause")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-500 text-sm hover:bg-amber-500/25 transition-colors"
            >
              <Pause size={14} /> Pause
            </button>
            <button
              onClick={() => apiPost("/dialer/stop")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/15 border border-red-500/30 text-red-500 text-sm hover:bg-red-500/25 transition-colors"
            >
              <Square size={14} /> Stop
            </button>
          </div>
          {dialer && (
            <div className="space-y-1 text-sm">
              {dialer.schedule && (
                <p className="text-zinc-400">Schedule: {dialer.schedule.name}</p>
              )}
              {dialer.next_lead && (
                <p className="text-zinc-400">Next: {dialer.next_lead.name}</p>
              )}
              <p className="text-zinc-500">
                Calls: {dialer.calls_today} / {dialer.calls_today + dialer.calls_remaining}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Section 3: Service Health */}
      {health && (
        <div className="flex items-center gap-3">
          {Object.entries(health).map(([service, status]) => (
            <div
              key={service}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full glass-card text-sm"
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  status === "up" ? "bg-green-500" : status === "down" ? "bg-red-500" : "bg-zinc-500"
                }`}
              />
              <span className="text-zinc-400 capitalize">{service}</span>
            </div>
          ))}
        </div>
      )}

      {/* Section 4: Recent Calls */}
      <div className="glass-card p-5">
        <h3 className="label-mono text-zinc-500 text-xs mb-3">Recent Calls</h3>
        {recentCalls && recentCalls.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-zinc-500 text-xs border-b border-glass-border">
                <th className="text-left py-2 font-medium">Time</th>
                <th className="text-left py-2 font-medium">Lead</th>
                <th className="text-left py-2 font-medium">Duration</th>
                <th className="text-left py-2 font-medium">Outcome</th>
                <th className="text-left py-2 font-medium">Strategy</th>
              </tr>
            </thead>
            <tbody>
              {recentCalls.map((call) => (
                <tr
                  key={call.id}
                  className="border-b border-glass-border/50 hover:bg-glass-fill cursor-pointer transition-colors"
                >
                  <td className="py-2 text-zinc-400 font-mono text-xs">
                    {formatTime(call.started_at)}
                  </td>
                  <td className="py-2 text-zinc-200">
                    <Link to={`/calls/${call.id}`} className="hover:text-orange-500">
                      {call.to_number}
                    </Link>
                  </td>
                  <td className="py-2 text-zinc-400 font-mono">
                    {formatDuration(call.duration_seconds)}
                  </td>
                  <td className="py-2">
                    <StatusBadge status={call.outcome} />
                  </td>
                  <td className="py-2 text-zinc-400 text-xs">
                    {call.closing_strategy_used || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState message="No calls today" />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add execution/dashboard/src/pages/Home.jsx
git commit -m "feat: Home page — stats grid, live call, dialer controls, health, recent calls"
```

---

### Task 15: Rewrite App.jsx with React Router + Login Page Update

**Files:**
- Modify: `execution/dashboard/src/App.jsx`
- Modify: `execution/dashboard/src/main.jsx`
- Modify: `execution/dashboard/src/components/Login.jsx`

This replaces the tab-based navigation with `react-router-dom` routes.

- [ ] **Step 1: Update main.jsx to add BrowserRouter + AuthProvider**

Replace `execution/dashboard/src/main.jsx` with:

```jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./AuthContext";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
```

- [ ] **Step 2: Update Login.jsx to use new API and AuthContext**

Replace `execution/dashboard/src/components/Login.jsx` with:

```jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { apiPost } from "../api";

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
      // Temporarily set token so the POST can auth
      const { setToken } = await import("../api");
      setToken(token.trim());
      await apiPost("/auth/login", { token: token.trim() });
      login(token.trim());
      navigate("/");
    } catch {
      const { clearToken } = await import("../api");
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
```

- [ ] **Step 3: Rewrite App.jsx with Routes**

Replace `execution/dashboard/src/App.jsx` with:

```jsx
import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { getToken } from "./api";
import Layout from "./Layout";
import Login from "./components/Login";
import Home from "./pages/Home";

// Placeholder for pages not yet built — replaced in later sprints
function Placeholder({ name }) {
  return (
    <div className="flex items-center justify-center h-64">
      <p className="text-zinc-500 text-lg">{name} — coming soon</p>
    </div>
  );
}

function ProtectedRoute({ children }) {
  const { authenticated } = useAuth();
  if (!authenticated && !getToken()) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Home />} />
        <Route path="leads" element={<Placeholder name="Leads" />} />
        <Route path="leads/:id" element={<Placeholder name="Lead Detail" />} />
        <Route path="pipeline" element={<Placeholder name="Pipeline" />} />
        <Route path="outreach" element={<Placeholder name="Outreach" />} />
        <Route path="bookings" element={<Placeholder name="Bookings" />} />
        <Route path="calls" element={<Placeholder name="Calls" />} />
        <Route path="calls/:id" element={<Placeholder name="Call Detail" />} />
        <Route path="follow-ups" element={<Placeholder name="Follow-ups" />} />
        <Route path="committed" element={<Placeholder name="Committed" />} />
        <Route path="enrolled" element={<Placeholder name="Enrolled" />} />
        <Route path="analytics" element={<Placeholder name="Analytics" />} />
        <Route path="activity" element={<Placeholder name="Activity" />} />
        <Route path="errors" element={<Placeholder name="Errors" />} />
        <Route path="settings" element={<Placeholder name="Settings" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add execution/dashboard/src/main.jsx execution/dashboard/src/App.jsx execution/dashboard/src/components/Login.jsx
git commit -m "feat: react-router migration — 14 routes, auth guard, layout shell, updated login"
```

---

### Sprint 1 Verification

After completing Tasks 1-15:

- [ ] **Verify frontend builds**

```bash
cd execution/dashboard && npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Verify backend starts**

```bash
cd execution/backend && python -c "from dashboard_routes import router; print('Router OK:', len(router.routes), 'routes')"
```

Expected: `Router OK: N routes` (should be 7+ routes).

- [ ] **Verify login flow**

Start backend (`uvicorn main:app --reload --port 8000`) and frontend (`npm run dev`), navigate to `http://localhost:5173`:
1. Should redirect to `/login`
2. Enter correct token → should redirect to `/` (Home page)
3. Home page should show stats cards, live call area, dialer controls, health pills, recent calls table
4. Sidebar should show 13 nav items, clicking any navigates to that route
5. Other pages show "coming soon" placeholder

---

## SPRINT 2: Lead Management + Pipeline (Tasks 16-22)

> Sprint 2 builds: `/leads` (search, filter, CSV import), `/leads/:id` (detail + tabs), `/pipeline` (kanban). Adds 6 API endpoints for lead CRUD. Uses Anthropic `frontend-design` skill for all pages.

**API Endpoints to add in `dashboard_routes.py`:**
- `GET /leads` — paginated list with search/filter
- `GET /leads/{lead_id}` — full detail + calls + pipeline logs
- `POST /leads/import` — CSV upload
- `GET /leads/by-status` — kanban data from `leads_by_status` view
- `GET /leads/blocked` — DNC list
- `POST /leads/{lead_id}/block` — block a lead
- `POST /leads/{lead_id}/unblock` — unblock a lead
- `POST /leads/bulk-action` — bulk queue/block/export

**Pages to build:**
- `execution/dashboard/src/pages/Leads.jsx` — table with search, filters, CSV import
- `execution/dashboard/src/pages/LeadDetailPage.jsx` — wraps/replaces existing LeadDetail with tabs
- `execution/dashboard/src/pages/PipelinePage.jsx` — wraps existing Pipeline with kanban enhancements
- `execution/dashboard/src/components/DataTable.jsx` — reusable sortable table
- `execution/dashboard/src/components/FilterBar.jsx` — reusable filter bar

**Pattern:** Each task follows the same structure as Sprint 1 — exact file paths, complete code, exact commit commands.

---

## SPRINT 3: Outreach + Bookings + Calls (Tasks 23-30)

> Sprint 3 builds: `/outreach` (3 tabs: queue, delivery log, replies), `/bookings` (calendar + list), `/calls` (history + transcript slide-out), `/follow-ups` (grouped by urgency).

**API Endpoints to add:**
- `GET /outreach/queue`, `GET /outreach/log`, `GET /outreach/replies`, `GET /outreach/timeout`
- `GET /bookings`
- `GET /leads/follow-ups`, `GET /leads/retries`
- `GET /calls/transfers`

**Pages to build:**
- `execution/dashboard/src/pages/Outreach.jsx`
- `execution/dashboard/src/pages/Bookings.jsx`
- `execution/dashboard/src/pages/Calls.jsx` (replaces placeholder)
- `execution/dashboard/src/pages/FollowUps.jsx`

---

## SPRINT 4: Analytics + Post-Call (Tasks 31-37)

> Sprint 4 builds: `/analytics` (6 Recharts sections), `/committed` (payment tracking), `/enrolled` (CSV export).

**API Endpoints to add:**
- `GET /analytics/strategies`, `GET /analytics/heatmap`, `GET /analytics/trends`
- `GET /analytics/objections`, `GET /analytics/funnel`, `GET /analytics/revenue`
- `GET /post-call/emails`, `GET /post-call/whatsapp`
- `PUT /leads/{lead_id}/payment`
- `GET /leads/enrolled`

**Pages to build:**
- `execution/dashboard/src/pages/Analytics.jsx` — 6 chart sections using Recharts
- `execution/dashboard/src/pages/Committed.jsx`
- `execution/dashboard/src/pages/Enrolled.jsx`

---

## SPRINT 5: System + Settings + Polish (Tasks 38-45)

> Sprint 5 builds: `/activity`, `/errors`, `/settings` (5 tabs). Polish pass: loading states, empty states, responsive, security.

**API Endpoints to add:**
- `GET /pipeline/log`, `GET /errors`
- `POST /auth/login` (already done), `GET /settings`, `PUT /settings`
- `GET /schedules`, `POST /schedules`, `PUT /schedules/{id}`, `DELETE /schedules/{id}`
- `GET /templates`, `PUT /templates`
- `GET /retell/prompt`, `PUT /retell/prompt`
- `GET /analytics/costs`

**Pages to build:**
- `execution/dashboard/src/pages/Activity.jsx`
- `execution/dashboard/src/pages/Errors.jsx`
- `execution/dashboard/src/pages/Settings.jsx` — 5 tabs

**Polish:**
- Loading skeletons on every page
- Empty states with friendly messages
- Responsive testing at 1200px and 768px breakpoints
- Remove old `/api/dashboard/*` endpoints from `main.py`
- Remove `legacyFetch`/`legacyPost` from `api.js`
- Remove old tab-based components no longer referenced

**Final verification:**
- All 14 pages load with real data
- Auth blocks unauthenticated access on all routes
- CORS correct for production origin
- No Supabase service key in frontend code
- Error badge shows real-time count in sidebar
