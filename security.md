# security.md — Security Enforcement Document
## Sarah Voice Sales Agent on Retell AI
### Written by: Senior Application Security Engineer (15+ years securing production voice/telephony systems, API platforms, and PII-handling applications)

---

## DOCUMENT PURPOSE

This document defines every security control required for the Sarah project.
It is not advisory — it is mandatory. Every item is a hard requirement.
No code ships to production without satisfying every applicable control.

Claude Code must read this document before writing any code and enforce
every rule during implementation.

---

## THREAT MODEL

| Attack Surface | Threat | Impact | Priority |
|----------------|--------|--------|----------|
| API keys in source code | Credential leak via Git | Full account takeover | CRITICAL |
| Webhook endpoints | Unauthenticated calls, payload injection | Data corruption, unauthorized calls | CRITICAL |
| Supabase | Unprotected tables, SQL injection | Lead data breach, PII exposure | CRITICAL |
| Dashboard | No auth, session hijacking | Unauthorized access to all call data | HIGH |
| Retell API | Rate limit abuse, toll fraud | Financial loss, service suspension | HIGH |
| Call recordings/transcripts | PII in logs, unencrypted storage | GDPR/data protection violation | HIGH |
| n8n workflows | Unauthenticated triggers, credential exposure | Pipeline manipulation | MEDIUM |
| CSV import | Malicious payloads in uploaded data | XSS, injection, data corruption | MEDIUM |
| Dependencies | Vulnerable packages | Remote code execution | MEDIUM |
| Error messages | Stack traces in API responses | Information disclosure | LOW |
| OpenClaw API | Unauthenticated message sending | Spam from your WhatsApp, account ban | HIGH |
| Cal.com webhooks | Fake booking injection | False leads, wasted call slots | MEDIUM |
| Email content | PII in outreach emails | Data exposure if email forwarded | MEDIUM |
| WhatsApp message replies | Injection via reply text | Malicious content parsed by AI | LOW |

---

## 1. SECRETS MANAGEMENT

### 1.1 No Hardcoded Secrets — EVER

```
RULE: No API key, token, password, or secret string may appear in any file
that is tracked by Git. This includes Python files, config files, JSON,
YAML, shell scripts, n8n workflow exports, Dockerfiles, and comments.
```

**Enforcement:**

```bash
# .gitignore — MUST include these lines
.env
.env.*
!.env.example
*.pem
*.key
*.crt
secrets/
.retell_config
node_modules/
__pycache__/
```

**Pre-commit hook** — Install and run before every commit:

```bash
#!/bin/bash
# .git/hooks/pre-commit — blocks commits containing secrets

PATTERNS=(
    'RETELL_API_KEY\s*='
    'SUPABASE_SERVICE_KEY\s*='
    'TWILIO_AUTH_TOKEN\s*='
    'RESEND_API_KEY\s*='
    'sk-[a-zA-Z0-9]{20,}'
    'eyJ[a-zA-Z0-9_-]{50,}'
    'AKIA[A-Z0-9]{16}'
    'ghp_[a-zA-Z0-9]{36}'
    'password\s*=\s*["\x27][^"\x27]+'
    'Bearer\s+[a-zA-Z0-9._-]{20,}'
    'OPENCLAW_API_KEY\s*='
    'CAL_COM_API_KEY\s*='
    'CAL_COM_WEBHOOK_SECRET\s*='
)

STAGED=$(git diff --cached --name-only)
FOUND=0

for FILE in $STAGED; do
    [ ! -f "$FILE" ] && continue
    for PATTERN in "${PATTERNS[@]}"; do
        if grep -qEi "$PATTERN" "$FILE"; then
            echo "BLOCKED: Secret pattern found in $FILE"
            echo "  Pattern: $PATTERN"
            grep -nEi "$PATTERN" "$FILE" | head -3
            FOUND=1
        fi
    done
done

if [ "$FOUND" -eq 1 ]; then
    echo ""
    echo "COMMIT BLOCKED — Remove secrets before committing."
    echo "Use environment variables instead."
    exit 1
fi
exit 0
```

**Make it executable:**
```bash
chmod +x .git/hooks/pre-commit
```

### 1.2 Environment Variable Standards

```python
# CORRECT — always load from environment
import os
api_key = os.environ["RETELL_API_KEY"]  # Fails loudly if missing

# ALSO CORRECT — with validation
api_key = os.environ.get("RETELL_API_KEY")
if not api_key:
    raise RuntimeError("RETELL_API_KEY not set — cannot start")

# NEVER — hardcoded value
api_key = "key_abc123..."  # VIOLATION

# NEVER — default value for secrets
api_key = os.environ.get("RETELL_API_KEY", "key_abc123...")  # VIOLATION

# NEVER — in comments
# The API key is key_abc123...  # VIOLATION
```

### 1.3 .env.example

The `.env.example` file MUST exist and contain only placeholder values:

```
# .env.example — Copy to .env and fill in real values
RETELL_API_KEY=your_retell_api_key_here
RETELL_AGENT_ID=your_agent_id_here
RETELL_LLM_ID=your_llm_id_here
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_service_key_here
TWILIO_ACCOUNT_SID=your_twilio_sid_here
TWILIO_AUTH_TOKEN=your_twilio_auth_token_here
TWILIO_NUMBER=+1XXXXXXXXXX
RESEND_API_KEY=your_resend_key_here
WEBHOOK_BASE_URL=https://your-endpoint.com
WEBHOOK_SECRET=generate_a_random_32_char_string
DASHBOARD_SECRET_KEY=generate_a_random_64_char_string
N8N_BASE_URL=https://your-n8n-instance.com
N8N_WEBHOOK_SECRET=generate_a_random_32_char_string
OPENCLAW_API_URL=http://your-vps2-ip:8080
OPENCLAW_API_KEY=your_openclaw_key_here
OPENCLAW_INSTANCE=cloudboosta
CAL_COM_URL=https://cal.yourdomain.com
CAL_COM_API_KEY=your_cal_com_key_here
CAL_COM_WEBHOOK_SECRET=generate_random_32_chars
```

### 1.4 Secrets Rotation Schedule

| Secret | Rotation Frequency | Procedure |
|--------|-------------------|-----------|
| RETELL_API_KEY | Every 90 days | Generate new key in Retell dashboard → update .env → restart |
| SUPABASE_SERVICE_KEY | Every 90 days | Rotate in Supabase dashboard → update .env |
| TWILIO_AUTH_TOKEN | Every 90 days | Rotate in Twilio Console → update .env + Retell import |
| RESEND_API_KEY | Every 90 days | Rotate in Resend dashboard → update .env |
| WEBHOOK_SECRET | Every 90 days | Generate new random string → update .env + Retell webhook config |
| DASHBOARD_SECRET_KEY | Every 90 days | Generate new string → update .env → all sessions invalidated |
| OPENCLAW_API_KEY | Every 90 days | Regenerate in OpenClaw dashboard → update .env |
| CAL_COM_API_KEY | Every 90 days | Regenerate in Cal.com admin → update .env |

---

## 2. WEBHOOK SECURITY

### 2.1 Retell Webhook Verification

Every incoming webhook from Retell MUST be verified before processing.
Retell signs webhooks with HMAC-SHA256. Reject any request that fails verification.

```python
import hmac
import hashlib
from fastapi import Request, HTTPException

WEBHOOK_SECRET = os.environ["WEBHOOK_SECRET"]

async def verify_retell_signature(request: Request) -> bytes:
    """Verify Retell webhook signature. Reject if invalid."""
    body = await request.body()
    signature = request.headers.get("x-retell-signature", "")

    expected = hmac.new(
        WEBHOOK_SECRET.encode(),
        body,
        hashlib.sha256
    ).hexdigest()

    if not hmac.compare_digest(signature, expected):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    return body
```

### 2.2 Webhook Endpoint Protection

```python
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.trustedhost import TrustedHostMiddleware
import time

app = FastAPI()

# Only accept requests from known hosts
app.add_middleware(TrustedHostMiddleware, allowed_hosts=[
    "*.retellai.com",
    "api.retellai.com",
    "localhost",  # Remove in production
])

# Rate limit webhook endpoints
WEBHOOK_RATE_LIMIT = {}
WEBHOOK_RATE_WINDOW = 60  # seconds
WEBHOOK_RATE_MAX = 120     # max requests per window

async def check_webhook_rate_limit(request: Request):
    """Prevent webhook flood attacks."""
    ip = request.client.host
    now = time.time()

    if ip not in WEBHOOK_RATE_LIMIT:
        WEBHOOK_RATE_LIMIT[ip] = []

    # Clean old entries
    WEBHOOK_RATE_LIMIT[ip] = [t for t in WEBHOOK_RATE_LIMIT[ip] if now - t < WEBHOOK_RATE_WINDOW]

    if len(WEBHOOK_RATE_LIMIT[ip]) >= WEBHOOK_RATE_MAX:
        raise HTTPException(status_code=429, detail="Rate limit exceeded")

    WEBHOOK_RATE_LIMIT[ip].append(now)
```

### 2.3 n8n Webhook Security

All n8n webhook triggers MUST use authentication:

```
Method: Header Auth
Header Name: X-Webhook-Secret
Header Value: {{ $env.N8N_WEBHOOK_SECRET }}

In n8n workflow:
- Add "Header Auth" credential to webhook trigger node
- Set header name and expected value
- Requests without valid header are rejected (401)
```

### 2.4 Cal.com Webhook Verification
```python
async def verify_calcom_webhook(request: Request) -> bytes:
    body = await request.body()
    signature = request.headers.get("x-cal-signature-256", "")
    expected = hmac.new(
        os.environ["CAL_COM_WEBHOOK_SECRET"].encode(),
        body, hashlib.sha256
    ).hexdigest()
    if not hmac.compare_digest(signature, expected):
        raise HTTPException(status_code=401, detail="Invalid Cal.com signature")
    return body
```

### 2.5 OpenClaw API Security
- OpenClaw runs on VPS #2 with no public exposure
- All API calls require the apikey header
- Never expose the OpenClaw API URL or key to frontend code
- Rate limit outbound WhatsApp: max 30 messages per hour
- Never send WhatsApp to numbers marked do_not_contact

---

## 3. API RATE LIMITING

### 3.1 Retell API Rate Limits

| Endpoint | Rate Limit | Our Safeguard |
|----------|-----------|---------------|
| create_phone_call | 10/min (free), 100/min (paid) | Auto-dialer: max 1 call/2min |
| list-agents | 60/min | Cache agent list, refresh every 5min |
| get-call | 60/min | Cache call details for 30s |
| llm.create | 10/min | One-time setup, not called in production |

```python
import asyncio
from datetime import datetime, timedelta

class RateLimiter:
    """Token bucket rate limiter for API calls."""

    def __init__(self, max_calls: int, window_seconds: int):
        self.max_calls = max_calls
        self.window = window_seconds
        self.calls = []

    async def acquire(self):
        now = datetime.utcnow()
        self.calls = [t for t in self.calls if now - t < timedelta(seconds=self.window)]

        if len(self.calls) >= self.max_calls:
            wait = (self.calls[0] + timedelta(seconds=self.window) - now).total_seconds()
            await asyncio.sleep(max(wait, 0.1))
            return await self.acquire()

        self.calls.append(now)

# Usage
retell_limiter = RateLimiter(max_calls=25, window_seconds=60)  # Conservative

async def safe_create_call(client, **kwargs):
    await retell_limiter.acquire()
    return client.call.create_phone_call(**kwargs)
```

### 3.2 Dashboard API Rate Limiting

```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@app.get("/api/dashboard/live")
@limiter.limit("30/minute")
async def dashboard_live(request: Request):
    ...

@app.get("/api/dashboard/pipeline")
@limiter.limit("20/minute")
async def dashboard_pipeline(request: Request):
    ...

@app.get("/api/dashboard/strategy")
@limiter.limit("10/minute")
async def dashboard_strategy(request: Request):
    ...
```

### 3.3 Auto-Dialer Rate Control

```python
# In dial_schedules table
calls_per_hour INTEGER DEFAULT 30  # Max 30 calls/hour = 1 every 2 minutes

# Enforce in dialer logic
MIN_CALL_INTERVAL_SECONDS = 120  # Never call faster than this

async def can_dial_next(supabase) -> bool:
    """Check if enough time has passed since last call."""
    last = supabase.table("call_logs") \
        .select("started_at") \
        .order("started_at", desc=True) \
        .limit(1).execute()

    if not last.data:
        return True

    elapsed = (datetime.utcnow() - parse(last.data[0]["started_at"])).total_seconds()
    return elapsed >= MIN_CALL_INTERVAL_SECONDS
```

---

## 4. SUPABASE SECURITY

### 4.1 Row Level Security (RLS)

Enable RLS on ALL tables. The service key bypasses RLS (for backend use only).
The anon key (used by dashboard) must have restricted access.

```sql
-- Enable RLS
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE dial_schedules ENABLE ROW LEVEL SECURITY;

-- Service role can do everything (backend uses service key)
CREATE POLICY "Service role full access" ON leads
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access" ON call_logs
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access" ON pipeline_logs
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access" ON dial_schedules
    FOR ALL USING (auth.role() = 'service_role');

-- Dashboard read-only access (via authenticated user or anon with restrictions)
CREATE POLICY "Dashboard read" ON leads
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Dashboard read" ON call_logs
    FOR SELECT USING (auth.role() = 'authenticated');

-- NEVER expose service key to the frontend dashboard.
-- Dashboard uses anon key + Supabase Auth (email/password login).
```

### 4.2 Service Key vs Anon Key

```
SUPABASE_SERVICE_KEY → ONLY used by backend (FastAPI server, n8n workflows)
  - Bypasses RLS
  - Full read/write access
  - NEVER exposed to frontend or client-side code

SUPABASE_ANON_KEY → Used by dashboard frontend
  - Subject to RLS policies
  - Read-only access to leads, call_logs
  - Requires Supabase Auth login
```

### 4.3 SQL Injection Prevention

```python
# CORRECT — parameterised queries (Supabase client handles this)
supabase.table("leads").select("*").eq("id", lead_id).execute()

# CORRECT — filter with known values
supabase.table("leads").select("*").in_("status", ["queued", "new"]).execute()

# NEVER — string concatenation in queries
supabase.rpc("raw_query", {"sql": f"SELECT * FROM leads WHERE id = '{lead_id}'"})

# NEVER — user input directly in any query string
```

### 4.4 Sensitive Data in Supabase

```
PII Fields in leads table:
  - name (personal)
  - phone (personal)
  - email (personal)
  - location (personal)

RULES:
  - Never log full phone numbers in pipeline_logs.details — mask as +234****1234
  - Call transcripts may contain PII — stored in call_logs with RLS protection
  - Recording URLs are time-limited (Retell signed URLs expire in 24h)
  - Never expose Supabase data via unauthenticated API endpoints
```

---

## 5. DASHBOARD SECURITY

### 5.1 Authentication Required

The dashboard MUST require authentication. No public access.

```python
# Option A: Simple bearer token (for single-user/admin)
DASHBOARD_TOKEN = os.environ["DASHBOARD_SECRET_KEY"]

async def verify_dashboard_auth(request: Request):
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer ") or auth[7:] != DASHBOARD_TOKEN:
        raise HTTPException(status_code=401, detail="Unauthorized")

# Option B: Supabase Auth (for multi-user)
# Dashboard frontend uses @supabase/auth-ui-react for login
# Backend validates JWT from Supabase Auth
```

### 5.2 CORS Configuration

```python
from fastapi.middleware.cors import CORSMiddleware

# NEVER use allow_origins=["*"] in production
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://your-dashboard-domain.com",
        "http://localhost:3000",  # Dev only — remove in production
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)
```

### 5.3 Content Security Policy

```python
from starlette.middleware import Middleware
from starlette.responses import Response

@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data:; "
        "connect-src 'self' https://*.supabase.co"
    )
    return response
```

---

## 6. INPUT VALIDATION

### 6.1 Phone Number Validation

```python
import re

E164_PATTERN = re.compile(r'^\+[1-9]\d{6,14}$')

def validate_phone(phone: str) -> str:
    """Validate and normalize phone number to E.164 format."""
    phone = phone.strip().replace(" ", "").replace("-", "").replace("(", "").replace(")", "")

    if not phone.startswith("+"):
        raise ValueError(f"Phone must start with +: {phone}")

    if not E164_PATTERN.match(phone):
        raise ValueError(f"Invalid E.164 phone: {phone}")

    return phone
```

### 6.2 CSV Import Sanitization

```python
import csv
import io
from html import escape

MAX_CSV_ROWS = 10000
MAX_FIELD_LENGTH = 500
ALLOWED_FIELDS = {"name", "phone", "email", "location", "source", "notes"}

def sanitize_csv_import(raw_data: str) -> list[dict]:
    """Parse and sanitize CSV data. Reject malicious content."""
    reader = csv.DictReader(io.StringIO(raw_data))
    rows = []

    for i, row in enumerate(reader):
        if i >= MAX_CSV_ROWS:
            raise ValueError(f"CSV exceeds max {MAX_CSV_ROWS} rows")

        clean = {}
        for key, value in row.items():
            key = key.strip().lower()
            if key not in ALLOWED_FIELDS:
                continue  # Skip unknown columns

            value = str(value).strip()

            # Block formula injection (CSV injection attack)
            if value and value[0] in ('=', '+', '-', '@', '\t', '\r'):
                value = "'" + value  # Neutralize formula

            # HTML escape
            value = escape(value)

            # Length limit
            if len(value) > MAX_FIELD_LENGTH:
                value = value[:MAX_FIELD_LENGTH]

            clean[key] = value

        # Validate required fields
        if "phone" not in clean or not clean["phone"]:
            continue  # Skip rows without phone

        clean["phone"] = validate_phone(clean["phone"])
        rows.append(clean)

    return rows
```

### 6.3 Webhook Payload Validation

```python
from pydantic import BaseModel, validator
from typing import Optional

class ToolCallPayload(BaseModel):
    call_id: str
    name: str
    args: dict

    @validator("name")
    def valid_function_name(cls, v):
        allowed = {"lookup_programme", "get_objection_response", "log_call_outcome"}
        if v not in allowed:
            raise ValueError(f"Unknown function: {v}")
        return v

    @validator("call_id")
    def valid_call_id(cls, v):
        if not v or len(v) > 100:
            raise ValueError("Invalid call_id")
        return v

class WebhookPayload(BaseModel):
    event: str
    call: Optional[dict] = None

    @validator("event")
    def valid_event(cls, v):
        allowed = {"call_started", "call_ended", "call_analyzed"}
        if v not in allowed:
            raise ValueError(f"Unknown event: {v}")
        return v
```

### 6.4 WhatsApp Reply Sanitization
```python
def sanitize_whatsapp_reply(text: str) -> str:
    text = text.strip()
    if len(text) > 500:
        text = text[:500]
    text = re.sub(r'https?://\S+', '[link removed]', text)
    text = re.sub(r'[{}\[\]<>]', '', text)
    return text
```

### 6.5 Email Address Validation
```python
EMAIL_PATTERN = re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')

def validate_email(email: str) -> str:
    email = email.strip().lower()
    if not EMAIL_PATTERN.match(email):
        raise ValueError(f"Invalid email: {email}")
    if len(email) > 254:
        raise ValueError("Email too long")
    return email
```

---

## 7. NETWORK SECURITY

### 7.1 HTTPS Everywhere

```
RULE: All endpoints MUST be served over HTTPS. No HTTP.

- Webhook backend: Deploy behind HTTPS (Cloud Run provides this automatically,
  or use Caddy/nginx with Let's Encrypt on VPS)
- Dashboard: Serve over HTTPS
- Supabase: Already HTTPS
- n8n: Must be behind HTTPS reverse proxy
- Retell API: Already HTTPS

Test: curl -I http://your-endpoint.com should redirect to https:// or fail
```

### 7.2 Firewall Rules (VPS)

```bash
# UFW rules for Hostinger VPS
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 80/tcp      # HTTP (redirect to HTTPS)
sudo ufw allow 443/tcp     # HTTPS
sudo ufw deny 5678/tcp     # n8n — only accessible via reverse proxy
sudo ufw deny 8000/tcp     # FastAPI — only accessible via reverse proxy
sudo ufw enable
```

### 7.3 IP Allowlisting (Production)

For webhook endpoints, restrict to known Retell IP ranges:

```python
RETELL_IP_RANGES = [
    # Add Retell's published IP ranges here
    # Check docs.retellai.com for current ranges
]

async def check_ip_allowlist(request: Request):
    """Restrict webhook access to known Retell IPs."""
    client_ip = request.client.host
    # Implement IP range checking
    # For now, rely on webhook signature verification (Section 2.1)
```

---

## 8. TELEPHONY SECURITY

### 8.1 Toll Fraud Prevention

```python
# Max concurrent calls — prevent runaway dialer
MAX_CONCURRENT_CALLS = 1  # For cold calling, always 1

# Max calls per day — financial safety net
MAX_DAILY_CALLS = 200

# Blocked destinations — prevent international toll fraud
BLOCKED_PREFIXES = [
    "+900",   # Premium rate (Turkey)
    "+906",   # Premium (Italy)
    "+118",   # Premium (UK)
    "+1900",  # Premium (US)
    "+979",   # International premium rate
]

def is_safe_destination(phone: str) -> bool:
    for prefix in BLOCKED_PREFIXES:
        if phone.startswith(prefix):
            return False
    return True

async def check_daily_limit(supabase) -> bool:
    today_count = supabase.table("call_logs") \
        .select("count") \
        .gte("started_at", datetime.utcnow().date().isoformat()) \
        .execute()
    return (today_count.count or 0) < MAX_DAILY_CALLS
```

### 8.2 Do-Not-Call Compliance

```python
# CRITICAL: Never call a lead marked do_not_contact
# Check BEFORE every call initiation

async def pre_call_check(supabase, lead_id: str) -> bool:
    lead = supabase.table("leads").select("status, phone").eq("id", lead_id).single().execute()

    if lead.data["status"] == "do_not_contact":
        return False

    if lead.data["status"] == "declined":
        return False

    if not is_safe_destination(lead.data["phone"]):
        return False

    return True
```

### 8.3 WhatsApp Anti-Spam Compliance
- Max 30 outreach messages per hour
- Never send more than 1 message to same number in 24 hours
- If lead replies "stop" or "unsubscribe", immediately set do_not_contact=true
- Log every outbound WhatsApp in pipeline_logs

---

## 9. LOGGING AND AUDIT TRAIL

### 9.1 What to Log

```python
# Log to pipeline_logs for every significant action
AUDIT_EVENTS = [
    "call_initiated",
    "call_completed",
    "call_failed",
    "lead_status_changed",
    "lead_imported",
    "lead_deleted",
    "payment_email_sent",
    "dialer_started",
    "dialer_stopped",
    "webhook_received",
    "webhook_rejected",
    "auth_failed",
    "rate_limit_hit",
    "secret_rotation",
]
```

### 9.2 What NEVER to Log

```
NEVER log in plaintext:
  - Full API keys or tokens
  - Full credit card numbers
  - Passwords or hashes
  - Full phone numbers in non-secured tables (mask as +234****1234)

NEVER log to stdout in production:
  - Call transcripts (contain PII)
  - Lead personal details
  - Webhook payloads containing PII
```

### 9.3 Structured Logging

```python
import logging
import json
from datetime import datetime

class SecureLogger:
    def __init__(self, component: str):
        self.component = component
        self.logger = logging.getLogger(component)

    def log(self, event: str, lead_id: str = None, **kwargs):
        entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "component": self.component,
            "event": event,
            "lead_id": lead_id,
            **kwargs,
        }
        # Mask any phone numbers in kwargs
        for key, val in entry.items():
            if isinstance(val, str) and val.startswith("+") and len(val) > 8:
                entry[key] = val[:4] + "****" + val[-4:]

        self.logger.info(json.dumps(entry))
```

---

## 10. ERROR HANDLING

### 10.1 Never Expose Internal Errors

```python
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    # Log the real error internally
    logger.error(f"Unhandled error: {exc}", exc_info=True)

    # Return sanitized error to client
    return JSONResponse(
        status_code=500,
        content={"error": "Internal server error"},  # No stack trace
    )

# NEVER return:
# {"error": str(exc)}  — may contain file paths, DB details, keys
# {"error": traceback.format_exc()}  — full stack trace
```

### 10.2 Graceful Tool Failures

```python
async def execute_tool(name: str, args: dict, call_id: str) -> str:
    """Execute a tool call. On failure, return a graceful message for Sarah."""
    try:
        result = await TOOL_HANDLERS[name](args)
        return json.dumps(result)
    except Exception as e:
        logger.error(f"Tool {name} failed for call {call_id}: {e}")
        # Return a message Sarah can speak naturally
        return json.dumps({
            "result": "I don't have that information right now. "
                      "Let me have someone on the team follow up with you on that."
        })
```

---

## 11. DEPENDENCY SECURITY

### 11.1 Pin Dependencies

```
# requirements.txt — always pin exact versions
retell-sdk==4.12.0
fastapi==0.115.0
uvicorn==0.32.0
supabase==2.10.0
httpx==0.27.0
python-dotenv==1.0.1
resend==2.5.0
slowapi==0.1.9
pydantic==2.9.0
```

### 11.2 Vulnerability Scanning

```bash
# Run before every deployment
pip install pip-audit
pip-audit --strict

# If vulnerabilities found:
pip-audit --fix --dry-run  # Preview fixes
pip-audit --fix             # Apply fixes
```

### 11.3 Update Schedule

Check for updates weekly:
```bash
pip list --outdated
```

---

## 12. DEPLOYMENT SECURITY

### 12.1 Environment Isolation

```
DEVELOPMENT:
  - Runs on localhost
  - Uses test Retell agent (separate from production)
  - Uses separate Supabase project or schema
  - Test phone numbers only (your own number)

PRODUCTION:
  - Runs on VPS or Cloud Run behind HTTPS
  - Production Retell agent
  - Production Supabase with RLS enabled
  - Real lead phone numbers
  - All security controls enforced
```

### 12.2 Docker Security (if containerised)

```dockerfile
# Run as non-root user
FROM python:3.12-slim
RUN adduser --disabled-password --gecos "" appuser
USER appuser
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

# NEVER:
# RUN as root
# COPY .env into the image
# Expose unnecessary ports
```

---

## 13. SECURITY CHECKLIST (Run Before Every Deploy)

```
[ ] No secrets in any tracked file (run pre-commit hook)
[ ] .env.example updated with any new variables
[ ] .gitignore includes .env and all secret patterns
[ ] Webhook signature verification enabled
[ ] CORS restricted to known origins (not "*")
[ ] Rate limiting active on all public endpoints
[ ] Dashboard requires authentication
[ ] Supabase RLS enabled on all tables
[ ] HTTPS enforced on all endpoints
[ ] Phone number validation on all imports
[ ] CSV import sanitization active
[ ] Daily call limit configured
[ ] Do-not-call check runs before every call
[ ] Error handler returns sanitized messages (no stack traces)
[ ] Dependencies pinned and audited
[ ] pip-audit shows no critical vulnerabilities
[ ] Firewall rules applied on VPS
[ ] Logs do not contain full phone numbers or API keys
[ ] OpenClaw API not exposed to public internet
[ ] Cal.com webhook signature verification enabled
[ ] WhatsApp outreach rate limited to 30/hour
[ ] WhatsApp opt-out ("stop") handling implemented
[ ] Email validation on save_email tool
[ ] WhatsApp reply text sanitized before AI parsing
[ ] OpenClaw and Cal.com API keys in .env (not hardcoded)
```

---

## 14. INCIDENT RESPONSE

If a security incident occurs:

1. **Credential Leak** — Immediately rotate all keys. Check Git history for exposure. Revoke old keys in respective dashboards.
2. **Unauthorized Access** — Disable affected endpoint. Review audit logs. Rotate affected credentials. Investigate source.
3. **Data Breach** — Stop the auto-dialer. Assess scope. Notify affected parties if PII exposed. Document timeline.
4. **Toll Fraud** — Disable outbound calling immediately. Check Retell and Twilio dashboards for unauthorized calls. Set spending limits.
5. **WhatsApp Account Ban** — Stop all outbound messages immediately. Review message templates. Contact WhatsApp Business support. Reduce sending rate. Never resume until restored.

Emergency contacts:
- Retell support: support@retellai.com
- Twilio support: console → Support
- Supabase support: dashboard → Support