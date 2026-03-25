# Phase 6: Auto-Dialer + Retry Logic - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Create an n8n workflow that autonomously polls the lead queue every 2 minutes, checks dial windows, picks the next lead, and initiates calls via the FastAPI backend. Add retry requeue logic to the call_ended webhook handler. Enforce DNC through the existing database + backend chain.

</domain>

<decisions>
## Implementation Decisions

### n8n Auto-Dialer Workflow (AUTO-01)
- Trigger: n8n Schedule Trigger, cron every 2 minutes (*/2 * * * *)
- Flow:
  1. **Check dial window:** Query dial_schedules via Supabase node WHERE is_active=true. Compare current time (Europe/London) against start_time/end_time and day_of_week. If outside window → stop silently.
  2. **Check active call:** Query leads via Supabase node WHERE status IN ('calling', 'in_call') LIMIT 1. If found → stop silently.
  3. **Pick next lead:** Call pick_next_lead() RPC via Supabase node. If empty → stop silently. RPC atomically sets status to 'calling'.
  4. **Initiate call:** POST /retell/initiate-call with body {lead_id: result.id}, Authorization: Bearer DASHBOARD_SECRET_KEY.
- Error handling on initiate-call:
  - 409 (active call) → revert lead to 'queued' via Supabase UPDATE
  - 429 (rate limited) → revert lead to 'queued' via Supabase UPDATE
  - 500 (server error) → set lead to 'failed' via Supabase UPDATE
  - Next cron cycle (2 min later) picks up reverted leads naturally
- n8n credentials: Supabase service key + DASHBOARD_SECRET_KEY for bearer auth

### Retry Requeue Logic (AUTO-05)
- Handled by call_ended webhook handler (Phase 5 main.py) — NOT a separate n8n workflow
- When call_ended fires with disconnect status (no_answer/voicemail/busy):
  1. Check lead.retry_count < lead.max_retries (default 2)
  2. If retries available: UPDATE leads SET retry_count = retry_count + 1, next_retry_at = NOW() + interval '60 minutes', status = 'queued'
  3. If retries exhausted: UPDATE leads SET status = 'declined'
- Fixed 60-minute backoff (no escalation between retries)
- pick_next_lead() RPC already filters: WHERE status='queued' AND (next_retry_at IS NULL OR next_retry_at <= NOW())
- **NOTE:** This requires updating Phase 5's call_ended handler in main.py to add the retry logic. Phase 6 plan should include this update.

### DNC Enforcement (AUTO-06)
- Backend only — n8n does NOT add its own DNC check
- Enforcement chain:
  1. pick_next_lead() RPC: WHERE status='queued' → excludes do_not_contact + declined (they never have status 'queued')
  2. POST /retell/initiate-call: if status in ('do_not_contact', 'declined') → 403
- Double enforcement at database + backend level. n8n trusts both.

### pick_next_lead() RPC Update
- Current RPC may need updating to filter by next_retry_at:
  - WHERE status = 'queued' AND (next_retry_at IS NULL OR next_retry_at <= NOW())
  - ORDER BY priority DESC, created_at ASC
  - This ensures leads in backoff period are not picked up too early

### Claude's Discretion
- n8n workflow JSON structure and node configuration
- n8n Supabase node configuration for RPC calls
- How to store n8n credentials securely (external secrets vs inline)
- Whether to update pick_next_lead() RPC for next_retry_at filtering or handle in the n8n query
- Exact error handling node chain in n8n (IF nodes, error outputs)

</decisions>

<specifics>
## Specific Ideas

- The n8n workflow should be exported as JSON in execution/n8n/auto-dialer.json for version control
- n8n uses external secrets from environment — credentials should reference env vars, not hardcoded values
- The 2-minute cron interval naturally enforces the 1 call/2 min rate limit without needing additional logic
- The retry requeue happening in call_ended (not a separate workflow) keeps the logic centralized and reduces n8n workflow complexity
- pick_next_lead() RPC is the single source of truth for queue ordering — priority first, then creation date, with retry backoff respected

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `execution/backend/dialer.py` — has should_dial_now(), get_next_lead(), is_call_active(), can_dial_next(), check_daily_limit(). These are Python implementations of the same checks n8n needs. Useful as reference but n8n will do them directly via Supabase.
- `execution/backend/main.py` — POST /retell/initiate-call with bearer auth + active-call guard + rate limiting. This is what n8n POSTs to.
- `execution/backend/schema/005_functions.sql` — pick_next_lead() RPC function. May need updating for next_retry_at filter.
- `execution/backend/seeds/005_dial_schedules.sql` — Default dial window (Europe/London, 10:00-19:00, 7 days)

### Established Patterns
- n8n workflows exported as JSON in execution/n8n/ directory
- Supabase queries via n8n Supabase node (already used in other Cloudboosta n8n workflows)
- Bearer token auth for API calls from n8n

### Integration Points
- n8n Schedule Trigger → Supabase dial_schedules → Supabase leads (RPC) → POST /retell/initiate-call
- call_ended handler (main.py) → retry requeue logic → leads table (status back to 'queued')
- pick_next_lead() RPC → respects next_retry_at to avoid picking up leads in backoff period

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 06-auto-dialer-retry-logic*
*Context gathered: 2026-03-25*
