# MERGE: skills.md
## Type: Add new pattern sections
## Priority: Medium — reference patterns for new integrations

### Claude Code Prompt
```
Read skills.md in full. Add the following NEW sections at the end,
after the existing Retell/Supabase/n8n patterns. Do not modify existing content.

---

## OPENCLAW / EVOLUTION API PATTERNS

### Send WhatsApp Message
```python
import httpx

OPENCLAW_URL = os.environ["OPENCLAW_API_URL"]
OPENCLAW_KEY = os.environ["OPENCLAW_API_KEY"]
INSTANCE = "cloudboosta"  # your Evolution instance name

async def send_whatsapp(phone: str, text: str):
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{OPENCLAW_URL}/message/sendText/{INSTANCE}",
            headers={"apikey": OPENCLAW_KEY},
            json={
                "number": phone.replace("+", ""),
                "text": text,
            },
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
{
    "event": "messages.upsert",
    "instance": "cloudboosta",
    "data": {
        "key": {"remoteJid": "2348012345678@s.whatsapp.net"},
        "message": {"conversation": "Tuesday 3pm works for me"},
        "messageTimestamp": "1711234567"
    }
}

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

### Cal.com Webhook Payload (BOOKING_CREATED)
```json
{
    "triggerEvent": "BOOKING_CREATED",
    "payload": {
        "title": "Cloudboosta Advisory Call",
        "startTime": "2026-04-02T15:00:00.000Z",
        "endTime": "2026-04-02T15:15:00.000Z",
        "attendees": [
            {"email": "lead@email.com", "name": "David Smith", "timeZone": "Europe/London"}
        ],
        "organizer": {"email": "john@cloudboosta.co.uk"}
    }
}
```

---

## AI DATETIME PARSING PATTERN (for WhatsApp replies)

### n8n: Parse Free-Text Time into ISO DateTime
```
Use OpenRouter (Claude Haiku) in n8n to parse natural language times:

System prompt:
"You are a datetime parser. The user will give you a message from a lead
who is suggesting a time for a phone call. Extract the date and time.
Today's date is {{$now.format('YYYY-MM-DD')}}. The lead's timezone is
{{$json.timezone}}. Return ONLY a JSON object: 
{\"datetime\": \"ISO-8601\", \"confidence\": \"high|medium|low\"}
If you cannot determine a datetime, return {\"datetime\": null, \"confidence\": \"none\"}"

User message: "{{$json.message_text}}"

Examples:
  "Tuesday 3pm" → {"datetime": "2026-04-01T15:00:00+01:00", "confidence": "high"}
  "next week sometime" → {"datetime": null, "confidence": "low"}
  "tomorrow morning" → {"datetime": "2026-03-31T10:00:00+01:00", "confidence": "medium"}
```

---

## TIMEZONE DERIVATION PATTERN

```python
COUNTRY_CODE_TO_TIMEZONE = {
    "44": "Europe/London",
    "234": "Africa/Lagos",
    "1": "America/New_York",
    "353": "Europe/Dublin",
    "233": "Africa/Accra",
    "254": "Africa/Nairobi",
    "27": "Africa/Johannesburg",
    "49": "Europe/Berlin",
    "33": "Europe/Paris",
    "971": "Asia/Dubai",
    "91": "Asia/Kolkata",
}

def derive_timezone(phone: str) -> str:
    phone = phone.lstrip("+")
    for code, tz in sorted(COUNTRY_CODE_TO_TIMEZONE.items(), key=lambda x: -len(x[0])):
        if phone.startswith(code):
            return tz
    return "UTC"
```

---

## CONTEXT INJECTION PATTERN (for Retell dynamic variables)

```python
async def build_call_context(supabase, lead_id: str) -> dict:
    """Build dynamic variables for Retell call with full lead context."""
    lead = supabase.table("leads").select("*").eq("id", lead_id).single().execute()
    
    # Get previous calls
    calls = supabase.table("call_logs").select("*") \
        .eq("lead_id", lead_id) \
        .order("started_at", desc=True) \
        .limit(5).execute()
    
    previous_summaries = []
    for c in (calls.data or []):
        previous_summaries.append({
            "date": c.get("started_at", "")[:10],
            "summary": c.get("summary", ""),
            "programme": c.get("programme_recommended", ""),
            "objections": c.get("objections_raised", []),
            "outcome": c.get("outcome", ""),
        })
    
    return {
        "lead_name": f"{lead.data.get('first_name', '')} {lead.data.get('last_name', '')}".strip(),
        "lead_email": lead.data.get("email", "none"),
        "has_email": str(bool(lead.data.get("email"))).lower(),
        "contact_method": lead.data.get("contact_method", "cold_call"),
        "previous_calls": json.dumps(previous_summaries) if previous_summaries else "[]",
        "is_follow_up": str(len(previous_summaries) > 0).lower(),
    }
```

---

## ENVIRONMENT VARIABLES (additions)

Add to .env.example:
```
# OpenClaw / Evolution API (VPS #2)
OPENCLAW_API_URL=http://your-vps2-ip:8080
OPENCLAW_API_KEY=your_openclaw_api_key_here
OPENCLAW_INSTANCE=cloudboosta

# Cal.com (self-hosted)
CAL_COM_URL=https://cal.yourdomain.com
CAL_COM_API_KEY=your_cal_com_api_key_here
CAL_COM_WEBHOOK_SECRET=generate_random_32_chars
CAL_COM_EVENT_TYPE_ID=your_event_type_id_here
```

Commit message: "feat: skills.md — OpenClaw, Cal.com, AI datetime parsing,
timezone derivation, context injection patterns"
```
