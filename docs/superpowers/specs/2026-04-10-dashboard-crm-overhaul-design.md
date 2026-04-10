# Dashboard CRM Overhaul — Design Spec

**Date:** 2026-04-10
**Source:** 5 merge files in `dashboard-updates/`
**Scope:** Expand 3-tab dashboard into 14-page internal CRM

---

## 1. What We're Building

Transform the existing Command Centre dashboard (3 tabs: Command Centre, Pipeline, Strategy Analytics) into a full 14-page CRM with URL routing, 6 modules, 42 features, 45 API endpoints, and 10 database views.

The Anthropic `frontend-design` skill is used for ALL frontend UI work. No generic Bootstrap/Material. Clean, professional, data-dense interfaces.

### Modules

| # | Module | Pages | Features |
|---|--------|-------|----------|
| 1 | Lead Management | Leads, Lead Detail, Pipeline | CSV import, search/filter, kanban, DNC |
| 2 | Outreach Management | Outreach, Bookings | Queue, delivery log, replies, timeouts |
| 3 | Call Operations | Home, Calls, Follow-ups | Live monitor, dialer, history, transcripts |
| 4 | Analytics & Strategy | Analytics | Trends, strategy perf, heatmap, funnel |
| 5 | Post-Call Automation | Committed, Enrolled | Payment emails, payment tracking |
| 6 | System & Operations | Activity, Errors, Settings, Login | Health, logs, config, auth |

---

## 2. Approved Design Decisions

### Decision 1: API Route Migration (Option A — Clean Break)

**Current:** All endpoints at `/api/dashboard/*` (e.g. `/api/dashboard/live`, `/api/dashboard/pipeline`)
**New:** Endpoints at `/api/*` organized by module (e.g. `/api/leads`, `/api/calls`, `/api/analytics/today`)

- Create `execution/backend/dashboard_routes.py` as a FastAPI `APIRouter(prefix="/api")`
- Import router in `main.py`
- Keep old `/api/dashboard/*` endpoints temporarily with deprecation comments
- Update frontend `api.js` to use new `/api/*` prefix
- Remove old endpoints after all pages migrated

### Decision 2: Frontend Architecture (Option A — React Router)

**Current:** Tab-based with `useState` for navigation, no URL routing
**New:** `react-router-dom` with proper URL routes for all 14 pages

- Install `react-router-dom`
- Replace `App.jsx` tab-based rendering with `<Routes>` / `<Route>`
- Existing components (CommandCentre, Pipeline, StrategyAnalytics, LeadDetail) become route pages
- New sidebar nav with 13 menu items + logout
- Topbar with page title, dialer status, active call indicator

### Decision 3: Anthropic Frontend-Design Skill

All UI components use the Anthropic `frontend-design` skill. This means:
- Clean, professional, distinctive interfaces
- No generic component libraries
- Data density prioritized over decoration
- Consistent design system across all 14 pages

---

## 3. Schema Gap Analysis

The merge specs assume columns and statuses that don't exist in the current schema. These need migration BEFORE the views or API can work.

### 3.1 Missing Columns on `leads`

| Column | Type | Purpose | Merge Spec Ref |
|--------|------|---------|----------------|
| `first_name` | TEXT | Split from `name` | LM-02, LM-06 |
| `last_name` | TEXT | Split from `name` | LM-02, LM-06 |
| `has_whatsapp` | BOOLEAN DEFAULT FALSE | WhatsApp enrichment flag | LM-07, OM-01 |
| `has_email` | BOOLEAN DEFAULT FALSE | Email enrichment flag | LM-07 |
| `timezone` | TEXT | Detected timezone | LM-02 |
| `call_scheduled_at` | TIMESTAMPTZ | Cal.com booking time | OM-05 |

**Name split strategy:**
1. `ALTER TABLE leads ADD COLUMN first_name TEXT, ADD COLUMN last_name TEXT;`
2. `UPDATE leads SET first_name = split_part(name, ' ', 1), last_name = substring(name from position(' ' in name) + 1);`
3. `ALTER TABLE leads DROP COLUMN name;`
4. `ALTER TABLE leads ADD COLUMN name TEXT GENERATED ALWAYS AS (first_name || ' ' || coalesce(last_name, '')) STORED;`
5. All existing code referencing `leads.name` continues working via the generated column.
6. New code uses `first_name`/`last_name` directly.

### 3.2 Missing Columns on `call_logs`

| Column | Type | Purpose |
|--------|------|---------|
| `objections_raised` | TEXT[] | Array of objection keys raised during call |
| `lead_persona` | TEXT | Alias — already exists as `detected_persona` |
| `sentiment` | TEXT | Post-call sentiment analysis |
| `duration_ms` | — | NOT NEEDED — use existing `duration_seconds`, multiply in views |

**`detected_persona` vs `lead_persona`:** The merge specs use `lead_persona`. The actual column is `detected_persona`. The views will alias: `detected_persona AS lead_persona`.

### 3.3 Missing Columns on `pipeline_logs`

| Column | Type | Purpose |
|--------|------|---------|
| `status` | TEXT | Event status (success/error) — for error log page |

### 3.4 Missing Lead Statuses

The current schema has 14 statuses. The merge specs reference additional statuses needed for the multi-channel outreach flow:

| New Status | Purpose | Insert After |
|------------|---------|-------------|
| `enriched` | Lead data enriched, ready for outreach | `new` |
| `outreach_sent` | WhatsApp/email sent, waiting for response | `enriched` |
| `outreach_no_response` | 48h passed with no reply | `outreach_sent` |
| `call_scheduled` | Cal.com booking confirmed | `outreach_sent` |
| `follow_up_scheduled` | Follow-up call booked for specific time | `follow_up` |
| `payment_pending` | Committed but awaiting payment | `committed` |
| `enrolled` | Payment received, student enrolled | `payment_pending` |
| `exhausted` | Max retries reached, no more attempts | `busy` |
| `invalid_number` | Phone number invalid/disconnected | `failed` |

**Migration:** `ALTER TABLE leads DROP CONSTRAINT leads_status_check` then add new CHECK with all 23 statuses. Update the state machine trigger function accordingly.

### 3.5 Migration SQL File

Create `execution/backend/schema/007_dashboard_migration.sql` with:
1. Add new columns to `leads` (first_name, last_name, has_whatsapp, has_email, timezone, call_scheduled_at)
2. Populate first_name/last_name from existing `name` column
3. Make `name` a generated column
4. Add new columns to `call_logs` (objections_raised, sentiment)
5. Add status column to `pipeline_logs`
6. Expand leads status CHECK constraint to 23 statuses
7. Update state machine trigger with new transitions

---

## 4. Database Views

10 new views replacing/extending the existing 3. All use `CREATE OR REPLACE VIEW` (idempotent).

Create `execution/backend/schema/008_dashboard_views.sql`:

| View | Purpose | Adapts To Actual Schema |
|------|---------|------------------------|
| `dashboard_today` | Today's overview stats | Uses `duration_seconds` not `duration_ms` |
| `leads_by_status` | Pipeline kanban counts | Replaces `pipeline_snapshot`, keeps same interface |
| `strategy_performance` | Strategy conversion rates | Adds `detected_persona` grouping (aliased as `lead_persona`) |
| `strategy_persona_heatmap` | Strategy x persona grid | Uses `detected_persona` |
| `daily_trends` | 30-day trend lines | Uses `duration_seconds` |
| `follow_up_queue` | Overdue/upcoming follow-ups | Joins leads + latest call_log |
| `retry_queue` | Leads pending retry | Respects `next_retry_at` from 006 migration |
| `outreach_log` | Outreach delivery history | Reads `pipeline_logs.details` JSONB |
| `funnel_conversion` | Full-funnel counts | Uses new status values |
| `objection_frequency` | Objection breakdown | Uses new `objections_raised` column |

---

## 5. API Architecture

### 5.1 Router Structure

```
execution/backend/
  main.py                    # Existing — keeps Retell webhooks, dialer, health
  dashboard_routes.py        # NEW — all 45 CRM endpoints under /api/*
```

`dashboard_routes.py` is a `FastAPI APIRouter(prefix="/api")` imported into `main.py`.

### 5.2 Auth

Same pattern as existing: Bearer token matching `DASHBOARD_SECRET_KEY` env var. Applied via `Depends(verify_bearer_token)` on every endpoint in the router.

### 5.3 CORS Update

Add `PUT` and `DELETE` to `allow_methods` in the existing CORS middleware.

### 5.4 Rate Limiting

Per-endpoint rate limits using existing `slowapi` setup. Ranges from 2/min (prompt update) to 60/min (live call polling).

### 5.5 Endpoint Count by Module

| Module | GET | POST | PUT | DELETE | Total |
|--------|-----|------|-----|--------|-------|
| Lead Management | 7 | 4 | 1 | 0 | 12 |
| Outreach | 5 | 0 | 1 | 0 | 6 |
| Call Operations | 5 | 3 | 1 | 1 | 10 |
| Analytics | 7 | 0 | 0 | 0 | 7 |
| Post-Call | 2 | 0 | 0 | 0 | 2 |
| System | 5 | 1 | 2 | 0 | 8 |
| **Total** | **31** | **8** | **5** | **1** | **45** |

---

## 6. Frontend Architecture

### 6.1 Tech Stack

- React 18 (existing)
- Tailwind CSS (existing)
- `react-router-dom` v6 (NEW)
- Recharts (NEW — for analytics charts)
- Lucide React (NEW — for consistent icons)
- Anthropic `frontend-design` skill for all UI

### 6.2 Routing

```
/login          → Login
/               → Home Dashboard
/leads          → Leads List
/leads/:id      → Lead Detail
/pipeline       → Pipeline Kanban
/outreach       → Outreach Management
/bookings       → Bookings Calendar
/calls          → Call History
/calls/:id      → Call Detail (slide-out or page)
/follow-ups     → Follow-up Queue
/committed      → Committed Leads
/enrolled       → Enrolled Students
/analytics      → Analytics Dashboard
/activity       → Activity Log
/errors         → Error Log
/settings       → Settings (5 tabs)
```

### 6.3 Layout Shell

- **Sidebar:** Fixed left, 240px, collapsible to 56px icons-only at <1200px, hamburger at <768px
- **Topbar:** Page title, dialer status badge, active call indicator
- **Auth guard:** All routes except `/login` require token in state/localStorage

### 6.4 Component Reuse

Existing components adapted for new routes:
- `CommandCentre.jsx` → becomes the Home (`/`) page content
- `Pipeline.jsx` → becomes `/pipeline` page (may need kanban enhancement)
- `StrategyAnalytics.jsx` → becomes part of `/analytics` page
- `LeadDetail.jsx` → becomes `/leads/:id` page
- `Login.jsx` → stays as `/login`
- `ActiveCallCard.jsx`, `RecentCallsTable.jsx`, `StatCard.jsx`, `OutcomeBadge.jsx` → reused as shared components

### 6.5 New Shared Components

- `PageShell` — wrapper with sidebar + topbar
- `DataTable` — reusable sortable/paginated table with search
- `FilterBar` — reusable filter dropdowns + search
- `StatusBadge` — colored pills for all 23 lead statuses
- `ChannelBadge` — email/WhatsApp icons
- `EmptyState` — friendly empty state (existing, reuse)
- `LoadingSkeleton` — shimmer placeholders while data loads

### 6.6 API Client Update

Replace hardcoded `/api/dashboard` prefix in `api.js`:

```js
// Before
fetch(`/api/dashboard${path}`, ...)

// After  
fetch(`/api${path}`, ...)
```

Add `apiPut()` and `apiDelete()` methods alongside existing `apiFetch()` and `apiPost()`.

---

## 7. Build Phases (5 Sprints)

### Pre-Sprint: Schema Migration + Infrastructure
- Run `007_dashboard_migration.sql` (new columns, statuses, state machine)
- Run `008_dashboard_views.sql` (10 views + indexes)
- Update CORS to allow PUT/DELETE
- Install `react-router-dom`, `recharts`, `lucide-react`
- Update `api.js` prefix from `/api/dashboard` to `/api`
- Create `dashboard_routes.py` scaffold with auth middleware

### Sprint 1: Foundation + Home + Auth (P0)
- Login page, auth context, route guard
- Nav layout shell (sidebar + topbar)
- Home dashboard (today stats, live call, dialer controls, health, recent calls)
- API: `/api/analytics/today`, `/api/calls/live`, `/api/dialer/status`, `/api/health`, `/api/calls`

### Sprint 2: Lead Management + Pipeline (P0)
- Leads list page (search, filter, CSV import)
- Lead detail page (header + 3 tabs)
- Pipeline kanban
- DNC management
- API: `/api/leads`, `/api/leads/:id`, `/api/leads/import`, `/api/leads/by-status`, `/api/leads/blocked`

### Sprint 3: Outreach + Bookings + Calls (P0)
- Outreach page (queue, delivery log, replies, timeout)
- Bookings page (calendar + list)
- Call history page (table + transcript slide-out)
- Follow-ups page (grouped by urgency)
- API: All outreach + call operation endpoints

### Sprint 4: Analytics + Post-Call (P0/P1)
- Analytics page (6 chart sections using Recharts)
- Committed page (payment tracking)
- Enrolled page (export CSV)
- API: All analytics + post-call endpoints

### Sprint 5: System + Settings + Polish (P1/P2)
- Activity log, Error log, Settings (5 tabs)
- Error badge in nav
- Loading skeletons, empty states, responsive
- Security hardening review
- API: All system endpoints

---

## 8. Backward Compatibility

### During Build
- Old `/api/dashboard/*` endpoints stay active throughout all sprints
- Each sprint adds new `/api/*` endpoints alongside
- Frontend pages migrate one at a time to new endpoints

### After Build
- Remove old `/api/dashboard/*` endpoints from `main.py`
- Remove old tab-based navigation code from `App.jsx`
- Update smoke tests to use new endpoints

### Database
- `name` column becomes generated from `first_name || ' ' || last_name`
- All existing code referencing `leads.name` continues to work
- Views use `CREATE OR REPLACE` — existing view consumers get updated schemas

---

## 9. Testing Strategy

After each sprint:
- Manual QA via `gstack /qa` against the running dashboard
- Verify auth blocks unauthenticated access
- Verify new endpoints return correct data shapes
- Verify existing Retell webhook/dialer functionality not broken

Before final deploy:
- Full `gstack /qa` pass across all 14 pages
- Run existing `pytest` test suite to ensure backend regression-free
- Security audit: no service keys in frontend, CORS correct, rate limits active
