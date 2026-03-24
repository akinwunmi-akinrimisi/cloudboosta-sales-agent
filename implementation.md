# implementation.md — Phased Build Plan (v2)
## Sarah Voice Sales Agent on Retell AI
### Pure cold calling, scheduled auto-dialer, custom dashboard

---

## PHASE 0: SKILL INSTALLATION (Day 0)
### GSD + Agency Agents setup in Claude Code environment

#### Task 0.1: Install GSD Skill
```
Status: [ ] Not started
Method: CLI
Time: 15 minutes
```
**Prompt for Claude Code:**
```
Install the GSD (Get Shit Done) skill globally. GSD is a Claude Code skill
that produces production-grade, high-quality code and UI components.

Steps:
1. Check if /home/user/.claude/skills/ or equivalent skill directory exists
2. If GSD is available as a published skill, install it
3. If not, create the skill directory and configure it:
   - Create /home/user/.claude/skills/gsd/SKILL.md with the GSD methodology
   - GSD principles: ship fast, test immediately, no over-engineering,
     production quality from day one, iterate based on real feedback
4. Verify GSD is loadable by Claude Code
```

#### Task 0.2: Install Agency Agents Skill
```
Status: [ ] Not started
Method: CLI
Time: 15 minutes
```
**Prompt for Claude Code:**
```
Clone and install the Agency Agents skill from GitHub.

Steps:
1. git clone https://github.com/msitarzewski/agency-agents.git /tmp/agency-agents
2. Review the repo structure — identify the skill files, patterns, and templates
3. Copy relevant skill files to Claude Code's skill directory
4. The Agency Agents repo contains reusable agent patterns for:
   - Multi-agent orchestration
   - Tool-calling patterns
   - Webhook handler templates
   - State machine patterns for conversation flows
5. Integrate patterns that are useful for the Sarah project:
   - Webhook handler pattern → for Retell tool callbacks
   - State machine → for lead pipeline status transitions
   - Agent orchestration → for the auto-dialer scheduler
6. Verify installation by listing available skills
```

---

## PHASE 1: FOUNDATION (Day 1)
### Accounts, SDK, Twilio number migration

#### Task 1.1: Retell AI Account + API Key
```
Status: [ ] Not started
Method: Dashboard (manual)
Time: 10 minutes
```
**Steps:**
1. Sign up at https://retellai.com
2. Dashboard → API Keys → Copy key
3. Store as `RETELL_API_KEY` in `.env`

#### Task 1.2: Install Dependencies
```
Status: [ ] Not started
Method: CLI
Time: 5 minutes
```
**Prompt for Claude Code:**
```
Install all project dependencies:
pip install retell-sdk python-dotenv fastapi uvicorn supabase httpx resend
Create .env.example with all required environment variables from skills.md.
```

#### Task 1.3: Migrate Twilio Number to Retell
```
Status: [ ] Not started
Method: API + Dashboard
Time: 30 minutes
```
**Prompt for Claude Code:**
```
Migrate the existing Twilio US number +1 161 570 0419 to Retell AI.

Two possible methods — try in order:

Method A (Direct Import):
  from retell import Retell
  client = Retell(api_key=os.environ["RETELL_API_KEY"])
  number = client.phone_number.import_twilio(
      phone_number="+11615700419",
      twilio_account_sid=os.environ["TWILIO_ACCOUNT_SID"],
      twilio_auth_token=os.environ["TWILIO_AUTH_TOKEN"],
  )
  print(f"Imported: {number.phone_number}")

Method B (SIP Trunk — if Method A fails):
  1. In Twilio Console → Elastic SIP Trunking → Create trunk
  2. Set termination URI to Retell's SIP endpoint (from Retell docs)
  3. In Retell Console → Phone Numbers → Add SIP Number
  4. Enter your Twilio number and SIP details
  5. Test by calling the number

After import, assign the agent_id (from Phase 3) to this number for
both inbound_agent_id and outbound_agent_id.
Do NOT hardcode any credentials.
```

#### Task 1.4: Supabase Schema
```
Status: [ ] Not started
Method: CLI (SQL)
Time: 30 minutes
```
**Prompt for Claude Code:**
```
Connect to Supabase at supabase.operscale.cloud.
Create all tables from the schemas in skills.md:
- leads (with cold-calling status values)
- call_logs (with strategy tracking columns)
- pipeline_logs (unified event log)
- dial_schedules (auto-dialer time windows)

Also create the views:
- pipeline_snapshot (lead counts by status)
- strategy_performance (conversion by strategy + persona)
- todays_calls (calls initiated today with outcomes)
- leads_ready_to_call (status='queued', ordered by priority)

Plus the dial_schedules table:
CREATE TABLE dial_schedules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    name TEXT NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    timezone TEXT DEFAULT 'Africa/Lagos',
    days_of_week INTEGER[] DEFAULT '{1,2,3,4,5}',
    calls_per_hour INTEGER DEFAULT 30,
    is_active BOOLEAN DEFAULT TRUE,
    max_retries INTEGER DEFAULT 2,
    retry_delay_minutes INTEGER DEFAULT 60
);

Do NOT hardcode credentials. Use environment variables.
```

#### Task 1.5: Environment Validation
```
Status: [ ] Not started
Method: CLI
Time: 5 minutes
```
**Prompt for Claude Code:**
```
Run: bash skills.sh
Verify all services reachable. Fix any failures before proceeding.
```

---

## PHASE 2: RETELL LLM CONFIGURATION (Day 2-3)
### Sarah's brain

#### Task 2.1: Create Retell LLM with System Prompt
```
Status: [ ] Not started
Method: API (retell-sdk)
Time: 2 hours
```
**Prompt for Claude Code:**
```
Using the Retell Python SDK, create a new Retell LLM.

Read the following project files to build the system prompt:
- knowledge-base/conversation-sequence.pdf → conversation flow + qualification gates
- knowledge-base/objection-handling.pdf → 11 objections with multi-layer responses
- knowledge-base/programmes.pdf → all 4 pathways, pricing, delivery model
- closing-strategies.md → 6 strategies with persona detection + selection algorithm

The system prompt must include:

IDENTITY: Sarah, AI sales consultant for Cloudboosta. British English. Warm,
professional, never pushy. Always transparent about being AI.

COLD CALL OPENING: Since this is a pure cold call (no prior contact), Sarah's
opening must be different from a warm call. She must:
- Introduce herself clearly
- State Cloudboosta's value proposition in one sentence
- Ask permission to continue ("Do you have 2 minutes?")
- If no → polite exit, log as declined
- If yes → proceed to DISCOVERY

CONVERSATION FLOW: OPEN → DISCOVERY → QUALIFY → BRIDGE → PRESENT →
HANDLE OBJECTIONS → CLOSE → FOLLOW-UP LOCK

QUALIFICATION GATES (3-gate system):
- Gate 1: Cloud experience? AWS SA cert + projects? → determines starting pathway
- Gate 2: Goal? → single pathway vs bundle vs full programme
- Gate 3: After DevOps → Platform Engineer OR SRE

CLOSING STRATEGIES: Include all 6 strategies with the selection algorithm.
Sarah picks strategy based on persona detected during DISCOVERY.

PROGRAMME DATA: All 4 pathways, exact pricing (£1,500/£1,350 early bird),
bundles, multi-currency, instalments. Cohort 2 starts 25 April 2026.

OBJECTION HANDLING: 11 objections with layered responses.

OUTCOME CLASSIFICATION: COMMITTED / FOLLOW_UP / DECLINED. Follow-up must
have specific date. Use the log_call_outcome tool at end of every call.

SUCCESS STORIES: 6 named testimonials.

RULES: Never guarantee jobs. Respect "no". Use name 2-3 times. Target 5-7 min.

Also set:
- model: "gpt-4o-mini" (fast, cheap, proven on Retell)
- starting_message with dynamic {{lead_name}} variable
- speak_during_execution: true (Sarah says "Let me look that up" while tools run)

Use client.llm.create(). Store the returned llm_id in .env as RETELL_LLM_ID.
```

#### Task 2.2: Define Custom Functions (Tools)
```
Status: [ ] Not started
Method: API (retell-sdk)
Time: 1 hour
```
**Prompt for Claude Code:**
```
Add custom functions to the Retell LLM. These are tools Sarah can invoke.

Functions to create:

1. lookup_programme
   - Params: experience_level (string), interest_area (string)
   - Returns: programme details, pricing, duration
   - Webhook: POST to WEBHOOK_BASE_URL/retell/tool
   - speak_during_execution: true
   - speak_after_execution: true

2. get_objection_response
   - Params: objection_type (string enum)
   - Returns: multi-layer response text
   - Webhook: POST to WEBHOOK_BASE_URL/retell/tool

3. log_call_outcome
   - Params: outcome (string), programme_recommended (string),
     summary (string), objections_raised (string),
     follow_up_date (string), closing_strategy_used (string),
     lead_persona (string)
   - Returns: confirmation
   - Webhook: POST to WEBHOOK_BASE_URL/retell/tool
   - MUST be called at the end of every call

4. end_call — Built-in Retell function

5. transfer_call — Built-in Retell function
   - Transfer to: +44 7592 233052 (human advisor)

Use client.llm.update() to add functions to existing LLM.
```

---

## PHASE 3: VOICE AGENT + PHONE (Day 3-4)

#### Task 3.1: Create the Agent
```
Status: [ ] Not started
Method: API (retell-sdk)
Time: 30 minutes
```
**Prompt for Claude Code:**
```
Using the Retell Python SDK:

1. List available voices: client.voice.list()
   Filter for: English, female, British accent
   Print the top 5 options with provider + voice_id

2. Create the agent:
   client.agent.create(
       agent_name="Sarah - Cloudboosta Cold Caller",
       response_engine={"type": "retell-llm", "llm_id": RETELL_LLM_ID},
       voice_id=<selected British female voice>,
       language="en-GB",
       voice_speed=1.0,
       voice_temperature=0.8,
       responsiveness=0.9,
       interruption_sensitivity=0.8,
       enable_backchannel=True,
       backchannel_frequency=0.8,
       backchannel_words=["yeah", "uh-huh", "I see", "right", "absolutely"],
       reminder_trigger_ms=10000,
       reminder_max_count=2,
       ambient_sound="off",
       webhook_url=WEBHOOK_BASE_URL + "/retell/webhook",
       webhook_events=["call_started", "call_ended", "call_analyzed"],
   )

3. Store agent_id in .env as RETELL_AGENT_ID

4. Assign agent to the migrated phone number:
   client.phone_number.update(
       phone_number_id=<from Phase 1.3>,
       inbound_agent_id=RETELL_AGENT_ID,
       outbound_agent_id=RETELL_AGENT_ID,
   )
```

---

## PHASE 4: WEBHOOK BACKEND (Day 4-6)

#### Task 4.1: Build FastAPI Webhook Server
```
Status: [ ] Not started
Method: Code (Python)
Time: 3 hours
```
**Prompt for Claude Code:**
```
Build a FastAPI webhook server with these endpoints. Use the patterns
from skills.md. Apply Agency Agents patterns for the webhook handler
structure and state machine for lead status transitions.

POST /retell/tool
- Receives tool calls from Retell during live conversations
- Routes to handler by function_name
- Returns {"result": "..."} to Retell

POST /retell/webhook
- Receives call lifecycle events (call_started, call_ended, call_analyzed)
- Updates Supabase lead status + call_logs
- On call_ended: extract transcript, duration, recording URL
- On COMMITTED outcome: trigger payment email via Resend

POST /retell/initiate-call
- Receives {"lead_id": "uuid"}
- Fetches lead from Supabase
- Calls Retell API to start outbound call
- Returns {"call_id": "...", "status": "..."}

POST /dialer/start
- Starts the scheduled auto-dialer for a given schedule_id
- Returns confirmation

POST /dialer/stop
- Stops the auto-dialer
- Returns confirmation

GET /api/dashboard/live
- Returns current active call info + recent calls for dashboard

GET /api/dashboard/pipeline
- Returns lead counts by status for dashboard

GET /api/dashboard/strategy
- Returns strategy performance data for dashboard

All endpoints use Supabase client from environment variables.
Include proper error handling, logging, and CORS for dashboard access.
```

#### Task 4.2: Seed Programme + Objection Data
```
Status: [ ] Not started
Method: CLI (Python)
Time: 30 minutes
```
**Prompt for Claude Code:**
```
Seed Supabase with programme data and objection responses from the
knowledge base PDFs. Create and populate:
- programmes table: 4 pathways + 4 bundles, all pricing in 4 currencies
- objections table: 11 objection types with all response layers
- company_info table: payment details, contact numbers

All pricing must exactly match the knowledge base:
£1,500 standard / £1,350 early bird per pathway.
```

---

## PHASE 5: AUTO-DIALER + ORCHESTRATION (Day 6-8)

#### Task 5.1: Scheduled Auto-Dialer (n8n)
```
Status: [ ] Not started
Method: n8n workflow
Time: 3 hours
```
**Prompt for Claude Code:**
```
Build an n8n workflow: "Scheduled Auto-Dialer"

Trigger: Cron (runs every 2 minutes during active dial window)

Steps:
1. Check if current time is within any active dial_schedule window
   - Query Supabase dial_schedules where is_active=true
   - Check current time (in schedule timezone) is between start_time and end_time
   - Check current day_of_week matches
   - If outside window → exit silently

2. Check if there's already a call in progress
   - Query Supabase leads where status='calling' or status='in_call'
   - If active call exists → exit (wait for it to finish)

3. Pick the next lead to call
   - Query Supabase leads where status='queued'
   - Order by priority (new leads first, then retries by retry_count ASC)
   - Limit 1
   - If no leads → exit

4. Initiate the call
   - POST to webhook backend /retell/initiate-call with lead_id
   - Update lead status to 'calling'
   - Log to pipeline_logs

5. Error handling
   - If Retell API fails → log error, mark lead as 'queued' (retry next cycle)
   - Error trigger node catches workflow failures → logs to Supabase
```

#### Task 5.2: Post-Call Handler (n8n)
```
Status: [ ] Not started
Method: n8n workflow
Time: 2 hours
```
**Prompt for Claude Code:**
```
Build an n8n workflow: "Post-Call Handler"

Trigger: Webhook (receives Retell call_ended / call_analyzed events)

Steps:
1. Parse call data: call_id, transcript, outcome, summary, duration
2. Update Supabase lead status based on outcome
3. Insert into call_logs table
4. If COMMITTED:
   - Send payment email via Resend API (bank transfer details from payment-details.pdf)
   - Update lead status to payment_pending
   - Send admin notification email
5. If FOLLOW_UP:
   - Schedule follow-up call (insert into leads with follow_up_at date)
   - Send admin summary email
6. If DECLINED:
   - Log decline reason
   - No further action
7. If NO_ANSWER or VOICEMAIL:
   - Check retry count. If < max_retries → requeue with status='queued'
   - If >= max_retries → status='exhausted'
8. Log all actions to pipeline_logs
```

#### Task 5.3: Lead Import Workflow (n8n)
```
Status: [ ] Not started
Method: n8n workflow
Time: 1 hour
```
**Prompt for Claude Code:**
```
Build an n8n workflow: "Lead Import"

Trigger: Webhook (receives CSV data or JSON array of leads)

Steps:
1. Parse incoming data (name, phone, email, location, source)
2. Validate phone format (must be E.164: +country code + number)
3. Deduplicate against existing Supabase leads by phone
4. Insert new leads with status='new'
5. Batch update status to 'queued' (ready for auto-dialer)
6. Return: {"imported": N, "duplicates": M, "errors": K}
```

---

## PHASE 6: CUSTOM DASHBOARD (Day 8-10)

#### Task 6.1: Build React Dashboard
```
Status: [ ] Not started
Method: Code (React + Tailwind) — use GSD skill
Time: 4-6 hours
```
**Prompt for Claude Code:**
```
Using the GSD skill for production-grade quality, build a React dashboard
for the Sarah voice agent. This is a single-page application with 3 tabs:

TAB 1: LIVE VIEW
- Current active call card: lead name, phone, duration timer, strategy being used
- If no active call: "Waiting for next call" with auto-dialer status
- Recent calls list (last 20): lead name, duration, outcome badge (green/yellow/red)
- Today's stats: total calls, pick-up rate, commitments, avg duration
- Auto-dialer controls: Start/Stop button, current schedule display

TAB 2: LEAD PIPELINE
- Kanban-style columns: New → Queued → Calling → Committed → Follow-Up → Declined
- Each card shows: lead name, phone, last call date, outcome
- Click a card → slide-out panel with: full transcript, recording player, call details
- Search bar (by name or phone)
- Bulk actions: "Queue selected" button to move leads to queued status
- CSV upload button: drag & drop CSV to import leads

TAB 3: STRATEGY ANALYTICS
- Bar chart: conversion rate by closing strategy (6 bars)
- Heatmap: strategy × persona (6×6 grid showing conversion rate intensity)
- Line chart: daily calls and commitments over last 30 days
- Top stats cards: best strategy, worst strategy, most common persona, total revenue potential
- Table: all strategies with total calls, commitments, follow-ups, declined, conversion %

Data source: Supabase REST API
- Live view polls every 5 seconds
- Pipeline and strategy tabs poll every 30 seconds
- Use Supabase JS client for queries

Tech: React, Tailwind CSS, Recharts for charts, Supabase JS client.
Deploy as static files served from the webhook backend or separate hosting.

The dashboard must work in both light and dark mode.
Use clean, professional design. No flashy colors or animations.
```

---

## PHASE 7: TESTING (Day 10-12)

#### Task 7.1: Self-Test
```
Status: [ ] Not started
Method: CLI + manual
Time: 1 day
```
**Prompt for Claude Code:**
```
Create a comprehensive test script that:
1. Insert a test lead into Supabase with your phone number
2. Set status to 'queued'
3. Trigger the auto-dialer manually (POST /dialer/start)
4. Verify: Sarah calls your phone within 2 minutes
5. Answer and test: greeting, discovery questions, programme recommendation,
   objection handling (say "it's too expensive"), closing
6. Hang up → verify:
   - call_logs entry created with transcript + outcome
   - Lead status updated
   - Pipeline log entry created
   - Dashboard reflects the call
7. Test no-answer: insert lead with disconnected number → verify retry logic
8. Test CSV import: upload a 5-row CSV → verify all imported to Supabase
9. Print pass/fail report for each step
```

#### Task 7.2: Wave 0 (10 Real Calls)
```
Status: [ ] Not started
Method: Automated pipeline
Time: 1 week
```
**Steps:**
1. Prepare 10 real phone numbers (willing participants)
2. Import via CSV into Supabase
3. Set dial schedule: specific time window
4. Start auto-dialer
5. Monitor on dashboard
6. After all 10: review transcripts, strategy data, outcomes
7. Refine system prompt based on findings

---

## PHASE 8: STRATEGY OPTIMIZATION (Ongoing)

#### Task 8.1: Weekly Strategy Review
```
Status: [ ] Recurring
Method: Dashboard + SQL
Time: 30 minutes/week
```
Run the strategy performance query. Update system prompt to favour
high-performing strategies for each persona. Document changes in
a changelog.
