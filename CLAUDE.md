# CLAUDE.md — Claude Code Instructions (v2)
## John Voice Sales Agent on Retell AI

---

## PROJECT CONTEXT

You are building "John" — an AI cold-calling sales agent for Cloudboosta.
John calls leads directly (no pre-contact), qualifies them, recommends the
right cloud/DevOps training programme, handles objections, and closes.

**Platform:** Retell AI handles all voice. Your code handles tool execution,
auto-dialer scheduling, and the custom dashboard.

**Do NOT write:** audio processing, STT/TTS, WebSocket media streams, or VAD.
Retell handles all of that.

**DO write:** Retell SDK configuration, webhook endpoints, Supabase queries,
n8n workflows, auto-dialer logic, and a React dashboard.

v3.0 adds multi-channel pre-contact outreach. Before cold calling, John sends intro messages via WhatsApp (OpenClaw) and email (Resend) with a Cal.com booking link. Leads who book or reply are called at their preferred time. Leads who don't respond within 48h are cold-called directly.

---

## SKILLS

### GSD (Get Shit Done)
Production-quality code from day one. Ship fast, test immediately, iterate.
Use GSD when building: dashboard, webhook server, any user-facing component.

### Agency Agents (github.com/msitarzewski/agency-agents)
Reusable patterns for agent orchestration, webhook handlers, state machines.
Use Agency Agents patterns for: lead status transitions, tool call routing,
auto-dialer state management.

**Installation:** See implementation.md Phase 0 for setup instructions.

---

## FILE STRUCTURE

```
john-retell-project/
├── AGENT.md                    # Master DOE — read first, always
├── CLAUDE.md                   # THIS FILE
├── security.md                 # Security controls — read before writing ANY code
├── implementation.md           # 8-phase build plan with prompts
├── closing-strategies.md       # 6 strategies + persona detection
├── skills.md                   # Technical patterns reference
├── skills.sh                   # Environment validation
├── .env.example                # Template for all secrets (NEVER commit .env)
├── knowledge-base/             # 6 PDF knowledge base documents
├── directives/                 # Per-phase SOPs (read before acting)
│   ├── 00_foundation.md
│   ├── 01_retell_llm.md
│   ├── 02_system_prompt.md
│   ├── 03_voice_agent.md
│   ├── 04_webhook_backend.md
│   ├── 05_auto_dialer.md
│   ├── 06_post_call.md
│   └── 07_dashboard.md
├── execution/
│   ├── backend/                # FastAPI webhook server
│   │   ├── main.py
│   │   ├── retell_config.py
│   │   ├── tools.py
│   │   ├── dialer.py
│   │   ├── supabase_client.py
│   │   └── requirements.txt
│   ├── dashboard/              # React app (3 tabs)
│   │   ├── src/App.jsx
│   │   ├── src/components/
│   │   └── package.json
│   ├── n8n/                    # Workflow JSON exports
│   │   ├── auto-dialer.json
│   │   ├── post-call-handler.json
│   │   └── lead-import.json
│   ├── cal-com/               # Cal.com Docker config + setup scripts
│   └── outreach/              # Email templates + WhatsApp message templates
```

---

## CRITICAL RULES

### Security
- NEVER hardcode API keys in any file
- Use `os.environ` or `python-dotenv` for all secrets
- `.env` is gitignored. Only `.env.example` is committed.

### Cold Calling Model
- NO pre-contact (no WhatsApp, no email before the call)
- John calls leads directly from Supabase queue
- Auto-dialer runs within scheduled time windows
- Rate limit: 1 call per 2 minutes (configurable)
- Max 2 retries for no-answer/voicemail

### Channel Routing
- WhatsApp outreach uses OpenClaw/Evolution API (VPS #2) — NOT Twilio WhatsApp
- Email outreach uses Resend API — NOT OpenClaw
- Voice calls use Retell AI via Twilio SIP trunk

### Multi-Channel Outreach
- OpenClaw/Evolution API is on VPS #2 (Hostinger). Already running.
- Cal.com will be self-hosted on VPS. Docker deployment.
- Email outreach uses Resend API — not OpenClaw.
- WhatsApp outreach uses OpenClaw — not Twilio WhatsApp.
- Before sending WhatsApp, ALWAYS check if number is registered on WhatsApp via OpenClaw's number check API.

### Call Memory
- Before EVERY call to an existing lead, retrieve previous call_logs from Supabase and inject summaries into Retell dynamic variables.
- John must NEVER treat a returning lead as a first-time contact.

### Email Handling
- If lead's email exists in Supabase, John NEVER asks for it on the call.
- When asking a lead to spell their email on a call, NEVER use NATO alphabet. Use natural language only.

---

## IMPLEMENTATION ORDER

Follow `implementation.md` strictly:

0. **Skills** — Install GSD + Agency Agents
1. **Foundation** — Accounts, SDK, Twilio→Retell migration, Supabase schema
2. **Retell LLM** — System prompt, custom functions
3. **Voice Agent** — Agent creation, voice, phone assignment
4. **Webhook Backend** — FastAPI server for tools + dashboard API
5. **Auto-Dialer** — n8n scheduled workflow + post-call handler
6. **Dashboard** — React app with live view, pipeline, strategy analytics
7. **Testing** — Self-test, then Wave 0 (10 real calls)
8. **Optimization** — Weekly strategy review from dashboard data

---

## TESTING COMMANDS

```bash
# Validate environment
bash skills.sh

# Run webhook server
cd execution/backend && uvicorn main:app --reload --port 8000

# Test Retell connection
python -c "from retell import Retell; import os; c = Retell(api_key=os.environ['RETELL_API_KEY']); print(c.agent.list())"

# Trigger a test call
curl -X POST http://localhost:8000/retell/initiate-call \
  -H "Content-Type: application/json" \
  -d '{"lead_id": "TEST_UUID"}'

# Start auto-dialer
curl -X POST http://localhost:8000/dialer/start \
  -H "Content-Type: application/json" \
  -d '{"schedule_id": "SCHEDULE_UUID"}'

# Run dashboard dev server
cd execution/dashboard && npm run dev

# Test OpenClaw WhatsApp connection
curl -X POST $OPENCLAW_API_URL/message/sendText \
  -H "apikey: $OPENCLAW_API_KEY" \
  -d '{"number": "YOUR_NUMBER", "text": "Test from John agent"}'

# Test Cal.com API
curl -H "Authorization: Bearer $CAL_COM_API_KEY" \
  "$CAL_COM_URL/api/v1/availability"

# Test context retrieval for a lead
curl http://localhost:8000/api/lead-context/TEST_LEAD_UUID
```


---

## FRONTEND DESIGN SKILL (Anthropic)

The frontend-design skill is installed and activates automatically when
writing HTML, CSS, React, or any UI component. It produces production-grade,
distinctive interfaces. Use it for all dashboard work (Phase 6).

Do NOT produce generic Bootstrap or Material UI output. Follow the
frontend-design skill's guidance for clean, professional design.

## GSTACK (Selective Use Only)

gstack is installed but Superpowers controls the build workflow.

**DO NOT USE these gstack skills** (Superpowers handles planning/review):
/office-hours, /plan-ceo-review, /plan-eng-review, /plan-design-review

**DO USE these gstack skills:**
- /qa — Full QA testing (Phase 7 and before any deploy)
- /qa-only — Quick targeted test pass
- /browse — Headless browser for testing endpoints
- /careful — Warns before destructive commands
- /freeze — Locks edits to a specific directory (use when touching production)
- /guard — Combines /careful + /freeze
- /unfreeze — Removes freeze boundary
- /review — Final code review before deploy ONLY (not during build)

Available gstack skills: /qa, /qa-only, /browse, /careful, /freeze,
/guard, /unfreeze, /review, /investigate, /retro, /gstack-upgrade