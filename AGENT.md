# AGENT.md — Sarah Voice Sales Agent (Retell AI)
## Daily Operations Engine (DOE) — Master Document
### Version 2.0 | March 2026 | Operscale × Cloudboosta

---

## PROJECT IDENTITY

- **Agent Name:** Sarah
- **Voice:** Neutral British English, warm, professional
- **Platform:** Retell AI (retellai.com)
- **LLM Backend:** Retell LLM (GPT-4o-mini primary)
- **Client:** Cloudboosta Technology Solutions Ltd
- **Objective:** Autonomous outbound cold calls to convert cloud/DevOps leads into paid enrolments
- **Mode:** Pure cold calling — no pre-contact via WhatsApp or email

---

## IMMUTABLE RULES

1. Sarah is ALWAYS transparent about being AI when asked. Never pretends to be human.
2. Never hardcode API keys. Use environment variables or Retell credential storage.
3. Never guarantee job outcomes. Use "opportunity" and "support", never "guarantee" or "promise".
4. Never contact a lead marked `do_not_contact` or `declined`.
5. All programme data comes from the knowledge base — Sarah never fabricates details.
6. Follow the qualification gate logic: everyone starts at Cloud Computing unless they hold AWS SA cert + hands-on projects.
7. Every call must end with a classification: COMMITTED, FOLLOW_UP, or DECLINED.
8. FOLLOW_UP must have a specific date/time locked in.
9. Respect "no" immediately. Three objections on the same topic = move to FOLLOW_UP.
10. All call data logged to Supabase via webhook.

---

## SYSTEM ARCHITECTURE

```
┌─────────────────┐     ┌──────────────────┐     ┌───────────────────┐
│  Lead's Phone   │◄───►│   Retell AI      │◄───►│  Webhook Backend  │
│  (+234/+44/+1)  │voice│  • STT (speech)  │text │  (Cloud Run/VPS)  │
│                 │     │  • TTS (voice)   │     │  • Tool execution │
│                 │     │  • VAD (turns)   │     │  • Supabase CRUD  │
│                 │     │  • LLM (brain)   │     │  • Auto-dialer    │
└─────────────────┘     └──────────────────┘     └───────────────────┘
                               │                         │
                               │ webhooks                │
                               ▼                         ▼
                        ┌──────────────────┐     ┌───────────────────┐
                        │  n8n (VPS #1)    │     │  Supabase         │
                        │  • Auto-dialer   │     │  • leads          │
                        │  • Post-call     │     │  • call_logs      │
                        │  • Scheduling    │     │  • pipeline_logs  │
                        └──────────────────┘     │  • dial_schedules │
                                                 └───────────────────┘
                                                         │
                                                         ▼
                                                 ┌───────────────────┐
                                                 │  Dashboard (React)│
                                                 │  • Live call view │
                                                 │  • Lead pipeline  │
                                                 │  • Strategy stats │
                                                 └───────────────────┘
```

---

## TELEPHONY

- **Number:** +1 161 570 0419 (US, currently on Twilio)
- **Migration:** Import to Retell via Twilio SIP trunk integration
- **Outbound:** Retell API triggers cold calls from this number

---

## COLD CALLING MODEL (Scheduled Auto-Dialer)

No pre-contact. Sarah calls leads directly from Supabase.

**How it works:**
1. You set a dial window (e.g., 9am-5pm WAT) via the dashboard or n8n
2. n8n scheduler polls Supabase every 2 minutes for the next uncalled lead
3. Triggers Retell outbound call via API
4. Waits for call to complete (Retell fires `call_ended` webhook)
5. Picks the next lead, repeats
6. Stops at end of window or when list is exhausted
7. Rate limit: 1 call per 2 minutes (configurable)

**Call Dispositions:**
- Lead picks up → conversation flows → outcome logged
- No answer → status `no_answer`, auto-retry next day (max 2 retries)
- Voicemail → status `voicemail`, auto-retry next day (max 2 retries)
- Busy → status `busy`, retry in 1 hour
- Invalid number → status `invalid_number`, skip permanently

---

## PIPELINE STAGES (Cold Calling — No Pre-Contact)

| # | Stage | System | Status Value |
|---|-------|--------|--------------|
| 1 | Lead uploaded | Supabase (CSV/manual) | `new` |
| 2 | Queued for dialing | n8n auto-dialer | `queued` |
| 3 | Call initiated | Retell API | `calling` |
| 4 | No answer / voicemail | Retell webhook | `no_answer` / `voicemail` |
| 5 | Conversation | Retell + LLM | `in_call` |
| 6 | Outcome classified | Retell webhook → n8n | `committed` / `follow_up` / `declined` |
| 7 | Payment email sent | n8n → Resend (email) | `payment_pending` |
| 8 | Follow-up scheduled | n8n scheduler | `follow_up_scheduled` |
| 9 | Payment received | Manual check | `enrolled` |

---

## CLOSING STRATEGY SYSTEM

6 strategies from Dan Lok + Jeremy Miner. Selected during DISCOVERY based on persona detection. Strategy + outcome logged for continuous improvement.

See: `closing-strategies.md`

---

## KNOWLEDGE BASE (6 PDFs)

programmes.pdf, faqs.pdf, payment-details.pdf, conversation-sequence.pdf, objection-handling.pdf, coming-soon.pdf

---

## CUSTOM DASHBOARD (React)

Three views, built with GSD skill:

1. **Live Call Status** — Active call (lead name, timer, strategy), recent calls, today's count
2. **Lead Pipeline** — All leads by status, filterable, click for transcript
3. **Strategy Analytics** — Conversion rate per strategy per persona, trends, totals

Reads from Supabase REST API. Real-time updates via Supabase Realtime subscriptions.

---

## SKILLS AND TOOLING

| Skill | Purpose | Source |
|-------|---------|--------|
| GSD | Production UI/dashboard, high-quality code | Install globally in Claude Code |
| Agency Agents | Reusable agent patterns, workflow templates | github.com/msitarzewski/agency-agents |

---

## TEST PLAN

- **Wave 0:** 10 calls (your number + friendly contacts)
- **Wave 1:** 50 cold calls (first real batch)
- **Wave 2:** 200 cold calls (refined from Wave 1)
- **Wave 3:** 1,000+ (scaled operation)

---

## SUCCESS METRICS

| Metric | Target (Wave 1) | Source |
|--------|-----------------|--------|
| Pick-up rate | >25% | Supabase: answered / initiated |
| Completion rate | >60% of answered | calls >60s / answered |
| Commitment rate | >5% of completed | committed / completed |
| Avg call duration | 3-7 minutes | Retell analytics |
