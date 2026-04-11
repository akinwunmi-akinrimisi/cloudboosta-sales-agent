# John — AI Sales Agent for Cloudboosta

An autonomous AI cold-calling sales agent that qualifies leads, recommends cloud/DevOps training programmes, handles objections using real-time strategy selection, and closes deals — all by voice. Built on Retell AI with a FastAPI backend, React dashboard, and multi-channel pre-contact outreach.

**Version 3.0** | Operscale Systems | 2026

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Features](#features)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Running the Application](#running-the-application)
- [Testing](#testing)
- [Dashboard](#dashboard)
- [Sales Methodology](#sales-methodology)
- [Security](#security)
- [License](#license)

---

## Overview

John is an AI sales agent for **Cloudboosta Technology Solutions Ltd**, a cloud computing and DevOps training provider. John handles the entire sales pipeline:

1. **Pre-contact outreach** — sends intro messages via WhatsApp and email with a Cal.com booking link
2. **Scheduled or cold calls** — calls leads at their preferred time (if they booked) or cold-calls non-responders after 48 hours
3. **Live qualification** — detects the lead's experience level, career goals, and budget sensitivity in real time
4. **Programme recommendation** — maps each lead to the right pathway (Cloud Computing, Advanced DevOps, DevOps Pro, or a bundle)
5. **Objection handling** — responds to 11+ documented objections with multi-layer responses
6. **Closing** — selects from 6 closing strategies based on detected persona type
7. **Post-call automation** — logs outcomes, sends payment emails, schedules follow-ups

Retell AI handles all voice processing (STT, TTS, VAD, LLM orchestration). This codebase handles tool execution, outreach, auto-dialer scheduling, and the monitoring dashboard.

---

## Architecture

```
 LEAD IMPORT (CSV)
       |
       v
 SUPABASE (leads table)
       |
  +----+----+
  v         v
WhatsApp   Email
(OpenClaw) (Resend)
  +Cal.com  +Cal.com
  link      link
  |         |
  +----+----+
       v
 MONITOR RESPONSES
  * Cal.com webhook (booking)
  * OpenClaw webhook (WA reply)
  * n8n polling (backup)
       |
  +----+----+
  v         v
Booked    Replied         No response (48h)
  |         |                    |
  +----+----+                    |
       v                         v
 SCHEDULED CALL            COLD CALL
       |                         |
       +------------+------------+
                    v
           RETELL AI (voice)
           * STT / TTS / VAD
           * LLM (John's brain)
           * Dynamic vars: lead context,
             previous call summaries
                    |
                    v
           POST-CALL AUTOMATION
           * Log transcript + outcome
           * COMMITTED -> payment email
           * FOLLOW_UP -> schedule next
           * DECLINED -> close out
```

### Three-Layer Design

| Layer | Name | Location | Role |
|-------|------|----------|------|
| 1 | Directive | `directives/` | Markdown SOPs per phase — read before acting |
| 2 | Orchestration | Agent + n8n | Interpret directives, route API calls, trigger workflows |
| 3 | Execution | `execution/` | FastAPI server, React dashboard, n8n workflows, Retell config |

---

## Tech Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Voice | [Retell AI](https://retellai.com) | STT, TTS, VAD, LLM orchestration |
| Backend | FastAPI + Uvicorn | Webhook server, tool execution, dashboard API |
| Database | [Supabase](https://supabase.com) (PostgreSQL) | Leads, call logs, bookings, pipeline |
| Orchestration | [n8n](https://n8n.io) | Auto-dialer, post-call workflows, outreach |
| WhatsApp | OpenClaw / Evolution API | Send messages, receive replies, number detection |
| Email | [Resend](https://resend.com) | Intro messages, payment detail emails |
| Booking | [Cal.com](https://cal.com) (self-hosted) | Lead scheduling |
| Telephony | Twilio SIP trunk -> Retell | Outbound/inbound calling |
| Dashboard | React 19 + Vite + Tailwind CSS + Recharts | Live monitoring, pipeline, analytics |

---

## Features

### Multi-Channel Pre-Contact Outreach (v3.0)
- WhatsApp intro message with Cal.com booking link (via OpenClaw/Evolution API)
- Email intro message with booking link (via Resend)
- Automatic WhatsApp number detection before sending
- AI-parsed reply extraction for preferred call times
- 48-hour timeout before cold-calling non-responders

### Voice Calling
- Outbound cold calls via Retell AI with Twilio SIP trunk
- Call memory — retrieves previous call logs before every call so John never treats a returning lead as a first-time contact
- Dynamic variable injection (lead name, email status, previous call summaries, programme discussed)
- Real-time persona detection and strategy selection
- Warm transfer to human advisor (+44 number)

### Auto-Dialer
- Scheduled calling within configured time windows
- Timezone-aware dialing (20+ country codes mapped)
- Batch calling support — up to 18 concurrent calls
- Rate limiting (1 call per 2 minutes minimum)
- Retry logic — max 2 retries for no-answer/voicemail
- Start/stop controls via API and dashboard

### Qualification System
- 3-gate qualification:
  1. AWS SA cert + hands-on? -> Advanced DevOps; else -> Cloud Computing
  2. Goal-based: single pathway / bundle / full programme
  3. Post-DevOps: Platform Engineer OR SRE
- 14-stage pipeline from `new` to `enrolled`

### 6 Closing Strategies
- Doctor Frame, Pain Close, Inverse Close (Dan Lok)
- NEPQ Sequence, Diffusion Framework (Jeremy Miner)
- Direct Close
- Auto-selected based on detected persona (Career Changer, Upskiller, Beginner, Experienced Dev, Price Sensitive, Time Constrained)

### Objection Handling
- 11+ documented objections with multi-layer responses
- A.D.Q. fallback framework for unknown objections
- Persona-specific testimonials

### Post-Call Automation
- Outcome logging (COMMITTED / FOLLOW_UP / DECLINED)
- Payment email with multi-currency pricing (GBP, USD, NGN, EUR)
- Pathway-specific HTML email templates with instalment options
- Follow-up call scheduling
- Transcript and sentiment extraction

### Dashboard
- **Live View** — active call display, recent calls, today's stats, dialer controls
- **Lead Pipeline** — Kanban board by status, search, transcript viewer, CSV import
- **Strategy Analytics** — conversion by strategy, strategy x persona heatmap, trends over time

---

## Project Structure

```
cloudboosta-sales-agent/
|
+-- AGENT.md                     # Master Directive of Execution (DOE)
+-- CLAUDE.md                    # Claude Code development instructions
+-- security.md                  # Security controls and threat model
+-- implementation.md            # 8-phase build plan
+-- closing-strategies.md        # 6 closing strategies + persona detection
+-- skills.md                    # Technical patterns reference (SDK, DB, APIs)
+-- .env.example                 # Environment variable template
|
+-- knowledge-base/              # Domain knowledge (6 documents)
|   +-- programmes.pdf           # 4 training pathways and pricing
|   +-- faqs.pdf                 # Frequently asked questions
|   +-- payment-details.pdf      # Multi-currency pricing + instalments
|   +-- conversation-sequence.pdf # Cold call flows + qualification gates
|   +-- objection-handling.pdf   # 11 objections with multi-layer responses
|   +-- webinar-schedule.md      # Webinar dates and registration
|
+-- directives/                  # Per-phase Standard Operating Procedures
|   +-- 00_foundation.md         # Accounts, SDK, migrations
|   +-- 01_retell_llm.md         # LLM configuration
|   +-- 02_system_prompt.md      # John's conversation prompts
|   +-- 03_voice_agent.md        # Agent creation, voice selection
|   +-- 04_webhook_backend.md    # FastAPI endpoints
|   +-- 05_auto_dialer.md        # Scheduling, retry logic
|   +-- 06_post_call.md          # Post-call automation
|   +-- 07_dashboard.md          # Dashboard specifications
|
+-- execution/
|   +-- backend/                 # FastAPI webhook server (~4,300 lines)
|   |   +-- main.py              # App init, CORS, auth, webhooks, endpoints
|   |   +-- tools.py             # Tool execution (programme lookup, objections, logging)
|   |   +-- dashboard_routes.py  # Dashboard API (live, pipeline, strategy, stats)
|   |   +-- dialer.py            # Auto-dialer logic (scheduling, queue, batch)
|   |   +-- postcall_email.py    # Payment email sending (4 templates, multi-currency)
|   |   +-- retell_config.py     # Retell SDK initialization
|   |   +-- supabase_client.py   # Supabase client setup
|   |   +-- timezone_util.py     # Phone -> timezone mapping (20+ countries)
|   |   +-- webinar_schedule.py  # Call type determination
|   |   +-- requirements.txt     # Python dependencies
|   |   +-- scripts/             # Setup automation (create LLM, agent, verify)
|   |   +-- prompts/             # John's system prompts
|   |   +-- schema/              # Supabase schema SQL
|   |   +-- seeds/               # Test data
|   |
|   +-- dashboard/               # React monitoring app
|   |   +-- src/
|   |   |   +-- App.jsx          # Router
|   |   |   +-- Layout.jsx       # Navigation shell
|   |   |   +-- AuthContext.jsx   # Bearer token management
|   |   |   +-- api.js           # API client
|   |   |   +-- constants.js     # Status colours, persona mappings
|   |   |   +-- pages/           # LiveView, PipelineView, StrategyView
|   |   |   +-- components/      # 20+ components (Kanban, charts, cards, modals)
|   |   |   +-- hooks/           # Custom React hooks
|   |   +-- package.json
|   |
|   +-- outreach/                # Email and WhatsApp templates
|       +-- outreach-email.html  # Pre-contact intro email
|       +-- payment-emails/      # 4 pathway-specific payment email templates
```

---

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- A [Retell AI](https://retellai.com) account with API key
- A [Supabase](https://supabase.com) project (or self-hosted instance)
- A [Twilio](https://twilio.com) account with a phone number
- An [n8n](https://n8n.io) instance for workflow orchestration
- A [Resend](https://resend.com) account for email
- OpenClaw / Evolution API instance for WhatsApp (optional, for v3.0 outreach)
- Cal.com instance for booking (optional, for v3.0 outreach)

### Installation

1. **Clone the repository**

   ```bash
   git clone git@github.com:akinwunmi-akinrimisi/cloudboosta-sales-agent.git
   cd cloudboosta-sales-agent
   ```

2. **Set up the backend**

   ```bash
   cd execution/backend
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

3. **Set up the dashboard**

   ```bash
   cd execution/dashboard
   npm install
   ```

4. **Configure environment variables**

   ```bash
   cp .env.example .env
   # Edit .env with your actual API keys and configuration
   ```

5. **Initialize the database**

   Run the SQL files in `execution/backend/schema/` against your Supabase instance to create the required tables and views:
   - `leads` — lead records with status, contact info, programme tracking
   - `call_logs` — transcripts, outcomes, strategy/persona tracking
   - `dial_schedules` — dialer time windows
   - `pipeline_logs` — event log with JSONB details
   - Views: `pipeline_snapshot`, `strategy_performance`, `todays_calls`, `leads_ready_to_call`

6. **Create the Retell LLM and agent**

   ```bash
   cd execution/backend
   python scripts/create_llm.py
   python scripts/create_agent.py
   ```

---

## Environment Variables

Copy `.env.example` and fill in your values:

| Variable | Description |
|----------|-------------|
| `RETELL_API_KEY` | Retell AI API key |
| `RETELL_AGENT_ID` | Retell agent ID (created in step 6) |
| `RETELL_LLM_ID` | Retell LLM ID (created in step 6) |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Supabase service role key (backend only) |
| `SUPABASE_ANON_KEY` | Supabase anon key (frontend) |
| `TWILIO_ACCOUNT_SID` | Twilio account SID |
| `TWILIO_AUTH_TOKEN` | Twilio auth token |
| `WEBHOOK_BASE_URL` | Public URL for webhook endpoints |
| `WEBHOOK_SECRET` | HMAC secret for webhook signature verification |
| `DASHBOARD_SECRET_KEY` | Bearer token for dashboard API authentication |
| `DASHBOARD_ORIGIN` | Allowed CORS origin for the dashboard |
| `N8N_BASE_URL` | n8n instance URL |
| `N8N_WEBHOOK_BASE` | n8n webhook base URL |
| `N8N_API_KEY` | n8n API key |
| `OPENCLAW_API_URL` | OpenClaw/Evolution API base URL (WhatsApp) |
| `OPENCLAW_API_KEY` | OpenClaw API key |
| `CAL_COM_URL` | Cal.com instance URL |
| `CAL_COM_API_KEY` | Cal.com API key |
| `RESEND_API_KEY` | Resend API key for email |

---

## Running the Application

### Backend (FastAPI)

```bash
cd execution/backend
uvicorn main:app --reload --port 8000
```

The server exposes:
- `POST /retell/tool` — tool execution from Retell during calls
- `POST /retell/webhook` — call lifecycle events (started, ended, analyzed)
- `POST /retell/initiate-call` — trigger an outbound call to a lead
- `POST /dialer/start` — start the auto-dialer
- `POST /dialer/stop` — stop the auto-dialer
- `GET /api/dashboard/*` — dashboard API (live view, pipeline, strategy, stats)
- `POST /api/leads/import` — CSV lead import
- `GET /health` — health check

### Dashboard (React)

```bash
cd execution/dashboard
npm run dev
```

Opens at `http://localhost:5173` by default.

### Validate Environment

```bash
bash skills.sh
```

### Test Retell Connection

```bash
python -c "from retell import Retell; import os; c = Retell(api_key=os.environ['RETELL_API_KEY']); print(c.agent.list())"
```

---

## Testing

### Unit Tests

```bash
cd execution/backend
pytest
```

40+ tests covering API endpoints, tool execution, and dialer logic.

### Manual Test Call

```bash
curl -X POST http://localhost:8000/retell/initiate-call \
  -H "Content-Type: application/json" \
  -d '{"lead_id": "TEST_UUID"}'
```

### Test WhatsApp (OpenClaw)

```bash
curl -X POST $OPENCLAW_API_URL/message/sendText \
  -H "apikey: $OPENCLAW_API_KEY" \
  -d '{"number": "YOUR_NUMBER", "text": "Test from John agent"}'
```

### Test Cal.com Availability

```bash
curl -H "Authorization: Bearer $CAL_COM_API_KEY" \
  "$CAL_COM_URL/api/v1/availability"
```

---

## Dashboard

The React dashboard has three tabs:

### Live View
- Active call display with real-time status
- Recent call feed
- Today's statistics (calls made, outcomes, conversion rate)
- Auto-dialer controls (start/stop, schedule configuration)

### Lead Pipeline
- Kanban board with 14 pipeline stages
- Lead search and filtering
- Call transcript viewer
- CSV import for bulk lead upload
- Lead detail cards with full history

### Strategy Analytics
- Conversion rate by closing strategy
- Strategy x persona heatmap
- Trend charts over time
- Performance comparisons

---

## Sales Methodology

### Persona Detection

During discovery, John classifies each lead into one of six personas:

| Persona | Primary Strategy | Fallback |
|---------|-----------------|----------|
| Career Changer | Pain Close | NEPQ |
| Upskiller | Doctor Frame | Direct Close |
| Beginner (Fearful) | NEPQ | Diffusion |
| Experienced Dev | Inverse Close | Doctor Frame |
| Price Sensitive | Diffusion | Pain Close |
| Time Constrained | Direct Close | NEPQ |

### Call Outcomes

Every call ends with one of three classifications:
- **COMMITTED** — triggers payment email with programme details and pricing
- **FOLLOW_UP** — schedules a specific date/time for the next call
- **DECLINED** — closes the lead respectfully (marked `do_not_contact`)

### Knowledge Base

John draws on six documents during calls:
- **Programmes** — 4 training pathways (Cloud Computing, Advanced DevOps, DevOps Pro, bundles)
- **Payment Details** — multi-currency pricing (GBP, USD, NGN, EUR) with instalment options
- **Conversation Sequence** — structured call flows and qualification gates
- **Objection Handling** — 11+ objections with multi-layer responses
- **FAQs** — common questions and answers
- **Webinar Schedule** — upcoming sessions and registration

---

## Security

Security controls are documented in detail in `security.md`. Key measures:

- **Secrets** — all API keys via environment variables, never hardcoded, 90-day rotation
- **Webhook verification** — HMAC-SHA256 signature validation on all Retell webhooks
- **Authentication** — bearer token on all dashboard API endpoints
- **Rate limiting** — per-IP limits on API endpoints, 1 call per 2 minutes on dialer
- **Database** — RLS enabled, parameterized queries, service key restricted to backend
- **Input validation** — E.164 phone format, CSV sanitization (formula injection prevention), Pydantic models
- **Telephony** — toll fraud prevention (blocked premium prefixes), max concurrent call limits, do-not-call enforcement
- **PII protection** — phone numbers masked in logs (`+234****1234`), no full keys logged
- **CORS** — restricted to configured dashboard origin
- **Headers** — Content Security Policy, X-Frame-Options, X-Content-Type-Options

---

## Infrastructure

| Component | Location | Purpose |
|-----------|----------|---------|
| Retell AI | Cloud (retellai.com) | Voice processing |
| Supabase | supabase.operscale.cloud | PostgreSQL database |
| n8n | VPS #1 (Hostinger) | Workflow orchestration |
| OpenClaw/Evolution API | VPS #2 (Hostinger) | WhatsApp messaging |
| Cal.com | VPS (self-hosted) | Booking and scheduling |
| Resend | Cloud API | Email delivery |
| Twilio | Cloud | SIP trunk to Retell |

---

## Key Dependencies

### Backend (Python)
- `retell-sdk` 5.8.0 — Retell AI SDK
- `fastapi` 0.115.0 — Web framework
- `uvicorn` 0.32.0 — ASGI server
- `supabase` 2.12.0 — Supabase client
- `httpx` 0.27.0 — Async HTTP client
- `slowapi` 0.1.9 — Rate limiting
- `pydantic` 2.9.0 — Data validation
- `python-dotenv` 1.0.1 — Environment variable loading

### Dashboard (JavaScript)
- `react` 19.0.0 — UI framework
- `react-router-dom` 6.30.3 — Client-side routing
- `recharts` 3.0.0 — Charts and data visualization
- `@supabase/supabase-js` 2.45.0 — Supabase client
- `lucide-react` 1.8.0 — Icons
- `tailwindcss` 3.4.4 — Utility-first CSS
- `vite` 6.2.0 — Build tool

---

## Build Phases

The project follows an 8-phase implementation plan (see `implementation.md`):

| Phase | Name | Status |
|-------|------|--------|
| 0 | Skill Installation | Complete |
| 1 | Foundation (accounts, SDK, schema) | Complete |
| 2 | Retell LLM Configuration | Complete |
| 3 | Voice Agent + Phone | Complete |
| 4 | Webhook Backend | Complete |
| 5 | Auto-Dialer + Retry Logic | Complete |
| 6 | Post-Call Automation | Complete |
| 7 | Dashboard | Complete |
| 8 | Testing + Optimization | Ongoing |

---

## License

Proprietary. All rights reserved by Operscale Systems / Cloudboosta Technology Solutions Ltd.
