# Agent Instructions (DOE)
## John — AI Sales Agent on Retell AI
### Directive → Observation → Experiment

> **AI is probabilistic. Sales pipeline execution must be deterministic.**
> This system separates those responsibilities. Retell AI handles all voice processing.
> Your backend handles outreach, booking, tool execution, and data persistence.
> Every interaction is logged. Every strategy is tracked. The system learns what works.
> If a lead says "no," respect it immediately. If the dialer breaks, the pipeline stops.
> Reliability and trust are non-negotiable.

**Version 3.0 | Operscale Systems | March 2026**
**Owner:** Akinwunmi Akinrimisi
**Client:** Cloudboosta Technology Solutions Ltd
**Stack:** Retell AI (voice) + Supabase (database) + n8n (orchestration) + OpenClaw/Evolution API (WhatsApp, VPS #2) + Cal.com (booking, self-hosted) + Resend (email) + FastAPI (webhook backend)

---

## ⚠️ IMMUTABLE — Non-Negotiable Operating Rules

All work must:

- Read the relevant `directives/` file before writing or modifying any workflow, endpoint, or prompt.
- Push every repeatable operation into deterministic scripts in `execution/`.
- Treat every error as a learning signal — self-anneal by fixing the script, then updating the directive.
- **Superpowers is the build methodology.** Follow brainstorm → plan → execute. Use TDD. Use subagent-driven development.
- **Never hardcode API keys.** Always reference environment variables. Any key exposed in code must be rotated immediately.
- Read `security.md` before writing ANY code.
- **Never call a lead marked `do_not_contact` or `declined`.**
- **Never guarantee job outcomes.** John uses "opportunity" and "support", never "guarantee" or "promise".
- All programme data comes from the knowledge base — John never fabricates details.
- Every call must end with a classification: COMMITTED, FOLLOW_UP, or DECLINED.
- FOLLOW_UP must have a specific date/time locked in.
- **John's name is John.** Not Sarah. Update all references.
- Do not rewrite or regenerate this file unless explicitly instructed.

---

## 1. The 3-Layer Architecture

| Layer | Name | What lives here | Your role |
|-------|------|-----------------|-----------|
| **1** | Directive | `directives/` — Markdown SOPs per phase | READ before acting |
| **2** | Orchestration | **THIS AGENT — you.** Interpret directives, route API calls, trigger workflows, handle errors | DECIDE & ROUTE |
| **3** | Execution | `execution/` — FastAPI server, n8n workflows, Retell config scripts, Supabase migrations | RUN & OBSERVE |

---

## 2. System Architecture

```
                    ┌──────────────────────────────────────────┐
                    │           LEAD IMPORT (CSV)              │
                    │    first_name, last_name, phone, email   │
                    └──────────────┬───────────────────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────────────────┐
                    │         SUPABASE (leads table)           │
                    │  Tags: has_email, has_whatsapp, timezone │
                    └──────────────┬───────────────────────────┘
                                   │
                          ┌────────┴────────┐
                          ▼                 ▼
               ┌─────────────────┐  ┌─────────────────┐
               │ WhatsApp Check  │  │  Has Email?      │
               │ (OpenClaw API)  │  │                  │
               └────────┬────────┘  └────────┬─────────┘
                        │                    │
          ┌─────────────┴─────────────┐      │
          ▼                           ▼      ▼
 ┌─────────────────┐      ┌──────────────────────────┐
 │ Send WhatsApp   │      │    Send Email            │
 │ (OpenClaw)      │      │    (Resend)              │
 │ + Cal.com link  │      │    + Cal.com link        │
 │ + reply option  │      │    + reply option        │
 └────────┬────────┘      └──────────┬───────────────┘
          │                          │
          └──────────┬───────────────┘
                     ▼
          ┌─────────────────────────────────┐
          │  MONITOR FOR RESPONSE           │
          │  • Cal.com webhook (booking)    │
          │  • OpenClaw webhook (WA reply)  │
          │  • n8n polling (backup)         │
          │  • AI parses reply → datetime   │
          └──────────────┬──────────────────┘
                         │
              ┌──────────┴──────────┐
              ▼                     ▼
    ┌──────────────────┐  ┌──────────────────┐
    │ Lead books via   │  │ Lead replies     │
    │ Cal.com          │  │ with pref. time  │
    │ → exact datetime │  │ → AI extracts    │
    └────────┬─────────┘  └────────┬─────────┘
             │                     │
             └──────────┬──────────┘
                        ▼
             ┌─────────────────────────────┐
             │  SCHEDULED CALL             │
             │  John calls at lead's       │
             │  preferred time             │
             │  (via Retell API)           │
             └──────────────┬──────────────┘
                            │
                            ▼
             ┌──────────────────────────────┐
             │  RETELL AI (voice call)      │
             │  • STT / TTS / VAD           │
             │  • LLM (John's brain)        │
             │  • Dynamic vars: lead context,│
             │    previous call summaries,   │
             │    known email status         │
             └──────────────┬───────────────┘
                            │
                            ▼
             ┌──────────────────────────────┐
             │  POST-CALL AUTOMATION        │
             │  • Log transcript + outcome  │
             │  • COMMITTED → payment email │
             │  • FOLLOW_UP → schedule next │
             │  • DECLINED → close out      │
             └──────────────────────────────┘
```

**For leads with NO email AND NOT on WhatsApp:** Skip pre-contact entirely. John cold-calls directly via the scheduled auto-dialer at a time appropriate for the lead's timezone.

---

## 3. Infrastructure Map

| Component | Location | Purpose |
|-----------|----------|---------|
| Retell AI | Cloud (retellai.com) | Voice: STT, TTS, VAD, LLM orchestration |
| Supabase | supabase.operscale.cloud | Database: leads, call_logs, bookings, pipeline |
| n8n | VPS #1 (Hostinger) | Orchestration: auto-dialer, post-call, outreach workflows |
| OpenClaw/Evolution API | VPS #2 (Hostinger) | WhatsApp: send messages, receive replies, number detection |
| Cal.com | VPS (self-hosted, to be installed) | Booking: leads schedule call times |
| Resend | Cloud API | Email: intro messages, payment details |
| FastAPI Backend | VPS #1 or Cloud Run | Webhooks: Retell tool calls, Cal.com events, dashboard API |
| Dashboard | Static / VPS | React app: live calls, pipeline, strategy analytics |

---

## 4. Telephony

- **Number:** +1 161 570 0419 (US, Twilio → Retell via SIP trunk)
- **Outbound:** Retell API triggers calls from this number
- **Warm transfer:** To +44 7592 233052 (Akinwunmi / Cloudboosta team) during live call when lead is highly interested or requests human

---

## 5. Lead Contact Flow

### 5.1 CSV Import

Upload CSV with columns: `first_name`, `last_name`, `phone`, `email`. Any field except `phone` may be empty. System:
1. Validates phone (E.164 format)
2. Deduplicates by phone number
3. Checks if phone is registered on WhatsApp (OpenClaw API)
4. Derives timezone from phone country code
5. Tags lead: `has_email` (bool), `has_whatsapp` (bool), `timezone` (string)
6. Sets status to `new`

### 5.2 Multi-Channel Pre-Contact Outreach

| Lead Profile | Channels | Action |
|-------------|----------|--------|
| Has email + on WhatsApp | Email + WhatsApp | Send both with Cal.com booking link |
| Has email, NOT on WhatsApp | Email only | Send email with Cal.com link |
| No email, on WhatsApp | WhatsApp only | Send WhatsApp with Cal.com link |
| No email, NOT on WhatsApp | None (direct call) | Skip outreach, queue for cold call |

**Message content (both channels):**
- Brief intro: "Hi [First Name], I'm John from Cloudboosta's advisory team."
- Value prop: "We help professionals transition into cloud and DevOps careers."
- CTA: "I'd love to have a brief 5-minute chat with you. You can book a time here: [Cal.com link]"
- Alternative: "Or simply reply with a time that works for you."

### 5.3 Booking + Reply Monitoring

**Path A — Cal.com booking:**
Cal.com fires a webhook on new booking → n8n receives → updates lead status to `call_scheduled` with exact datetime → auto-dialer calls at that time.

**Path B — Reply with preferred time:**
1. OpenClaw webhook fires when lead replies on WhatsApp
2. n8n also polls for new messages every 5 minutes (backup)
3. AI (Claude via n8n) parses the reply text to extract date/time
4. If clear datetime → update lead to `call_scheduled`
5. If ambiguous → send clarifying WhatsApp: "Just to confirm — would that be Tuesday at 3pm?"

**Path C — No response after 48 hours:**
Lead didn't book and didn't reply → status changes to `outreach_no_response` → queue for direct cold call at appropriate timezone.

### 5.4 Smart Call Timing

Derive timezone from phone number country code:
- +44 → Europe/London (GMT/BST)
- +234 → Africa/Lagos (WAT)
- +1 → America/New_York (default, can refine by area code)
- +353 → Europe/Dublin
- Others → map as needed

Call during lead's local business hours: 9am-6pm in their timezone. Never call before 9am or after 7pm local time.

---

## 6. Context-Aware Calling (Call Memory)

### 6.1 First Call

John's system prompt receives dynamic variables:
```
lead_name: "David"
lead_email: "david@email.com" (or "none")
has_email: true/false
contact_method: "whatsapp_booking" / "email_reply" / "cold_call"
previous_calls: [] (empty for first call)
```

If the lead booked via Cal.com or replied to a message, John opens with: "Hi David, thanks for making time. You booked this call through our link — I appreciate that."

If it's a cold call: "Hi David, I'm John from Cloudboosta's advisory team. I help professionals transition into cloud and DevOps careers. Do you have 2 minutes?"

### 6.2 Subsequent Calls

Before each call, the system retrieves all previous call records from `call_logs` and injects a summary into John's dynamic variables:

```
previous_calls: [
  {
    "date": "2026-04-02",
    "duration": "4m 32s",
    "summary": "David is interested in Advanced DevOps. Has 2 years IT experience. Main concern: time commitment. Outcome: FOLLOW_UP. Promised to check schedule.",
    "programme_discussed": "Advanced DevOps",
    "objections": ["no-time"],
    "strategy_used": "NEPQ Sequence"
  }
]
```

John opens subsequent calls with: "Hi David, it's John from Cloudboosta again. Last time we spoke, you were looking into the Advanced DevOps pathway and wanted to check your schedule. How did that go?"

### 6.3 Follow-Up Scheduling

For every FOLLOW_UP outcome, John MUST ask: "When would be a good time for me to follow up with you?"

If vague: "Would Tuesday or Wednesday work better? Morning or afternoon?"

The exact datetime is logged to `leads.follow_up_at`. The auto-dialer picks it up and calls at that time.

---

## 7. Smart Email Handling

| Scenario | John's Behaviour |
|----------|-----------------|
| Email in Supabase | Never asks for email. Says: "I'll send the details to your email." |
| No email, contacted via WhatsApp | "Could you drop your email in our WhatsApp chat so I can send the full details?" |
| No email, direct cold call | If needed: "What's your email address so I can send this over?" If unclear: "Could you spell that out for me?" — NEVER uses NATO alphabet (no "B for Bravo"). Just natural: "Was that D-A-V-I-D?" |
| Email captured on call | Immediately stored in Supabase. Post-call automation uses it for payment/follow-up emails. |

---

## 8. Warm Transfer

During a live call, if John detects the lead is highly interested AND:
- Asks complex questions John can't answer, OR
- Explicitly requests to speak to a human, OR
- Is ready to commit and wants personal reassurance

John says: "Let me connect you with someone from our team who can help with that right now."

Retell executes warm transfer to: **+44 7592 233052** (Akinwunmi / Cloudboosta advisor)

John stays on briefly for handoff: "I've got [Name] on the line — they were asking about [topic]."

---

## 9. John's Conversation Flow

Eight stages per call. Target: 5-7 minutes.

```
OPEN → DISCOVERY → QUALIFY → BRIDGE → PRESENT → HANDLE OBJECTIONS → CLOSE → FOLLOW-UP LOCK
```

**OPEN** adapts based on how the lead was contacted:
- Booked via Cal.com → warm, grateful, reference the booking
- Replied to message → warm, reference their reply
- Cold call → brief intro, ask for 2 minutes, earn permission first

**DISCOVERY through CLOSE** — same 6-strategy system from closing-strategies.md.

**FOLLOW-UP LOCK** — always pin down specific date and time.

---

## 10. Qualification Gate Logic

- **Gate 1:** Everyone → Cloud Computing UNLESS AWS SA cert + hands-on projects → skip to Advanced DevOps
- **Gate 2:** Based on goal → single pathway / Zero to Cloud DevOps bundle / Zero to DevOps Pro
- **Gate 3:** After DevOps → Platform Engineer OR SRE

---

## 11. Closing Strategy System

6 strategies from Dan Lok + Jeremy Miner. Selected based on persona detected during DISCOVERY.
Strategy + persona + outcome logged per call. Weekly analysis reveals what works.

See: `closing-strategies.md` (update all "Sarah" references to "John")

---

## 12. Knowledge Base (6 PDFs)

programmes.pdf, faqs.pdf, payment-details.pdf, conversation-sequence.pdf, objection-handling.pdf, coming-soon.pdf

---

## 13. Custom Functions (Tools)

| Function | Purpose | When |
|----------|---------|------|
| `lookup_programme` | Get programme details for lead's profile | After qualification |
| `get_objection_response` | Get layered response for objection | During objection handling |
| `log_call_outcome` | Log outcome + strategy + follow-up date | End of every call |
| `get_lead_context` | Retrieve previous call history for this lead | Start of subsequent calls |
| `save_email` | Store email address captured during call | When lead provides email |
| `end_call` | End the call | Built-in Retell |
| `transfer_call` | Warm transfer to +44 7592 233052 | When lead requests human |

---

## 14. Pipeline Stages

| # | Stage | Trigger | Status |
|---|-------|---------|--------|
| 1 | Lead imported | CSV upload | `new` |
| 2 | WhatsApp check | n8n workflow | `enriched` |
| 3 | Outreach sent | n8n → OpenClaw/Resend | `outreach_sent` |
| 4 | Lead books call | Cal.com webhook | `call_scheduled` |
| 5 | Lead replies with time | OpenClaw webhook + AI parse | `call_scheduled` |
| 6 | No response (48h) | n8n scheduler | `outreach_no_response` → queued for cold call |
| 7 | Call initiated | Retell API | `calling` |
| 8 | No answer / voicemail | Retell webhook | `no_answer` / `voicemail` |
| 9 | Conversation | Retell + LLM | `in_call` |
| 10 | Outcome | Retell webhook → n8n | `committed` / `follow_up` / `declined` |
| 11 | Payment email sent | n8n → Resend | `payment_pending` |
| 12 | Follow-up scheduled | n8n scheduler | `follow_up_scheduled` |
| 13 | Payment received | Manual | `enrolled` |

---

## 15. Custom Dashboard

Three tabs, built with Anthropic frontend-design skill:

1. **Live View** — Active call, recent calls, today's stats, dialer controls
2. **Lead Pipeline** — Kanban by status, search, transcript viewer, CSV upload
3. **Strategy Analytics** — Conversion by strategy, strategy×persona heatmap, trends

---

## 16. Self-Annealing Loop

```
1. OBSERVE  — Read error from webhook, n8n log, or Supabase
2. DIAGNOSE — Root cause
3. FIX      — Patch the specific component
4. CONFIRM  — Test call or webhook test
5. UPDATE   — Update directive
6. CONTINUE — Resume pipeline
```

---

## 17. Success Metrics

| Metric | Wave 0 (10) | Wave 1 (50) | Wave 2 (200) |
|--------|-------------|-------------|--------------|
| Outreach response rate | N/A (test) | >20% | >25% |
| Booking rate | N/A | >30% of responses | >35% |
| Pick-up rate (scheduled) | >80% | >70% | >70% |
| Pick-up rate (cold) | >30% | >25% | >25% |
| Commitment rate | Testing | >5% | >8% |

---

## 18. Directory Structure

```
cloudboosta-sales-agent/
├── AGENT.md                    ← THIS FILE
├── CLAUDE.md                   ← Claude Code instructions
├── security.md                 ← Security controls
├── implementation.md           ← Phased build plan
├── closing-strategies.md       ← 6 strategies (John, not Sarah)
├── skills.md                   ← Technical patterns
├── skills.sh                   ← Environment validation
├── leads.md                    ← Lead management reference
├── knowledge-base/             ← 6 PDFs
├── .claude/                    ← Superpowers + skills
├── .planning/                  ← Superpowers state
├── directives/                 ← Per-phase SOPs
├── execution/
│   ├── backend/                ← FastAPI webhook server
│   ├── dashboard/              ← React app
│   ├── n8n/                    ← Workflow JSON exports
│   └── cal-com/                ← Cal.com config
├── docs/superpowers/           ← Superpowers docs
└── .env.example
```

---

## Summary

You operate between **human intent** (a CSV of leads) and **deterministic sales pipeline execution** (outreach → booking → call → outcome → follow-up).

OpenClaw handles WhatsApp.
Cal.com handles booking.
Resend handles email.
Retell handles the voice.
The LLM handles the conversation.
Your backend handles the tools.
n8n handles the orchestration.
Supabase holds the truth.
The dashboard shows the picture.

Read directives. Make decisions. Run tools. Observe results. Improve the system.

Be pragmatic. Be reliable.

**Self-anneal.**

---

> ⚠️ **IMMUTABLE** — Do not rewrite, regenerate, summarise, or replace this file unless explicitly instructed.
> These operating rules are authoritative. Before performing any task: read this file. Apply it strictly.
