# Agent Instructions (DOE)
## Sarah — AI Cold-Calling Sales Agent on Retell AI
### Directive → Observation → Experiment

> **AI is probabilistic. Sales pipeline execution must be deterministic.**
> This system separates those responsibilities. Retell AI handles all voice processing.
> Your backend handles tool execution, scheduling, and data persistence.
> Every call outcome is logged. Every strategy is tracked. The system learns what works.
> If a lead says "no," respect it immediately. If the dialer breaks, the pipeline stops.
> Reliability and trust are non-negotiable.

**Version 2.0 | Operscale Systems | March 2026**
**Owner:** Akinwunmi Akinrimisi
**Client:** Cloudboosta Technology Solutions Ltd
**Stack:** Retell AI (voice platform) + Supabase (self-hosted PostgreSQL at supabase.operscale.cloud) + n8n (self-hosted on Hostinger KVM 4) + Resend (email delivery) + FastAPI (webhook backend)

---

## ⚠️ IMMUTABLE — Non-Negotiable Operating Rules

All work must:

- Read the relevant `directives/` file before writing or modifying any workflow, endpoint, or prompt.
- Push every repeatable operation into deterministic scripts in `execution/`.
- Treat every error as a learning signal — self-anneal by fixing the script, then updating the directive.
- **Never hardcode API keys** (Retell, Supabase, Twilio, Resend). Always reference environment variables. Any key exposed in code, workflow JSON, or logs must be rotated immediately.
- Read `security.md` before writing ANY code. Every endpoint, query, and data flow must satisfy the security controls defined there.
- **Never call a lead marked `do_not_contact` or `declined`.** The pre-call check is non-negotiable.
- **Never guarantee job outcomes.** Sarah uses "opportunity" and "support", never "guarantee" or "promise".
- All programme data comes from the knowledge base — Sarah never fabricates details.
- Every call must end with a classification: COMMITTED, FOLLOW_UP, or DECLINED.
- FOLLOW_UP must have a specific date/time locked in. "I'll get back to you" is not acceptable.
- Do not rewrite or regenerate this file unless explicitly instructed.

---

## 1. The 3-Layer Architecture

| Layer | Name | What lives here | Your role |
|-------|------|-----------------|-----------|
| **1** | Directive | `directives/` — Markdown SOPs per project phase. Goals, inputs, tools, outputs, edge cases. | READ before acting |
| **2** | Orchestration | **THIS AGENT — you.** Interpret directives, route API calls, trigger n8n workflows, handle errors, update directives. | DECIDE & ROUTE |
| **3** | Execution | `execution/` — FastAPI webhook server, Retell SDK config scripts, n8n workflow JSONs, Supabase migrations. | RUN & OBSERVE |

**Example:** You don't configure the Retell agent by guessing parameters. You read `directives/03_voice_agent.md`, determine the required voice, language, and behaviour settings, then call `client.agent.create()`. If Retell returns an error, you parse the response, fix the parameters, retest, and update the directive with what you learned.

---

## 2. System Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌───────────────────┐
│  Lead's Phone   │◄───►│   Retell AI      │◄───►│  Webhook Backend  │
│  (+234/+44/+1)  │voice│  • STT (speech)  │text │  (FastAPI on VPS) │
│                 │     │  • TTS (voice)   │     │  • Tool execution │
│                 │     │  • VAD (turns)   │     │  • Supabase CRUD  │
│                 │     │  • LLM (brain)   │     │  • Dialer control │
└─────────────────┘     └──────────────────┘     └───────────────────┘
                               │                         │
                               │ webhooks                │
                               ▼                         ▼
                        ┌──────────────────┐     ┌───────────────────┐
                        │  n8n (VPS #1)    │     │  Supabase         │
                        │  • Auto-dialer   │     │  • leads          │
                        │  • Post-call     │     │  • call_logs      │
                        │  • Lead import   │     │  • pipeline_logs  │
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

**What each component does:**

| Component | Responsibility | You write code for it? |
|-----------|---------------|----------------------|
| Retell AI | All voice: STT, TTS, VAD, turn-taking, interruptions, LLM orchestration | No — config only via SDK |
| Retell LLM | Sarah's brain: system prompt, conversation flow, strategy selection | Config via SDK — the prompt is the product |
| Webhook Backend | Executes tools when Sarah calls a function during a live call | Yes — FastAPI server |
| Supabase | All data: leads, call logs, strategy tracking, pipeline events | Yes — schema + queries |
| n8n | Scheduled auto-dialer, post-call automation, lead import | Yes — workflow builder |
| Dashboard | Operator view: live calls, pipeline, strategy analytics | Yes — React app (GSD skill) |

---

## 3. Telephony

- **Number:** +1 161 570 0419 (US, currently on Twilio)
- **Migration:** Import to Retell via `client.phone_number.import_twilio()`
- **Fallback:** If import fails, configure Twilio SIP trunk → Retell SIP endpoint
- **Outbound:** `client.call.create_phone_call()` triggers cold calls from this number
- **Caller ID:** +1 161 570 0419 shows on the lead's phone

---

## 4. Cold Calling Model

This is pure cold calling. No WhatsApp, no email, no pre-contact. Sarah calls leads directly from the Supabase queue.

**Scheduled Auto-Dialer:**

| Parameter | Value | Configurable? |
|-----------|-------|--------------|
| Dial window | Set by operator (e.g., 9am-5pm WAT) | Yes — `dial_schedules` table |
| Call interval | 1 call per 2 minutes minimum | Yes — `calls_per_hour` field |
| Max concurrent | 1 call at a time | Fixed for cold calling |
| Max daily calls | 200 | Configurable in backend |
| Max retries | 2 per lead (no-answer/voicemail) | Yes — `max_retries` field |
| Retry delay | 60 minutes (busy), next day (no-answer) | Configurable |

**Call disposition flow:**

```
Lead picks up → Conversation → Outcome logged
No answer     → status='no_answer' → retry next day (max 2)
Voicemail     → status='voicemail' → retry next day (max 2)
Busy          → status='busy' → retry in 60 minutes
Invalid       → status='invalid_number' → skip permanently
Exhausted     → status='exhausted' → no more retries
```

---

## 5. Pipeline Stages

| # | Stage | System | Status Value | Directive |
|---|-------|--------|-------------|-----------|
| 1 | Lead uploaded | Supabase (CSV/manual) | `new` | `directives/05_lead_import.md` |
| 2 | Queued for dialing | n8n auto-dialer | `queued` | `directives/05_auto_dialer.md` |
| 3 | Call initiated | Retell API | `calling` | `directives/05_auto_dialer.md` |
| 4 | No answer / voicemail | Retell webhook | `no_answer` / `voicemail` | `directives/06_post_call.md` |
| 5 | Conversation | Retell + LLM | `in_call` | `directives/02_system_prompt.md` |
| 6 | Outcome classified | Retell webhook → n8n | `committed` / `follow_up` / `declined` | `directives/06_post_call.md` |
| 7 | Payment email | n8n → Resend | `payment_pending` | `directives/06_post_call.md` |
| 8 | Follow-up scheduled | n8n scheduler | `follow_up_scheduled` | `directives/06_post_call.md` |
| 9 | Payment received | Manual check | `enrolled` | — |

---

## 6. Sarah's Conversation Flow

Eight stages per call. Target duration: 5-7 minutes.

```
OPEN → DISCOVERY → QUALIFY → BRIDGE → PRESENT → HANDLE OBJECTIONS → CLOSE → FOLLOW-UP LOCK
```

| Stage | Duration | Purpose | Key Actions |
|-------|----------|---------|-------------|
| OPEN | 30s | Earn permission to talk (cold call) | Introduce, state value prop, ask for 2 minutes |
| DISCOVERY | 60-90s | Ask 4-5 qualifying questions | Current role, motivation, experience, certs, location |
| QUALIFY | 15s | Apply 3-gate decision tree | Gate 1: Cloud Computing or skip? Gate 2: Bundle? Gate 3: Specialise? |
| BRIDGE | 15s | Summarise their story back | Proves Sarah listened. Never skip. |
| PRESENT | 60-90s | Present the recommended programme | Name, duration, highlights, format, differentiator, social proof, price |
| OBJECTIONS | 60-120s | Handle resistance with layered responses | 11 objection types, multi-layer responses |
| CLOSE | 30s | Get commitment | Strategy-specific close (6 strategies available) |
| FOLLOW-UP LOCK | 15s | If not ready, lock specific date/time | Never accept vague "I'll get back to you" |

**Qualification Gate Logic:**

- **Gate 1:** Everyone starts at Cloud Computing UNLESS they hold AWS Solutions Architect certification AND have multiple hands-on projects → then skip to Advanced DevOps
- **Gate 2:** Based on goal → single pathway (£1,350) / Zero to Cloud DevOps (£2,400) / Zero to DevOps Pro (£4,500)
- **Gate 3:** After DevOps → Platform Engineer (monitoring/security focus) OR SRE (IaC/multi-cloud focus)

---

## 7. Closing Strategy System

Sarah has 6 closing strategies, selected based on lead persona detected during DISCOVERY. See `closing-strategies.md` for full definitions.

| # | Strategy | Source | Best For |
|---|----------|--------|----------|
| 1 | Doctor Frame | Dan Lok | Upskillers, experienced devs |
| 2 | Pain Close | Dan Lok | Career changers, frustrated leads |
| 3 | Inverse Close | Dan Lok | Analytical, sceptical, burned-before leads |
| 4 | NEPQ Sequence | Jeremy Miner | Beginners, fearful leads |
| 5 | Diffusion Framework | Jeremy Miner | Price-sensitive, "need to think" leads |
| 6 | Direct Close | — | Already-warm leads, strong buying signals |

**Adaptive learning:** After each call, `closing_strategy_used` + `lead_persona` + `outcome` are logged to `call_logs`. Weekly analysis via the dashboard reveals which strategy converts best per persona. System prompt is updated monthly based on real data.

---

## 8. Knowledge Base

Six PDF documents contain all programme data Sarah draws from:

| Document | Content | Pages |
|----------|---------|-------|
| `programmes.pdf` | 4 pathways, pricing, delivery model, career outcomes | 3 |
| `faqs.pdf` | 19 Q&As covering every common lead question | 2 |
| `payment-details.pdf` | Bank transfer details: GBP/USD/EUR (Revolut) + NGN (GTBank) | 2 |
| `conversation-sequence.pdf` | 8-stage call flow, 3 qualification gates, outcome rules | 4 |
| `objection-handling.pdf` | 11 objections with multi-layer responses + frequency table | 8 |
| `coming-soon.pdf` | Future programmes, redirect protocol | 1 |

**Authoritative pricing (never change without explicit instruction):**

| Option | Standard | Early Bird | USD | EUR | NGN |
|--------|----------|------------|-----|-----|-----|
| 1 pathway (8 wks) | £1,500 | £1,350 | $1,850 | €1,650 | ₦2,700,000 |
| 2 pathways (16 wks) | £3,000 | £2,400 | $3,300 | €2,900 | ₦4,800,000 |
| 3 pathways (24 wks) | £4,500 | £3,450 | $4,800 | €4,100 | ₦6,900,000 |
| All 4 (32 wks) | £6,000 | £4,500 | $6,150 | €5,300 | ₦9,000,000 |

Cohort 2 starts: **Saturday 25 April 2026**

---

## 9. Custom Functions (Tools)

Sarah can invoke these during a live call. Retell sends the tool call to your webhook backend, which executes it and returns the result.

| Function | Purpose | Parameters | Webhook |
|----------|---------|-----------|---------|
| `lookup_programme` | Get programme details for a given experience level | `experience_level`, `interest_area` | POST /retell/tool |
| `get_objection_response` | Get layered response for a specific objection | `objection_type` (enum) | POST /retell/tool |
| `log_call_outcome` | Log the final call result | `outcome`, `programme_recommended`, `summary`, `objections_raised`, `follow_up_date`, `closing_strategy_used`, `lead_persona` | POST /retell/tool |
| `end_call` | End the call | `reason` | Built-in Retell |
| `transfer_call` | Transfer to human advisor | `transfer_to` (+44 7592 233052) | Built-in Retell |

---

## 10. Dashboard

Three-tab React application built with GSD skill:

| Tab | Shows | Refresh Rate |
|-----|-------|-------------|
| Live View | Active call card (name, timer, strategy), recent calls, today's stats, dialer start/stop | 5 seconds |
| Lead Pipeline | Kanban by status, search, click for transcript, CSV upload | 30 seconds |
| Strategy Analytics | Conversion by strategy, strategy×persona heatmap, daily trends | 30 seconds |

---

## 11. Self-Annealing Loop

When something goes wrong during the pipeline:

```
1. OBSERVE  — Read the error from Retell webhook, n8n execution log, or Supabase pipeline_logs
2. DIAGNOSE — Identify root cause (wrong prompt? tool failure? rate limit? bad phone number?)
3. FIX      — Patch the specific component (system prompt, webhook handler, n8n workflow)
4. CONFIRM  — Run a test call or test webhook to verify the fix
5. UPDATE   — Update the relevant directive in directives/ with what was learned
6. CONTINUE — Resume the pipeline from where it stopped
```

**Example:** Sarah recommends the wrong programme to a lead with 5 years of cloud experience. Diagnosis: the system prompt's Gate 1 logic doesn't account for extensive experience without a formal certification. Fix: update the system prompt to include "extensive hands-on experience (5+ years)" as an alternative to "AWS SA cert + projects" for skipping Cloud Computing. Confirm: test with a simulated discovery conversation. Update: add the edge case to `directives/02_system_prompt.md`. Continue.

---

## 12. Known Constraints

| Constraint | Impact | Mitigation |
|------------|--------|-----------|
| Retell free tier: limited concurrent calls | Can only run 1 call at a time | Auto-dialer enforces max_concurrent=1 |
| Twilio trial: must verify every outbound number | Can't cold-call unverified numbers | Upgrade Twilio account ($20) before Wave 1 |
| US number calling international leads | Leads may not pick up unknown US number | Warn in WhatsApp community first (Wave 0 only) |
| GPT-4o-mini context window: 128K tokens | Long system prompts reduce available context | Keep system prompt under 8K tokens |
| Retell webhook timeout: 20 seconds | Tool execution must be fast | Cache programme data, pre-compute objection responses |
| Cold calling = low pick-up rate (~25%) | Most calls will be no-answer | Auto-retry logic, max 2 retries per lead |
| Strategy tracking needs volume | Need 30+ calls per strategy to see patterns | Don't optimise strategies until Wave 2 (200+ calls) |

---

## 13. Success Metrics

| Metric | Wave 0 (10) | Wave 1 (50) | Wave 2 (200) | Source |
|--------|-------------|-------------|--------------|--------|
| Pick-up rate | >50% (friendly contacts) | >25% | >25% | Supabase |
| Completion rate | >80% | >60% | >60% | Retell analytics |
| Commitment rate | Testing only | >5% | >8% | call_logs |
| Avg call duration | 3-7 min | 3-7 min | 3-7 min | Retell analytics |
| Strategy data points | — | 30+ total | 30+ per strategy | call_logs |

---

## 14. Directory Structure

```
sarah-retell-project/
├── AGENT.md                    ← THIS FILE — read first, always
├── CLAUDE.md                   ← Claude Code operating instructions
├── security.md                 ← Security controls — read before writing ANY code
├── implementation.md           ← 8-phase build plan with prompts per task
├── closing-strategies.md       ← 6 strategies + persona detection + tracking SQL
├── skills.md                   ← Technical patterns (Retell SDK, Supabase, n8n, FastAPI)
├── skills.sh                   ← Environment validation script
├── knowledge-base/             ← 6 PDF documents (programme data, objections, etc.)
├── directives/                 ← Per-phase SOPs (created during build)
│   ├── 00_foundation.md
│   ├── 01_retell_llm.md
│   ├── 02_system_prompt.md
│   ├── 03_voice_agent.md
│   ├── 04_webhook_backend.md
│   ├── 05_auto_dialer.md
│   ├── 06_post_call.md
│   └── 07_dashboard.md
├── execution/
│   ├── backend/                ← FastAPI webhook server
│   ├── dashboard/              ← React app
│   └── n8n/                    ← Workflow JSON exports
└── .env.example                ← Template for all secrets (NEVER commit .env)
```

---

## Summary

You operate between **human intent** (a CSV of phone numbers in Supabase) and **deterministic sales pipeline execution** (a completed call with outcome, transcript, and strategy data logged).

Retell handles the voice.
The LLM handles the conversation.
Your backend handles the tools.
n8n handles the scheduling.
Supabase holds the truth.
The dashboard shows the picture.

Read directives.
Make decisions.
Run tools.
Observe results.
Improve the system.

Be pragmatic. Be reliable.

**Self-anneal.**

---

> ⚠️ **IMMUTABLE** — Do not rewrite, regenerate, summarise, or replace this file unless explicitly instructed.
> These operating rules are authoritative. Before performing any task: read this file. Apply it strictly.