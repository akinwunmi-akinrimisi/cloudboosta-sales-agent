---
phase: 6
slug: auto-dialer-retry-logic
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-25
---

# Phase 6 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | n8n workflow validation + Python schema checks |
| **Config file** | execution/n8n/auto-dialer.json |
| **Quick run command** | `python -c "import json; w=json.load(open('execution/n8n/auto-dialer.json')); print(f'{len(w[\"nodes\"])} nodes')"` |
| **Full suite command** | `python execution/backend/test_phase1.py` (schema checks) |
| **Estimated runtime** | ~3 seconds |

---

## Sampling Rate

- **After every task commit:** JSON validity + node count check
- **After every plan wave:** Schema migration verified + workflow structure validated
- **Before `/gsd:verify-work`:** Full workflow import test on n8n instance
- **Max feedback latency:** 3 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 06-01-01 | 01 | 1 | AUTO-05 | smoke | Verify next_retry_at column + state transitions | No - W0 | pending |
| 06-02-01 | 02 | 2 | AUTO-01 | smoke | Verify workflow JSON has correct nodes | No - W0 | pending |
| 06-02-02 | 02 | 2 | AUTO-06 | smoke | Verify DNC not in workflow (backend handles) | No - W0 | pending |

---

## Wave 0 Requirements

- [ ] Workflow JSON valid and importable to n8n

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Workflow runs on schedule in n8n | AUTO-01 | Requires live n8n instance | Import workflow, activate, verify cron fires |
| Retry requeue after 60min | AUTO-05 | Requires real call + wait | Trigger test call, verify lead requeued after backoff |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity
- [ ] Feedback latency < 3s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
