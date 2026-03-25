---
phase: 7
slug: post-call-workflows
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-25
---

# Phase 7 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | n8n workflow JSON validation + Python import checks |
| **Config file** | execution/n8n/post-call-handler.json, execution/n8n/lead-import.json |
| **Quick run command** | `python -c "import json; [json.load(open(f'execution/n8n/{f}')) for f in ['post-call-handler.json','lead-import.json']]; print('OK')"` |
| **Full suite command** | Quick run + main.py import check |
| **Estimated runtime** | ~3 seconds |

---

## Sampling Rate

- **After every task commit:** JSON validity + node count
- **After every plan wave:** Workflow structure + main.py handler check
- **Before `/gsd:verify-work`:** Import workflows to n8n + send test email
- **Max feedback latency:** 3 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 1 | AUTO-02 | smoke | Verify post-call JSON has Switch + MailerSend nodes | No - W0 | pending |
| 07-01-02 | 01 | 1 | AUTO-04 | smoke | Verify main.py has BackgroundTasks + n8n POST | No - W0 | pending |
| 07-02-01 | 02 | 2 | AUTO-03 | smoke | Verify lead-import JSON has webhook + CSV + dedup | No - W0 | pending |

---

## Wave 0 Requirements

- [ ] Workflow JSONs valid and importable

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Payment email arrives with correct bank details | AUTO-04 | Requires MailerSend delivery | Trigger COMMITTED outcome, check inbox |
| CSV import deduplicates by phone | AUTO-03 | Requires live Supabase | Upload CSV with duplicate phone, verify skip |

---

## Validation Sign-Off

- [ ] All tasks have automated verify
- [ ] Sampling continuity
- [ ] Feedback latency < 3s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
