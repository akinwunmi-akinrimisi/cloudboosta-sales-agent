---
phase: 8
slug: dashboard
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-25
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vite dev server + Python import checks |
| **Config file** | execution/dashboard/vite.config.js |
| **Quick run command** | `cd execution/dashboard && npm run build 2>&1 | tail -5` |
| **Full suite command** | Quick run + backend API import check |
| **Estimated runtime** | ~15 seconds (Vite build) |

---

## Sampling Rate

- **After every task commit:** Component file exists + imports valid
- **After every plan wave:** `npm run build` succeeds (no TypeScript/JSX errors)
- **Before `/gsd:verify-work`:** Full build + manual visual check in browser
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-------------------|--------|
| 08-01 | 01 | 1 | BACK-04 | unit | Python import check for dashboard endpoints | pending |
| 08-02 | 02 | 2 | DASH-06,05 | build | `npm run build` succeeds | pending |
| 08-03 | 03 | 3 | DASH-01 | build | Build + component import check | pending |
| 08-04 | 04 | 3 | DASH-02,03 | build | Build + component import check | pending |
| 08-05 | 05 | 4 | DASH-04 | build | Build + Recharts import check | pending |

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live View shows active call with timer | DASH-01 | Visual + polling | Start dev server, check Live View tab |
| Pipeline kanban columns render correctly | DASH-02 | Visual layout | Check Pipeline tab, verify 6 columns |
| Lead click opens side panel with transcript | DASH-03 | Interaction | Click lead card, verify panel content |
| Strategy bar chart renders | DASH-04 | Visual | Check Analytics tab with/without data |
| Auth rejects bad token | DASH-05 | Interaction | Try invalid token, verify redirect |

---

## Validation Sign-Off

- [ ] All tasks have automated verify
- [ ] Sampling continuity
- [ ] `npm run build` passes
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
