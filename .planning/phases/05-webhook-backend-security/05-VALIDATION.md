---
phase: 5
slug: webhook-backend-security
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-25
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Python import checks + curl tests |
| **Config file** | None |
| **Quick run command** | `python -c "from main import app; print(len(app.routes))"` |
| **Full suite command** | `cd execution/backend && python -c "from main import app, verify_dashboard_token, retell_webhook; print('All imports OK')"` |
| **Estimated runtime** | ~3 seconds |

---

## Sampling Rate

- **After every task commit:** Import check + route count
- **After every plan wave:** Full import + curl test against running server
- **Before `/gsd:verify-work`:** All endpoints tested with valid/invalid auth
- **Max feedback latency:** 3 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 05-01-01 | 01 | 1 | BACK-02 | unit | Verify webhook handlers importable + have Supabase calls | No - W0 | pending |
| 05-01-02 | 01 | 1 | BACK-03 | unit | Verify initiate_call has active-call check | No - W0 | pending |
| 05-02-01 | 02 | 1 | BACK-05,06,07 | unit | Verify auth deps + rate limiter + CORS config | No - W0 | pending |

---

## Wave 0 Requirements

- [ ] Automated import/assertion checks inline in plan verify blocks

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Rate limiter returns 429 | BACK-07 | Needs running server | Start server, hit initiate-call twice within 2 min |
| CORS rejects wrong origin | BACK-06 | Needs browser/curl | curl with wrong Origin header, verify blocked |

---

## Validation Sign-Off

- [ ] All tasks have automated verify or Wave 0 dependencies
- [ ] Sampling continuity
- [ ] Feedback latency < 3s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
