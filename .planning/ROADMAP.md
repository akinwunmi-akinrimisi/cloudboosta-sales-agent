# Roadmap: Sarah -- Cloudboosta AI Cold-Calling Sales Agent

## Overview

Sarah goes from zero to 10 real cold calls in 8 phases. Phase 1 addresses the hard March 31, 2026 deadline for Retell's weighted agents migration and lays the database foundation. Phases 2-4 build the voice agent and its backend brain (LLM, tools, webhooks). Phases 5-6 create the autonomous calling pipeline (auto-dialer, post-call routing, payment emails). Phase 7 delivers the monitoring dashboard. Phase 8 validates everything end-to-end with Wave 0 (10 real calls). Phases 5-7 can execute in parallel once Phase 4 completes.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation + SDK Migration** - Supabase schema, retell-sdk 5.x upgrade, and phone number weighted agents migration (DEADLINE: March 31)
- [ ] **Phase 2: Retell LLM Configuration** - System prompt with qualification gates, 6 closing strategies, 3 tool definitions, and dynamic variables
- [ ] **Phase 3: Voice Agent Creation** - British female voice agent with backchannel, assigned to migrated phone number
- [ ] **Phase 4: Tool Execution Backend** - FastAPI tool call router with 3 handlers, fallback responses, and speak-during-execution
- [ ] **Phase 5: Webhook Backend + Security** - Call lifecycle webhooks, call initiation endpoint, HMAC verification, CORS, rate limiting
- [ ] **Phase 6: Auto-Dialer + Retry Logic** - n8n scheduled dialer with dial windows, retry backoff, and do-not-contact enforcement
- [ ] **Phase 7: Post-Call Workflows** - n8n post-call outcome routing, payment email via Resend, and CSV lead import
- [ ] **Phase 8: Dashboard** - React SPA with Live View, Pipeline kanban, Strategy Analytics, and bearer token auth
- [ ] **Phase 9: Testing + Wave 0** - Self-test checklist, 10 real calls, transcript review, strategy data collection

## Phase Details

### Phase 1: Foundation + SDK Migration
**Goal**: Database is ready, SDK is current, and phone number uses weighted agents format before the March 31 deprecation deadline
**Depends on**: Nothing (first phase)
**Requirements**: DATA-01, DATA-02, DATA-03, DATA-04, DATA-05, DATA-06, DATA-07, VOICE-04
**Success Criteria** (what must be TRUE):
  1. All 4 Supabase tables (leads, call_logs, pipeline_logs, dial_schedules) exist with correct schemas and RLS policies enforced
  2. SQL views (pipeline_snapshot, strategy_performance, todays_calls) return correct data when queried
  3. pick_next_lead() RPC atomically selects and locks the highest-priority queued lead
  4. Phone number +1 (740) 494-3597 is configured on Retell using weighted agents array (not deprecated inbound_agent_id/outbound_agent_id)
  5. retell-sdk 5.8.0 is installed and basic API calls (list agents, get phone number) succeed
**Plans:** 3/3 plans complete

Plans:
- [x] 01-01-PLAN.md -- Supabase tables (4 core + 3 reference), indexes, RLS policies, trigger functions
- [x] 01-02-PLAN.md -- SQL views, pick_next_lead() RPC, seed data (programmes, pricing, objections, test leads), test script
- [x] 01-03-PLAN.md -- retell-sdk 5.x upgrade, main.py SDK migration, phone number weighted agents migration script

### Phase 2: Retell LLM Configuration
**Goal**: Sarah's brain is configured on Retell with her full sales personality, qualification flow, and tool definitions
**Depends on**: Phase 1 (SDK must be upgraded, phone number migrated)
**Requirements**: VOICE-01, VOICE-02, VOICE-05
**Success Criteria** (what must be TRUE):
  1. Retell LLM exists with system prompt under 8K tokens containing qualification gates, 8-stage conversation flow, and 6 closing strategies
  2. All 3 custom tools (lookup_programme, get_objection_response, log_call_outcome) are registered on the LLM with correct webhook URLs and parameter schemas
  3. Dynamic variables (lead_name, lead_location) are defined in the LLM configuration and referenced in the system prompt
**Plans**: TBD

Plans:
- [ ] 02-01: System prompt authoring (under 8K tokens)
- [ ] 02-02: Tool definitions and webhook URL registration on Retell LLM

### Phase 3: Voice Agent Creation
**Goal**: Sarah exists as a callable voice agent with natural British speech and her phone number assigned
**Depends on**: Phase 2 (LLM ID required for agent creation)
**Requirements**: VOICE-03
**Success Criteria** (what must be TRUE):
  1. Voice agent is created on Retell with British female voice and backchannel enabled (frequency 0.8)
  2. Agent is linked to the Retell LLM from Phase 2
  3. A test outbound call can be initiated via the Retell API and Sarah speaks her opening line
**Plans**: TBD

Plans:
- [ ] 03-01: Voice agent creation and phone number assignment

### Phase 4: Tool Execution Backend
**Goal**: Sarah's 3 tools execute correctly during live calls with fast responses and graceful failure handling
**Depends on**: Phase 2 (tool webhook URLs must point to this server)
**Requirements**: TOOL-01, TOOL-02, TOOL-03, TOOL-04, TOOL-05, BACK-01
**Success Criteria** (what must be TRUE):
  1. POST /retell/tool dispatches to the correct handler based on tool name and returns valid Retell tool response format
  2. lookup_programme returns multi-currency pricing (GBP/USD/EUR/NGN) based on lead country
  3. get_objection_response returns appropriate multi-layer responses for all 11 objection types
  4. log_call_outcome writes outcome, strategy, and persona to Supabase call_logs
  5. All 3 tools return hardcoded fallback responses within 10 seconds when Supabase fails, and speak_during_execution phrases are configured
**Plans**: TBD

Plans:
- [ ] 04-01: FastAPI project setup and tool call router
- [ ] 04-02: lookup_programme and get_objection_response tool handlers
- [ ] 04-03: log_call_outcome handler and fallback/speak-during-execution configuration

### Phase 5: Webhook Backend + Security
**Goal**: The backend handles all Retell call lifecycle events, initiates calls safely, and rejects unauthorized requests
**Depends on**: Phase 4 (same FastAPI server, tool router must exist)
**Requirements**: BACK-02, BACK-03, BACK-05, BACK-06, BACK-07
**Success Criteria** (what must be TRUE):
  1. POST /retell/webhook processes call_started, call_ended, and call_analyzed events correctly, updating Supabase records
  2. POST /retell/initiate-call validates lead status, checks daily call count against 200 limit, confirms no active call, and initiates via Retell API
  3. All Retell endpoints verify HMAC-SHA256 signature from x-retell-signature header and reject invalid requests with 401
  4. CORS allows only the dashboard origin; all other origins are rejected
  5. Rate limiting enforces 1 call per 2 minutes and 200 calls per day
**Plans**: TBD

Plans:
- [ ] 05-01: Webhook lifecycle endpoint and call initiation endpoint
- [ ] 05-02: HMAC signature verification, CORS, and rate limiting

### Phase 6: Auto-Dialer + Retry Logic
**Goal**: Sarah calls leads autonomously on schedule with proper retry handling and compliance enforcement
**Depends on**: Phase 5 (call initiation endpoint must exist)
**Requirements**: AUTO-01, AUTO-05, AUTO-06
**Success Criteria** (what must be TRUE):
  1. n8n auto-dialer workflow polls queue every 2 minutes and initiates calls only within configured dial windows
  2. Dialer checks for no active call and non-empty queue before each call attempt
  3. Failed calls (no_answer, voicemail) retry up to 2 times with 60-minute backoff delay
  4. Leads with status 'do_not_contact' or 'declined' are never called (hard block in dialer)
**Plans**: TBD

Plans:
- [ ] 06-01: n8n auto-dialer workflow with dial window and queue checks
- [ ] 06-02: Retry logic and do-not-contact enforcement

### Phase 7: Post-Call Workflows
**Goal**: Every call outcome is automatically routed to the correct action -- payment email, reschedule, or log-and-close
**Depends on**: Phase 5 (webhook endpoint triggers post-call workflow)
**Requirements**: AUTO-02, AUTO-03, AUTO-04
**Success Criteria** (what must be TRUE):
  1. COMMITTED outcomes trigger a payment email via Resend with correct bank transfer details (Revolut + GTBank)
  2. FOLLOW_UP outcomes schedule a retry call at appropriate time
  3. DECLINED outcomes update lead status and log final disposition
  4. CSV lead import workflow accepts files with E.164 phone validation and deduplication against existing leads
**Plans**: TBD

Plans:
- [ ] 07-01: n8n post-call handler workflow with outcome routing and Resend email
- [ ] 07-02: n8n lead import workflow with CSV validation and dedup

### Phase 8: Dashboard
**Goal**: The operator can monitor all calling activity, manage the lead pipeline, and track strategy effectiveness in real time
**Depends on**: Phase 5 (backend API endpoints for dashboard data)
**Requirements**: DASH-01, DASH-02, DASH-03, DASH-04, DASH-05, DASH-06, BACK-04
**Success Criteria** (what must be TRUE):
  1. Live View tab shows active call card, recent calls list, and today's stats with data refreshing every 5 seconds
  2. Pipeline tab displays leads grouped by status in kanban columns
  3. Clicking any lead on Pipeline tab opens full transcript, call recording, and call details
  4. Strategy Analytics tab shows conversion rate by strategy as a bar chart with totals table
  5. Dashboard requires bearer token authentication and rejects unauthenticated requests
**Plans**: TBD

Plans:
- [ ] 08-01: React project setup with Vite 6, Tailwind 3.4, bearer token auth, and dashboard API endpoints
- [ ] 08-02: Live View tab (active call, recent calls, daily stats)
- [ ] 08-03: Pipeline tab with kanban and transcript viewer
- [ ] 08-04: Strategy Analytics tab with charts

### Phase 9: Testing + Wave 0
**Goal**: The entire pipeline is validated end-to-end and Sarah completes 10 real cold calls with full data capture
**Depends on**: Phases 6, 7, 8 (all components must be operational)
**Requirements**: TEST-01, TEST-02, TEST-03, TEST-04
**Success Criteria** (what must be TRUE):
  1. Self-test checklist passes covering all integration points (Retell to backend to Supabase to n8n to email)
  2. 10 real outbound calls completed with outcomes logged in call_logs table
  3. All 10 call transcripts are viewable on the dashboard Pipeline tab
  4. Strategy and persona data from the 10 calls is visible on the Strategy Analytics tab
**Plans**: TBD

Plans:
- [ ] 09-01: Self-test checklist and integration validation
- [ ] 09-02: Wave 0 execution -- 10 real calls with monitoring

## Progress

**Execution Order:**
Phases execute in numeric order: 1 > 2 > 3 > 4 > 5 > 6 + 7 (parallel) > 8 > 9

Note: Phases 6 and 7 can execute in parallel (independent n8n workflows). Phase 8 can start after Phase 5 completes (needs only backend API). In practice with a single builder, sequential execution is fine.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation + SDK Migration | 3/3 | Complete    | 2026-03-25 |
| 2. Retell LLM Configuration | 0/2 | Not started | - |
| 3. Voice Agent Creation | 0/1 | Not started | - |
| 4. Tool Execution Backend | 0/3 | Not started | - |
| 5. Webhook Backend + Security | 0/2 | Not started | - |
| 6. Auto-Dialer + Retry Logic | 0/2 | Not started | - |
| 7. Post-Call Workflows | 0/2 | Not started | - |
| 8. Dashboard | 0/4 | Not started | - |
| 9. Testing + Wave 0 | 0/2 | Not started | - |
