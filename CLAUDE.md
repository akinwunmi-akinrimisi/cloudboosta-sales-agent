# CLAUDE.md — Claude Code Instructions (v2)
## Sarah Voice Sales Agent on Retell AI

---

## PROJECT CONTEXT

You are building "Sarah" — an AI cold-calling sales agent for Cloudboosta.
Sarah calls leads directly (no pre-contact), qualifies them, recommends the
right cloud/DevOps training programme, handles objections, and closes.

**Platform:** Retell AI handles all voice. Your code handles tool execution,
auto-dialer scheduling, and the custom dashboard.

**Do NOT write:** audio processing, STT/TTS, WebSocket media streams, or VAD.
Retell handles all of that.

**DO write:** Retell SDK configuration, webhook endpoints, Supabase queries,
n8n workflows, auto-dialer logic, and a React dashboard.

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
sarah-retell-project/
├── AGENT.md                    # Master DOE
├── CLAUDE.md                   # THIS FILE
├── implementation.md           # 8-phase build plan with prompts
├── closing-strategies.md       # 6 strategies + persona detection
├── skills.md                   # Technical patterns reference
├── skills.sh                   # Environment validation
├── knowledge-base/             # 6 PDF knowledge base documents
├── backend/
│   ├── main.py                 # FastAPI app (webhooks + dashboard API)
│   ├── retell_config.py        # Retell SDK setup (LLM, Agent, Phone)
│   ├── tools.py                # Tool execution handlers
│   ├── dialer.py               # Auto-dialer scheduler logic
│   ├── supabase_client.py      # Supabase connection + queries
│   └── .env.example            # Environment variable template
├── dashboard/
│   ├── src/App.jsx             # React dashboard (3 tabs)
│   ├── src/components/         # LiveView, Pipeline, StrategyAnalytics
│   └── package.json
└── n8n/
    ├── auto-dialer.json        # Scheduled dialer workflow
    ├── post-call-handler.json  # Post-call automation
    └── lead-import.json        # CSV/JSON lead import
```

---

## CRITICAL RULES

### Security
- NEVER hardcode API keys in any file
- Use `os.environ` or `python-dotenv` for all secrets
- `.env` is gitignored. Only `.env.example` is committed.

### Cold Calling Model
- NO pre-contact (no WhatsApp, no email before the call)
- Sarah calls leads directly from Supabase queue
- Auto-dialer runs within scheduled time windows
- Rate limit: 1 call per 2 minutes (configurable)
- Max 2 retries for no-answer/voicemail

### No OpenClaw
- OpenClaw is NOT used in this project
- Email sending uses Resend API (for payment emails post-call)
- All messaging happens through the voice call itself

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
cd backend && uvicorn main:app --reload --port 8000

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
cd dashboard && npm run dev
```
