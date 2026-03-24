# Architecture Patterns

**Domain:** AI Voice Cold-Calling Sales Agent (Retell AI)
**Researched:** 2026-03-24

## Recommended Architecture

```
                          +------------------+
                          |   Retell AI      |
                          |  (Voice Platform)|
                          |  STT/TTS/VAD    |
                          |  GPT-4o-mini    |
                          +--------+---------+
                                   |
                     Tool calls    |   Lifecycle webhooks
                     (during call) |   (call_started/ended/analyzed)
                                   v
                          +------------------+
                          |   FastAPI        |
                          |  Webhook Server  |
                          |  (Port 8000)     |
                          +--------+---------+
                                   |
                    +--------------+---------------+
                    |              |               |
                    v              v               v
           +-------+------+ +-----+-----+ +------+------+
           | Supabase     | | Resend    | | Retell API  |
           | (PostgreSQL) | | (Email)   | | (Call Init) |
           | RLS enabled  | |           | |             |
           +--------------+ +-----------+ +-------------+
                    ^
                    |
          +---------+---------+
          |                   |
          v                   v
  +-------+------+   +-------+------+
  |   n8n        |   |  Dashboard   |
  | (Workflows)  |   |  (React SPA) |
  | Auto-dialer  |   |  Polls every |
  | Post-call    |   |  5-30 sec    |
  | Lead import  |   |              |
  +--------------+   +--------------+
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **Retell AI** | Voice handling (STT, TTS, turn-taking, VAD), LLM inference (GPT-4o-mini), call management, recording | FastAPI (tool calls + webhooks), Twilio (telephony) |
| **FastAPI Backend** | Webhook handler (tool calls + lifecycle events), call initiation API, dashboard data API, Supabase queries, Resend email triggers | Retell AI (receive webhooks, initiate calls), Supabase (read/write), Resend (send email) |
| **Supabase** | Data persistence (leads, call_logs, pipeline_logs, dial_schedules), RLS security, SQL views for analytics | FastAPI (service key, full access), Dashboard (anon key, read-only), n8n (service key, full access) |
| **n8n** | Scheduled auto-dialer (cron), post-call outcome routing (webhook), lead CSV import (webhook) | FastAPI (POST /retell/initiate-call), Supabase (CRUD via built-in node), Resend (HTTP request) |
| **React Dashboard** | Real-time monitoring (live view), lead pipeline management, strategy analytics visualization | Supabase (direct JS client, read-only), FastAPI (/api/dashboard/* endpoints) |

### Data Flow

**Outbound Call Flow:**
```
1. n8n auto-dialer (cron every 2 min)
   -> Checks dial window (Supabase: dial_schedules)
   -> Checks no active call (Supabase: leads WHERE status IN ['calling','in_call'])
   -> Picks next lead (Supabase: leads WHERE status='queued' ORDER BY priority DESC LIMIT 1)
   -> POST /retell/initiate-call with lead_id

2. FastAPI backend
   -> Fetches lead from Supabase
   -> Updates lead status to 'calling'
   -> Calls Retell API: client.call.create_phone_call(
        from_number=TWILIO_NUMBER,
        to_number=lead.phone,
        retell_llm_dynamic_variables={"lead_name": lead.name}
      )
   -> Logs to pipeline_logs

3. Retell AI initiates call
   -> Sarah speaks opening ("Hi {{lead_name}}, this is Sarah...")
   -> During conversation, Retell POSTs tool calls to /retell/tool
   -> FastAPI executes tool, returns result within 10s
   -> At call end, Retell POSTs call_ended webhook to /retell/webhook

4. FastAPI processes call_ended
   -> Extracts transcript, duration, outcome, recording_url
   -> Inserts into call_logs
   -> Updates lead status based on outcome
   -> Logs to pipeline_logs

5. n8n post-call handler (webhook trigger)
   -> Routes by outcome:
      COMMITTED -> Resend payment email + update status to payment_pending
      FOLLOW_UP -> Schedule follow-up (set follow_up_at on lead)
      DECLINED  -> Log decline reason
      NO_ANSWER -> Check retry count, requeue if < max_retries
```

**Dashboard Data Flow:**
```
Dashboard (React) ---poll every 5s---> Supabase (todays_calls view, leads WHERE status IN ['calling','in_call'])
Dashboard (React) ---poll every 30s--> Supabase (pipeline_snapshot view, strategy_performance view)
Dashboard (React) ---on demand-------> Supabase (individual lead details, call transcripts)
```

## Patterns to Follow

### Pattern 1: Webhook Handler with Signature Verification

**What:** Every incoming Retell webhook is verified via HMAC-SHA256 before processing.
**When:** All `/retell/webhook` and `/retell/tool` endpoints.

```python
import hmac
import hashlib
from fastapi import Request, HTTPException

async def verify_retell_signature(request: Request) -> bytes:
    body = await request.body()
    signature = request.headers.get("x-retell-signature", "")
    expected = hmac.new(
        os.environ["WEBHOOK_SECRET"].encode(),
        body,
        hashlib.sha256
    ).hexdigest()
    if not hmac.compare_digest(signature, expected):
        raise HTTPException(status_code=401, detail="Invalid signature")
    return body
```

### Pattern 2: Tool Call Router

**What:** Route incoming tool calls to the correct handler by function name.
**When:** `/retell/tool` endpoint receives tool calls during live conversations.

```python
TOOL_HANDLERS = {
    "lookup_programme": handle_lookup_programme,
    "get_objection_response": handle_get_objection,
    "log_call_outcome": handle_log_outcome,
}

@app.post("/retell/tool")
async def handle_tool_call(request: Request):
    body = await verify_retell_signature(request)
    payload = ToolCallPayload.model_validate_json(body)

    handler = TOOL_HANDLERS.get(payload.name)
    if not handler:
        return {"result": "I don't have that capability right now."}

    try:
        result = await handler(payload.args, payload.call_id)
        return {"result": result}
    except Exception as e:
        logger.error(f"Tool {payload.name} failed: {e}")
        return {"result": "Let me have someone follow up with you on that."}
```

### Pattern 3: Lead Status State Machine

**What:** Enforce valid status transitions to prevent data corruption.
**When:** Any operation that changes a lead's status.

```python
VALID_TRANSITIONS = {
    "new": ["queued", "do_not_contact"],
    "queued": ["calling", "do_not_contact"],
    "calling": ["in_call", "no_answer", "voicemail", "busy", "invalid_number"],
    "in_call": ["committed", "follow_up", "declined"],
    "committed": ["payment_pending", "follow_up"],
    "payment_pending": ["enrolled", "follow_up"],
    "follow_up": ["queued", "declined", "do_not_contact"],
    "no_answer": ["queued", "exhausted"],
    "voicemail": ["queued", "exhausted"],
    "busy": ["queued", "exhausted"],
}

def validate_transition(current: str, new: str) -> bool:
    allowed = VALID_TRANSITIONS.get(current, [])
    return new in allowed
```

### Pattern 4: Graceful Tool Failure

**What:** When a tool fails, return a natural-sounding message Sarah can speak, not a technical error.
**When:** Any tool execution that may fail (database down, data not found).

```python
async def handle_lookup_programme(args: dict, call_id: str) -> str:
    try:
        result = supabase.table("programmes").select("*") \
            .eq("experience_level", args["experience_level"]).execute()
        if not result.data:
            return "Based on your experience, I'd recommend starting with our Cloud Computing pathway. It's 8 weeks and currently at the early bird rate of thirteen fifty pounds."
        return format_programme_response(result.data[0])
    except Exception:
        # Fallback to hardcoded response -- Sarah keeps talking naturally
        return "Our most popular programme is the Cloud Computing pathway at thirteen fifty pounds for the early bird rate. Shall I tell you more about it?"
```

### Pattern 5: Idempotent Webhook Processing

**What:** Use Retell's `call_id` as a deduplication key to prevent double-processing webhooks.
**When:** `/retell/webhook` endpoint, especially for `call_ended` events that trigger downstream actions.

```python
@app.post("/retell/webhook")
async def handle_webhook(request: Request):
    body = await verify_retell_signature(request)
    payload = json.loads(body)

    call_id = payload["call"]["call_id"]

    # Check if already processed (Retell retries on timeout)
    existing = supabase.table("call_logs") \
        .select("id").eq("retell_call_id", call_id).execute()
    if existing.data:
        return {"status": "already_processed"}

    # Process the event
    await process_call_event(payload)
    return {"status": "ok"}
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Chaining LLM Calls in Tool Execution

**What:** Making additional LLM API calls inside tool handlers.
**Why bad:** Retell has a 10-second webhook timeout. An LLM call adds 2-5 seconds, risking timeout. Retell already runs the LLM -- tools should return data, not generate text.
**Instead:** Return structured data from tools. Let Retell's LLM generate the spoken response from the data.

### Anti-Pattern 2: Storing Secrets in n8n Workflow JSON

**What:** Embedding API keys directly in n8n workflow node configurations.
**Why bad:** Workflow JSON exports are committed to git. Keys are exposed.
**Instead:** Use n8n's external secrets management or environment variables (`{{ $env.SUPABASE_SERVICE_KEY }}`).

### Anti-Pattern 3: Polling Supabase from the Auto-Dialer AND the Backend

**What:** Having both n8n and FastAPI independently poll the lead queue.
**Why bad:** Race conditions. Both might pick the same lead and initiate duplicate calls.
**Instead:** Only n8n polls the queue. n8n tells FastAPI which lead to call via POST /retell/initiate-call. FastAPI atomically updates the lead status to 'calling' before initiating the call.

### Anti-Pattern 4: Exposing Service Key to Dashboard Frontend

**What:** Using SUPABASE_SERVICE_KEY in the React dashboard's JavaScript.
**Why bad:** Service key bypasses all RLS. Anyone inspecting the browser can access/modify all data.
**Instead:** Dashboard uses SUPABASE_ANON_KEY + Supabase Auth (or bearer token auth via FastAPI proxy). Only the backend uses the service key.

### Anti-Pattern 5: Blocking Tool Execution on External APIs

**What:** Making synchronous calls to slow external APIs (e.g., CRM lookups) inside tool handlers.
**Why bad:** 10-second timeout. If the external API is slow, the tool call fails and Sarah goes silent.
**Instead:** Pre-load data into Supabase. Tool handlers only query Supabase (fast, local). External data sync happens out-of-band.

## Scalability Considerations

| Concern | At 10 calls/day (Wave 0) | At 200 calls/day (Wave 2) | At 1000+ calls/day |
|---------|--------------------------|---------------------------|---------------------|
| Database | Single Supabase instance, no issues | Add indexes on call_logs(started_at), monitor query times | Consider read replicas or materialized views for analytics |
| Auto-dialer | n8n cron every 2 min, plenty of headroom | Still fine at 1 call/2 min = 30/hour | Need multiple phone numbers, concurrent callers, custom scheduler replacing n8n |
| Webhook backend | Single uvicorn process | 2 Gunicorn workers sufficient | Horizontal scaling behind load balancer |
| Dashboard | Polling every 5s trivial | Still fine, consider increasing poll interval for analytics tab | WebSocket/SSE for live view, pagination for pipeline |
| Retell API | Well within free tier limits | May need paid tier (100 calls/min limit) | Enterprise tier, multiple agents, A/B testing via weighted routing |
| Storage | Minimal -- transcripts are text | ~50MB/day of transcripts + recordings | Archive old recordings, compress transcripts, consider object storage for recordings |

**Bottom line:** The architecture scales to 200 calls/day (Wave 2 target) without changes. Beyond that, the auto-dialer and telephony layer need redesign (multiple numbers, concurrent calls). The database and backend are fine to 1000+ with minor tuning.

## Sources

- [Retell AI Custom LLM Best Practices](https://docs.retellai.com/integrate-llm/llm-best-practice) -- Latency and tool execution guidance
- [Retell AI Create Phone Call API](https://docs.retellai.com/api-references/create-phone-call) -- Outbound call parameters
- [Retell AI Changelog](https://www.retellai.com/changelog) -- Webhook event controls, weighted agents
- [FastAPI Production Deployment Guide](https://www.zestminds.com/blog/fastapi-deployment-guide/) -- Gunicorn + Uvicorn patterns
- [n8n Supabase Node Docs](https://docs.n8n.io/integrations/builtin/app-nodes/n8n-nodes-base.supabase/) -- Integration patterns
- [Supabase Python Docs](https://supabase.com/docs/reference/python/update) -- Query patterns
