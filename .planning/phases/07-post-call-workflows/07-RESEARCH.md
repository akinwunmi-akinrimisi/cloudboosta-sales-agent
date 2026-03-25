# Phase 7: Post-Call Workflows - Research

**Researched:** 2026-03-25
**Domain:** n8n workflow automation, MailerSend transactional email API, FastAPI BackgroundTasks
**Confidence:** HIGH (core stack), MEDIUM (n8n node versions), HIGH (MailerLite vs MailerSend clarification)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **MailerLite** replaces Resend for all transactional emails — From: akinwunmi.akinrimisi@cloudboosta.co.uk, API key: MAILERLITE_API_KEY in .env
- All 3 email types (payment, follow-up reminder, graceful close) use MailerLite
- Payment email is currency-specific: show bank details ONLY for lead's currency (GBP/EUR/USD/NGN)
- Bank details per currency: GBP (Revolut Account 89383123, Sort 23-01-20, IBAN GB63 REVO...), EUR (same IBAN, Intermediary CHASDEFX), USD (same IBAN, Intermediary CHASGB2L), NGN (GTBank 0631796979)
- Payment reference format: CB-[FullName]-[PathwayName]
- After payment email sent: update lead status from 'committed' to 'payment_sent'
- Follow-up reminder email: "We'll call you back on [date]. Looking forward to it." — only if lead has email
- Graceful close email: "Thanks for your time, door is always open, future cohorts available" — only if lead has email, no status change
- Post-call trigger: call_ended handler POSTs to N8N_WEBHOOK_BASE/post-call — payload: {outcome, lead_id, programme_recommended, currency, lead_email, lead_name, follow_up_date}
- Only fires for COMMITTED, FOLLOW_UP, DECLINED (not NO_ANSWER/voicemail/busy — those use retry logic)
- httpx.post with timeout=5s, fire-and-forget (must not block webhook response to Retell)
- n8n IF node routes by outcome: COMMITTED → payment email → update to payment_sent; FOLLOW_UP → reminder email; DECLINED → close email
- Workflows exported as execution/n8n/post-call-handler.json and execution/n8n/lead-import.json
- CSV import flow: Webhook Trigger → Spreadsheet node → Code node validate → Supabase check dedup → Supabase insert → return summary
- E.164 phone required for import, name required, email/location/country optional
- Invalid rows skipped but collected in error report

### Claude's Discretion
- n8n MailerLite node configuration vs HTTP Request to MailerLite API
- Email HTML template design
- Exact n8n workflow JSON structure and node wiring
- How to handle leads without email (skip email, log warning)
- Whether to use n8n MailerLite node or HTTP Request node for email sending

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUTO-02 | Post-call handler n8n workflow routing outcomes: COMMITTED -> payment email, FOLLOW_UP -> reschedule, DECLINED -> log | n8n Switch node for multi-outcome routing; MailerSend HTTP Request for email; Supabase node for status update |
| AUTO-03 | Lead import n8n workflow accepting CSV with E.164 phone validation and deduplication | n8n Webhook Trigger + Extract From File node (replaces Spreadsheet File) + Code node validation + Supabase node |
| AUTO-04 | Payment email via Resend API with bank transfer details (Revolut + GTBank) on COMMITTED outcome | CRITICAL: MailerLite does NOT send individual emails — must use MailerSend (their transactional service). HTTP Request node to POST https://api.mailersend.com/v1/email |
</phase_requirements>

---

## Summary

Phase 7 delivers three automation components: a post-call n8n workflow that routes call outcomes to the correct email action, a CSV lead import workflow, and the FastAPI call_ended hook that triggers n8n non-blocking.

**Critical discovery:** The CONTEXT.md specifies "MailerLite" as the email provider, but MailerLite does NOT support sending individual transactional emails. MailerLite is a marketing platform (subscriber management, campaigns). Their transactional email product is a separate service called **MailerSend** (mailersend.com). The MAILERLITE_API_KEY in .env almost certainly refers to a MailerSend API key. The n8n implementation should use an HTTP Request node calling `POST https://api.mailersend.com/v1/email` — there is no native n8n MailerSend node capable of sending emails, but the HTTP Request node pattern matches how the existing auto-dialer JSON calls the Retell/Supabase APIs.

**Primary recommendation:** Use n8n HTTP Request nodes for email sending (MailerSend API), n8n Switch node for 3-way outcome routing, FastAPI BackgroundTasks for the fire-and-forget n8n trigger, and the Extract From File node (not deprecated Spreadsheet File node) for CSV parsing.

---

## Standard Stack

### Core

| Library/Service | Version | Purpose | Why Standard |
|-----------------|---------|---------|--------------|
| MailerSend API | v1 | Transactional email sending | MailerLite's own transactional product; simple REST POST; 120 req/min |
| httpx | 0.27.0 (already pinned) | Fire-and-forget POST from FastAPI to n8n | Already in requirements.txt; supports async |
| FastAPI BackgroundTasks | 0.115.x (already pinned) | Non-blocking n8n webhook trigger | Native FastAPI; no extra dependencies; appropriate for lightweight I/O |
| n8n Webhook Trigger | built-in | Receive call_ended payload from backend | Established pattern from auto-dialer workflow |
| n8n Switch node | built-in | Route by COMMITTED/FOLLOW_UP/DECLINED | Better than IF for 3+ routes; supports fallback output |
| n8n HTTP Request | typeVersion 4.2 (matches auto-dialer) | Call MailerSend API + Supabase RPC | Consistent with auto-dialer JSON pattern |
| n8n Supabase node | typeVersion 1 (matches auto-dialer) | Update lead status (committed → payment_sent) | Established pattern from auto-dialer |
| n8n Extract From File | built-in (v1.21.0+) | Parse CSV binary to JSON rows | Replaces deprecated Spreadsheet File node |
| n8n Code node | typeVersion 2 | E.164 validation + error collection | Established pattern from auto-dialer (Check Dial Window uses Code node) |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| mailersend Python SDK | latest | Optional: if backend sends email directly | Only if n8n approach is abandoned; `pip install mailersend` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| n8n Switch node | Multiple IF nodes chained | Switch is cleaner for 3 routes; IF chains become hard to read |
| HTTP Request to MailerSend | n8n MailerLite node | MailerLite node only manages subscribers — it cannot send transactional emails |
| FastAPI BackgroundTasks | asyncio.create_task + httpx.AsyncClient | BackgroundTasks is simpler, built into FastAPI, no extra setup; sufficient for fire-and-forget |
| Extract From File node | Spreadsheet File node | Spreadsheet File is deprecated since n8n v1.21.0; Extract From File is the current replacement |

**Installation (backend changes only):**
```bash
# Replace resend with mailersend in requirements.txt
pip install mailersend
# Remove: resend==2.5.1
# Add: mailersend==1.0.0
```

---

## Architecture Patterns

### Recommended Project Structure (additions)

```
execution/
├── backend/
│   └── main.py              # Extend call_ended handler with n8n trigger
└── n8n/
    ├── auto-dialer.json     # Existing (Phase 6)
    ├── post-call-handler.json  # NEW: 3-route outcome workflow
    └── lead-import.json        # NEW: CSV import workflow
```

### Pattern 1: Fire-and-Forget n8n Trigger from FastAPI

**What:** After updating call_logs in call_ended, POST to n8n webhook without waiting for response.
**When to use:** Any time the Retell webhook must respond quickly (< 2s) but side effects are needed.
**How:** Use FastAPI `BackgroundTasks` — adds the HTTP call to run after the response is sent.

```python
# Source: FastAPI docs https://fastapi.tiangolo.com/tutorial/background-tasks/
import httpx
from fastapi import BackgroundTasks

N8N_WEBHOOK_BASE = os.environ.get("N8N_WEBHOOK_BASE", "")

async def trigger_post_call_workflow(payload: dict):
    """Fire-and-forget POST to n8n post-call webhook."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.post(
                f"{N8N_WEBHOOK_BASE}/post-call",
                json=payload,
            )
    except Exception as exc:
        logger.warning("n8n post-call trigger failed (non-critical): %s", exc)

# In call_ended handler, after DB operations:
# Only fire for outcomes that need email routing
OUTCOMES_REQUIRING_WORKFLOW = {"committed", "follow_up", "declined"}
if lead_id and new_lead_status in OUTCOMES_REQUIRING_WORKFLOW:
    lead_email = lead_row.data.get("email") if lead_row.data else None
    lead_name = lead_row.data.get("name", "") if lead_row.data else ""
    background_tasks.add_task(
        trigger_post_call_workflow,
        {
            "outcome": outcome,  # COMMITTED / FOLLOW_UP / DECLINED
            "lead_id": lead_id,
            "programme_recommended": programme,
            "currency": currency,
            "lead_email": lead_email,
            "lead_name": lead_name,
            "follow_up_date": follow_up_date,
        }
    )
```

**Note:** The call_ended endpoint signature must accept `background_tasks: BackgroundTasks` from FastAPI injection. The existing handler is defined as `async def retell_webhook(request: Request)` — it needs `background_tasks: BackgroundTasks` added as a parameter.

### Pattern 2: n8n Switch Node for Outcome Routing

**What:** 3-way route on `{{ $json.body.outcome }}` value.
**When to use:** Any time a single payload must fan out to mutually exclusive branches.

```json
// Source: n8n Switch node documentation https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.switch/
{
  "name": "Route by Outcome",
  "type": "n8n-nodes-base.switch",
  "typeVersion": 3,
  "parameters": {
    "mode": "rules",
    "rules": {
      "values": [
        {
          "conditions": {
            "conditions": [
              {
                "leftValue": "={{ $json.body.outcome }}",
                "rightValue": "COMMITTED",
                "operator": { "type": "string", "operation": "equals" }
              }
            ]
          },
          "outputKey": "0"
        },
        {
          "conditions": {
            "conditions": [
              {
                "leftValue": "={{ $json.body.outcome }}",
                "rightValue": "FOLLOW_UP",
                "operator": { "type": "string", "operation": "equals" }
              }
            ]
          },
          "outputKey": "1"
        },
        {
          "conditions": {
            "conditions": [
              {
                "leftValue": "={{ $json.body.outcome }}",
                "rightValue": "DECLINED",
                "operator": { "type": "string", "operation": "equals" }
              }
            ]
          },
          "outputKey": "2"
        }
      ]
    },
    "fallbackOutput": "none"
  }
}
```

### Pattern 3: MailerSend Email via HTTP Request Node

**What:** POST to MailerSend API to send a single transactional email.
**Endpoint:** `POST https://api.mailersend.com/v1/email`
**Auth:** `Authorization: Bearer {{ $env.MAILERLITE_API_KEY }}` (env var name as specified in CONTEXT.md)
**Response:** 202 Accepted on success; `x-message-id` header for tracking.

```json
// Source: MailerSend API docs https://developers.mailersend.com/api/v1/email
{
  "name": "Send Payment Email",
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.2,
  "parameters": {
    "method": "POST",
    "url": "https://api.mailersend.com/v1/email",
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        { "name": "Authorization", "value": "Bearer {{ $env.MAILERLITE_API_KEY }}" },
        { "name": "Content-Type", "value": "application/json" }
      ]
    },
    "sendBody": true,
    "specifyBody": "json",
    "jsonBody": "={{ JSON.stringify({ from: { email: 'akinwunmi.akinrimisi@cloudboosta.co.uk', name: 'Sarah from Cloudboosta' }, to: [{ email: $('Webhook Trigger').item.json.body.lead_email, name: $('Webhook Trigger').item.json.body.lead_name }], subject: 'Your Cloudboosta Enrolment Details', html: $('Build Payment Email').item.json.html }) }}"
  }
}
```

### Pattern 4: Check Email Exists Before Sending (IF Node)

**What:** Gate email sending behind a check that `lead_email` is non-null/non-empty.
**Why:** CONTEXT.md specifies emails only sent if lead has email address.

```json
{
  "name": "Has Email?",
  "type": "n8n-nodes-base.if",
  "typeVersion": 2,
  "parameters": {
    "conditions": {
      "conditions": [
        {
          "leftValue": "={{ $json.body.lead_email }}",
          "rightValue": "",
          "operator": { "type": "string", "operation": "notEmpty" }
        }
      ]
    }
  }
}
```

### Pattern 5: Currency-Specific Email Body via Code Node

**What:** Build HTML payment email body in a Code node, branching by currency.
**Why:** Payment email must show ONLY the bank details for the lead's currency.

```javascript
// n8n Code node (typeVersion 2)
const payload = $('Webhook Trigger').item.json.body;
const currency = payload.currency || 'GBP';
const leadName = payload.lead_name || 'there';
const programme = payload.programme_recommended || 'Cloudboosta Programme';
const reference = `CB-${leadName.replace(/\s+/g, '')}-${programme.replace(/\s+/g, '')}`;

const bankDetails = {
  GBP: `
    <p><strong>Bank:</strong> Revolut</p>
    <p><strong>Account Number:</strong> 89383123</p>
    <p><strong>Sort Code:</strong> 23-01-20</p>
    <p><strong>IBAN:</strong> GB63 REVO 2301 2089 3831 23</p>
    <p><strong>BIC/SWIFT:</strong> REVOGB21</p>
    <p><strong>Intermediary Bank:</strong> CHASGB2L</p>`,
  EUR: `
    <p><strong>Bank:</strong> Revolut</p>
    <p><strong>IBAN:</strong> GB63 REVO 2301 2089 3831 23</p>
    <p><strong>BIC/SWIFT:</strong> REVOGB21</p>
    <p><strong>Intermediary Bank:</strong> CHASDEFX</p>`,
  USD: `
    <p><strong>Bank:</strong> Revolut</p>
    <p><strong>IBAN:</strong> GB63 REVO 2301 2089 3831 23</p>
    <p><strong>BIC/SWIFT:</strong> REVOGB21</p>
    <p><strong>Intermediary Bank:</strong> CHASGB2L</p>`,
  NGN: `
    <p><strong>Bank:</strong> Guaranty Trust Bank (GTBank)</p>
    <p><strong>Account Number:</strong> 0631796979</p>`,
};

const html = `
<p>Hi ${leadName},</p>
<p>Congratulations on taking this step! Here are your payment details for <strong>${programme}</strong>:</p>
<h3>Bank Transfer Details (${currency})</h3>
${bankDetails[currency] || bankDetails['GBP']}
<p><strong>Payment Reference:</strong> ${reference}</p>
<h3>Next Steps</h3>
<ul>
  <li>Send proof of payment to <a href="mailto:support@cloudboosta.co.uk">support@cloudboosta.co.uk</a></li>
  <li>Receive login credentials within 24 hours</li>
  <li>Join the WhatsApp group</li>
  <li>Programme starts: <strong>April 25, 2026</strong></li>
</ul>
<p>Questions? WhatsApp us: +44 7592 233052 / +44 7565 707254</p>
<p>Looking forward to seeing you in the programme!</p>
<p>Sarah<br>Cloudboosta Team</p>`;

return [{ json: { html, reference } }];
```

### Pattern 6: Extract From File (CSV) + Code Validation

**What:** Parse CSV binary to JSON rows; validate each row; collect errors.
**Node:** `n8n-nodes-base.extractFromFile` (typeVersion 1) — NOT the deprecated Spreadsheet File node.

```json
// Extract From File node
{
  "name": "Parse CSV",
  "type": "n8n-nodes-base.extractFromFile",
  "typeVersion": 1,
  "parameters": {
    "operation": "csv",
    "options": {}
  }
}
```

```javascript
// Code node: E.164 validation and dedup prep
const E164_REGEX = /^\+[1-9]\d{6,14}$/;
const valid = [];
const errors = [];

for (const item of $input.all()) {
  const row = item.json;
  const phone = (row.phone || '').trim();
  const name = (row.name || '').trim();

  if (!phone || !E164_REGEX.test(phone)) {
    errors.push({ row, reason: 'Invalid or missing E.164 phone' });
    continue;
  }
  if (!name) {
    errors.push({ row, reason: 'Missing name' });
    continue;
  }

  valid.push({
    json: {
      phone,
      name,
      email: (row.email || '').trim() || null,
      location: (row.location || '').trim() || null,
      country: (row.country || '').trim() || null,
      status: 'new',
      source: 'csv_import',
    }
  });
}

// Pass errors as item metadata for summary
return valid.map(v => ({ ...v, json: { ...v.json, _errors: errors } }));
```

### Anti-Patterns to Avoid

- **Blocking the Retell webhook:** Never `await` the n8n trigger inside the Retell webhook response path. Retell times out the webhook at ~5s; a slow n8n call will cause Retell to retry. Use `BackgroundTasks`.
- **Using MailerLite node for email sending:** The n8n MailerLite built-in node manages subscribers only — it cannot send individual emails. Use HTTP Request to MailerSend API.
- **Using deprecated Spreadsheet File node:** Since n8n v1.21.0 it is replaced by Extract From File. Using the old node will fail on modern n8n instances.
- **Sending email to leads without an email field:** The leads table may have null emails. Always gate on `lead_email` non-null before attempting to send.
- **Blocking Supabase update on email delivery:** Email delivery is async (MailerSend returns 202). Update lead status to `payment_sent` after the POST succeeds (202), not after email is confirmed delivered.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Transactional email delivery | Custom SMTP logic, Resend integration | MailerSend HTTP Request (`POST /v1/email`) | 202 response, delivery tracking, domain verification, rate 120/min |
| E.164 regex validation | New regex module | `/^\+[1-9]\d{6,14}$/` in Code node | Same regex already in main.py `E164_PATTERN` — keep consistent |
| CSV binary parsing | JavaScript CSV parser from scratch | n8n Extract From File node | Built-in, handles encodings, outputs JSON rows directly |
| Non-blocking async HTTP | Threading, Celery | FastAPI `BackgroundTasks` | Built into FastAPI 0.115.x; zero extra dependencies |

**Key insight:** The entire email sending and status update path lives in n8n — no Python email library needed in the backend. The backend's job is only to fire the webhook payload.

---

## Common Pitfalls

### Pitfall 1: MailerLite vs MailerSend Confusion

**What goes wrong:** Attempting to use `mailerlite` Python SDK or n8n MailerLite node to send individual emails — they manage subscriber lists and campaigns, not point-to-point transactional sends.
**Why it happens:** The two products share the same company (MailerLite Group) and similar names. "MailerLite" is the marketing platform; "MailerSend" is the transactional service.
**How to avoid:** Always target `https://api.mailersend.com/v1/email`. The env var in CONTEXT.md is named `MAILERLITE_API_KEY` but its value must be a **MailerSend API token** generated at mailersend.com.
**Warning signs:** Getting subscriber management endpoints instead of email send endpoints; 404 on `/v1/email` with MailerLite base URL.

### Pitfall 2: Retell Webhook Timeout from Blocking n8n Call

**What goes wrong:** If n8n is slow to respond (> 2-3s), the Retell webhook POST blocks, and Retell may retry or log an error.
**Why it happens:** n8n workflows can take 1-5s to start, especially if waking from idle.
**How to avoid:** Use `BackgroundTasks.add_task()` — the HTTP POST to n8n runs AFTER the 200 OK response is sent to Retell. The `timeout=5s` is a hard cap on how long the background task will wait.
**Warning signs:** Retell retrying webhook events; call_ended firing twice.

### Pitfall 3: n8n Webhook Binary Data Handling Bug (April 2025)

**What goes wrong:** When the Webhook Trigger receives `multipart/form-data` with both text fields and a file, the binary property may be missing from the output (n8n v1.89.2 cloud issue #14876).
**Why it happens:** A regression in the n8n Webhook node's multipart parser.
**How to avoid:** For CSV import, send the file as the only field (no mixed text+file in one request). If mixed is needed, use a Code node after the webhook to extract the binary data from `$json` body field.
**Warning signs:** Extract From File node receiving empty binary input.

### Pitfall 4: Supabase Deduplication Race Condition

**What goes wrong:** Two concurrent CSV imports of the same phone number both pass the dedup check and both insert, creating duplicate leads.
**Why it happens:** The dedup check (SELECT) and insert are separate operations with a window between them.
**How to avoid:** Use Supabase upsert on the `phone` column (requires a UNIQUE constraint on `leads.phone`) or accept that the Supabase node's insert will fail on duplicate and handle the error response. The existing schema has E.164 phone — verify whether UNIQUE constraint exists.
**Warning signs:** Duplicate lead entries with same phone number after bulk import.

### Pitfall 5: Outcome Value Case Mismatch

**What goes wrong:** The payload from call_ended sends `outcome` as uppercase ("COMMITTED") but the Supabase `leads.status` is lowercase ("committed"). The n8n Switch node must match on the uppercase value (from the tool log), while Supabase updates use lowercase.
**Why it happens:** `log_call_outcome` in tools.py stores `outcome` as uppercase ("COMMITTED"), lead `status` as lowercase ("committed"). The n8n webhook payload echoes the uppercase outcome.
**How to avoid:** Switch node rules use uppercase (COMMITTED, FOLLOW_UP, DECLINED); Supabase update node uses lowercase value ("payment_sent").

### Pitfall 6: Missing N8N_WEBHOOK_BASE env var

**What goes wrong:** `os.environ.get("N8N_WEBHOOK_BASE", "")` returns empty string; httpx POST to empty URL raises `MissingSchema` error.
**Why it happens:** .env.example does not yet include `N8N_WEBHOOK_BASE` — it has `N8N_BASE_URL` but not `N8N_WEBHOOK_BASE`. The CONTEXT.md uses `N8N_WEBHOOK_BASE`.
**How to avoid:** Add `N8N_WEBHOOK_BASE=https://your-n8n.com/webhook` to .env.example. Log a clear error at startup if it's unset.

---

## Code Examples

Verified patterns from official sources:

### MailerSend Single Email (Python SDK)

```python
# Source: https://developers.mailersend.com/guides/sdk/sending-emails-with-mailersend-and-python
# pip install mailersend
from mailersend import emails
import os

mailer = emails.NewEmail(os.environ['MAILERLITE_API_KEY'])

mail_body = {}
mailer.set_mail_from({"name": "Sarah from Cloudboosta", "email": "akinwunmi.akinrimisi@cloudboosta.co.uk"}, mail_body)
mailer.set_mail_to([{"name": lead_name, "email": lead_email}], mail_body)
mailer.set_subject(subject, mail_body)
mailer.set_html_content(html_content, mail_body)
mailer.set_plaintext_content(plain_content, mail_body)
response = mailer.send(mail_body)
# response is an http.client.HTTPResponse; 202 = success
```

### MailerSend Single Email (HTTP — for use in n8n HTTP Request node)

```
POST https://api.mailersend.com/v1/email
Authorization: Bearer <MAILERLITE_API_KEY>
Content-Type: application/json

{
  "from": { "email": "akinwunmi.akinrimisi@cloudboosta.co.uk", "name": "Sarah from Cloudboosta" },
  "to": [{ "email": "<lead_email>", "name": "<lead_name>" }],
  "subject": "<subject>",
  "html": "<html body>",
  "text": "<plain text fallback>"
}

Response: 202 Accepted
Header: x-message-id: <tracking id>
```

### FastAPI BackgroundTasks injection

```python
# Source: https://fastapi.tiangolo.com/tutorial/background-tasks/
from fastapi import BackgroundTasks

@app.post("/retell/webhook")
async def retell_webhook(request: Request, background_tasks: BackgroundTasks):
    # ... existing handler logic ...
    background_tasks.add_task(trigger_post_call_workflow, payload_dict)
    return {"status": "ok"}
```

### n8n Webhook Trigger for multipart file upload

```json
{
  "name": "CSV Import Webhook",
  "type": "n8n-nodes-base.webhook",
  "typeVersion": 2,
  "parameters": {
    "httpMethod": "POST",
    "path": "lead-import",
    "responseMode": "lastNode",
    "options": {
      "binaryData": true
    }
  }
}
```

### Extract From File node (CSV)

```json
{
  "name": "Parse CSV",
  "type": "n8n-nodes-base.extractFromFile",
  "typeVersion": 1,
  "parameters": {
    "operation": "csv",
    "binaryPropertyName": "data",
    "options": {}
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Spreadsheet File node | Extract From File node | n8n v1.21.0 | Old node deprecated; use `n8n-nodes-base.extractFromFile` |
| Resend for transactional email | MailerSend (locked decision in CONTEXT.md) | Phase 7 decision | requirements.txt needs `resend==2.5.1` replaced with `mailersend` |
| IF node chains for multi-branch | Switch node (3+ outputs) | Available in current n8n | Cleaner JSON, single node for 3-way routing |
| Blocking httpx.post in webhook handler | FastAPI BackgroundTasks | n8n integration pattern | Prevents Retell webhook timeouts |

**Deprecated/outdated in this phase:**
- `resend==2.5.1` in requirements.txt: replaced by `mailersend` (or pure HTTP calls from n8n — no Python change needed if email goes fully through n8n)
- `RESEND_API_KEY` in .env.example: replaced by `MAILERLITE_API_KEY` (which holds MailerSend token)
- `n8n-nodes-base.spreadsheetFile` node type: use `n8n-nodes-base.extractFromFile` instead

---

## Open Questions

1. **MailerSend domain verification status**
   - What we know: MailerSend requires the sending domain (cloudboosta.co.uk) to be verified before emails can be sent
   - What's unclear: Whether akinwunmi.akinrimisi@cloudboosta.co.uk is already verified on MailerSend
   - Recommendation: Include domain verification check in the plan. If not verified, MailerSend will reject sends with 422. Verification requires DNS TXT records.

2. **leads.phone UNIQUE constraint**
   - What we know: The schema has E.164 phones; Phase 1 set up the leads table
   - What's unclear: Whether a UNIQUE constraint exists on `leads.phone` — affects deduplication strategy
   - Recommendation: In the n8n CSV import workflow, use Supabase HTTP Request for an upsert-style insert (or check explicitly in Code node via Supabase query before inserting).

3. **Actual n8n instance version**
   - What we know: The auto-dialer workflow uses typeVersion 4.2 for HTTP Request and typeVersion 1 for Supabase
   - What's unclear: Whether the n8n instance is current enough for Extract From File (requires v1.21.0+)
   - Recommendation: Use the same typeVersion conventions from the existing auto-dialer.json. If the instance is older, fall back to Spreadsheet File node.

4. **N8N_WEBHOOK_BASE env var name**
   - What we know: CONTEXT.md uses `N8N_WEBHOOK_BASE`; .env.example has `N8N_BASE_URL` but not `N8N_WEBHOOK_BASE`
   - What's unclear: Which variable name is already set in the actual .env
   - Recommendation: Add `N8N_WEBHOOK_BASE` to .env.example; in main.py read `os.environ.get("N8N_WEBHOOK_BASE", "")` with a startup warning if unset.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Manual integration testing (no automated test framework in project) |
| Config file | none |
| Quick run command | `curl -X POST http://localhost:8000/retell/webhook -H "Content-Type: application/json" -d '{"event":"call_ended","call":{"call_id":"TEST","metadata":{"lead_id":"TEST_UUID"},"disconnection_reason":"user_hangup"}}'` |
| Full suite command | `bash skills.sh` + manual n8n workflow test trigger |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTO-02 | Post-call n8n workflow routes COMMITTED to payment email | manual/integration | Trigger n8n webhook manually with `{"outcome":"COMMITTED","lead_email":"test@example.com",...}` | ❌ Wave 0 |
| AUTO-02 | FOLLOW_UP outcome sends reminder email | manual/integration | Trigger n8n webhook with `{"outcome":"FOLLOW_UP","lead_email":"test@example.com","follow_up_date":"2026-04-01"}` | ❌ Wave 0 |
| AUTO-02 | DECLINED outcome sends close email | manual/integration | Trigger n8n webhook with `{"outcome":"DECLINED","lead_email":"test@example.com"}` | ❌ Wave 0 |
| AUTO-03 | CSV import accepts valid E.164 phones | manual/integration | `curl -X POST N8N_WEBHOOK_BASE/lead-import -F "file=@test.csv"` | ❌ Wave 0 |
| AUTO-03 | CSV import rejects invalid phones with error report | manual/integration | Same curl with invalid rows in CSV | ❌ Wave 0 |
| AUTO-04 | Payment email delivered with correct currency bank details | manual/visual | Check email inbox after COMMITTED trigger | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** Run `bash skills.sh` to verify environment
- **Per wave merge:** Trigger all 3 n8n workflow paths manually; verify email arrives
- **Phase gate:** All 3 outcome emails received in test inbox + CSV import returns valid summary before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `test_post_call_payload.json` — sample payload for manual n8n trigger testing
- [ ] `test_leads.csv` — sample CSV with mix of valid/invalid rows for import testing
- [ ] MailerSend domain verification — prerequisite for any email to be delivered

*(No automated test infrastructure changes needed — this phase is n8n workflows and a main.py extension, tested through integration)*

---

## Sources

### Primary (HIGH confidence)

- MailerSend API docs (https://developers.mailersend.com/api/v1/email) — endpoint, payload schema, response codes, rate limits
- MailerSend Python SDK guide (https://developers.mailersend.com/guides/sdk/sending-emails-with-mailersend-and-python) — SDK usage, required fields
- FastAPI Background Tasks docs (https://fastapi.tiangolo.com/tutorial/background-tasks/) — BackgroundTasks injection pattern
- MailerLite API docs (https://developers.mailerlite.com/docs/) — confirmed no transactional send endpoint; subscriber/campaign only
- n8n Switch node docs (https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.switch/) — multi-route by string value
- Existing auto-dialer.json — canonical n8n JSON structure for this project

### Secondary (MEDIUM confidence)

- n8n Extract From File docs (https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.extractfromfile/) — CSV parsing node (Spreadsheet File replacement since v1.21.0)
- n8n HTTP Request node (https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.httprequest/) — typeVersion 4.2, Bearer auth pattern
- n8n Webhook node multipart handling (community issue #14876) — binary property bug warning

### Tertiary (LOW confidence — flag for validation)

- MailerSend domain verification requirement — inferred from standard transactional email service practice; needs manual confirmation that cloudboosta.co.uk is verified
- leads.phone UNIQUE constraint — not verified from schema files; inferred from expected dedup behavior

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — MailerSend API verified from official docs; FastAPI BackgroundTasks from official docs; n8n patterns from existing auto-dialer.json
- Architecture: HIGH — n8n workflow structure directly modeled on existing auto-dialer.json; Switch node for 3-way routing is standard n8n practice
- Pitfalls: HIGH — MailerLite/MailerSend confusion is a critical verified finding; BackgroundTasks pattern is from FastAPI official docs; Spreadsheet File deprecation is documented
- Email templates: MEDIUM — HTML structure is custom; MailerSend delivery behavior is HIGH confidence

**Research date:** 2026-03-25
**Valid until:** 2026-04-25 (MailerSend API is stable; n8n node versions change faster)
