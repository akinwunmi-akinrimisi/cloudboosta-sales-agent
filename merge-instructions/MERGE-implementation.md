# MERGE: implementation.md
## Type: Add new phases after existing phases
## Priority: High — defines the build plan for new features

### Claude Code Prompt
```
Read implementation.md in full. Add these NEW phases at the end,
after the existing phases. Do not modify existing phase content.

## PHASE 9: CAL.COM SELF-HOSTED (Day 12-13)

#### Task 9.1: Deploy Cal.com via Docker
**Prompt:**
Deploy Cal.com on the Hostinger VPS using Docker Compose. Create directory
/opt/cal-com, set up docker-compose.yml with cal-web + postgres containers.
Configure Traefik/nginx reverse proxy for HTTPS at cal.yourdomain.com.
Create admin account. Create booking event type: "Cloudboosta Advisory Call"
(15 min, Mon-Fri 9am-6pm WAT). Configure webhook: on BOOKING_CREATED →
POST to n8n endpoint. Do NOT hardcode secrets — use .env file.
Read security.md before configuring credentials.

#### Task 9.2: Cal.com Webhook → n8n
**Prompt:**
Build n8n workflow "Cal.com Booking Handler". Trigger: Webhook from Cal.com.
Steps: verify signature → extract attendee data → match to Supabase lead
by email or phone → update status to call_scheduled with booked datetime →
schedule Retell outbound call at that time → log to pipeline_logs.

---

## PHASE 10: OPENCLAW WHATSAPP INTEGRATION (Day 13-15)

#### Task 10.1: WhatsApp Number Detection
**Prompt:**
Build n8n workflow "WhatsApp Number Check". Called during CSV import.
For each phone number, call OpenClaw API to check WhatsApp registration:
POST OPENCLAW_API_URL/chat/whatsappNumbers/[instance] with the number.
Parse response → update lead in Supabase: has_whatsapp=true/false.
If API timeout → default to false. Do NOT hardcode OpenClaw API key.

#### Task 10.2: WhatsApp Outreach Messages
**Prompt:**
Build n8n workflow "WhatsApp Outreach". Triggered after lead enrichment
for leads where has_whatsapp=true. Compose message: intro as John from
Cloudboosta advisory team, value prop, Cal.com booking link, alternative
to reply with preferred time. Send via OpenClaw API POST
OPENCLAW_API_URL/message/sendText. Update lead status to outreach_sent.
Log to pipeline_logs.

#### Task 10.3: WhatsApp Reply Monitoring + AI Parsing
**Prompt:**
Build n8n workflow "WhatsApp Reply Handler" with two triggers:
Trigger A: OpenClaw webhook (fires on incoming WhatsApp message).
Trigger B: n8n Cron every 5 minutes polling OpenClaw for new messages (backup).
Steps: receive message → match sender phone to Supabase lead →
use Claude via OpenRouter to parse the reply text and extract a datetime
(e.g., "Tuesday 3pm" → 2026-04-01T15:00:00+01:00) → if clear datetime,
update lead to call_scheduled → if ambiguous, send clarifying WhatsApp:
"Just to confirm — would that be Tuesday at 3pm?" → log to pipeline_logs.

---

## PHASE 11: MULTI-CHANNEL OUTREACH ORCHESTRATOR (Day 15-16)

#### Task 11.1: Email Outreach via Resend
**Prompt:**
Build n8n workflow "Email Outreach". Triggered after lead enrichment for
leads where has_email=true. Compose HTML email: subject "Quick question
about your cloud career", body with intro as John, value prop, Cal.com
booking link, reply alternative. Send via Resend API. Update lead status
to outreach_sent. Log to pipeline_logs.

#### Task 11.2: Master Outreach Orchestrator
**Prompt:**
Build n8n workflow "Lead Outreach Orchestrator". Called after CSV import
enrichment completes for each lead. Decision logic:
- has_email=true AND has_whatsapp=true → trigger both Email + WhatsApp workflows
- has_email=true AND has_whatsapp=false → trigger Email only
- has_email=false AND has_whatsapp=true → trigger WhatsApp only
- has_email=false AND has_whatsapp=false → set status to queued (direct cold call)
Update lead status appropriately. Log channel used to pipeline_logs.

#### Task 11.3: 48-Hour No-Response Escalation
**Prompt:**
Build n8n workflow "Outreach Timeout". Trigger: Cron runs every hour.
Query Supabase for leads where status='outreach_sent' AND
updated_at < NOW() - INTERVAL '48 hours'. For each: update status to
'outreach_no_response', then set to 'queued' for direct cold call by
auto-dialer. Log to pipeline_logs.

---

## PHASE 12: CONTEXT-AWARE CALLING (Day 16-17)

#### Task 12.1: get_lead_context Tool
**Prompt:**
Add a new custom function to the Retell LLM: get_lead_context.
Params: lead_phone (string). Webhook: POST to backend /retell/tool.
Backend handler: query Supabase call_logs for all records matching
this lead's phone number. Return JSON array of previous call summaries:
[{date, duration, summary, programme_discussed, objections, strategy_used}].
This data is injected into John's dynamic variables before the call starts.

#### Task 12.2: save_email Tool
**Prompt:**
Add a new custom function to the Retell LLM: save_email.
Params: email (string). Webhook: POST to backend /retell/tool.
Backend handler: validate email format, update the lead's email field
in Supabase, set has_email=true. Return confirmation.
John calls this when a lead provides their email during a call.

#### Task 12.3: Dynamic Variable Injection
**Prompt:**
Update the auto-dialer workflow. Before triggering each Retell outbound
call, fetch the lead's full context from Supabase:
- lead name, email (if exists), has_email flag
- contact_method (whatsapp_booking / email_reply / cold_call / follow_up)
- all previous call summaries from call_logs (ordered by date)
Pass all of this as retell_llm_dynamic_variables in the
client.call.create_phone_call() API call. This way John has full context
before he even says "Hello".

---

## PHASE 13: SMART CALL TIMING (Day 17-18)

#### Task 13.1: Timezone Detection from Phone Number
**Prompt:**
Create a Python utility function: derive_timezone(phone: str) -> str.
Map phone country code to IANA timezone:
+44 → Europe/London, +234 → Africa/Lagos, +1 → America/New_York,
+353 → Europe/Dublin, +233 → Africa/Accra, +254 → Africa/Nairobi,
+27 → Africa/Johannesburg. Add to Supabase during CSV import enrichment.

#### Task 13.2: Update Auto-Dialer for Timezone Awareness
**Prompt:**
Update the auto-dialer n8n workflow. When selecting the next lead to call,
filter by: current time in the lead's timezone must be between 09:00 and
18:00. Query: SELECT * FROM leads WHERE status='queued' AND
EXTRACT(HOUR FROM NOW() AT TIME ZONE timezone) BETWEEN 9 AND 18
ORDER BY priority DESC, created_at ASC LIMIT 1.
If no leads are in callable hours, skip and wait for next poll cycle.

---

## PHASE 14: WARM TRANSFER (Day 18)

#### Task 14.1: Configure Retell Warm Transfer
**Prompt:**
Update the Retell agent configuration to enable warm transfer.
Add transfer_call as a built-in function with transfer number
+44 7592 233052 (Akinwunmi / Cloudboosta advisor).
Update John's system prompt to include warm transfer trigger conditions:
- Lead explicitly requests to speak to a human
- Lead is highly interested and has complex questions John can't answer
- Lead is ready to commit and wants personal reassurance
John should say: "Let me connect you with someone from our team right now"
then stay on briefly for handoff context.

---

Commit message: "feat: implementation.md — phases 9-14 for Cal.com, 
OpenClaw, outreach, context-aware calling, timezone, warm transfer"
```
