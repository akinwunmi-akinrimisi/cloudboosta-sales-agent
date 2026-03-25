---
phase: 4
slug: tool-execution-backend
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-25
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest + manual curl tests |
| **Config file** | None (uses existing FastAPI app) |
| **Quick run command** | `cd execution/backend && python -c "from tools import TOOL_HANDLERS; print(len(TOOL_HANDLERS))"` |
| **Full suite command** | `cd execution/backend && python -m pytest test_tools.py -v` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Quick import check + handler signature validation
- **After every plan wave:** Full test suite against Supabase
- **Before `/gsd:verify-work`:** Full suite + manual curl test against running server
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | BACK-01 | unit | Test ToolCallPayload matches Retell format | No - W0 | pending |
| 04-02-01 | 02 | 1 | TOOL-01 | integration | lookup_programme returns correct pricing | No - W0 | pending |
| 04-02-02 | 02 | 1 | TOOL-02 | integration | get_objection_response returns multi-layer | No - W0 | pending |
| 04-03-01 | 03 | 2 | TOOL-03 | integration | log_call_outcome inserts + updates lead | No - W0 | pending |
| 04-03-02 | 03 | 2 | TOOL-04 | unit | All 3 tools return fallback on Supabase error | No - W0 | pending |
| 04-03-03 | 03 | 2 | TOOL-05 | smoke | speak_during_execution configured in tool defs | No - W0 | pending |

---

## Wave 0 Requirements

- [ ] `execution/backend/test_tools.py` — pytest suite covering all 6 requirements

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Tool response renders naturally in Sarah's speech | TOOL-01/02 | Subjective voice quality | Start server, trigger test call, verify Sarah speaks programme/objection data naturally |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity
- [ ] Wave 0 covers all MISSING references
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
