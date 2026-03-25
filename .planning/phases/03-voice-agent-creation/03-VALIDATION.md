---
phase: 3
slug: voice-agent-creation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-25
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Python verification scripts + live API test call |
| **Config file** | None (Phase 3 is agent configuration) |
| **Quick run command** | `python execution/backend/scripts/verify_agent.py` |
| **Full suite command** | `python execution/backend/scripts/verify_agent.py && python execution/backend/scripts/verify_llm.py` |
| **Estimated runtime** | ~5 seconds (verification), ~30 seconds (test call) |

---

## Sampling Rate

- **After every task commit:** Quick verification of created/updated resources
- **After every plan wave:** Full agent + LLM verification
- **Before `/gsd:verify-work`:** Full suite + successful test call
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 03-01-01 | 01 | 1 | VOICE-03 | smoke | `python scripts/verify_agent.py --check-voice --check-backchannel` | No - W0 | pending |
| 03-01-02 | 01 | 1 | VOICE-03 | smoke | `python scripts/verify_agent.py --check-phone` | No - W0 | pending |
| 03-01-03 | 01 | 1 | VOICE-03 | integration | Test outbound call to operator's number | Manual | pending |

---

## Wave 0 Requirements

- [ ] `execution/backend/scripts/create_agent.py` — Agent creation script
- [ ] `execution/backend/scripts/verify_agent.py` — Agent verification script

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Voice sounds correct (cartesia-Willa) | VOICE-03 | Subjective audio quality | Listen to test call, confirm British female voice |
| Backchannel natural | VOICE-03 | Subjective quality | Speak during test call, listen for "yeah", "uh-huh" |
| Opening greeting correct | VOICE-03 | Dynamic time-based | Verify Sarah says appropriate time greeting |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
