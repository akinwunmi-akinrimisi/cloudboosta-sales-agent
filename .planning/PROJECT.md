# Sarah — Cloudboosta AI Cold-Calling Sales Agent

## What This Is

An autonomous AI cold-calling sales agent named Sarah, built on Retell AI, that calls leads directly from a Supabase queue, qualifies them for cloud computing and DevOps training programmes, handles objections using 6 closing strategies, and closes — logging every outcome for continuous improvement. The operator monitors everything through a real-time React dashboard.

## Core Value

Sarah converts cold leads into paid Cloudboosta programme enrolments through autonomous outbound calls — no human intervention required during the call, no pre-contact needed.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Retell LLM configured with Sarah's full system prompt, qualification gates, and 6 closing strategies
- [ ] 3 custom tools (lookup_programme, get_objection_response, log_call_outcome) callable during live calls
- [ ] Voice agent created with British female voice, assigned to phone number
- [ ] Twilio number +1 (740) 494-3597 migrated to Retell for outbound calling
- [ ] FastAPI webhook backend handling tool calls, call lifecycle events, and call initiation
- [ ] Supabase schema: leads, call_logs, pipeline_logs, dial_schedules tables + views
- [ ] Scheduled auto-dialer (n8n) polling queue every 2 minutes within dial windows
- [ ] Post-call handler (n8n) routing outcomes: COMMITTED → payment email, FOLLOW_UP → schedule, DECLINED → log
- [ ] Lead import workflow (n8n) accepting CSV with phone validation and dedup
- [ ] React dashboard: Live View (active call, recent calls, today's stats), Lead Pipeline (kanban, search, transcript viewer), Strategy Analytics (conversion by strategy, heatmap, trends)
- [ ] Security controls: webhook signature verification, RLS, rate limiting, input validation, CORS
- [ ] Wave 0 test: 10 successful calls with outcomes logged and visible on dashboard

### Out of Scope

- Audio processing, STT/TTS, WebSocket media streams, VAD — Retell handles all voice
- WhatsApp or email pre-contact — pure cold calling model
- OpenClaw integration — email uses Resend API
- Mobile app — dashboard is web only
- Multi-agent concurrent calling — max 1 call at a time
- Strategy optimization — wait until Wave 2 (200+ calls) for statistical significance

## Context

**Client:** Cloudboosta Technology Solutions Ltd — cloud computing and DevOps training provider.
**Owner:** Akinwunmi Akinrimisi (Operscale Systems)
**Existing infrastructure:**
- Self-hosted Supabase at supabase.operscale.cloud (leads, call_logs, pipeline_logs tables already exist; dial_schedules pending)
- Self-hosted n8n at n8n.srv1297445.hstgr.cloud (Hostinger KVM 4)
- Retell AI account with API key and 3 existing agents
- Twilio account with number +1 (740) 494-3597 (needs migration to Retell)
- Resend API for transactional email

**Knowledge base:** 5 PDFs covering programmes (4 pathways, pricing in GBP/USD/EUR/NGN), FAQs, payment details (bank transfer via Revolut + GTBank), conversation sequence (8-stage flow, 3 qualification gates), objection handling (11 types with multi-layer responses).

**Pricing (authoritative — never change without instruction):**
- 1 pathway (8 wks): £1,500 / £1,350 early bird
- 2 pathways (16 wks): £3,000 / £2,400 early bird
- 3 pathways (24 wks): £4,500 / £3,450 early bird
- All 4 (32 wks): £6,000 / £4,500 early bird
- Cohort 2 starts: Saturday 25 April 2026

**Closing strategies:** 6 strategies (Doctor Frame, Pain Close, Inverse Close, NEPQ Sequence, Diffusion Framework, Direct Close) selected based on lead persona detected during discovery. Strategy + persona + outcome logged per call for continuous improvement.

## Constraints

- **Platform:** Retell AI for all voice — no custom STT/TTS/VAD code
- **LLM:** GPT-4o-mini on Retell (128K context, keep system prompt under 8K tokens)
- **Telephony:** Single US number +1 (740) 494-3597, max 1 concurrent call
- **Rate limits:** 1 call per 2 minutes, max 200 calls/day, max 2 retries per lead
- **Retell webhook timeout:** 20 seconds — tool execution must be fast
- **Timeline:** ASAP — build full pipeline, then Wave 0 (10 test calls) immediately
- **Security:** Read security.md before writing any code. Webhook verification, RLS, no hardcoded keys.
- **Cold calling compliance:** Never call do_not_contact or declined leads. Respect "no" immediately.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Retell AI over custom voice stack | Handles STT/TTS/VAD/turn-taking, lets us focus on sales logic | — Pending |
| GPT-4o-mini over GPT-4o | Fast, cheap, proven on Retell for voice agents | — Pending |
| n8n for auto-dialer over custom scheduler | Already self-hosted, visual workflow builder, cron + webhook support | — Pending |
| Resend over OpenClaw for email | Simpler API, no dependency on OpenClaw VPS | — Pending |
| Pure cold calling (no pre-contact) | Faster pipeline, no warm-up needed, test conversion rate directly | — Pending |
| 3-layer DOE architecture (directives/execution) | Separates SOPs from code, enables self-annealing improvement loop | — Pending |

---
*Last updated: 2026-03-24 after initialization*
