---
phase: 03-voice-agent-creation
plan: 01
subsystem: voice-agent
tags: [retell, voice-agent, system-prompt, cartesia, backchannel, voicemail]

# Dependency graph
requires:
  - phase: 02-retell-llm-configuration
    provides: "Retell LLM with system prompt, 3 tools, dynamic variables (RETELL_LLM_ID)"
provides:
  - "Updated system prompt with conditional name exchange flow and {{current_hour_Europe/London}}"
  - "create_agent.py script with all locked voice agent parameters"
  - "verify_agent.py with 5 granular --check-* flags"
  - "update_llm.py --null-begin-message flag for dynamic greeting generation"
  - "verify_llm.py forward-compatible begin_message=null acceptance"
affects: [03-02-PLAN (executes these scripts), 04-webhook-backend, 05-auto-dialer]

# Tech tracking
tech-stack:
  added: []
  patterns: ["Conditional name exchange in system prompt", "begin_message=null for dynamic LLM-generated greeting"]

key-files:
  created:
    - execution/backend/scripts/create_agent.py
    - execution/backend/scripts/verify_agent.py
  modified:
    - execution/backend/prompts/sarah_system_prompt.txt
    - execution/backend/scripts/update_llm.py
    - execution/backend/scripts/verify_llm.py

key-decisions:
  - "begin_message=null lets LLM dynamically generate time-aware greeting from system prompt using {{current_hour_Europe/London}}"
  - "Name exchange flow is conditional: use {{lead_name}} if available, ask for name if 'there' or unavailable"
  - "Voice Rules reference 'lead's confirmed name' instead of {{lead_name}} variable for flexibility"

patterns-established:
  - "Agent creation script pattern: env loading, SDK client init, agent.create() with full config, agent_id output"
  - "Agent verification pattern: granular --check-* flags matching verify_llm.py convention"
  - "Forward-compatible LLM checks: accept both old (Phase 2) and new (Phase 3+) begin_message states"

requirements-completed: [VOICE-03]

# Metrics
duration: 4min
completed: 2026-03-25
---

# Phase 3 Plan 01: Voice Agent Scripts Summary

**System prompt updated with conditional name exchange flow and timezone fix; agent creation/verification scripts ready with cartesia-Willa voice, backchannel 0.8, voicemail static_text, call-center ambient**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-25T10:36:28Z
- **Completed:** 2026-03-25T10:41:09Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- System prompt updated with conditional name exchange flow (ask if unknown, confirm if known) and {{current_hour_Europe/London}} timezone fix
- create_agent.py ready to execute with all locked parameters (voice, backchannel, voicemail, ambient, webhook)
- verify_agent.py with 5 granular checks (voice, backchannel, voicemail, phone binding, ambient sound)
- update_llm.py extended with --null-begin-message flag for Phase 3 LLM update
- verify_llm.py made forward-compatible (accepts begin_message=null as PASS)

## Task Commits

Each task was committed atomically:

1. **Task 1: Update system prompt with name exchange flow and timezone fix** - `a8c0727` (feat)
2. **Task 2: Create agent creation script, verification script, and update LLM scripts** - `d037b08` (feat)

## Files Created/Modified
- `execution/backend/prompts/sarah_system_prompt.txt` - Updated Opening Flow with conditional name exchange, fixed {{current_hour_Europe/London}}, updated Voice Rules
- `execution/backend/scripts/create_agent.py` - One-time agent creation script with all Retell parameters (121 lines)
- `execution/backend/scripts/verify_agent.py` - Agent verification with --check-voice/backchannel/voicemail/phone/ambient flags (279 lines)
- `execution/backend/scripts/update_llm.py` - Added --null-begin-message flag (4 lines added)
- `execution/backend/scripts/verify_llm.py` - Updated check_model_and_begin() to accept None as valid

## Decisions Made
- begin_message=null approach chosen over custom dynamic variable -- LLM generates greeting dynamically from system prompt's hour-based logic
- Name exchange flow made conditional on {{lead_name}} value -- avoids Pitfall 6 (asking for a name already available)
- Voice Rules updated to reference "lead's confirmed name" instead of {{lead_name}} variable, since name may come from exchange rather than database
- Token count after changes: 2,497/8,000 (31.2%) -- net increase of ~168 tokens from name exchange flow

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required. Scripts are ready to execute in Plan 02.

## Next Phase Readiness
- All scripts ready for Plan 03-02 execution (create agent, update LLM, assign phone, verify, test call)
- System prompt tested at 2,497 tokens (31.2% of 8K limit) -- ample headroom
- Plan 03-02 will execute: update_llm.py --null-begin-message, create_agent.py, migrate_phone_number.py, verify_agent.py, test call

---
*Phase: 03-voice-agent-creation*
*Completed: 2026-03-25*
