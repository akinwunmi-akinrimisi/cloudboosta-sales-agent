# Directive 07 — Dashboard
## React App: Live View, Lead Pipeline, Strategy Analytics

---

## Goal
Build a 3-tab React dashboard that gives the operator real-time visibility into the calling pipeline.

## Tech
- React 18 + Vite
- Tailwind CSS (light + dark mode)
- Recharts for charts
- Supabase JS client for data queries

## Tab 1: Live View (polls every 5 seconds)
- **Active call card:** lead name, phone, duration timer, strategy being used
- **No active call state:** "Waiting for next call" with auto-dialer status indicator
- **Recent calls list:** last 20 calls — lead name, duration, outcome badge (green/yellow/red)
- **Today's stats cards:** total calls, pick-up rate, commitments, avg duration
- **Dialer controls:** Start/Stop button, current schedule display

## Tab 2: Lead Pipeline (polls every 30 seconds)
- **Kanban columns:** New → Queued → Calling → Committed → Follow-Up → Declined
- **Cards:** lead name, phone, last call date, outcome
- **Click card:** slide-out panel with full transcript, recording player, call details
- **Search bar:** filter by name or phone
- **Bulk actions:** "Queue selected" button
- **CSV upload:** drag-and-drop to import leads

## Tab 3: Strategy Analytics (polls every 30 seconds)
- **Bar chart:** conversion rate by closing strategy (6 bars)
- **Heatmap:** strategy x persona (6x6 grid, colour intensity = conversion rate)
- **Line chart:** daily calls + commitments over last 30 days
- **Top stats cards:** best strategy, worst strategy, most common persona, total revenue potential
- **Table:** all strategies with total calls, commitments, follow-ups, declined, conversion %

## Data Source
- All data from Supabase REST API via `@supabase/supabase-js`
- Dashboard uses `SUPABASE_ANON_KEY` (not service key) + Supabase Auth login
- See security.md section 5 for dashboard auth requirements

## Design
- Clean, professional. No flashy colours or animations.
- Light + dark mode via Tailwind `dark:` classes
- Responsive layout

## Edge Cases
- If Supabase is unreachable: show "Connection lost" banner, keep showing stale data
- If no calls yet: show empty states with helpful messages
- CSV upload validation: reject files >10MB, non-CSV formats

## Lessons Learned
<!-- Update this section after completing the phase -->
