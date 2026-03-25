---
phase: 1
slug: foundation-sdk-migration
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-25
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual SQL verification + Python smoke tests |
| **Config file** | None -- Phase 1 is primarily SQL schema + API calls |
| **Quick run command** | `python -c "from supabase_client import supabase; print(supabase.table('leads').select('count', count='exact').execute())"` |
| **Full suite command** | `python execution/backend/test_phase1.py` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run quick SQL verification after each schema change
- **After every plan wave:** Full schema + RPC + RLS verification
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | DATA-01 | smoke | `SELECT * FROM leads LIMIT 1` | No - W0 | pending |
| 01-01-02 | 01 | 1 | DATA-02 | smoke | `SELECT * FROM call_logs LIMIT 1` | No - W0 | pending |
| 01-01-03 | 01 | 1 | DATA-03 | integration | Update lead status, verify pipeline_logs row | No - W0 | pending |
| 01-01-04 | 01 | 1 | DATA-04 | smoke | `SELECT * FROM dial_schedules` | No - W0 | pending |
| 01-01-05 | 01 | 1 | DATA-07 | integration | Test anon key: SELECT ok, INSERT fails | No - W0 | pending |
| 01-02-01 | 02 | 1 | DATA-05 | smoke | `SELECT * FROM pipeline_snapshot` | No - W0 | pending |
| 01-02-02 | 02 | 1 | DATA-06 | integration | Call pick_next_lead(), verify status='calling' | No - W0 | pending |
| 01-03-01 | 03 | 1 | VOICE-04 | smoke | `client.phone_number.get("+17404943597")` | No - W0 | pending |

*Status: pending / green / red / flaky*

---

## Wave 0 Requirements

- [ ] `execution/backend/test_phase1.py` -- smoke test script covering DATA-01 through DATA-07 + VOICE-04
- [ ] `execution/backend/seeds/` directory -- SQL seed files for reference data
- [ ] `execution/backend/schema/` directory -- SQL migration files

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Phone number weighted agents on Retell dashboard | VOICE-04 | Requires Retell API key + live account | Run SDK script, verify on Retell dashboard |
| RLS policies enforce correct access | DATA-07 | Requires both service key and anon key testing | Test queries with each key type |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
