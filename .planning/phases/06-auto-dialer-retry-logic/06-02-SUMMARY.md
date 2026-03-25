---
phase: 06-auto-dialer-retry-logic
plan: 02
subsystem: automation
tags: [n8n, workflow, auto-dialer, cron, luxon, supabase-rpc, http-request]

# Dependency graph
requires:
  - phase: 06-01-retry-backoff-schema
    provides: "pick_next_lead() RPC with retry backoff, next_retry_at column"
  - phase: 05-webhook-backend-security
    provides: "POST /retell/initiate-call endpoint with bearer auth"
provides:
  - "Complete n8n auto-dialer workflow JSON (15 nodes)"
  - "2-minute cron schedule trigger"
  - "Dial window enforcement via Luxon timezone-aware comparison"
  - "Active call guard preventing concurrent calls"
  - "pick_next_lead() RPC integration via HTTP Request"
  - "Error recovery: 409/429 reverts lead to queued, 500 sets lead to failed"
affects: [07-post-call-workflows, 09-testing-wave0]

# Tech tracking
tech-stack:
  added: [n8n-workflow-json]
  patterns:
    - "n8n HTTP Request node for Supabase RPC calls (not native Supabase node)"
    - "n8n $env references for secrets (SUPABASE_URL, SUPABASE_SERVICE_KEY, WEBHOOK_BASE_URL, DASHBOARD_SECRET_KEY)"
    - "ignoreHttpStatusErrors: true on HTTP Request for graceful error branching"
    - "Credential placeholders (SUPABASE_CRED_ID) for post-import re-linking"

key-files:
  created:
    - "execution/n8n/auto-dialer.json"
  modified: []

key-decisions:
  - "HTTP Request node for RPC calls instead of native Supabase node (Supabase node cannot reliably call RPCs)"
  - "DNC enforcement excluded from workflow -- handled by pick_next_lead() and initiate-call endpoint only"
  - "n8n workflow imported as inactive -- activation deferred to Phase 9 (Wave 0)"
  - "Supabase credentials need manual re-linking in n8n UI after import (placeholder IDs used)"

patterns-established:
  - "n8n workflow JSON uses $env references for all secrets, no hardcoded values"
  - "Error branching with fullResponse + ignoreHttpStatusErrors for status code inspection"
  - "Schedule-triggered n8n workflows with guard nodes (dial window, active call, empty queue) for safe autonomous operation"

requirements-completed: [AUTO-01, AUTO-06]

# Metrics
duration: 10min
completed: 2026-03-25
---

# Phase 6 Plan 02: n8n Auto-Dialer Workflow Summary

**15-node n8n auto-dialer workflow with 2-min cron, Luxon dial window check, pick_next_lead RPC, bearer-auth call initiation, and 409/429/500 error recovery**

## Performance

- **Duration:** 10 min
- **Started:** 2026-03-25T16:26:00Z
- **Completed:** 2026-03-25T16:36:42Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Complete 15-node n8n auto-dialer workflow JSON ready for import
- Schedule Trigger fires every 2 minutes (*/2 cron), checks active dial windows via Luxon timezone-aware comparison
- Active call guard prevents concurrent calls; empty queue silently stops execution
- pick_next_lead() called via HTTP Request (not Supabase node) with proper service key auth
- Error handling: 409/429 responses revert lead to queued, 500 sets lead to failed
- Workflow imported into n8n instance (ID: mLQMaQF3gzRSlJUH) at n8n.srv1297445.hstgr.cloud
- Schema migration 006_retry_migration.sql verified applied (7 statements, next_retry_at column confirmed)

## Task Commits

Each task was committed atomically:

1. **Task 1: Build complete n8n auto-dialer workflow JSON** - `f59d268` (feat)
2. **Task 2: Verify n8n workflow import and schema migration** - checkpoint:human-verify (approved)

## Files Created/Modified
- `execution/n8n/auto-dialer.json` - Complete 15-node n8n workflow: Schedule Trigger, Get Active Schedules, Check Dial Window (Luxon), Check Active Call, Has Active Call? IF, No-Op Active, Pick Next Lead (RPC) via HTTP Request, Has Lead? IF, No-Op Empty, Initiate Call via HTTP Request, Call Response Check IF, No-Op Success, Is Server Error? IF, Set Failed (Supabase update), Revert to Queued (Supabase update)

## Decisions Made
- HTTP Request node used for Supabase RPC calls because n8n's native Supabase node cannot reliably call RPCs
- DNC enforcement deliberately excluded from the workflow -- database (pick_next_lead only selects status=queued) and backend (initiate-call returns 403 for DNC) handle it
- Workflow imported as inactive (activation deferred to Phase 9 Wave 0 testing)
- Supabase credentials need manual re-linking in n8n UI after import (documented for operator)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required

**Operator action required before activation:**
- Re-link Supabase credentials in n8n UI for the imported workflow (placeholder SUPABASE_CRED_ID was used)
- Verify n8n environment variables are set: SUPABASE_URL, SUPABASE_SERVICE_KEY, WEBHOOK_BASE_URL, DASHBOARD_SECRET_KEY
- Do NOT activate the workflow until Phase 9 (Wave 0 testing)

## Next Phase Readiness
- Auto-dialer workflow is complete and imported into n8n, ready for activation in Phase 9
- Phase 6 is fully complete (both plans done): retry backoff schema + n8n auto-dialer workflow
- Phase 7 (Post-Call Workflows) can proceed -- independent n8n workflows for outcome routing and lead import
- Phase 8 (Dashboard) can also proceed -- depends only on Phase 5 backend API

## Self-Check: PASSED

All files exist. All commits verified.

---
*Phase: 06-auto-dialer-retry-logic*
*Completed: 2026-03-25*
