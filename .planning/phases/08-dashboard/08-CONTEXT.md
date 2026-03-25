# Phase 8: Dashboard - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Build the React SPA dashboard with 3 tabs (Live View, Pipeline, Strategy Analytics), bearer token auth, and dashboard API endpoints in the FastAPI backend. Uses the frontend-design skill for production-grade UI. No generic Bootstrap/Material UI.

</domain>

<decisions>
## Implementation Decisions

### Live View Tab
- **Active call card:** Rich card with lead name, masked phone, status badge (calling/in_call), duration timer, programme recommended, current strategy. Green pulsing indicator when live. When no active call: grey "No Active Call" with countdown to next dial check.
- **Today's stats:** 4 stat cards in a row: Total Calls, Connected (talked), Committed, Conversion Rate. Powered by todays_calls SQL view.
- **Recent calls list:** Compact table of last 10 calls today: time, name, duration, outcome badge (color-coded: green=committed, yellow=follow_up, red=declined, grey=no_answer). Click row to expand with transcript snippet, recording player, call details.
- **Polling:** Every 5 seconds for active call + recent calls. Stats refresh on same interval.

### Pipeline Tab (Kanban)
- **6 columns** (grouping related statuses):
  - New (new)
  - Queued (queued)
  - In Progress (calling, in_call)
  - Follow-Up (follow_up)
  - Committed (committed, payment_sent)
  - Closed (declined, not_qualified, do_not_contact, failed)
- Transient statuses (no_answer, voicemail, busy) cycle back to Queued — no dedicated columns.
- **Lead card:** Name, masked phone, time since last activity, retry count badge (if > 0). Click to open side panel.
- **Side panel (on click):** Full call history, transcript, recording player, notes/outcome, strategy used. Slides in from right.
- **Polling:** Every 30 seconds for pipeline data.

### Strategy Analytics Tab
- **Bar chart:** Horizontal bars showing conversion rate per closing strategy (6 strategies). Recharts BarChart component.
- **Totals table:** Below chart — columns: Strategy, Calls, Connected, Committed, Rate. Powered by strategy_performance SQL view.
- **Empty state:** Friendly message "No call data yet. Analytics will appear after Sarah's first calls. Start the auto-dialer to begin collecting data." with chart icon. Applies to all tabs when no data.
- **Polling:** Every 30 seconds for analytics data.

### Dashboard API Endpoints (BACK-04)
- GET /api/dashboard/live — active call + recent calls + today's stats (stub exists, needs implementation)
- GET /api/dashboard/pipeline — leads grouped by status with counts (partially exists)
- GET /api/dashboard/strategy — strategy performance data (stub exists)
- All protected by bearer token auth (DASHBOARD_SECRET_KEY, already wired in Phase 5)

### Auth
- Bearer token in Authorization header (already implemented in Phase 5)
- Dashboard login screen: simple token input field. Store token in localStorage. No username/password.
- Unauthenticated → show login screen. Invalid token → 401 → redirect to login.

### Tech Stack (locked from PROJECT.md)
- React 19 + Vite 6 + Tailwind 3.4 + Recharts 3
- Use frontend-design skill for production-grade, distinctive UI (per CLAUDE.md)
- No Bootstrap, Material UI, or generic component libraries
- Responsive layout (single operator, web only)

### Claude's Discretion
- Color palette, typography, spacing (frontend-design skill guides these)
- Component structure (how to split into React components)
- State management approach (useState/useEffect vs library)
- How to implement polling (setInterval vs custom hook)
- Tab navigation implementation
- Recording player component (HTML5 audio or library)
- How to mask phone numbers in display

</decisions>

<specifics>
## Specific Ideas

- The dashboard should feel clean and professional — like a modern CRM, not a template
- The active call card is the hero element of Live View — it should command attention when live
- Outcome badges should use consistent colors across all tabs: green=committed, yellow=follow_up, red=declined, grey=no_answer/voicemail
- The kanban should be scannable — operator glances and knows the pipeline state immediately
- Strategy analytics is the continuous improvement engine — it tells you which strategies work
- Empty states are important — Wave 0 starts with no data, the dashboard should look intentional not broken

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `execution/backend/main.py` — Dashboard API endpoints exist as stubs (GET /api/dashboard/live, /pipeline, /strategy). Bearer token auth already wired. CORS configured.
- `execution/backend/schema/004_views.sql` — 3 SQL views ready: pipeline_snapshot, strategy_performance, todays_calls
- `execution/dashboard/` — Directory exists with package.json (from Phase 0 scaffolding). May need initialization.
- Frontend-design skill — Auto-activates on React/CSS work per CLAUDE.md

### Established Patterns
- Supabase anon key for dashboard reads (from Phase 1 RLS: anon can SELECT)
- Bearer token auth via Authorization header (Phase 5)
- JSON API responses from FastAPI

### Integration Points
- Dashboard polls FastAPI: GET /api/dashboard/* with Bearer token
- OR polls Supabase directly with anon key (for pipeline data — bypasses backend)
- FastAPI serves dashboard API at same origin (CORS configured)
- Vite dev server at localhost:5173 (CORS already allows this)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 08-dashboard*
*Context gathered: 2026-03-25*
