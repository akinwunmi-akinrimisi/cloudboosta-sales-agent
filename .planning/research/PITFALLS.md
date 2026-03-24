# Domain Pitfalls

**Domain:** AI voice cold-calling sales agent (Retell AI + Supabase + n8n)
**Project:** Sarah -- Cloudboosta Sales Agent
**Researched:** 2026-03-24

## Critical Pitfalls

Mistakes that cause rewrites, service outages, or financial loss.

### Pitfall 1: Retell Phone Number API Deprecation (March 31, 2026)

**What goes wrong:** The `inbound_agent_id` and `outbound_agent_id` fields on phone numbers are deprecated as of March 31, 2026. Code using these fields will stop working.
**Why it happens:** Retell migrated to weighted agent lists (`inbound_agents`, `outbound_agents`) to support A/B testing and multi-agent routing. The old single-agent fields are being removed.
**Consequences:** Phone number configuration fails. Agent cannot be assigned to the number. No calls can be initiated or received.
**Prevention:** Use the new weighted agent format from day one:
```python
client.phone_number.update(
    phone_number_id=number_id,
    outbound_agents=[{"agent_id": agent_id, "weight": 100}],
    inbound_agents=[{"agent_id": agent_id, "weight": 100}],
)
```
**Detection:** Calls fail to initiate. Retell API returns 422 or ignores the deprecated fields silently.
**Deadline:** 7 days from research date (March 31, 2026).

### Pitfall 2: retell-sdk Major Version Mismatch

**What goes wrong:** The `requirements.txt` pins `retell-sdk==4.12.0` but the current stable is `5.8.0`. The 4.x SDK may not support new API fields (weighted agents, new webhook events, new model options).
**Why it happens:** Dependencies were pinned during initial project planning and never updated.
**Consequences:** Runtime errors when calling new API methods. Missing type definitions. Incompatible request/response schemas.
**Prevention:** Upgrade to `retell-sdk>=5.8.0,<6.0.0` in requirements.txt. Test all SDK calls (create LLM, create agent, create phone call, update phone number) after upgrade.
**Detection:** ImportError or TypeError on SDK method calls. Missing attributes on response objects.

### Pitfall 3: Tool Execution Timeout (10 Seconds)

**What goes wrong:** Retell webhooks for tool calls have a 10-second timeout. If the tool handler does not respond within 10s, Retell retries (up to 3 times) or gives up. Sarah goes silent or repeats herself.
**Why it happens:** Tool handlers make slow external API calls, database queries time out, or error handling adds latency.
**Consequences:** Sarah says "Let me look that up" and then goes silent. Lead experience degrades. Tool call results are lost.
**Prevention:**
- All tool data must be pre-loaded into Supabase (no external API calls during tool execution)
- Supabase queries should complete in <500ms (add proper indexes)
- Implement hardcoded fallback responses for every tool (if DB fails, return a reasonable default)
- Set connection timeouts on Supabase client: `timeout=5`
**Detection:** Monitor `pipeline_logs` for tool execution times. Alert if any tool takes >5s.

### Pitfall 4: Toll Fraud via Runaway Auto-Dialer

**What goes wrong:** A bug in the auto-dialer logic causes it to initiate calls without checking rate limits, dial windows, or daily caps. Hundreds of calls are placed in minutes.
**Why it happens:** n8n cron job fires but the "check if call is active" logic fails (Supabase down, query returns empty). The dialer assumes no active call and keeps calling.
**Consequences:** Retell billing spike. Twilio charges. Phone number flagged as spam. Leads harassed.
**Prevention:**
- Enforce `MAX_DAILY_CALLS = 200` as a hard cap in the backend, not just n8n
- Backend `/retell/initiate-call` endpoint must independently verify: daily count < limit, no active call, lead is in valid status
- n8n error trigger node catches failures and stops the workflow
- Set Retell spending limit in dashboard
**Detection:** Dashboard daily call counter exceeds expected range. Retell billing alerts (if configured).

### Pitfall 5: Webhook Signature Bypass

**What goes wrong:** Webhook endpoints accept requests without verifying the `x-retell-signature` HMAC header. An attacker sends forged webhook payloads.
**Why it happens:** Developer skips signature verification during development and forgets to enable it for production.
**Consequences:** Unauthorized data manipulation. Fake call outcomes injected into database. Lead statuses corrupted.
**Prevention:** Signature verification is mandatory on all webhook endpoints. Use a FastAPI dependency that runs before every handler:
```python
@app.post("/retell/webhook", dependencies=[Depends(verify_retell_signature)])
```
**Detection:** Monitor `pipeline_logs` for `webhook_rejected` events. Alert on any 401 responses from webhook endpoints.

## Moderate Pitfalls

### Pitfall 6: System Prompt Exceeds 8K Token Limit

**What goes wrong:** The system prompt grows too large with all 6 closing strategies, 11 objection responses, 4 programme pathways, pricing tables, and conversation flow instructions. Retell's GPT-4o-mini has 128K context but prompts over 8K tokens degrade latency and response quality.
**Prevention:** Retell best practices say "keep prompts concise." Move programme details and objection responses into tools (lookup_programme, get_objection_response) rather than embedding them in the system prompt. The prompt should contain the conversation flow, qualification gates, and strategy selection logic. Data lives in the database.

### Pitfall 7: Race Condition in Lead Queue

**What goes wrong:** n8n picks a lead from the queue, but before it can update the status to 'calling', another n8n execution (or a manual API call) picks the same lead. The lead gets called twice simultaneously.
**Prevention:** Use an atomic update in Supabase. Instead of SELECT then UPDATE, use a single RPC call:
```sql
CREATE FUNCTION pick_next_lead() RETURNS leads AS $$
  UPDATE leads SET status = 'calling', updated_at = NOW()
  WHERE id = (
    SELECT id FROM leads WHERE status = 'queued'
    ORDER BY priority DESC, created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
$$ LANGUAGE sql;
```
This locks the row during selection, preventing duplicate picks.

### Pitfall 8: Recording URLs Expire

**What goes wrong:** Retell recording URLs are time-limited (signed URLs that expire in ~24 hours). The dashboard tries to play a recording from 3 days ago and gets a 403 error.
**Prevention:** Download and store recordings in a persistent location (Supabase Storage or S3) within the post-call handler workflow. Store the persistent URL in `call_logs.recording_url`. Alternatively, accept the limitation and display "Recording expired" for old calls.

### Pitfall 9: n8n Workflow Secrets in Git

**What goes wrong:** n8n workflow JSON exports contain hardcoded credentials in node configurations. These files are committed to the `n8n/` directory.
**Prevention:** Use n8n's external secrets management (supports 1Password, HashiCorp Vault, AWS SM, Azure KV). Reference secrets as `{{ $env.SUPABASE_SERVICE_KEY }}` in workflows. Before committing workflow JSONs, scrub any credential values. Add a pre-commit check for secret patterns in JSON files.

### Pitfall 10: Supabase Service Key in Dashboard Frontend

**What goes wrong:** The React dashboard imports the SUPABASE_SERVICE_KEY instead of SUPABASE_ANON_KEY. The service key bypasses all RLS. Anyone inspecting the browser console can read/write all data.
**Prevention:** Dashboard uses only `SUPABASE_ANON_KEY` via environment variable (VITE_SUPABASE_ANON_KEY). Backend uses `SUPABASE_SERVICE_KEY`. Never import service key in any file under `dashboard/src/`.
**Detection:** Search codebase for `SERVICE_KEY` in any `.jsx`, `.tsx`, or `.js` file under `dashboard/`.

### Pitfall 11: FastAPI Strict Content-Type Breaking Retell Webhooks

**What goes wrong:** FastAPI 0.135.x+ introduces strict Content-Type checking by default. If Retell sends webhook payloads without a proper `application/json` Content-Type header, requests are rejected with 422 errors.
**Prevention:** Pin FastAPI to `0.115.x`. If using newer versions, disable strict checking: `@app.post("/retell/webhook", strict_content_type=False)`.

## Minor Pitfalls

### Pitfall 12: Phone Number Format Inconsistency

**What goes wrong:** Leads imported via CSV have phone numbers in various formats (+44 7592 233052, 07592233052, 44-7592-233052). Retell requires strict E.164 format (+447592233052).
**Prevention:** Validate and normalize all phone numbers to E.164 on import. Reject invalid numbers. The validation regex: `^\+[1-9]\d{6,14}$`.

### Pitfall 13: Timezone Mismatch in Dial Schedules

**What goes wrong:** The dial schedule uses `Africa/Lagos` timezone but the leads are in UK/US/EU timezones. Calls are placed at inappropriate times for the lead's location.
**Prevention:** For Wave 0/1, call all leads within the configured timezone window. For Wave 2+, add a `timezone` field to leads and check the lead's local time before calling.

### Pitfall 14: Duplicate Webhook Processing

**What goes wrong:** Retell retries a webhook (network hiccup, slow response). The post-call handler runs twice, sending duplicate payment emails or double-logging call outcomes.
**Prevention:** Use `retell_call_id` as a deduplication key. Before processing, check if `call_logs` already has an entry for this `retell_call_id`. If yes, return 200 OK without reprocessing.

### Pitfall 15: Missing `log_call_outcome` Tool Call

**What goes wrong:** Sarah hangs up or the lead hangs up before Sarah can call the `log_call_outcome` tool. The call has no structured outcome data.
**Prevention:** The `call_ended` webhook is the authoritative source for call data, not the tool call. Always process `call_ended` webhooks. Use `call_analysis` from the webhook payload (Retell auto-generates a summary and sentiment). The `log_call_outcome` tool provides richer data (strategy, persona) but the webhook provides the baseline.

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Foundation (Phase 1) | retell-sdk 4.x -> 5.x breaking changes | Test all SDK calls after upgrade. Check PyPI changelog. |
| Foundation (Phase 1) | Phone number weighted agent migration | Use new `outbound_agents` format. Deadline: March 31. |
| Retell LLM (Phase 2) | System prompt too long (>8K tokens) | Move data into tools. Keep prompt focused on flow + strategy. |
| Retell LLM (Phase 2) | Tool webhook URL hardcoded or wrong | Use WEBHOOK_BASE_URL env var. Test with ngrok/tunnel in dev. |
| Voice Agent (Phase 3) | Voice selection -- wrong accent/gender | List voices, filter for en-GB female. Test with a real call. |
| Webhook Backend (Phase 4) | Tool timeout (>10s) | Pre-load data in Supabase. Hardcoded fallbacks. |
| Webhook Backend (Phase 4) | Missing signature verification | Add as FastAPI dependency on all webhook routes. |
| Webhook Backend (Phase 4) | CORS blocking dashboard requests | Configure explicit origins, not wildcard "*". |
| Auto-Dialer (Phase 5) | Race condition on lead queue | Use FOR UPDATE SKIP LOCKED in Supabase RPC. |
| Auto-Dialer (Phase 5) | Runaway dialer (no active call check fails) | Backend enforces daily limit independently. |
| Post-Call (Phase 5) | Duplicate webhook processing | Dedup on retell_call_id. |
| Post-Call (Phase 5) | Payment email sent for non-committed outcomes | Strict outcome check before email trigger. |
| Dashboard (Phase 6) | Service key exposed to frontend | Use VITE_SUPABASE_ANON_KEY only. |
| Dashboard (Phase 6) | Recording URLs expired | Download recordings in post-call handler or display expiry notice. |
| Testing (Phase 7) | Test calls to real numbers without consent | Use only willing participants for Wave 0. |

## Sources

- [Retell AI Changelog](https://www.retellai.com/changelog) -- API deprecation notices, feature changes
- [Retell AI Custom LLM Best Practices](https://docs.retellai.com/integrate-llm/llm-best-practice) -- Prompt length, tool execution guidance
- [Retell AI Community: Phone Number Deprecation](https://community.retellai.com/t/clarification-on-phone-number-agent-field-deprecation/1917) -- Migration details
- [retell-sdk on PyPI](https://pypi.org/project/retell-sdk/) -- Version history and breaking changes
- [FastAPI Release Notes](https://fastapi.tiangolo.com/release-notes/) -- Strict Content-Type change
- [Retell AI Webhook Integration Issues](https://ausjournal.com/view_article.php?id=120) -- Common webhook problems and solutions
- [n8n External Secrets](https://docs.n8n.io/release-notes/) -- Secrets management in n8n 2.x
