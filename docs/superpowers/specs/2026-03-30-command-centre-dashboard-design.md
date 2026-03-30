# Command Centre Dashboard — Design Spec

## Overview

Transform the Sarah/John sales agent dashboard from a 3-tab monitoring tool into a full operational command centre. Four views: Command Centre (home), Pipeline, Strategy, Lead Detail.

**Tech stack:** React 19 + Tailwind 3.4 + Recharts 3 + Vite 6. Dark theme with glass-card design system already established. FastAPI backend with Supabase (PostgreSQL).

---

## View 1: Command Centre (Home)

Replaces the current Live tab. Single-pane operational overview.

### Layout (top to bottom)

**Stats Row** — 6 glass-cards in a horizontal grid:
- Total Leads (from leads table count)
- Queued (leads where status = 'queued')
- Today's Calls (from todays_calls view count)
- Connected (today's calls with outcome != null)
- Committed (today's calls with outcome = 'committed')
- Conversion Rate (committed / connected * 100)

**Middle Row** — 2-column grid:

Left: **Active Call Card** (existing component, keep as-is with live timer, name, phone, programme, strategy). When no active call, show "No active call" empty state.

Right: **Call Queue Panel** — Next 10 leads in queue ordered by priority then next_retry_at. Each row shows: name, masked phone, priority badge, retry count, call_type (invite/reminder/follow_up). Each row has a [Call] button that triggers the quick-call endpoint.

Query: `SELECT * FROM leads WHERE status IN ('queued', 'new') ORDER BY priority DESC, next_retry_at ASC NULLS LAST LIMIT 10`

**Third Row** — 2-column grid:

Left: **Lead Funnel** — Horizontal stacked bar or vertical funnel showing lead counts by lifecycle stage. Stages: New → Queued → In Progress (calling + in_call) → Follow Up → Committed → Closed (declined + not_qualified + do_not_contact). Use Recharts BarChart. Each segment colored per existing COLUMN_COLORS.

Right: **Activity Feed** — Scrollable feed of recent activity (last 20 items). Sources:
- `pipeline_logs` table (status transitions): "Lead [name] moved to [status]"
- `call_logs` recent entries: "[name] called — [duration] — [outcome]"

Query: Combined query from pipeline_logs + call_logs, ordered by created_at DESC, limit 20. New backend endpoint returns this merged.

**Bottom** — **Today's Calls Table** (enhanced from current RecentCallsTable):
- Columns: Time, Lead Name, Duration, Outcome, Persona, Strategy, Programme, Summary (truncated)
- Each row has: [Play] icon button for recording, [View] button navigates to Lead Detail
- Expandable rows show full summary
- Clicking lead name → Lead Detail view

### Data Source
New endpoint: `GET /api/dashboard/command-centre`

Returns:
```json
{
  "stats": {
    "total_leads": int,
    "queued": int,
    "todays_calls": int,
    "connected": int,
    "committed": int,
    "conversion_rate": float
  },
  "active_call": { ... } | null,
  "queue": [{ "id", "name", "phone", "priority", "retry_count", "next_call_type", "next_call_at" }],
  "funnel": { "new": int, "queued": int, "in_progress": int, "follow_up": int, "committed": int, "closed": int },
  "activity": [{ "type": "call"|"status_change", "lead_name": str, "detail": str, "timestamp": iso }],
  "recent_calls": [{ existing todays_calls fields + persona, strategy, programme }]
}
```

Polling: 5000ms (same as current Live tab).

---

## View 2: Lead Detail (Full Intelligence Page)

Full-page view navigated to by clicking any lead name/card from any view. Not a tab — accessed via navigation state.

### Layout

**Header Bar:**
- Back button (returns to previous view)
- Lead name (large)
- Outcome badge + Status badge
- Phone (masked) | Email | Location | Source

**Two-Column Grid:**

Left: **Profile Card** (glass-card):
- Detected Persona (with label)
- Programme Recommended
- Motivation (from leads.motivation field)
- Priority
- Currency
- Country
- Experience Level
- Current Role
- Notes

Right: **Call Intelligence Card** (glass-card):
- Total Calls (count from call_logs)
- Total Talk Time (sum of duration_seconds)
- Last Called (relative time)
- Next Call Scheduled (from leads.next_call_at + next_call_type)
- Retries Used (retry_count / max_retries)
- Objections Raised (aggregated distinct objection types from all call_logs summaries — parsed from closing_strategy_used and detected_persona patterns)
- Last Strategy Used
- Webinars Invited (list from leads.webinars_invited array)
- Last Webinar Attended (boolean)

**Call History Timeline** — Full width below the cards. Each call as a collapsible card:

```
┌─ Call #N — [date time] ──── [duration] ──── [OutcomeBadge] ───┐
│  Persona: [badge]  |  Strategy: [badge]  |  Disconnect: [reason] │
│  Summary: [full text]                                            │
│  [▶ Play Recording]  (audio player, only if recording_url exists)│
│  [Transcript ▼] (collapsible, full transcript text)              │
└──────────────────────────────────────────────────────────────────┘
```

Calls ordered newest first. All calls shown (no pagination needed — leads rarely have more than 10 calls).

**Quick Actions Bar** — Fixed at bottom or below timeline:
- [Call Now] — triggers POST /api/dashboard/call-now/{lead_id}
- [Schedule Follow-up] — future enhancement, disabled for now
- [Mark Declined] — updates lead status to declined via API
- [Add Note] — future enhancement, disabled for now

### Data Source
Existing endpoint enhanced: `GET /api/dashboard/lead/{lead_id}`

Returns (additions in bold):
```json
{
  "lead": { /* full leads row — already returned */ },
  "calls": [{ /* full call_logs rows — already returned */ }],
  "call_stats": {
    "total_calls": int,
    "total_duration_seconds": int,
    "objections_seen": [str]
  }
}
```

The `call_stats` field is computed server-side from call_logs aggregation.

---

## View 3: Pipeline (Enhanced)

Keep existing Kanban layout. Changes:

**Search/Filter Bar** at top:
- Text search input (filters by lead name, phone, email)
- Dropdown filters: Programme, Persona, Outcome
- Filters applied client-side on the leads array

**Enhanced Lead Cards:**
- Add persona icon/label if detected_persona is set
- Add programme badge if programme_recommended is set
- Add follow-up date if follow_up_at is set
- Add small call count indicator

**Click Behavior:**
- Remove LeadSidePanel component
- Clicking a card navigates to Lead Detail view (full page)

### Data Source
Same endpoint: `GET /api/dashboard/pipeline` — no changes needed. All new card fields already exist in the response.

---

## View 4: Strategy (Enhanced)

Keep existing bar chart + table. Add:

**Outcomes Over Time Chart** — Line chart showing daily call volumes with outcome breakdown (stacked area or grouped bars). X-axis: dates (last 14 days). Y-axis: call count. Series: committed, follow_up, declined, no_answer.

**Persona Performance Table** — Which personas convert best. Columns: Persona, Total Calls, Committed, Conversion Rate. Sorted by conversion rate.

### Data Source
Enhanced endpoint: `GET /api/dashboard/strategy`

Returns (additions):
```json
{
  "strategies": [/* existing */],
  "daily_outcomes": [{ "date": "2026-03-30", "committed": 2, "follow_up": 5, "declined": 1, "no_answer": 3 }],
  "persona_performance": [{ "persona": str, "total_calls": int, "committed_count": int, "conversion_rate": float }]
}
```

---

## New Backend Endpoints

### GET /api/dashboard/command-centre
Single endpoint that returns all command centre data. Queries:
- `SELECT COUNT(*) FROM leads` (total)
- `SELECT COUNT(*) FROM leads WHERE status = 'queued'` (queued)
- Active call query (existing)
- Queue query (top 10 queued/new leads)
- Funnel counts grouped by status
- Activity feed: UNION of pipeline_logs + call_logs, ordered by timestamp, limit 20
- Today's calls (existing view)

### POST /api/dashboard/call-now/{lead_id}
Thin wrapper around existing initiate-call logic. Same safety checks (active call guard, daily limit, blocked destinations). Requires bearer token auth. Returns `{ call_id, status }`.

### Enhanced GET /api/dashboard/lead/{lead_id}
Add `call_stats` to response: total calls count, total duration sum, distinct objection types seen across all call summaries.

### Enhanced GET /api/dashboard/strategy
Add `daily_outcomes` (from call_logs grouped by date + outcome, last 14 days) and `persona_performance` (from call_logs grouped by detected_persona).

---

## Component Changes Summary

| Component | Action |
|---|---|
| App.jsx | Update nav: 4 views, add routing state for Lead Detail |
| LiveView.jsx | Replace with CommandCentre.jsx |
| CommandCentre.jsx | NEW — stats, active call, queue, funnel, feed, calls table |
| CallQueuePanel.jsx | NEW — queued leads with call buttons |
| LeadFunnel.jsx | NEW — Recharts bar/funnel visualization |
| ActivityFeed.jsx | NEW — scrollable recent activity |
| LeadDetail.jsx | NEW — full-page lead intelligence view |
| CallTimeline.jsx | NEW — call history cards with transcript/recording |
| QuickActions.jsx | NEW — action buttons for lead |
| Pipeline.jsx | Add search/filter bar, enhance cards, remove side panel |
| LeadCard.jsx | Add persona, programme, follow-up badges |
| SearchFilter.jsx | NEW — search input + dropdown filters |
| StrategyAnalytics.jsx | Add daily outcomes chart + persona table |
| LeadSidePanel.jsx | DELETE — replaced by LeadDetail full page |
| StatCard.jsx | Keep as-is |
| OutcomeBadge.jsx | Keep as-is |
| ActiveCallCard.jsx | Keep as-is |
| RecentCallsTable.jsx | Enhance with persona, strategy, programme columns |

---

## Design System

All new components follow existing patterns:
- `glass-card` class for containers
- `label-mono` for section labels
- `value-lg` for stat numbers
- Space Grotesk for display, IBM Plex Mono for data
- Dark theme (bg-base, bg-surface)
- Outcome colors from OUTCOME_COLORS constant
- Kanban colors from COLUMN_COLORS constant

---

## Polling Strategy

| View | Interval | Endpoint |
|---|---|---|
| Command Centre | 5000ms | /api/dashboard/command-centre |
| Pipeline | 30000ms | /api/dashboard/pipeline |
| Strategy | 30000ms | /api/dashboard/strategy |
| Lead Detail | On-demand only | /api/dashboard/lead/{id} |

---

## Out of Scope (Future)

- Schedule Follow-up action (needs date picker UI)
- Add Note action (needs text input + backend endpoint)
- Send Email action (needs Resend integration from dashboard)
- Drag-and-drop in Kanban
- WebSocket real-time updates (polling is sufficient for single-user)
- Lead import/CSV upload from dashboard
