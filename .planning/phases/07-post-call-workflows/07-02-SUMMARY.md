---
phase: 07-post-call-workflows
plan: 02
subsystem: infra
tags: [n8n, csv, lead-import, supabase, postgrest, e164, validation]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: Supabase leads table with phone UNIQUE constraint and E.164 CHECK
provides:
  - n8n CSV lead import workflow with validation and dedup (execution/n8n/lead-import.json)
  - Bulk lead onboarding for production calling campaigns
affects: [09-testing, auto-dialer]

# Tech tracking
tech-stack:
  added: [n8n-nodes-base.extractFromFile, n8n-nodes-base.webhook]
  patterns: [PostgREST Prefer header for ignore-duplicates bulk insert, responseMode lastNode for webhook response]

key-files:
  created: []
  modified: [execution/n8n/lead-import.json]

key-decisions:
  - "PostgREST Prefer: resolution=ignore-duplicates header for DB-level dedup (bulk approach preferred over per-row insert)"
  - "extractFromFile node (not deprecated Spreadsheet File) for CSV parsing"
  - "In-batch dedup via Set before DB insert catches same-file duplicates"

patterns-established:
  - "Webhook responseMode=lastNode: returns final node output as HTTP response"
  - "PostgREST Prefer header for conflict resolution on UNIQUE constraints"

requirements-completed: [AUTO-03]

# Metrics
duration: 2min
completed: 2026-03-25
---

# Phase 07 Plan 02: Lead Import Workflow Summary

**n8n CSV lead import workflow with E.164 validation, in-batch dedup, and PostgREST bulk insert with ignore-duplicates**

## Performance

- **Duration:** 2 min
- **Started:** 2026-03-25T18:03:50Z
- **Completed:** 2026-03-25T18:06:45Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments
- Complete n8n workflow (5 nodes) for CSV lead import at POST /lead-import
- E.164 phone validation matching database CHECK constraint, with required name field
- Two-level dedup: in-batch Set prevents CSV duplicates, PostgREST Prefer header handles DB duplicates
- Summary response with imported/skipped/validation_errors/db_duplicates_skipped/total_rows

## Task Commits

Each task was committed atomically:

1. **Task 1: Create n8n lead-import workflow JSON** - `d197b22` (feat)

**Plan metadata:** pending (docs: complete plan)

## Files Created/Modified
- `execution/n8n/lead-import.json` - Full n8n workflow: Webhook -> Parse CSV -> Validate Rows -> Insert Leads -> Build Summary

## Decisions Made
- Used PostgREST `Prefer: resolution=ignore-duplicates,return=representation` header for bulk dedup against existing DB leads. This is standard PostgREST (which Supabase uses) and more efficient than per-row inserts. Alternative approach documented in workflow notes for older PostgREST versions.
- Used `n8n-nodes-base.extractFromFile` (typeVersion 1) instead of deprecated `n8n-nodes-base.spreadsheetFile` per research findings.
- In-batch dedup uses JavaScript Set for O(1) phone lookup before DB insert, catching same-CSV duplicates that PostgREST dedup would miss in a single batch.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required. Workflow imports as inactive and uses existing Supabase credentials (same placeholder pattern as auto-dialer.json).

## Next Phase Readiness
- Lead import workflow ready for n8n import alongside auto-dialer and post-call-handler workflows
- Supabase credentials need manual re-linking in n8n UI after import (same as auto-dialer)
- Workflow activates manually when production leads are ready for import

## Self-Check: PASSED

- FOUND: execution/n8n/lead-import.json
- FOUND: d197b22 (Task 1 commit)
- FOUND: 07-02-SUMMARY.md

---
*Phase: 07-post-call-workflows*
*Completed: 2026-03-25*
