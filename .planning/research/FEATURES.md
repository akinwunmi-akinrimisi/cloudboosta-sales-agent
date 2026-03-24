# Feature Landscape

**Domain:** AI-powered outbound cold-calling sales agent
**Project:** Sarah -- Cloudboosta AI Sales Agent on Retell AI
**Researched:** 2026-03-24

## Table Stakes

Features the operator expects. Missing = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Outbound call initiation via API | Core function -- Sarah calls leads | Low | Retell `create_phone_call` API. `from_number` + `to_number` required. |
| System prompt with qualification gates | Sarah must qualify leads through 3 gates before recommending programmes | Medium | Keep under 8K tokens. Include 6 closing strategies, 11 objection responses, 4 pathways with pricing. |
| Custom tool execution (3 tools) | Sarah needs real-time data lookup during calls | Medium | `lookup_programme`, `get_objection_response`, `log_call_outcome`. Must execute within 10s (Retell webhook timeout). |
| Auto-dialer with time windows | Automated calling within scheduled hours | Medium | n8n cron every 2 min. Checks dial window, active calls, and queue. |
| Call outcome logging | Every call must log outcome, strategy, persona | Low | `log_call_outcome` tool at end of every call + `call_ended` webhook data. |
| Lead queue management | Queue leads for calling, track status transitions | Low | Supabase `leads` table with 14 status values. Priority ordering for queue. |
| Post-call routing by outcome | COMMITTED -> payment email, FOLLOW_UP -> schedule, DECLINED -> log | Medium | n8n post-call handler workflow with branching logic. |
| Dashboard: live call monitoring | See active call, recent calls, today's stats | Medium | Poll Supabase every 5s. Active call card, recent call list, stat counters. |
| Dashboard: lead pipeline view | See leads by status, view transcripts | Medium | Kanban columns by status. Click to expand with transcript and recording player. |
| Dashboard: strategy analytics | Track which closing strategies work best | Medium | Bar chart (conversion by strategy), table with totals. Uses `strategy_performance` SQL view. |
| Webhook signature verification | Security -- reject unsigned/forged requests | Low | HMAC-SHA256 using Retell `x-retell-signature` header. |
| Do-not-contact enforcement | Legal compliance -- never call declined/DNC leads | Low | Pre-call check against lead status. Hard block in dialer logic. |
| Rate limiting (1 call/2 min) | Prevent runaway dialer, stay within Retell limits | Low | Enforced in n8n cron interval + backend rate limiter. |
| CSV lead import | Bulk load leads from spreadsheets | Low | n8n workflow with E.164 phone validation and dedup. |
| Payment email on commitment | Close the loop after COMMITTED outcome | Low | Resend API with bank transfer details from knowledge base. |

## Differentiators

Features that set the product apart. Not expected but valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Persona detection + strategy selection | Sarah detects lead persona during discovery and selects the optimal closing strategy from 6 options | Medium | 6 strategies x multiple persona types. Logged per call for continuous improvement loop. |
| Strategy performance heatmap | Visual matrix of strategy x persona conversion rates | Medium | Recharts heatmap on Strategy Analytics tab. Requires 50+ calls for meaningful data. |
| Multi-currency pricing | Sarah quotes in GBP, USD, EUR, NGN based on lead location | Low | Static pricing in `lookup_programme` tool. Currency detected from lead country. |
| Dynamic voice variables | Sarah greets each lead by name using `retell_llm_dynamic_variables` | Low | `{{lead_name}}` and `{{lead_location}}` injected per call via Retell API. |
| Early bird pricing incentive | Time-sensitive discount creates urgency in the close | Low | Part of programme data. Cohort 2 starts April 25, 2026. |
| Call recording + transcript storage | Full audit trail of every conversation | Low | Retell provides recording_url and transcript in `call_ended` webhook. Stored in `call_logs`. |
| Retry logic with backoff | Leads that don't answer get retried up to 2 times with delay | Low | Retry count tracked on leads table. Requeued after configurable delay (default 60 min). |
| British female voice with backchannel | Natural-sounding conversation with "yeah", "uh-huh", "I see" responses | Low | Retell agent config: `enable_backchannel=True`, `backchannel_frequency=0.8`. |
| Speak-during-execution | Sarah says "Let me look that up" while tools execute, avoiding dead air | Low | Set `speak_during_execution=True` on tool definitions in Retell LLM config. |

## Anti-Features

Features to explicitly NOT build.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Pre-contact (WhatsApp/email before call) | Project requires pure cold calling. Pre-contact adds pipeline complexity and delays. | Call leads directly from queue. |
| Audio processing / STT / TTS code | Retell handles all voice. Custom audio duplicates Retell and introduces maintenance debt. | Use Retell SDK and webhooks exclusively. |
| Multi-agent concurrent calling | Single US number, max 1 concurrent call. Concurrent calls add telephony complexity and billing risk. | Sequential calling with 2-minute interval. |
| Real-time WebSocket dashboard | Over-engineering for a single-operator dashboard. Adds complexity for no UX gain. | Poll Supabase every 5-30 seconds. |
| Full Supabase Auth with role-based access | Single operator. Multi-role auth is unnecessary development effort. | Bearer token authentication with DASHBOARD_SECRET_KEY. |
| Strategy auto-optimization | Insufficient data until 200+ calls (Wave 2). Premature optimization leads to bad strategy selection. | Manual weekly review from dashboard data. |
| Mobile app | Dashboard is web-only. React dashboard is already responsive. | Access dashboard from mobile browser if needed. |
| OpenClaw email integration | Explicitly scoped out by project requirements. Resend is simpler. | Use Resend API for all transactional email. |
| Custom conversation flow builder | Retell offers Conversation Flow API now, but LLM-based system prompt is simpler for the 8-stage sales flow. | System prompt with qualification gates and 3 custom tools. |
| Inbound call handling | Scope is outbound cold calling only. Inbound adds separate conversation flows. | Outbound only. If someone calls back, the same agent can answer (Retell handles this). |

## Feature Dependencies

```
Retell Account + API Key
  -> Retell LLM (system prompt + tools) [needs API key]
     -> Voice Agent [needs llm_id]
        -> Phone Number Assignment [needs agent_id, uses weighted agents format]
           -> Outbound Calling [needs from_number configured]

Supabase Schema
  -> Lead Queue Management [needs leads table]
  -> Call Logging [needs call_logs table]
  -> Pipeline Events [needs pipeline_logs table]
  -> Dashboard Queries [needs views: pipeline_snapshot, strategy_performance, todays_calls]

FastAPI Backend [needs Supabase + Retell configured]
  -> Tool Execution Endpoints [/retell/tool]
  -> Webhook Lifecycle Endpoints [/retell/webhook]
  -> Call Initiation Endpoint [/retell/initiate-call]
  -> Dashboard API Endpoints [/api/dashboard/*]

n8n Workflows [need FastAPI backend running + Supabase + Resend configured]
  -> Auto-Dialer [POSTs to /retell/initiate-call]
  -> Post-Call Handler [receives webhooks, queries Supabase, sends email via Resend]
  -> Lead Import [writes to Supabase]

Dashboard [needs Supabase + FastAPI backend]
  -> Live View [polls /api/dashboard/live every 5s]
  -> Pipeline [queries Supabase directly]
  -> Strategy Analytics [queries strategy_performance view]
```

## MVP Recommendation

Prioritize (for Wave 0 -- 10 test calls):

1. **Retell LLM + Agent + Phone** -- Sarah must be able to call and converse
2. **FastAPI webhook backend** -- Tool execution during calls is non-negotiable
3. **Supabase schema + seed data** -- Leads, call_logs, programme data, objection responses
4. **Auto-dialer (n8n)** -- Automated queue processing
5. **Post-call handler (n8n)** -- Outcome routing and logging
6. **Dashboard live view** -- Monitor Wave 0 calls in real-time

Defer to post-Wave 0:
- **Strategy analytics heatmap**: Needs 50+ calls for meaningful data
- **CSV import workflow**: Can manually insert 10 test leads via Supabase UI
- **Lead pipeline kanban**: Nice-to-have for monitoring but not blocking for Wave 0

## Sources

- [Retell AI Changelog](https://www.retellai.com/changelog) -- Feature landscape of voice AI platforms
- [Retell AI Custom LLM Best Practices](https://docs.retellai.com/integrate-llm/llm-best-practice) -- Tool execution and prompt guidance
- [Retell AI Create Phone Call API](https://docs.retellai.com/api-references/create-phone-call) -- Call initiation parameters
