# Phase 5: Webhook Backend + Security - Research

**Researched:** 2026-03-25
**Domain:** FastAPI webhook lifecycle handlers, Retell call event payloads, rate limiting, bearer token auth
**Confidence:** HIGH

## Summary

Phase 5 fills the TODO stubs in `main.py` for call lifecycle webhook handling (call_started, call_ended, call_analyzed), adds an active-call guard to the initiate-call endpoint, wires slowapi rate limiting on all endpoints, restricts CORS to the dashboard origin, and adds bearer token auth via FastAPI `Depends()`. The existing codebase already has the endpoint routing, Retell signature verification, Pydantic models, and CORS middleware -- this phase enhances them, not replaces them.

The Retell webhook payload is well-documented. The `call` object in webhooks is identical to the Get Call API response. `call_ended` includes everything except `call_analysis`; `call_analyzed` adds it. Key fields for our use: `disconnection_reason` (31 possible values, 3 categories), `recording_url`, `transcript`, `duration_ms`, `start_timestamp`, `end_timestamp`, and `call_analysis` (with `call_summary`, `user_sentiment`, `call_successful`, `custom_analysis_data`). Retell retries webhooks up to 3 times if no 2xx response within 10 seconds.

slowapi 0.1.9 (already in requirements.txt) supports stacked `@limiter.limit()` decorators for multiple limits per endpoint, `get_remote_address` for IP-based keying, and in-memory storage (no Redis needed). The setup requires 3 lines: create Limiter, assign to `app.state.limiter`, and register the `RateLimitExceeded` exception handler.

**Primary recommendation:** Implement in 3 waves -- (1) webhook handlers with Supabase writes, (2) auth + CORS hardening, (3) rate limiting. Keep webhook handlers fast (single DB operation each, return 200 immediately).

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **call_started:** Extract lead_id from call.metadata, UPDATE leads SET status='in_call', last_call_at=NOW(), last_call_id=call.call_id. Idempotent: skip if lead already 'in_call'.
- **call_ended:** UPSERT call_logs by retell_call_id (UPDATE if exists from tool, INSERT if missing). Store duration, recording_url, transcript, ended_at, from_number, to_number. Disconnect reason to lead status mapping: 'no_answer' -> 'no_answer', 'voicemail_reached'/'machine_detected' -> 'voicemail', 'busy' -> 'busy', 'error'/'unknown' -> 'failed'. If lead was 'in_call' but no tool outcome -> 'declined' fallback. Recording URL saved in call_logs only (no download, defer to v2 COMPL-02).
- **call_analyzed:** UPDATE call_logs with call_summary, sentiment, custom_analysis_data. Idempotent on retell_call_id.
- **Dedup strategy:** Idempotent on retell_call_id, no separate event tracking table.
- **Call initiation enhancement:** Active call check via leads table status IN ('calling', 'in_call'), reject 409 if found. Reuse dialer.py is_call_active() pattern.
- **Auth map:** Retell.verify() for /retell/tool + /retell/webhook. Bearer token (DASHBOARD_SECRET_KEY) for /retell/initiate-call + /api/dashboard/*. No auth for /health.
- **Rate limiting:** slowapi in-memory. initiate-call: 1/120s + 200/day (global). tool + webhook: 100/min (from Retell, safety net). dashboard: 60/min.
- **CORS:** DASHBOARD_ORIGIN env var, defaults to 'http://localhost:5173'. allow_origins: [DASHBOARD_ORIGIN, 'http://localhost:3000', 'http://localhost:5173']. allow_methods: GET, POST. allow_headers: Authorization, Content-Type.

### Claude's Discretion
- Exact Retell webhook payload fields for call_ended and call_analyzed (from research)
- slowapi decorator patterns and key functions
- FastAPI Depends() implementation for bearer token
- How to extract disconnect_reason from Retell's call_ended payload
- Error response format for 401/409/429

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| BACK-02 | Webhook lifecycle endpoint handling call_started, call_ended, call_analyzed events at POST /retell/webhook | Full Retell webhook payload documented: 31 disconnection reasons, call_analysis structure, transcript/recording fields, retry behavior (3x within 10s). Existing endpoint stub in main.py ready for implementation. |
| BACK-03 | Call initiation endpoint at POST /retell/initiate-call validating lead status, daily call count, and no active call | Existing endpoint has DNC + blocked prefix + daily limit checks. Needs active-call guard (reuse is_call_active() from dialer.py) and bearer token auth. |
| BACK-05 | HMAC-SHA256 webhook signature verification on all Retell endpoints using x-retell-signature header | Already implemented on /retell/tool via verify_retell_signature(). Same function applies to /retell/webhook (already wired in current code). Research confirms: Retell.verify(json_body, api_key, signature) with separators=(",",":"). |
| BACK-06 | CORS configuration allowing dashboard origin only | Existing CORS middleware needs DASHBOARD_ORIGIN env var instead of hardcoded list. Research confirms standard CORSMiddleware pattern. |
| BACK-07 | Rate limiting via slowapi enforcing 1 call per 2 minutes and max 200 calls per day | slowapi 0.1.9 in requirements.txt. Stacked decorators supported. Setup: Limiter + app.state + exception handler. |

</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| FastAPI | 0.115.0 | Web framework | Already in use, pinned to avoid Retell webhook Content-Type issues in 0.135.x |
| retell-sdk | 5.8.0 | Retell.verify() for signature verification | Already in use, provides webhook signature verification out of the box |
| slowapi | 0.1.9 | Rate limiting decorators | Already in requirements.txt, Flask-Limiter port for Starlette/FastAPI |
| supabase | 2.12.0 | Database client | Already in use for all Supabase operations |
| pydantic | 2.9.0 | Request/response validation | Already in use with WebhookPayload and InitiateCallRequest models |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| python-dotenv | 1.0.1 | Environment variable loading | Already used, loads DASHBOARD_ORIGIN and DASHBOARD_SECRET_KEY |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| slowapi in-memory | slowapi + Redis | Redis adds ops complexity, unnecessary for single-server single-operator |
| Bearer token auth | OAuth2/JWT | Over-engineering for single operator, bearer token is explicit project decision |

**Installation:**
No new packages needed. All dependencies already in requirements.txt.

## Architecture Patterns

### Relevant File Structure
```
execution/backend/
  main.py              # Endpoints, middleware, auth -- PRIMARY CHANGES HERE
  dialer.py            # is_call_active() reused for active-call guard
  tools.py             # No changes needed (tool execution already complete)
  retell_config.py     # retell_client used for Retell.verify()
  supabase_client.py   # supabase client for all DB operations
  requirements.txt     # No changes needed (slowapi already present)
```

### Pattern 1: Webhook Event Handler (Fast Return)
**What:** Handle Retell webhook events with minimal DB operations and return 200 immediately.
**When to use:** All three webhook events (call_started, call_ended, call_analyzed).
**Why:** Retell retries up to 3 times if no 2xx within 10 seconds. Long-running operations risk duplicate processing.
**Example:**
```python
# Source: https://docs.retellai.com/features/webhook-overview
# "If within 10 seconds no success status (2xx) is received,
# the webhook will be retried, up to 3 times."

@app.post("/retell/webhook")
async def retell_webhook(request: Request):
    body = await verify_retell_signature(request)
    payload = WebhookPayload(**json.loads(body))
    call_data = payload.call or {}
    call_id = call_data.get("call_id", "unknown")

    if payload.event == "call_started":
        lead_id = call_data.get("metadata", {}).get("lead_id")
        if lead_id:
            # Single UPDATE -- fast
            supabase.table("leads").update({
                "status": "in_call",
                "last_call_at": "now()",
                "last_call_id": call_id,
            }).eq("id", lead_id).eq("status", "calling").execute()
            # .eq("status", "calling") makes it idempotent

    return {"status": "ok"}
```

### Pattern 2: UPSERT on retell_call_id for Idempotency
**What:** Use Supabase UPSERT (insert with on_conflict) keyed on retell_call_id to safely handle duplicate webhooks.
**When to use:** call_ended handler where tool may have already created the call_logs row.
**Example:**
```python
# UPSERT: If call_logs row exists (created by log_call_outcome tool),
# update it with webhook data. If not, insert a new row.
supabase.table("call_logs").upsert({
    "retell_call_id": call_id,
    "lead_id": lead_id,
    "duration_seconds": call_data.get("duration_ms", 0) / 1000,
    "recording_url": call_data.get("recording_url"),
    "transcript": call_data.get("transcript"),
    "ended_at": ended_at_iso,
    "from_number": call_data.get("from_number"),
    "to_number": call_data.get("to_number"),
    "disconnection_reason": call_data.get("disconnection_reason"),
}, on_conflict="retell_call_id").execute()
```

### Pattern 3: FastAPI Depends() for Bearer Token Auth
**What:** Create a reusable dependency that validates the Bearer token header.
**When to use:** /retell/initiate-call and /api/dashboard/* endpoints.
**Example:**
```python
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

bearer_scheme = HTTPBearer(auto_error=True)

async def verify_bearer_token(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> str:
    if credentials.credentials != DASHBOARD_SECRET_KEY:
        raise HTTPException(status_code=401, detail="Invalid token")
    return credentials.credentials

# Usage on endpoint:
@app.post("/retell/initiate-call")
async def initiate_call(
    req: InitiateCallRequest,
    request: Request,  # Required for slowapi
    _token: str = Depends(verify_bearer_token),
):
    ...
```

### Pattern 4: slowapi Setup + Stacked Decorators
**What:** Initialize slowapi, register error handler, use stacked decorators for multiple limits.
**When to use:** All endpoints per the auth map.
**Example:**
```python
# Source: https://github.com/laurentS/slowapi
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Stacked decorators for multiple limits:
@app.post("/retell/initiate-call")
@limiter.limit("1/2minutes")  # Most restrictive first
@limiter.limit("200/day")
async def initiate_call(request: Request, ...):
    ...

# Single limit:
@app.get("/api/dashboard/live")
@limiter.limit("60/minute")
async def dashboard_live(request: Request):
    ...
```

### Anti-Patterns to Avoid
- **Async background tasks in webhook handlers:** Do NOT use BackgroundTasks for Supabase writes. The writes are fast (<100ms) and running them in background risks losing data if the process restarts. Keep them synchronous.
- **Processing webhooks without signature verification:** The /retell/webhook endpoint already calls verify_retell_signature(). Never remove or bypass this.
- **Downloading recordings in webhook handler:** Recording URLs are S3 signed URLs. Downloading them takes time and risks webhook timeout. Just save the URL. Defer download to v2 (COMPL-02).
- **Using `allow_origins=["*"]` in CORS:** Explicitly forbidden by security.md. Always use DASHBOARD_ORIGIN env var.
- **Hardcoding DASHBOARD_SECRET_KEY:** Use os.environ. Already follows this pattern in existing code.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Rate limiting | Custom request counter with timestamps | slowapi 0.1.9 | Already in requirements.txt, handles edge cases (concurrent requests, window sliding), returns proper 429 headers |
| Webhook signature verification | Custom HMAC calculation | Retell.verify() from retell-sdk | SDK handles body serialization quirks, tested against Retell's signing implementation |
| Bearer token extraction | Manual header parsing | FastAPI HTTPBearer + Depends() | Built-in 401 response, Swagger UI integration, type-safe |
| CORS | Manual header injection | FastAPI CORSMiddleware | Handles preflight OPTIONS, credential headers, edge cases |
| Idempotent writes | Check-then-write with locks | Supabase UPSERT on retell_call_id | Atomic operation, no race conditions |

**Key insight:** Every security and rate-limiting mechanism in this phase has a library solution already in the stack. The implementation work is wiring them together, not building them.

## Common Pitfalls

### Pitfall 1: Webhook Timeout Causing Retries
**What goes wrong:** Handler takes >10 seconds, Retell retries, duplicate processing occurs.
**Why it happens:** Complex DB operations or external calls in the webhook handler.
**How to avoid:** Single Supabase UPSERT per event. No external API calls. Use idempotent operations (UPSERT on retell_call_id, conditional UPDATE on lead status).
**Warning signs:** Retell dashboard shows webhook retries for the same call_id.

### Pitfall 2: Missing `request: Request` Parameter with slowapi
**What goes wrong:** Rate limiting silently fails, no 429 responses.
**Why it happens:** slowapi requires the `request` parameter to be explicitly in the function signature.
**How to avoid:** Every rate-limited endpoint MUST have `request: Request` as a parameter, even if the function body doesn't use it.
**Warning signs:** No X-RateLimit headers in responses, rate limits never triggered during testing.

### Pitfall 3: Decorator Order with slowapi
**What goes wrong:** Rate limiting fails or returns incorrect responses.
**Why it happens:** Route decorator must be outermost (first applied), then limiter decorator(s).
**How to avoid:** Always: `@app.post(...)` then `@limiter.limit(...)` then `async def ...`.
**Warning signs:** 500 errors on rate-limited endpoints, or rate limits not applying.

### Pitfall 4: disconnect_reason "machine_detected" Not in Retell Enum
**What goes wrong:** CONTEXT.md mentions mapping 'machine_detected' to 'voicemail', but Retell uses 'voicemail_reached' instead.
**Why it happens:** The CONTEXT.md mapping uses a simplified name. Retell's actual enum value is 'voicemail_reached'.
**How to avoid:** Map 'voicemail_reached' (the actual Retell value). Also map 'ivr_reached' to 'voicemail' since IVR detection behaves similarly for our use case.
**Warning signs:** Unhandled disconnect reasons in production logs.

### Pitfall 5: call_ended Arrives Before call_analyzed
**What goes wrong:** Trying to read call_analysis data from call_ended -- it is NOT included.
**Why it happens:** Retell sends call_ended immediately when the call disconnects. call_analyzed arrives later (seconds to minutes) after Retell runs its analysis pipeline.
**How to avoid:** Only read call_analysis fields in the call_analyzed handler. call_ended should store transcript/recording/duration only.
**Warning signs:** Null call_summary values from call_ended handler.

### Pitfall 6: Supabase last_call_at Requires ISO Format Not SQL Function
**What goes wrong:** Passing literal string "now()" to Supabase client does not invoke SQL NOW().
**Why it happens:** Supabase Python client sends values as-is, not as SQL expressions.
**How to avoid:** Use Python's `datetime.utcnow().isoformat()` or `datetime.now(timezone.utc).isoformat()` for timestamp fields.
**Warning signs:** last_call_at stored as literal string "now()" instead of a timestamp.

## Code Examples

Verified patterns from official sources:

### Retell call_ended Payload Field Extraction
```python
# Source: https://docs.retellai.com/api-references/get-call
# The call object in webhooks matches the Get Call API response

call_data = payload.call or {}

# Core identifiers
call_id = call_data.get("call_id")
agent_id = call_data.get("agent_id")

# Metadata (contains our lead_id)
metadata = call_data.get("metadata", {})
lead_id = metadata.get("lead_id")

# Timing (milliseconds since epoch)
start_ts = call_data.get("start_timestamp")  # int, ms
end_ts = call_data.get("end_timestamp")      # int, ms
duration_ms = call_data.get("duration_ms")    # int, ms (convenience)

# Convert to seconds for call_logs.duration_seconds
duration_seconds = (duration_ms or 0) / 1000

# Disconnect reason (31 possible values)
disconnect_reason = call_data.get("disconnection_reason")

# Transcript (plain text string)
transcript = call_data.get("transcript")

# Recording (S3 signed URL, expires per data_storage_setting)
recording_url = call_data.get("recording_url")

# Phone numbers
from_number = call_data.get("from_number")
to_number = call_data.get("to_number")

# Call status: "ended" | "not_connected" | "error"
call_status = call_data.get("call_status")
```

### Retell call_analyzed Payload Field Extraction
```python
# Source: https://docs.retellai.com/features/webhook-overview
# call_analyzed includes all call_ended fields PLUS call_analysis

call_analysis = call_data.get("call_analysis", {})

# Built-in analysis fields
call_summary = call_analysis.get("call_summary")        # string
user_sentiment = call_analysis.get("user_sentiment")     # "Positive"|"Negative"|"Neutral"|"Unknown"
in_voicemail = call_analysis.get("in_voicemail")         # boolean
call_successful = call_analysis.get("call_successful")   # boolean

# Custom analysis data (configured per-agent in Retell dashboard)
custom_data = call_analysis.get("custom_analysis_data")  # dict, schema varies
```

### Disconnect Reason to Lead Status Mapping
```python
# Source: https://docs.retellai.com/reliability/debug-call-disconnect
# 31 reasons in 3 categories: connected (ended), never connected (not_connected), error

# For outbound cold calling, map disconnect reasons to lead statuses:
DISCONNECT_TO_STATUS = {
    # Never connected -- dial failures
    "dial_no_answer": "no_answer",
    "dial_busy": "busy",
    "dial_failed": "failed",
    "invalid_destination": "failed",

    # Connected but reached automation
    "voicemail_reached": "voicemail",
    "ivr_reached": "voicemail",       # Treat IVR same as voicemail for retry

    # Connected -- human interaction (status set by tool, not webhook)
    "user_hangup": None,              # Check if tool already set status
    "agent_hangup": None,             # Check if tool already set status
    "inactivity": None,               # Lead went silent

    # Errors
    "error_retell": "failed",
    "error_unknown": "failed",
    "error_llm_websocket_open": "failed",
    "error_llm_websocket_lost_connection": "failed",
    "error_llm_websocket_runtime": "failed",
    "error_no_audio_received": "failed",

    # System limits
    "max_duration_reached": None,     # Check if tool set status
    "concurrency_limit_reached": "failed",
    "no_valid_payment": "failed",
    "scam_detected": "failed",
    "marked_as_spam": "failed",
    "telephony_provider_permission_denied": "failed",
    "telephony_provider_unavailable": "failed",
    "sip_routing_error": "failed",
    "user_declined": "failed",        # User rejected the call

    # Shouldn't happen for outbound
    "call_transfer": None,
    "transfer_bridged": None,
    "transfer_cancelled": None,
    "registered_call_timeout": "failed",
    "error_user_not_joined": "failed",
    "error_asr": "failed",
    "error_llm_websocket_corrupt_payload": "failed",
}
```

### Full slowapi Setup for This Project
```python
# Source: https://github.com/laurentS/slowapi + https://slowapi.readthedocs.io/
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)

# After app = FastAPI(...)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# initiate-call: 1 per 2 minutes + 200 per day (global)
@app.post("/retell/initiate-call")
@limiter.limit("1/2minutes")
@limiter.limit("200/day")
async def initiate_call(request: Request, req: InitiateCallRequest, ...):
    ...

# Retell webhooks: 100/min safety net
@app.post("/retell/tool")
@limiter.limit("100/minute")
async def retell_tool(request: Request):
    ...

@app.post("/retell/webhook")
@limiter.limit("100/minute")
async def retell_webhook(request: Request):
    ...

# Dashboard: 60/min
@app.get("/api/dashboard/live")
@limiter.limit("60/minute")
async def dashboard_live(request: Request):
    ...
```

### Bearer Token Dependency
```python
# Source: https://fastapi.tiangolo.com/tutorial/security/first-steps/
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

bearer_scheme = HTTPBearer(auto_error=True)
# auto_error=True: returns 401 automatically if no Bearer header

DASHBOARD_SECRET_KEY = os.environ.get("DASHBOARD_SECRET_KEY", "")

async def verify_bearer_token(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> str:
    """Validate bearer token matches DASHBOARD_SECRET_KEY."""
    if not DASHBOARD_SECRET_KEY:
        raise HTTPException(status_code=500, detail="Server misconfigured")
    if credentials.credentials != DASHBOARD_SECRET_KEY:
        raise HTTPException(status_code=401, detail="Invalid token")
    return credentials.credentials

# Apply to endpoints:
@app.post("/retell/initiate-call")
async def initiate_call(
    req: InitiateCallRequest,
    request: Request,
    _token: str = Depends(verify_bearer_token),
):
    ...

@app.get("/api/dashboard/live")
async def dashboard_live(
    request: Request,
    _token: str = Depends(verify_bearer_token),
):
    ...
```

### CORS with Environment Variable
```python
DASHBOARD_ORIGIN = os.environ.get("DASHBOARD_ORIGIN", "http://localhost:5173")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        DASHBOARD_ORIGIN,
        "http://localhost:3000",
        "http://localhost:5173",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual HMAC calculation | Retell.verify() in SDK | retell-sdk 5.x | SDK handles body serialization (separators) automatically |
| Custom rate limiter class | slowapi decorators | Already standard | Declarative, testable, proper 429 headers |
| pydantic v1 @validator | pydantic v2 @field_validator | pydantic 2.x | WebhookPayload still uses v1 @validator (works but deprecated) |

**Deprecated/outdated:**
- pydantic v1 `@validator` decorator: WebhookPayload model in main.py uses `@validator("event")`. Should migrate to `@field_validator("event")` with `@classmethod` for consistency with ToolCallPayload which already uses v2 style. Not blocking but worth cleaning up.

## Open Questions

1. **Supabase UPSERT on_conflict syntax in Python client**
   - What we know: Supabase JS client supports `.upsert({...}, { onConflict: 'column' })`. Python client likely supports similar.
   - What's unclear: Exact Python client syntax for `on_conflict` parameter in `.upsert()`.
   - Recommendation: Test during implementation. If Python client doesn't support `on_conflict` keyword, use `.upsert({...}, on_conflict="retell_call_id")` or fall back to SELECT + INSERT/UPDATE pattern.

2. **Retell "machine_detected" vs "voicemail_reached"**
   - What we know: CONTEXT.md maps 'machine_detected' to 'voicemail'. Retell API uses 'voicemail_reached'. There is no 'machine_detected' in the official enum.
   - What's unclear: Whether this was a simplified name in CONTEXT.md or a misunderstanding.
   - Recommendation: Map 'voicemail_reached' (official value). Add 'ivr_reached' as well. Document the correction.

3. **slowapi "1/2minutes" rate string format**
   - What we know: slowapi uses the `limits` library for parsing. Standard formats: "5/minute", "100/hour", "200/day".
   - What's unclear: Whether "1/2minutes" is valid or needs "1/2 minutes" or "1 per 2 minutes".
   - Recommendation: Test "1/2minutes" first. Fallback: use "1/120seconds" or "30/hour" as equivalent.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest (not yet configured) |
| Config file | none -- see Wave 0 |
| Quick run command | `cd execution/backend && python -m pytest tests/ -x -q` |
| Full suite command | `cd execution/backend && python -m pytest tests/ -v` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BACK-02 | call_started updates lead to in_call | unit (mock Supabase) | `pytest tests/test_webhooks.py::test_call_started -x` | No -- Wave 0 |
| BACK-02 | call_ended UPSERT call_logs + lead status mapping | unit (mock Supabase) | `pytest tests/test_webhooks.py::test_call_ended -x` | No -- Wave 0 |
| BACK-02 | call_analyzed stores analysis data | unit (mock Supabase) | `pytest tests/test_webhooks.py::test_call_analyzed -x` | No -- Wave 0 |
| BACK-03 | Active call check rejects with 409 | unit (mock is_call_active) | `pytest tests/test_initiate_call.py::test_active_call_guard -x` | No -- Wave 0 |
| BACK-05 | Retell signature verification rejects invalid | unit (mock Retell.verify) | `pytest tests/test_auth.py::test_retell_signature -x` | No -- Wave 0 |
| BACK-06 | CORS allows dashboard origin only | manual | curl with Origin header | N/A -- manual |
| BACK-07 | Rate limiting returns 429 | unit (TestClient) | `pytest tests/test_rate_limit.py::test_429 -x` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** Manual curl test against local server
- **Per wave merge:** Full endpoint test with real Supabase (test_phase1.py pattern)
- **Phase gate:** All endpoints responding correctly before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `execution/backend/tests/` directory does not exist
- [ ] pytest not in requirements.txt
- [ ] No test configuration (pytest.ini or pyproject.toml)
- [ ] Tests deferred to Phase 9 (TEST-01 through TEST-04) per project roadmap

*(Note: Project uses manual integration tests per phase (test_phase1.py pattern). Full pytest infrastructure deferred to Phase 9.)*

## Sources

### Primary (HIGH confidence)
- [Retell AI Webhook Overview](https://docs.retellai.com/features/webhook-overview) - Event types, payload structure, retry behavior (10s timeout, 3 retries)
- [Retell AI Get Call API](https://docs.retellai.com/api-references/get-call) - Complete call object field reference (31 disconnection reasons, call_analysis structure, recording_url, transcript, duration_ms)
- [Retell AI Secure Webhook](https://docs.retellai.com/features/secure-webhook) - Retell.verify() usage, body serialization with separators=(",",":"), X-Retell-Signature header
- [Retell AI Debug Call Disconnect](https://docs.retellai.com/reliability/debug-call-disconnect) - 3 categories: connected (ended), never connected (not_connected), error. Complete handling guidance.
- [slowapi GitHub](https://github.com/laurentS/slowapi) - FastAPI setup, stacked decorators, key functions, in-memory storage
- [slowapi ReadTheDocs](https://slowapi.readthedocs.io/en/latest/) - Limiter constructor params, limit() method params, _rate_limit_exceeded_handler
- [slowapi API Reference](https://slowapi.readthedocs.io/en/latest/api/) - Limiter class, limit(), shared_limit(), exempt()
- [FastAPI Security Docs](https://fastapi.tiangolo.com/tutorial/security/first-steps/) - HTTPBearer, Depends(), OAuth2PasswordBearer patterns

### Secondary (MEDIUM confidence)
- [slowapi examples.md](https://github.com/laurentS/slowapi/blob/master/docs/examples.md) - default_limits, exempt, cost parameter, middleware options
- [Retell AI Post-Call Analysis](https://www.retellai.com/features/post-call-analysis) - Custom analysis types (boolean, text, number, selector)

### Tertiary (LOW confidence)
- slowapi "1/2minutes" rate string format -- needs validation during implementation
- Supabase Python client UPSERT on_conflict parameter syntax -- needs validation during implementation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - all libraries already in requirements.txt, no new dependencies
- Architecture: HIGH - existing codebase patterns (verify_retell_signature, Supabase queries, is_call_active) directly reusable
- Retell webhook payloads: HIGH - verified against official API docs (Get Call reference matches webhook call object)
- Disconnect reason mapping: HIGH - complete 31-value enum from official debug docs with 3-category classification
- slowapi setup: HIGH - official docs + GitHub examples confirm stacked decorators, in-memory store, FastAPI integration
- Bearer token auth: HIGH - standard FastAPI Depends() pattern with HTTPBearer
- Pitfalls: HIGH - based on official Retell retry behavior docs and direct slowapi documentation

**Research date:** 2026-03-25
**Valid until:** 2026-04-25 (stable -- no fast-moving dependencies)
