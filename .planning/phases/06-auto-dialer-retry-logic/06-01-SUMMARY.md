---
phase: 06-auto-dialer-retry-logic
plan: 01
subsystem: database, api
tags: [postgres, supabase, retry, backoff, state-machine, fastapi]

# Dependency graph
requires:
  - phase: 05-webhook-backend-security
    provides: "call_ended handler with DISCONNECT_TO_STATUS mapping"
provides:
  - "next_retry_at column on leads table for 60-min backoff"
  - "calling -> failed state machine transition"
  - "pick_next_lead() RPC respects next_retry_at backoff"
  - "handle_retry_requeue() function in main.py"
  - "RETRY_ELIGIBLE_STATUSES constant (no_answer, voicemail, busy)"
affects: [06-02-auto-dialer-workflow, 09-testing-wave0]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-step state transition: calling -> no_answer -> queued (via handle_retry_requeue)"
    - "Optimistic eq(status, mapped_status) guard on requeue update prevents race conditions"

key-files:
  created:
    - "execution/backend/schema/006_retry_migration.sql"
  modified:
    - "execution/backend/main.py"

key-decisions:
  - "Two-step transition pattern: webhook sets calling->no_answer first, then handle_retry_requeue transitions no_answer->queued or no_answer->declined"
  - "Optimistic concurrency: .eq('status', mapped_status) on requeue update prevents double-requeue if webhook fires twice"

patterns-established:
  - "Schema migration files follow sequential numbering (006_retry_migration.sql)"
  - "Retry-eligible statuses defined as a constant set for reuse"

requirements-completed: [AUTO-05, AUTO-06]

# Metrics
duration: 4min
completed: 2026-03-25
---

# Phase 6 Plan 01: Retry Backoff Schema + Requeue Logic Summary

**Retry backoff infrastructure with next_retry_at column, calling->failed state machine fix, and handle_retry_requeue() in call_ended handler**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-25T16:17:05Z
- **Completed:** 2026-03-25T16:21:34Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Schema migration adds next_retry_at column and fixes calling->failed state machine transition
- pick_next_lead() RPC now skips leads in 60-minute backoff period
- call_ended handler automatically requeues no_answer/voicemail/busy leads with retry_count < max_retries
- Retry-exhausted leads transition to declined status automatically

## Task Commits

Each task was committed atomically:

1. **Task 1: Schema migration -- next_retry_at column, state machine fix, pick_next_lead update** - `11bd019` (feat)
2. **Task 2: Add retry requeue logic to call_ended handler** - `c2e48e7` (feat)

## Files Created/Modified
- `execution/backend/schema/006_retry_migration.sql` - ALTER TABLE (next_retry_at), state machine fix (calling->failed), pick_next_lead() RPC update (backoff filter)
- `execution/backend/main.py` - timedelta import, RETRY_ELIGIBLE_STATUSES, handle_retry_requeue(), retry hook in call_ended

## Decisions Made
- Two-step transition pattern: webhook sets calling->no_answer first, then handle_retry_requeue transitions no_answer->queued or no_answer->declined -- satisfies state machine constraint
- Optimistic concurrency with .eq("status", mapped_status) on requeue update prevents race conditions from duplicate webhook deliveries

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

None - no external service configuration required. The 006_retry_migration.sql must be run against Supabase when deploying (same as all prior migrations).

## Next Phase Readiness
- Retry backoff infrastructure is ready for the n8n auto-dialer workflow (06-02)
- pick_next_lead() RPC will correctly skip leads in backoff period when called by the dialer
- DNC enforcement unchanged -- pick_next_lead() still only selects status='queued' leads

## Self-Check: PASSED

All files exist. All commits verified.

---
*Phase: 06-auto-dialer-retry-logic*
*Completed: 2026-03-25*
