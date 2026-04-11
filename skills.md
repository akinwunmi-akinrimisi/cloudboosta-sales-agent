# skills.md — Technical Patterns Reference (v2)
## Retell AI, Supabase, n8n, Dashboard, Auto-Dialer

---

## RETELL AI SDK PATTERNS

### Installation
```bash
pip install retell-sdk python-dotenv
```

### Client Init
```python
import os
from retell import Retell
client = Retell(api_key=os.environ["RETELL_API_KEY"])
```

### Create LLM
```python
llm = client.llm.create(
    model="gpt-4o-mini",
    general_prompt="<system prompt>",
    general_tools=[{
        "type": "custom",
        "name": "lookup_programme",
        "description": "Look up Cloudboosta programme details",
        "parameters": {
            "type": "object",
            "properties": {
                "experience_level": {"type": "string", "description": "beginner, intermediate, advanced"}
            },
            "required": ["experience_level"]
        },
        "url": os.environ["WEBHOOK_BASE_URL"] + "/retell/tool",
        "speak_during_execution": True,
        "speak_after_execution": True,
    }],
    starting_message="Hi {{lead_name}}, this is John calling from Cloudboosta. I help professionals transition into cloud and DevOps careers. Do you have 2 minutes for a quick chat?",
)
```

### Create Agent
```python
agent = client.agent.create(
    agent_name="John - Cloudboosta",
    response_engine={"type": "retell-llm", "llm_id": llm.llm_id},
    voice_id="<british_female_voice_id>",
    language="en-GB",
    voice_speed=1.0,
    voice_temperature=0.8,
    responsiveness=0.9,
    interruption_sensitivity=0.8,
    enable_backchannel=True,
    backchannel_frequency=0.8,
    backchannel_words=["yeah", "uh-huh", "I see", "right", "absolutely"],
    reminder_trigger_ms=10000,
    reminder_max_count=2,
    webhook_url=os.environ["WEBHOOK_BASE_URL"] + "/retell/webhook",
    webhook_events=["call_started", "call_ended", "call_analyzed"],
)
```

### List Voices
```python
for v in client.voice.list():
    if "en" in (v.language or ""):
        print(f"{v.voice_id}: {v.voice_name} ({v.gender}, {v.provider})")
```

### Import Twilio Number
```python
number = client.phone_number.import_twilio(
    phone_number="+11615700419",
    twilio_account_sid=os.environ["TWILIO_ACCOUNT_SID"],
    twilio_auth_token=os.environ["TWILIO_AUTH_TOKEN"],
    inbound_agent_id=agent.agent_id,
    outbound_agent_id=agent.agent_id,
)
```

### Trigger Outbound Call
```python
call = client.call.create_phone_call(
    from_number="+11615700419",
    to_number=lead["phone"],
    agent_id=os.environ["RETELL_AGENT_ID"],
    retell_llm_dynamic_variables={
        "lead_name": lead["name"],
        "lead_location": lead.get("location", "unknown"),
    },
)
```

### Webhook Payloads
```python
# call_ended webhook body:
{
    "event": "call_ended",
    "call": {
        "call_id": "call_xxx",
        "duration_ms": 322233,
        "transcript": "Agent: Hi...\nUser: Yes...",
        "recording_url": "https://...",
        "disconnection_reason": "agent_hangup",
        "call_analysis": {"call_summary": "...", "user_sentiment": "positive"},
        "retell_llm_dynamic_variables": {"lead_name": "John"},
    }
}

# Tool call webhook body:
{"call_id": "call_xxx", "name": "lookup_programme", "args": {"experience_level": "beginner"}}
# Response: {"result": "Cloud Computing: 8 weeks, £1,350 early bird..."}
```

---

## SUPABASE SCHEMAS

### leads
```sql
CREATE TABLE leads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    email TEXT,
    location TEXT,
    country TEXT,
    currency TEXT DEFAULT 'GBP',
    status TEXT DEFAULT 'new' CHECK (status IN (
        'new', 'queued', 'calling', 'in_call', 'committed', 'follow_up',
        'declined', 'no_answer', 'voicemail', 'busy', 'invalid_number',
        'exhausted', 'payment_pending', 'enrolled', 'do_not_contact'
    )),
    experience_level TEXT,
    has_aws_sa_cert BOOLEAN DEFAULT FALSE,
    has_hands_on_projects BOOLEAN DEFAULT FALSE,
    current_role TEXT,
    motivation TEXT,
    programme_recommended TEXT,
    last_call_id TEXT,
    last_call_at TIMESTAMPTZ,
    call_count INTEGER DEFAULT 0,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 2,
    last_strategy_used TEXT,
    detected_persona TEXT,
    follow_up_at TIMESTAMPTZ,
    outcome TEXT,
    decline_reason TEXT,
    source TEXT DEFAULT 'csv_import',
    priority INTEGER DEFAULT 0,
    notes TEXT
);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_queued ON leads(status, priority) WHERE status = 'queued';
```

### call_logs
```sql
CREATE TABLE call_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    lead_id UUID REFERENCES leads(id),
    retell_call_id TEXT UNIQUE,
    direction TEXT DEFAULT 'outbound',
    from_number TEXT,
    to_number TEXT,
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    duration_ms INTEGER,
    transcript TEXT,
    recording_url TEXT,
    summary TEXT,
    outcome TEXT CHECK (outcome IN ('COMMITTED','FOLLOW_UP','DECLINED','NO_ANSWER','VOICEMAIL','BUSY','ERROR')),
    programme_recommended TEXT,
    objections_raised TEXT[],
    follow_up_date TIMESTAMPTZ,
    closing_strategy_used TEXT,
    lead_persona TEXT,
    sentiment TEXT,
    disconnection_reason TEXT
);
CREATE INDEX idx_call_logs_lead ON call_logs(lead_id);
CREATE INDEX idx_call_logs_strategy ON call_logs(closing_strategy_used, lead_persona);
```

### dial_schedules
```sql
CREATE TABLE dial_schedules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    name TEXT NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    timezone TEXT DEFAULT 'Africa/Lagos',
    days_of_week INTEGER[] DEFAULT '{1,2,3,4,5}',
    calls_per_hour INTEGER DEFAULT 30,
    is_active BOOLEAN DEFAULT TRUE,
    max_retries INTEGER DEFAULT 2
);
```

### pipeline_logs
```sql
CREATE TABLE pipeline_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    lead_id UUID REFERENCES leads(id),
    component TEXT NOT NULL,
    event TEXT NOT NULL,
    status TEXT DEFAULT 'success',
    details JSONB,
    error_message TEXT
);
```

### Views
```sql
-- Pipeline snapshot
CREATE VIEW pipeline_snapshot AS
SELECT status, COUNT(*) as count FROM leads GROUP BY status ORDER BY count DESC;

-- Strategy performance
CREATE VIEW strategy_performance AS
SELECT closing_strategy_used, lead_persona,
    COUNT(*) as total_calls,
    COUNT(*) FILTER (WHERE outcome = 'COMMITTED') as commitments,
    ROUND(COUNT(*) FILTER (WHERE outcome = 'COMMITTED')::DECIMAL / NULLIF(COUNT(*), 0) * 100, 1) as conversion_pct
FROM call_logs WHERE closing_strategy_used IS NOT NULL
GROUP BY closing_strategy_used, lead_persona ORDER BY conversion_pct DESC;

-- Today's calls
CREATE VIEW todays_calls AS
SELECT * FROM call_logs WHERE started_at::DATE = CURRENT_DATE ORDER BY started_at DESC;

-- Ready to call
CREATE VIEW leads_ready_to_call AS
SELECT * FROM leads WHERE status = 'queued' ORDER BY priority DESC, created_at ASC;
```

---

## AUTO-DIALER PATTERN

```python
import asyncio
from datetime import datetime, time
import pytz

async def should_dial_now(supabase) -> bool:
    """Check if current time is within an active dial schedule."""
    schedules = supabase.table("dial_schedules").select("*").eq("is_active", True).execute()
    now = datetime.now(pytz.timezone("Africa/Lagos"))
    current_time = now.time()
    current_dow = now.isoweekday()
    for s in schedules.data:
        start = time.fromisoformat(s["start_time"])
        end = time.fromisoformat(s["end_time"])
        if start <= current_time <= end and current_dow in s["days_of_week"]:
            return True
    return False

async def get_next_lead(supabase) -> dict | None:
    """Get the next lead to call from the queue."""
    result = supabase.table("leads").select("*").eq("status", "queued") \
        .order("priority", desc=True).order("created_at").limit(1).execute()
    return result.data[0] if result.data else None

async def is_call_active(supabase) -> bool:
    """Check if there's already a call in progress."""
    result = supabase.table("leads").select("id") \
        .in_("status", ["calling", "in_call"]).limit(1).execute()
    return len(result.data) > 0
```

---

## RESEND EMAIL PATTERN (replaces OpenClaw)

```python
import resend
resend.api_key = os.environ["RESEND_API_KEY"]

def send_payment_email(lead_name: str, lead_email: str, programme: str):
    resend.Emails.send({
        "from": "John <academy@cloudboosta.co.uk>",
        "to": lead_email,
        "subject": f"Cloudboosta — Payment Details for {programme}",
        "html": f"<p>Hi {lead_name},</p><p>Thank you for your interest in {programme}...</p>",
    })
```

---

## ENVIRONMENT VARIABLES

```
RETELL_API_KEY=
RETELL_AGENT_ID=
RETELL_LLM_ID=
SUPABASE_URL=https://supabase.operscale.cloud
SUPABASE_SERVICE_KEY=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_NUMBER=+11615700419
RESEND_API_KEY=
WEBHOOK_BASE_URL=https://your-endpoint.com
N8N_BASE_URL=https://n8n.srv1297445.hstgr.cloud
```

---

## OPENCLAW / EVOLUTION API PATTERNS

### Send WhatsApp Message
```python
import httpx

OPENCLAW_URL = os.environ["OPENCLAW_API_URL"]
OPENCLAW_KEY = os.environ["OPENCLAW_API_KEY"]
INSTANCE = "cloudboosta"

async def send_whatsapp(phone: str, text: str):
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{OPENCLAW_URL}/message/sendText/{INSTANCE}",
            headers={"apikey": OPENCLAW_KEY},
            json={"number": phone.replace("+", ""), "text": text},
        )
        response.raise_for_status()
        return response.json()
```

### Check WhatsApp Registration
```python
async def check_whatsapp_number(phone: str) -> bool:
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{OPENCLAW_URL}/chat/whatsappNumbers/{INSTANCE}",
            headers={"apikey": OPENCLAW_KEY},
            json={"numbers": [phone.replace("+", "")]},
        )
        data = response.json()
        return bool(data and data[0].get("exists", False))
```

### Receive WhatsApp Webhook
```python
# OpenClaw sends webhooks on incoming messages:
# Extract phone: strip @s.whatsapp.net, prepend +
phone = "+" + data["key"]["remoteJid"].split("@")[0]
text = data["message"].get("conversation", "")
```

---

## CAL.COM API PATTERNS

### Get Available Slots
```python
CAL_URL = os.environ["CAL_COM_URL"]
CAL_KEY = os.environ["CAL_COM_API_KEY"]

async def get_available_slots(date: str):
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{CAL_URL}/api/v1/slots/available",
            headers={"Authorization": f"Bearer {CAL_KEY}"},
            params={"startTime": f"{date}T00:00:00Z", "endTime": f"{date}T23:59:59Z"},
        )
        return response.json()
```

---

## AI DATETIME PARSING PATTERN

For n8n: Parse free-text time into ISO DateTime using OpenRouter (Claude Haiku):

System prompt: "You are a datetime parser. Extract date and time from a lead's message about scheduling a phone call. Today is {{now}}. Return JSON: {\"datetime\": \"ISO-8601\", \"confidence\": \"high|medium|low\"}"

Examples:
- "Tuesday 3pm" → {"datetime": "2026-04-01T15:00:00+01:00", "confidence": "high"}
- "next week sometime" → {"datetime": null, "confidence": "low"}

---

## TIMEZONE DERIVATION PATTERN

```python
COUNTRY_CODE_TO_TIMEZONE = {
    "44": "Europe/London", "234": "Africa/Lagos", "1": "America/New_York",
    "353": "Europe/Dublin", "233": "Africa/Accra", "254": "Africa/Nairobi",
    "27": "Africa/Johannesburg", "49": "Europe/Berlin", "33": "Europe/Paris",
    "971": "Asia/Dubai", "91": "Asia/Kolkata",
}

def derive_timezone(phone: str) -> str:
    phone = phone.lstrip("+")
    for code, tz in sorted(COUNTRY_CODE_TO_TIMEZONE.items(), key=lambda x: -len(x[0])):
        if phone.startswith(code):
            return tz
    return "UTC"
```

---

## CONTEXT INJECTION PATTERN

```python
async def build_call_context(supabase, lead_id: str) -> dict:
    lead = supabase.table("leads").select("*").eq("id", lead_id).single().execute()
    calls = supabase.table("call_logs").select("*").eq("lead_id", lead_id).order("started_at", desc=True).limit(5).execute()

    previous_summaries = []
    for c in (calls.data or []):
        previous_summaries.append({
            "date": c.get("started_at", "")[:10],
            "summary": c.get("summary", ""),
            "programme": c.get("programme_recommended", ""),
            "outcome": c.get("outcome", ""),
        })

    return {
        "lead_name": lead.data.get("name", ""),
        "lead_email": lead.data.get("email", ""),
        "has_email": str(bool(lead.data.get("email"))).lower(),
        "contact_method": lead.data.get("contact_method", "cold_call"),
        "previous_calls": json.dumps(previous_summaries) if previous_summaries else "[]",
        "is_follow_up": str(len(previous_summaries) > 0).lower(),
    }
```
