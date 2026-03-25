# Phase 5: Webhook Backend + Security - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement call lifecycle webhook handlers (call_started, call_ended, call_analyzed), enhance call initiation with active-call check, wire rate limiting on all endpoints, restrict CORS to dashboard origin, and add bearer token auth to dashboard and initiate-call endpoints.

</domain>

<decisions>
## Implementation Decisions

### Webhook Event Handling (BACK-02)

**call_started:**
- Extract lead_id from call.metadata
- UPDATE leads SET status='in_call', last_call_at=NOW(), last_call_id=call.call_id
- DB trigger validates calling → in_call and auto-logs pipeline_logs
- Idempotent: skip if lead already 'in_call'

**call_ended:**
- UPSERT call_logs by retell_call_id:
  - If exists (tool created it): UPDATE with duration, recording_url, transcript, ended_at, from_number, to_number
  - If missing (call dropped before tool fired): INSERT with available data
- Disconnect reason → lead status mapping (if lead still in 'calling', never connected):
  - 'no_answer' → 'no_answer'
  - 'voicemail_reached' / 'machine_detected' → 'voicemail'
  - 'busy' → 'busy'
  - 'error' / 'unknown' → 'failed'
- If lead was 'in_call' but no tool outcome logged → 'declined' (fallback — assume hung up)
- Recording URL: save URL only in call_logs (don't download, defer persistence to v2 COMPL-02)
- Idempotent: UPSERT on retell_call_id

**call_analyzed:**
- UPDATE call_logs with Retell's analysis data: call_summary, sentiment, custom_analysis_data
- Useful for continuous improvement loop (strategy effectiveness tracking)
- Idempotent: UPDATE only on existing retell_call_id

**Dedup strategy:** Idempotent on retell_call_id — safe to process multiple times. No separate event tracking table.

### Call Initiation Enhancement (BACK-03)
- Active call check: query leads table for status IN ('calling', 'in_call'), reject with 409 if found (reuse dialer.py is_call_active() pattern)
- Already has: DNC check, blocked prefix check, daily limit check (from Phase 0 scaffolding)
- Auth: Bearer token (DASHBOARD_SECRET_KEY), NOT Retell signature (called by n8n/dashboard, not Retell)

### Auth Map
- POST /retell/tool → Retell.verify() (already done in Phase 4)
- POST /retell/webhook → Retell.verify()
- POST /retell/initiate-call → Bearer token (DASHBOARD_SECRET_KEY)
- GET /api/dashboard/* → Bearer token (DASHBOARD_SECRET_KEY)
- GET /health → No auth (health check)
- Two auth mechanisms: Retell SDK verify (webhooks from Retell) + Bearer token (everything else)
- FastAPI Depends() for bearer token verification

### Rate Limiting (BACK-07)
- ALL endpoints rate-limited via slowapi:
  - POST /retell/initiate-call: 1 per 120 seconds (global) + 200 per day (global)
  - POST /retell/tool: 100 per minute (from Retell, safety net)
  - POST /retell/webhook: 100 per minute (from Retell, safety net)
  - GET /api/dashboard/*: 60 per minute (single operator, prevent accidental flood)
- slowapi with in-memory store (sufficient for single-server)
- Returns 429 Too Many Requests if exceeded

### CORS (BACK-06)
- DASHBOARD_ORIGIN env var, defaults to 'http://localhost:5173' (Vite dev)
- allow_origins: [DASHBOARD_ORIGIN, 'http://localhost:3000', 'http://localhost:5173']
- Production: set DASHBOARD_ORIGIN in .env to deployed dashboard URL
- allow_methods: GET, POST
- allow_headers: Authorization, Content-Type

### Claude's Discretion
- Exact Retell webhook payload fields for call_ended and call_analyzed (from research)
- slowapi decorator patterns and key functions
- FastAPI Depends() implementation for bearer token
- How to extract disconnect_reason from Retell's call_ended payload
- Error response format for 401/409/429

</decisions>

<specifics>
## Specific Ideas

- The webhook handler must be fast (return 200 quickly) — Retell retries on timeout. Do Supabase operations synchronously but keep them minimal (single UPDATE/UPSERT per event).
- The active-call check prevents the auto-dialer (Phase 6) from starting a new call while one is in progress. This is a critical safety guard.
- Bearer token auth is simple but effective for a single-operator system. DASHBOARD_SECRET_KEY is already in .env.example from Phase 0.
- The disconnect_reason mapping is important for retry logic in Phase 6 — different disconnect reasons get different retry behavior.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `execution/backend/main.py` — webhook endpoint exists with TODO stubs. Tool endpoint already has Retell.verify(). CORS middleware already configured (needs origin restriction). Security headers middleware present.
- `execution/backend/dialer.py` — `is_call_active()`, `check_daily_limit()`, `can_dial_next()` already implement some safety checks. Reuse patterns.
- `execution/backend/tools.py` — `execute_tool()` shows the pattern for extracting lead_id from call metadata.
- slowapi already in requirements.txt (0.1.9)

### Established Patterns
- Retell signature verification: `Retell.verify(body_str, api_key, signature)` with `json.dumps(separators=(",",":"))`
- Supabase queries: `supabase.table("x").update({...}).eq("id", val).execute()`
- Tool call payload extraction: `payload.call_id`, `payload.lead_id` from nested call object

### Integration Points
- Webhook receives call data with metadata.lead_id → used to update leads table
- call_ended provides recording_url, transcript, duration → stored in call_logs
- initiate-call is called by n8n auto-dialer (Phase 6) and potentially dashboard (Phase 8)
- Rate limiting on initiate-call prevents toll fraud (runaway dialer)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 05-webhook-backend-security*
*Context gathered: 2026-03-25*
