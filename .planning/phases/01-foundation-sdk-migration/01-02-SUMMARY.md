---
phase: 01-foundation-sdk-migration
plan: 02
subsystem: database
tags: [postgresql, supabase, sql-views, rpc, plpgsql, seed-data, testing]

# Dependency graph
requires:
  - phase: 01-foundation-sdk-migration
    plan: 01
    provides: "7 Supabase tables, indexes, RLS policies, and trigger functions"
provides:
  - "3 SQL views (pipeline_snapshot, strategy_performance, todays_calls) for dashboard queries"
  - "pick_next_lead() RPC function with FOR UPDATE SKIP LOCKED for atomic queue picking"
  - "4 programme seed rows (Cloud Computing, Advanced DevOps, Platform Engineer, SRE)"
  - "16 pricing rows (4 bundles x 4 currencies with instalment info)"
  - "30 objection response rows across 10 categories with cultural nuances"
  - "10 Wave 0 test leads with mixed countries and priorities"
  - "1 default dial schedule (Europe/London, 10am-7pm, 7 days)"
  - "test_phase1.py validating DATA-01 through DATA-07"
affects: [04-webhook-backend, 05-auto-dialer, 06-post-call, 07-dashboard, 09-testing]

# Tech tracking
tech-stack:
  added: [plpgsql-rpc, sql-views]
  patterns: [atomic-queue-pick-skip-locked, idempotent-seed-on-conflict, automated-db-validation]

key-files:
  created:
    - execution/backend/schema/004_views.sql
    - execution/backend/seeds/001_programmes.sql
    - execution/backend/seeds/002_pricing.sql
    - execution/backend/seeds/003_objection_responses.sql
    - execution/backend/seeds/004_test_leads.sql
    - execution/backend/seeds/005_dial_schedules.sql
    - execution/backend/test_phase1.py
  modified:
    - execution/backend/schema/005_functions.sql

key-decisions:
  - "4 bundles only (not individual pathway pricing) per CONTEXT.md spec: 16 rows = 4 bundles x 4 currencies"
  - "Instalment surcharges in GBP-equivalent amounts per currency (100/200 GBP -> proportional per currency)"
  - "Objection responses include cultural_nuances JSONB with nigeria/uk/us keys for localized handling"
  - "Test leads use +1555XXXXXXX US test numbers to avoid real phone conflicts"
  - "Avoided literal SQL keywords in file header comments to prevent grep-based verification false positives"

patterns-established:
  - "ON CONFLICT DO NOTHING for idempotent seed data insertion"
  - "Atomic queue picking via PL/pgSQL function with SELECT FOR UPDATE SKIP LOCKED"
  - "Dashboard views as materialized query shortcuts over core tables"
  - "Automated DB validation script pattern with cleanup after each test"

requirements-completed: [DATA-05, DATA-06]

# Metrics
duration: 10min
completed: 2026-03-25
---

# Phase 1 Plan 02: SQL Views, pick_next_lead() RPC, Seed Data, and Test Script Summary

**3 dashboard SQL views, atomic pick_next_lead() RPC with SKIP LOCKED, 61 seed data rows (4 programmes + 16 pricing + 30 objections + 10 test leads + 1 schedule), and automated DATA-01 to DATA-07 validation script**

## Performance

- **Duration:** 10 min
- **Started:** 2026-03-25T06:35:13Z
- **Completed:** 2026-03-25T06:45:39Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments
- 3 SQL views provide pre-computed dashboard queries: pipeline_snapshot (lead counts by status), strategy_performance (conversion rates by closing strategy), todays_calls (today's call log with lead details)
- pick_next_lead() RPC function uses FOR UPDATE SKIP LOCKED for race-condition-free queue picking by the auto-dialer
- Complete seed data covering all 4 Cloudboosta pathways, 16 pricing rows with instalment details across 4 currencies, 30 objection responses with multi-layer scripts and cultural nuances, 10 test leads, and 1 default dial schedule
- test_phase1.py validates all Phase 1 DATA requirements with automated PASS/FAIL output and test data cleanup

## Task Commits

Each task was committed atomically:

1. **Task 1: Create SQL views and pick_next_lead() RPC function** - `4ad60e6` (feat)
2. **Task 2: Create seed data files and automated test script** - `69bf556` (feat)

## Files Created/Modified
- `execution/backend/schema/004_views.sql` - 3 SQL views (pipeline_snapshot, strategy_performance, todays_calls)
- `execution/backend/schema/005_functions.sql` - Appended pick_next_lead() RPC function with FOR UPDATE SKIP LOCKED
- `execution/backend/seeds/001_programmes.sql` - 4 Cloudboosta training pathways with topics, tools, and roles
- `execution/backend/seeds/002_pricing.sql` - 16 pricing rows (4 bundles x 4 currencies, GBP/USD/EUR/NGN)
- `execution/backend/seeds/003_objection_responses.sql` - 30 objection responses across 10 categories with cultural nuances
- `execution/backend/seeds/004_test_leads.sql` - 10 Wave 0 test leads with UK/US/Nigeria/Germany/Canada mix
- `execution/backend/seeds/005_dial_schedules.sql` - Default dial window (Europe/London, 10am-7pm, 7 days)
- `execution/backend/test_phase1.py` - Automated validation of DATA-01 through DATA-07

## Decisions Made
- Followed 4-bundle model from CONTEXT.md (Zero to Cloud DevOps, DevOps Pro, 3 Pathways, Zero to DevOps Pro) rather than including individual pathway pricing rows
- Applied GBP-proportional instalment surcharges per currency (e.g., GBP +100/+200, USD +100/+250, EUR +100/+250, NGN +200000/+400000)
- Wrote 30 objection responses (3 per category x 10 categories) with realistic sales-professional language, cultural_nuances JSONB for Nigeria/UK/US, and escalation triggers
- Used +1555XXXXXXX US test phone format for Wave 0 leads to avoid collision with real phone numbers
- Avoided literal "CREATE VIEW" text in SQL file comments to prevent grep-based verification counting comments as actual views

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- Initial Task 1 verification failed because the `grep -c "CREATE.*VIEW"` count included a comment containing "CREATE OR REPLACE VIEW". Fixed by rewording the comment to "replace-if-exists pattern" (same issue as Plan 01-01). No functional impact.

## User Setup Required

None - seed SQL files and test script are committed and ready to run against Supabase. Run schema files (001-005) first, then seed files (001-005), then `python test_phase1.py` to validate.

## Next Phase Readiness
- All Phase 1 database work is now complete: tables, indexes, RLS, triggers, views, RPC function, and seed data
- test_phase1.py can be run immediately after applying schema and seeds to Supabase to validate all DATA requirements
- Phase 2 (Retell LLM Configuration) can proceed -- it depends on Phase 1 completion, which is now satisfied
- The auto-dialer (Phase 6) will call `supabase.rpc("pick_next_lead").execute()` to pick leads from the queue

## Self-Check: PASSED

- All 8 created/modified files exist at expected paths
- All 1 summary file exists
- Commit 4ad60e6 (Task 1) verified in git log
- Commit 69bf556 (Task 2) verified in git log

---
*Phase: 01-foundation-sdk-migration*
*Completed: 2026-03-25*
