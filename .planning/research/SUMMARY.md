# Project Research Summary

**Project:** Sarah -- Cloudboosta AI Cold-Calling Sales Agent
**Domain:** AI-powered outbound voice sales agent (cold calling)
**Researched:** 2026-03-24
**Confidence:** HIGH

---

## 1. Executive Summary

- **Sarah is a standard webhook-driven voice agent project.** Retell AI handles all voice/audio complexity (STT, TTS, VAD, turn-taking). The custom code is limited to: a FastAPI webhook server for tool execution, n8n workflows for scheduling and post-call routing, a Supabase database for persistence, and a React dashboard for monitoring. There are no novel architectural patterns required.
- **The retell-sdk 4.x to 5.x upgrade and the Retell phone number API deprecation (March 31, 2026) are time-critical blockers.** The existing `requirements.txt` pins `retell-sdk==4.12.0` but the current stable is `5.8.0`. The deprecated `inbound_agent_id`/`outbound_agent_id` fields must be replaced with weighted agent arrays (`inbound_agents`/`outbound_agents`) before March 31 or phone number assignment will break.
- **The existing dependency versions across both backend and frontend are significantly outdated.** Backend: retell-sdk (4.12->5.8), FastAPI (keep 0.115.x deliberately), supabase (2.10->2.12), httpx (0.27->0.28), resend (2.5->2.26), pydantic (2.9->2.12). Frontend: React (18->19), Vite (5->6), Recharts (2->3). All upgrades are straightforward except retell-sdk which is a major version change.
- **The architecture scales to 200 calls/day without changes.** Single-number, single-concurrent-call design with 2-minute intervals. n8n handles scheduling, FastAPI handles synchronous webhook processing within Retell's 10-second timeout. No horizontal scaling needed for Wave 0-2.
- **Security posture is well-defined:** HMAC-SHA256 webhook verification, RLS on Supabase, service key isolation from frontend, bearer token dashboard auth, and rate limiting via slowapi.

---

## 2. Stack Recommendations

| Layer | Technology | Version | Rationale |
|-------|-----------|---------|-----------|
| Voice Platform | Retell AI | Current | Project requirement. Handles STT/TTS/VAD/call management. 3 agents already configured. |
| Voice LLM | GPT-4o-mini (on Retell) | Current | Best latency-to-cost ratio for voice. GPT-5 Nano available but less proven. |
| Backend | FastAPI | **0.115.x** | Async-native, Pydantic validation. Pin to 0.115.x -- 0.135.x breaks Retell webhooks with strict Content-Type checking. |
| Python SDK | retell-sdk | **5.8.0** | MUST upgrade from 4.12.0. Major version change required for weighted agent API. |
| Database | Supabase (self-hosted) | Current | Already deployed at supabase.operscale.cloud. PostgreSQL + RLS + REST API. |
| Workflows | n8n (self-hosted) | **2.11.x** | Already deployed. Visual builder with cron, Supabase node, webhook triggers. |
| Email | Resend | **2.26.0** | Project requirement (not OpenClaw). Simple API for payment emails. |
| Dashboard | React 19 + Vite 6 + Tailwind 3.4 + Recharts 3 | See STACK.md | Stable, proven stack. Tailwind 3 over v4 (breaking changes not worth it). |
| Rate Limiting | slowapi | **0.1.9** | In-memory, no Redis dependency. Sufficient for single-server. |

**Key version decisions:**
- FastAPI pinned at 0.115.x (not latest 0.135.x) to avoid strict Content-Type rejection of Retell webhooks.
- Tailwind 3.4.x (not v4) to avoid config migration effort and leverage larger ecosystem.
- Vite 6 (not Vite 8 released days ago) for production stability.

---

## 3. Table Stakes Features (Must-Haves for v1)

These are non-negotiable for Wave 0 (10 test calls):

| Feature | Complexity | Notes |
|---------|-----------|-------|
| Outbound call initiation via Retell API | Low | `create_phone_call` with weighted agent phone config |
| System prompt with qualification gates (under 8K tokens) | Medium | 6 strategies, 11 objections, 4 pathways. Move data into tools to stay under limit. |
| 3 custom tools (lookup_programme, get_objection_response, log_call_outcome) | Medium | Must execute within 10s. Hardcoded fallbacks required for each tool. |
| Auto-dialer with time windows (n8n cron) | Medium | Every 2 min. Checks: dial window, no active call, queue not empty. |
| Call outcome logging (webhook + tool) | Low | `call_ended` webhook is authoritative. Tool provides richer data (strategy, persona). |
| Lead queue with status state machine (14 states) | Low | Atomic `pick_next_lead()` RPC to prevent race conditions. |
| Post-call routing (COMMITTED->email, FOLLOW_UP->schedule, DECLINED->log) | Medium | n8n workflow with branching. |
| Dashboard live view (active call + recent calls + daily stats) | Medium | Poll Supabase every 5s. |
| Dashboard pipeline view (leads by status) | Medium | Kanban columns. Click to expand with transcript. |
| Dashboard strategy analytics (conversion by strategy) | Medium | Bar chart. Meaningful data requires 50+ calls. |
| Webhook HMAC-SHA256 signature verification | Low | Mandatory on all Retell endpoints. FastAPI dependency. |
| Do-not-contact enforcement | Low | Hard block in dialer. Pre-call status check. |
| Rate limiting (1 call / 2 min, MAX_DAILY_CALLS=200) | Low | Enforced in n8n interval AND backend independently. |
| Payment email on commitment (Resend) | Low | Bank transfer details from knowledge base. |

**Differentiators (should-have, not blocking):**
- Persona detection + strategy selection logging (for continuous improvement loop)
- Dynamic voice variables (`{{lead_name}}`, `{{lead_location}}`)
- Speak-during-execution ("Let me look that up" during tool calls)
- British female voice with backchannel ("yeah", "uh-huh")
- Multi-currency pricing (GBP, USD, EUR, NGN)
- Retry logic with backoff (max 2 retries, 60 min delay)

**Defer to post-Wave 0:**
- Strategy performance heatmap (needs 50+ calls)
- CSV lead import workflow (manually insert 10 test leads)
- Strategy auto-optimization (needs 200+ calls)

---

## 4. Critical Pitfalls (Top 5 Risks)

### 1. Retell Phone Number API Deprecation -- Deadline: March 31, 2026
**Risk:** All phone number config using `inbound_agent_id`/`outbound_agent_id` stops working.
**Mitigation:** Use weighted agent arrays from day one. Upgrade retell-sdk to 5.8.0. This is a hard deadline 7 days from research date.

### 2. retell-sdk Major Version Mismatch (4.x vs 5.x)
**Risk:** Runtime errors, missing type definitions, incompatible schemas.
**Mitigation:** Upgrade to `retell-sdk>=5.8.0,<6.0.0`. Test all SDK calls (create LLM, create agent, create phone call, update phone number) after upgrade. Check PyPI changelog for breaking changes.

### 3. Tool Execution Timeout (10 Seconds)
**Risk:** Sarah goes silent mid-call. Tool results lost. Retell retries up to 3 times.
**Mitigation:** Pre-load ALL data into Supabase (no external API calls during tool execution). Add proper indexes. Implement hardcoded fallback responses for every tool. Set Supabase client timeout to 5s.

### 4. Toll Fraud via Runaway Auto-Dialer
**Risk:** Bug causes hundreds of calls in minutes. Retell/Twilio billing spike. Number flagged as spam.
**Mitigation:** Backend enforces MAX_DAILY_CALLS=200 independently from n8n. `/retell/initiate-call` verifies: daily count < limit, no active call, valid lead status. Set Retell spending limit.

### 5. Race Condition in Lead Queue (Duplicate Calls)
**Risk:** n8n picks the same lead twice before status update propagates.
**Mitigation:** Use atomic Supabase RPC with `FOR UPDATE SKIP LOCKED`:
```sql
CREATE FUNCTION pick_next_lead() RETURNS leads AS $$
  UPDATE leads SET status = 'calling', updated_at = NOW()
  WHERE id = (SELECT id FROM leads WHERE status = 'queued'
    ORDER BY priority DESC, created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED)
  RETURNING *;
$$ LANGUAGE sql;
```

**Honorable mentions:** Webhook signature bypass (always verify), system prompt >8K tokens (move data into tools), service key in frontend (use anon key only), duplicate webhook processing (dedup on retell_call_id), recording URL expiry (download in post-call handler).

---

## 5. Architecture Decisions

### Overall Pattern: Webhook-Driven Integration

```
Retell AI (voice) --tool calls/webhooks--> FastAPI (backend) --queries--> Supabase (data)
n8n (scheduler) --POST /initiate-call----> FastAPI (backend) --API call--> Retell AI (voice)
React Dashboard --polls every 5-30s------> Supabase (data, read-only)
```

### Key Decisions

| Decision | Choice | Alternative Rejected | Why |
|----------|--------|---------------------|-----|
| Dashboard data | Polling (5-30s) | Supabase real-time / WebSocket | Single operator. Polling is simpler, sufficient, no persistent connections. |
| Dashboard auth | Bearer token (DASHBOARD_SECRET_KEY) | Supabase Auth with RBAC | Single user. Full auth is overengineering. |
| Queue management | Only n8n polls queue | Both n8n and FastAPI poll | Prevents race conditions. Single source of truth for queue picking. |
| Tool data source | Pre-loaded in Supabase | External API calls during tool execution | 10s timeout. Supabase queries complete in <500ms. External APIs are unpredictable. |
| Tool failure handling | Graceful fallback (natural speech) | Technical error messages | Sarah must keep talking naturally even when tools fail. |
| Webhook deduplication | Idempotent on retell_call_id | Process all webhooks | Retell retries on timeout. Prevents duplicate emails, double-logging. |
| Lead status transitions | State machine with valid transitions map | Freeform status updates | Prevents data corruption. Enforces valid business logic flow. |

### Component Boundaries

1. **Retell AI** -- Voice handling, LLM inference, call management, recording. We do NOT touch audio.
2. **FastAPI Backend** -- Webhook handler (tool calls + lifecycle), call initiation API, dashboard data API. Single process, 2 Gunicorn workers for production.
3. **Supabase** -- Persistence (leads, call_logs, pipeline_logs, dial_schedules), RLS, SQL views for analytics, atomic queue operations.
4. **n8n** -- 3 workflows: auto-dialer (cron), post-call handler (webhook), lead import (webhook). All use external secrets, not hardcoded credentials.
5. **React Dashboard** -- 3 tabs: Live View, Pipeline, Strategy Analytics. Polls Supabase directly with anon key.

---

## 6. Roadmap Implications

### Suggested Phase Structure (6 Phases)

#### Phase 1: Foundation + Dependency Upgrade
**Rationale:** Everything depends on working SDK + database. The retell-sdk 5.x upgrade and weighted agent migration are time-critical (March 31 deadline).
**Delivers:** Updated dependencies, Supabase schema (leads, call_logs, pipeline_logs, dial_schedules, SQL views), environment validation, phone number configured with weighted agents.
**Features addressed:** Lead queue management, Supabase schema, env setup.
**Pitfalls avoided:** API deprecation (#1), SDK mismatch (#2).
**Research flag:** NEEDS PHASE RESEARCH -- retell-sdk 4.x to 5.x may have breaking changes in method signatures and response types.

#### Phase 2: Retell LLM + Voice Agent
**Rationale:** LLM ID and Agent ID are prerequisites for webhook URL configuration and phone assignment. Must be created before the backend can receive tool calls.
**Delivers:** System prompt (under 8K tokens), 3 tool definitions with webhook URLs, voice agent with British female voice + backchannel, phone number assigned with weighted agents.
**Features addressed:** System prompt, tool definitions, voice selection, dynamic variables.
**Pitfalls avoided:** Prompt bloat (#6), tool webhook URL misconfiguration.
**Research flag:** Standard patterns. Well-documented in Retell docs.

#### Phase 3: Webhook Backend
**Rationale:** Must exist before n8n workflows can POST to it. Tool execution during live calls is the core value proposition.
**Delivers:** FastAPI server with: tool call router (3 handlers), webhook lifecycle endpoint (call_started/ended/analyzed), call initiation endpoint, dashboard API endpoints, HMAC verification, CORS, rate limiting.
**Features addressed:** Tool execution, webhook processing, call initiation, dashboard API, security.
**Pitfalls avoided:** Tool timeout (#3), webhook signature bypass (#5), service key exposure.
**Research flag:** Standard FastAPI patterns. No deep research needed.

#### Phase 4: Auto-Dialer + Post-Call Workflows
**Rationale:** Depends on backend endpoints being live. Enables autonomous calling pipeline.
**Delivers:** 3 n8n workflows: auto-dialer (cron every 2 min with dial window checks), post-call handler (outcome routing + email + retry logic), lead import (CSV with E.164 validation).
**Features addressed:** Auto-dialer, post-call routing, payment email, retry logic, lead import, rate limiting.
**Pitfalls avoided:** Toll fraud (#4), race condition (#5), duplicate webhooks, secrets in git.
**Research flag:** Minor research on n8n 2.x Supabase node API may be needed.

#### Phase 5: Dashboard
**Rationale:** Read-only monitoring. Non-blocking for the calling pipeline. Last before testing.
**Delivers:** React SPA with 3 tabs: Live View (poll 5s), Pipeline kanban (poll 30s), Strategy Analytics (bar charts, tables). Bearer token auth.
**Features addressed:** Live monitoring, pipeline management, strategy tracking.
**Pitfalls avoided:** Service key in frontend, over-engineering (polling not WebSocket).
**Research flag:** Standard React patterns. No deep research needed.

#### Phase 6: Testing + Wave 0
**Rationale:** End-to-end validation before real leads. 10 real calls with full pipeline monitoring.
**Delivers:** Self-test checklist passed. 10 real calls completed. Transcripts reviewed. Strategy data collected.
**Features addressed:** Validation of all prior phases.
**Pitfalls avoided:** Deploying untested code to real leads.
**Research flag:** No research needed -- execution only.

### Phase Ordering Rationale

- **Phases 1-3 are strictly sequential:** Each depends on the output of the previous (SDK -> LLM/Agent IDs -> webhook endpoints).
- **Phases 4 and 5 could run in parallel** if two developers are available. n8n workflows (Phase 4) and React dashboard (Phase 5) are independent -- both read/write Supabase and interact with the backend but not each other.
- **Phase 6 must be last:** Full end-to-end validation requires all components operational.
- **The March 31 deadline means Phase 1 must start immediately.** No time to spend on planning perfection.

### Phases Needing Deeper Research

| Phase | Research Needed | Why |
|-------|----------------|-----|
| Phase 1 | YES | retell-sdk 4.x->5.x migration. Check breaking changes in method signatures, auth patterns, response types. |
| Phase 4 | MINOR | Verify n8n 2.x Supabase node CRUD API and external secrets syntax. |

### Phases With Standard Patterns (Skip Research)

| Phase | Why Safe |
|-------|---------|
| Phase 2 | Retell LLM/agent creation is well-documented with examples. |
| Phase 3 | Standard FastAPI webhook server. Tool router is a simple dict dispatch. |
| Phase 5 | Standard React + polling + Recharts. No novel patterns. |
| Phase 6 | Execution and observation, no new code patterns. |

---

## 7. Open Questions

| Question | Impact | When to Resolve |
|----------|--------|-----------------|
| What are the exact breaking changes in retell-sdk 5.x vs 4.x? | HIGH -- blocks Phase 1 | During Phase 1 implementation. Check PyPI changelog and GitHub releases. |
| Does Retell publish webhook source IP ranges for allowlisting? | LOW -- HMAC verification is sufficient | Defer. Rely on signature verification. |
| Is GPT-5 Nano cost-effective at >100 calls/day? | LOW -- irrelevant for Wave 0 | Evaluate post-Wave 0 based on actual per-call costs. |
| Should we use Retell Conversation Flow API instead of system prompt? | MEDIUM -- could improve conversation structure | Evaluate after Wave 0 based on transcript quality. |
| Should PII redaction be enabled for EU leads (GDPR)? | MEDIUM -- compliance risk | Decide before calling EU leads. $0.01/min. |
| Should recording URLs be persisted to Supabase Storage? | LOW -- UX only | Decide during Phase 4 (post-call handler). Accept expiry notice for v1 if effort is high. |
| What is the actual token count of the full system prompt with all strategies and objections? | MEDIUM -- must stay under 8K | Measure during Phase 2 prompt authoring. Move data to tools if over limit. |

---

## Sources

### Primary (HIGH confidence)
- [Retell AI Changelog](https://www.retellai.com/changelog) -- API deprecations, feature changes, model availability
- [Retell AI Custom LLM Best Practices](https://docs.retellai.com/integrate-llm/llm-best-practice) -- Prompt length, tool execution, latency guidance
- [Retell AI Create Phone Call API](https://docs.retellai.com/api-references/create-phone-call) -- Call initiation parameters
- [Retell AI Community: Phone Number Deprecation](https://community.retellai.com/t/clarification-on-phone-number-agent-field-deprecation/1917) -- Migration details
- [retell-sdk on PyPI](https://pypi.org/project/retell-sdk/) -- Version 5.8.0, release history
- [FastAPI on PyPI](https://pypi.org/project/fastapi/) -- Version 0.135.1, release notes
- [supabase on PyPI](https://pypi.org/project/supabase/) -- Version 2.28.3

### Secondary (MEDIUM confidence)
- [n8n Release Notes](https://docs.n8n.io/release-notes/) -- v2.11.x, external secrets, autosave
- [n8n Supabase Node Docs](https://docs.n8n.io/integrations/builtin/app-nodes/n8n-nodes-base.supabase/) -- Integration patterns
- [Vite Releases](https://vite.dev/releases) -- v6.x stable, v8 too new
- [Tailwind CSS on npm](https://www.npmjs.com/package/tailwindcss) -- v4 breaking changes assessment
- [Recharts on npm](https://www.npmjs.com/package/recharts) -- v3.8.0

### Tertiary (LOW confidence)
- GPT-5 Nano cost-performance comparison -- based on changelog mention, not verified benchmarks
- Retell Assure (QA) -- launched January 2026, no hands-on evaluation
- Retell webhook IP ranges -- not published, inferred from security.md discussion

---
*Research completed: 2026-03-24*
*Synthesized: 2026-03-25*
*Ready for roadmap: yes*
