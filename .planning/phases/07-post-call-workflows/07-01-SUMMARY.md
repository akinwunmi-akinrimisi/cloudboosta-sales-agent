---
phase: 07-post-call-workflows
plan: 01
subsystem: api, automation
tags: [n8n, mailersend, fastapi, background-tasks, email, webhook]

# Dependency graph
requires:
  - phase: 05-webhook-backend
    provides: call_ended handler in main.py with disconnect reason routing
  - phase: 04-tool-backend
    provides: COUNTRY_CURRENCY_MAP, DEFAULT_CURRENCY, log_call_outcome tool writing outcomes to call_logs
provides:
  - n8n post-call-handler workflow routing COMMITTED/FOLLOW_UP/DECLINED to email actions
  - BackgroundTasks trigger from call_ended to n8n webhook
  - Currency-specific payment email with Revolut/GTBank bank details
  - Lead status transition from committed to payment_sent after email sent
affects: [09-testing, 08-dashboard]

# Tech tracking
tech-stack:
  added: [mailersend-api-v1, n8n-switch-node-v3]
  patterns: [fire-and-forget-background-tasks, n8n-3-way-switch-routing, mailersend-http-request]

key-files:
  created: [execution/n8n/post-call-handler.json]
  modified: [execution/backend/main.py, .env.example, execution/backend/requirements.txt]

key-decisions:
  - "MailerSend HTTP Request nodes (not n8n MailerLite built-in) for transactional email -- MailerLite node only manages subscribers"
  - "MAILERLITE_API_KEY env var name preserved per CONTEXT.md despite holding a MailerSend token"
  - "Post-call trigger only fires for connected calls with tool outcomes (not no_answer/voicemail retries)"
  - "resend==2.5.1 removed from requirements.txt -- all email sending moved to n8n/MailerSend"
  - "Workflow imported inactive (active: false) -- activation deferred to Phase 9"

patterns-established:
  - "BackgroundTasks fire-and-forget: add async HTTP POST as background task after DB operations, before returning 200"
  - "n8n Switch node for 3+ outcome routing: single node replaces chained IF nodes"
  - "n8n Code node for complex HTML templating: currency-branching logic in JavaScript"

requirements-completed: [AUTO-02, AUTO-04]

# Metrics
duration: 6min
completed: 2026-03-25
---

# Phase 7 Plan 1: Post-Call Handler Summary

**n8n 3-way outcome routing workflow with MailerSend payment/reminder/close emails, triggered non-blocking from call_ended via BackgroundTasks**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-25T18:04:07Z
- **Completed:** 2026-03-25T18:10:37Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Extended call_ended webhook handler with non-blocking BackgroundTasks trigger to n8n post-call workflow
- Created 11-node n8n post-call-handler.json with Switch node routing COMMITTED/FOLLOW_UP/DECLINED to correct email branches
- Payment email Code node generates currency-specific bank details (GBP/EUR/USD/NGN with Revolut and GTBank)
- Supabase node updates lead status from committed to payment_sent after payment email sent
- All 3 email branches gate on lead having an email address (IF node + No-Op Skip for missing email)
- Replaced Resend with MailerSend throughout (requirements.txt, .env.example)

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend call_ended with BackgroundTasks n8n trigger and update env config** - `6e444f9` (feat)
2. **Task 2: Create n8n post-call-handler workflow JSON** - `d5e9cce` (feat)

## Files Created/Modified
- `execution/backend/main.py` - Added BackgroundTasks injection, trigger_post_call_workflow helper, OUTCOMES_REQUIRING_WORKFLOW constant, N8N_WEBHOOK_BASE env var, startup warning, post-call trigger logic in call_ended
- `execution/n8n/post-call-handler.json` - Complete 11-node n8n workflow: Webhook Trigger, Switch (3-way), 3 IF email checks, Code (payment HTML), 3 HTTP Request (MailerSend), Supabase update, No-Op Skip
- `.env.example` - Replaced RESEND_API_KEY with MAILERLITE_API_KEY, added N8N_WEBHOOK_BASE
- `execution/backend/requirements.txt` - Removed resend==2.5.1

## Decisions Made
- Used MailerSend HTTP Request nodes instead of n8n MailerLite built-in node (MailerLite only manages subscribers, cannot send transactional emails)
- Preserved MAILERLITE_API_KEY env var name per CONTEXT.md locked decision (despite it holding a MailerSend token)
- Post-call workflow only fires for connected calls where Sarah had a conversation (not no_answer/voicemail/busy -- those use retry logic)
- Removed resend from requirements.txt entirely since all email sending is handled by n8n/MailerSend HTTP calls
- Single No-Op Skip node shared by all 3 branches' false paths (no email to send)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
- Set `N8N_WEBHOOK_BASE` in `.env` (e.g., `https://your-n8n.com/webhook`)
- Set `MAILERLITE_API_KEY` in `.env` with a MailerSend API token (generate at https://app.mailersend.com/api-tokens)
- Import `post-call-handler.json` into n8n and re-link Supabase credentials (placeholder SUPABASE_CRED_ID used)
- Verify MailerSend domain (cloudboosta.co.uk) is verified for email delivery

## Next Phase Readiness
- Post-call handler workflow ready for import and testing
- Phase 7 Plan 2 (CSV lead import) can proceed independently
- Phase 9 (Wave 0) will activate this workflow and test all 3 email paths with real calls

## Self-Check: PASSED

All files exist. All commits verified.

---
*Phase: 07-post-call-workflows*
*Completed: 2026-03-25*
