---
phase: 2
slug: retell-llm-configuration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-25
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual verification + Python scripts |
| **Config file** | None (Phase 2 is configuration, not application code) |
| **Quick run command** | `python execution/backend/scripts/count_tokens.py` |
| **Full suite command** | `python execution/backend/scripts/verify_llm.py` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** `python execution/backend/scripts/count_tokens.py` (verify prompt under 8K)
- **After every plan wave:** `python execution/backend/scripts/verify_llm.py` (full verification)
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 5 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | VOICE-01 | smoke | `python scripts/count_tokens.py` — verify under 8K | No - W0 | pending |
| 02-02-01 | 02 | 1 | VOICE-02 | smoke | `python scripts/verify_llm.py --check-tools` | No - W0 | pending |
| 02-02-02 | 02 | 1 | VOICE-05 | smoke | `python scripts/verify_llm.py --check-variables` | No - W0 | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `execution/backend/scripts/create_llm.py` — LLM creation script using retell-sdk 5.8.0
- [ ] `execution/backend/scripts/verify_llm.py` — Verification: fetches LLM, checks prompt length, tool count, variable defaults
- [ ] `execution/backend/scripts/count_tokens.py` — Token counting utility (tiktoken)
- [ ] `execution/backend/prompts/sarah_system_prompt.txt` — System prompt file

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| LLM created on Retell dashboard | VOICE-01 | Requires live Retell API key | Run create_llm.py, verify on Retell dashboard |
| Tool webhook URLs reachable | VOICE-02 | Requires deployed backend | Check tools point to WEBHOOK_BASE_URL/retell/tool |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 5s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
