---
phase: 04-tool-execution-backend
plan: 02
subsystem: api
tags: [supabase, pricing, objection-handling, tool-handlers, voice-agent]

# Dependency graph
requires:
  - phase: 04-tool-execution-backend/01
    provides: "Tool call router, ToolCallPayload model, execute_tool dispatcher, TOOL_FALLBACKS"
  - phase: 01-foundation
    provides: "Supabase schema (pricing, objection_responses tables), seed data"
provides:
  - "Implemented lookup_programme handler with Supabase pricing queries"
  - "Implemented get_objection_response handler with ADQ fallback"
  - "COUNTRY_CURRENCY_MAP, PROFILE_PATHWAY_MAP, PERSONA_TESTIMONIALS constants"
affects: [04-tool-execution-backend/03, 05-auto-dialer, 09-testing]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Hardcoded mapping tables for country->currency and profile->pathway (small, static data)"
    - "ADQ fallback pattern for unknown objection keys"
    - "Voice-ready JSON response structure with selling_points array"

key-files:
  created: []
  modified:
    - "execution/backend/tools.py"

key-decisions:
  - "Profile X maps to zero-to-cloud-devops (safe default) since cloud-computing is not a bundle in pricing table"
  - "DEFAULT_TESTIMONIAL (Ebunlomo) used since tool_definitions.py does not pass lead_persona to lookup_programme"
  - "ADQ (Acknowledge, Dig, Question) fallback for unknown objection keys per CONTEXT.md"

patterns-established:
  - "Voice-ready JSON: all tool returns are structured dicts ready for LLM consumption during live calls"
  - "Graceful fallback: unknown inputs get safe defaults (GBP currency, X profile, ADQ objection response)"

requirements-completed: [TOOL-01, TOOL-02]

# Metrics
duration: 3min
completed: 2026-03-25
---

# Phase 4 Plan 2: Tool Handlers Summary

**lookup_programme queries Supabase pricing by profile+country with currency mapping; get_objection_response returns multi-layer scripts with ADQ fallback for unknown keys**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-25T13:42:38Z
- **Completed:** 2026-03-25T13:45:49Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Implemented lookup_programme with country-to-currency mapping (19 countries across 4 currencies) and profile-to-pathway mapping (4 profiles to 2 bundle slugs)
- Implemented get_objection_response with Supabase query by exact objection_key and ADQ fallback for unknown keys
- Added 6 persona-matched testimonials with Ebunlomo as default (tool_definitions.py does not pass persona)

## Task Commits

Each task was committed atomically:

1. **Task 1: Implement lookup_programme handler** - `a4fb776` (feat)
2. **Task 2: Implement get_objection_response handler** - `fff9757` (feat)

**Plan metadata:** (pending) (docs: complete plan)

## Files Created/Modified
- `execution/backend/tools.py` - Added COUNTRY_CURRENCY_MAP, PROFILE_PATHWAY_MAP, PERSONA_TESTIMONIALS, DEFAULT_TESTIMONIAL, ADQ_FALLBACK constants; replaced lookup_programme and get_objection_response stubs with full Supabase-backed implementations

## Decisions Made
- Profile "X" (catch-all) maps to "zero-to-cloud-devops" bundle since "cloud-computing" is a pathway, not a bundle in the pricing table -- ensures pricing query always returns data
- Used DEFAULT_TESTIMONIAL (Ebunlomo) for all lookup_programme responses because tool_definitions.py does not include lead_persona as a parameter for this tool
- ADQ (Acknowledge, Dig, Question) fallback returns a generic probing question for any objection_key not found in Supabase, avoiding error messages during live calls

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- lookup_programme and get_objection_response are fully implemented and ready for live tool call routing
- log_call_outcome (Plan 04-03) is the remaining stub to implement
- All three tool handlers will be callable via execute_tool dispatcher once 04-03 completes

## Self-Check: PASSED

- [x] execution/backend/tools.py - FOUND
- [x] 04-02-SUMMARY.md - FOUND
- [x] Commit a4fb776 - FOUND
- [x] Commit fff9757 - FOUND

---
*Phase: 04-tool-execution-backend*
*Completed: 2026-03-25*
