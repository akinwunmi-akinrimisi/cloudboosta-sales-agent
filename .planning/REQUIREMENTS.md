# Requirements: Sarah -- Cloudboosta AI Cold-Calling Sales Agent

**Defined:** 2026-03-25
**Core Value:** Sarah converts cold leads into paid Cloudboosta programme enrolments through autonomous outbound calls -- no human intervention required during the call, no pre-contact needed.

## v1 Requirements

Requirements for Wave 0 (10 test calls) and initial production. Each maps to roadmap phases.

### Voice Platform

- [x] **VOICE-01**: Retell LLM configured with Sarah's system prompt (under 8K tokens) including qualification gates and 6 closing strategies
- [x] **VOICE-02**: 3 custom tool definitions (lookup_programme, get_objection_response, log_call_outcome) registered on Retell LLM with webhook URLs
- [x] **VOICE-03**: Voice agent created with British female voice, backchannel enabled (frequency 0.8)
- [x] **VOICE-04**: Phone number +1 (740) 494-3597 assigned to agent using weighted agents format (not deprecated fields)
- [x] **VOICE-05**: Dynamic voice variables (lead_name, lead_location) injected per outbound call via retell_llm_dynamic_variables

### Tools

- [x] **TOOL-01**: lookup_programme tool returns programme details with multi-currency pricing (GBP/USD/EUR/NGN) based on lead country
- [x] **TOOL-02**: get_objection_response tool returns multi-layer responses for 11 objection types
- [x] **TOOL-03**: log_call_outcome tool records outcome, closing strategy used, and persona detected per call
- [x] **TOOL-04**: All 3 tools execute within 10 seconds with hardcoded fallback responses on failure
- [x] **TOOL-05**: Speak-during-execution enabled on all tools ("Let me look that up") to avoid dead air

### Backend

- [x] **BACK-01**: FastAPI server with tool call router dispatching to 3 tool handlers at POST /retell/tool
- [x] **BACK-02**: Webhook lifecycle endpoint handling call_started, call_ended, call_analyzed events at POST /retell/webhook
- [x] **BACK-03**: Call initiation endpoint at POST /retell/initiate-call validating lead status, daily call count, and no active call
- [x] **BACK-04**: Dashboard API endpoints returning live view, pipeline, and analytics data
- [x] **BACK-05**: HMAC-SHA256 webhook signature verification on all Retell endpoints using x-retell-signature header
- [x] **BACK-06**: CORS configuration allowing dashboard origin only
- [x] **BACK-07**: Rate limiting via slowapi enforcing 1 call per 2 minutes and max 200 calls per day

### Database

- [x] **DATA-01**: leads table with 14 status states, priority ordering, and phone in E.164 format
- [x] **DATA-02**: call_logs table storing retell_call_id, outcome, strategy, persona, transcript, recording URL, duration, cost
- [x] **DATA-03**: pipeline_logs table tracking every lead status transition with timestamp and trigger
- [x] **DATA-04**: dial_schedules table for time window configuration (start_time, end_time, days_of_week, timezone)
- [x] **DATA-05**: SQL views: pipeline_snapshot, strategy_performance, todays_calls for dashboard queries
- [x] **DATA-06**: Atomic pick_next_lead() RPC function using FOR UPDATE SKIP LOCKED to prevent race conditions
- [x] **DATA-07**: Row Level Security policies on all tables with service key for backend, anon key for dashboard reads

### Automation

- [x] **AUTO-01**: Auto-dialer n8n workflow polling queue every 2 minutes, checking dial window + no active call + queue not empty
- [x] **AUTO-02**: Post-call handler n8n workflow routing outcomes: COMMITTED -> payment email, FOLLOW_UP -> reschedule, DECLINED -> log
- [x] **AUTO-03**: Lead import n8n workflow accepting CSV with E.164 phone validation and deduplication
- [x] **AUTO-04**: Payment email via Resend API with bank transfer details (Revolut + GTBank) on COMMITTED outcome
- [x] **AUTO-05**: Retry logic: max 2 retries per lead with 60-minute backoff delay, requeue to 'queued' status
- [x] **AUTO-06**: Do-not-contact enforcement: hard block in dialer for leads with status 'do_not_contact' or 'declined'

### Dashboard

- [x] **DASH-01**: Live View tab showing active call card, recent calls list, and today's stats (polls Supabase every 5s)
- [x] **DASH-02**: Pipeline tab with kanban view of leads grouped by status
- [x] **DASH-03**: Pipeline tab: click any lead to view full transcript, call recording, and call details
- [x] **DASH-04**: Strategy Analytics tab with conversion rate by strategy bar chart and totals table
- [x] **DASH-05**: Bearer token authentication using DASHBOARD_SECRET_KEY (single operator)
- [x] **DASH-06**: Responsive web layout using React 19 + Vite 6 + Tailwind 3.4 + Recharts 3

### Testing

- [ ] **TEST-01**: Self-test checklist covering all integration points (Retell -> backend -> Supabase -> n8n -> email)
- [ ] **TEST-02**: Wave 0: 10 real calls completed with outcomes logged in call_logs
- [ ] **TEST-03**: All 10 call transcripts reviewable on dashboard Pipeline tab
- [ ] **TEST-04**: Strategy and persona data collected and visible on Strategy Analytics tab

## v2 Requirements

Deferred to post-Wave 0. Tracked but not in current roadmap.

### Analytics

- **ANLYT-01**: Strategy performance heatmap (strategy x persona matrix) -- needs 50+ calls for statistical significance
- **ANLYT-02**: Conversion trend chart over time -- needs multi-week data
- **ANLYT-03**: Strategy auto-optimization (auto-select best strategy per persona) -- needs 200+ calls

### Compliance

- **COMPL-01**: PII redaction for EU leads (GDPR) -- evaluate before calling EU numbers ($0.01/min)
- **COMPL-02**: Recording URL persistence to Supabase Storage -- currently URLs expire

### Platform

- **PLATF-01**: Retell Conversation Flow API evaluation -- may improve structured conversation quality
- **PLATF-02**: GPT-5 Nano evaluation for cost reduction at scale (100+ calls/day)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Audio processing / STT / TTS / VAD code | Retell handles all voice -- custom audio duplicates platform and adds maintenance debt |
| Pre-contact (WhatsApp/email before call) | Pure cold calling model -- pre-contact adds pipeline complexity and delays |
| Multi-agent concurrent calling | Single US number, max 1 concurrent call -- concurrency adds telephony complexity and billing risk |
| Real-time WebSocket dashboard | Over-engineering for single operator -- polling every 5-30s is simpler and sufficient |
| Full Supabase Auth with RBAC | Single operator -- multi-role auth is unnecessary development effort |
| Mobile app | Web dashboard is already responsive -- mobile browser access sufficient |
| OpenClaw email integration | Explicitly excluded by project requirements -- Resend is simpler |
| Custom conversation flow builder | System prompt with tools is simpler for 8-stage sales flow |
| Inbound call handling | Scope is outbound cold calling only -- Retell auto-handles callbacks |
| Strategy auto-optimization | Insufficient data until 200+ calls (Wave 2) -- premature optimization leads to bad strategy selection |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| VOICE-01 | Phase 2: Retell LLM Configuration | Complete |
| VOICE-02 | Phase 2: Retell LLM Configuration | Pending |
| VOICE-03 | Phase 3: Voice Agent Creation | Complete |
| VOICE-04 | Phase 1: Foundation + SDK Migration | Complete |
| VOICE-05 | Phase 2: Retell LLM Configuration | Pending |
| TOOL-01 | Phase 4: Tool Execution Backend | Complete |
| TOOL-02 | Phase 4: Tool Execution Backend | Complete |
| TOOL-03 | Phase 4: Tool Execution Backend | Complete |
| TOOL-04 | Phase 4: Tool Execution Backend | Complete |
| TOOL-05 | Phase 4: Tool Execution Backend | Complete |
| BACK-01 | Phase 4: Tool Execution Backend | Complete |
| BACK-02 | Phase 5: Webhook Backend + Security | Complete |
| BACK-03 | Phase 5: Webhook Backend + Security | Complete |
| BACK-04 | Phase 8: Dashboard | Complete |
| BACK-05 | Phase 5: Webhook Backend + Security | Complete |
| BACK-06 | Phase 5: Webhook Backend + Security | Complete |
| BACK-07 | Phase 5: Webhook Backend + Security | Complete |
| DATA-01 | Phase 1: Foundation + SDK Migration | Complete |
| DATA-02 | Phase 1: Foundation + SDK Migration | Complete |
| DATA-03 | Phase 1: Foundation + SDK Migration | Complete |
| DATA-04 | Phase 1: Foundation + SDK Migration | Complete |
| DATA-05 | Phase 1: Foundation + SDK Migration | Complete |
| DATA-06 | Phase 1: Foundation + SDK Migration | Complete |
| DATA-07 | Phase 1: Foundation + SDK Migration | Complete |
| AUTO-01 | Phase 6: Auto-Dialer + Retry Logic | Complete |
| AUTO-02 | Phase 7: Post-Call Workflows | Complete |
| AUTO-03 | Phase 7: Post-Call Workflows | Complete |
| AUTO-04 | Phase 7: Post-Call Workflows | Complete |
| AUTO-05 | Phase 6: Auto-Dialer + Retry Logic | Complete |
| AUTO-06 | Phase 6: Auto-Dialer + Retry Logic | Complete |
| DASH-01 | Phase 8: Dashboard | Complete |
| DASH-02 | Phase 8: Dashboard | Complete |
| DASH-03 | Phase 8: Dashboard | Complete |
| DASH-04 | Phase 8: Dashboard | Complete |
| DASH-05 | Phase 8: Dashboard | Complete |
| DASH-06 | Phase 8: Dashboard | Complete |
| TEST-01 | Phase 9: Testing + Wave 0 | Pending |
| TEST-02 | Phase 9: Testing + Wave 0 | Pending |
| TEST-03 | Phase 9: Testing + Wave 0 | Pending |
| TEST-04 | Phase 9: Testing + Wave 0 | Pending |

**Coverage:**
- v1 requirements: 40 total
- Mapped to phases: 40/40
- Unmapped: 0

---
*Requirements defined: 2026-03-25*
*Last updated: 2026-03-25 after roadmap creation (traceability populated)*
