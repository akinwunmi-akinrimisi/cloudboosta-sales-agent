# Phase 4: Tool Execution Backend - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement the 3 tool handlers (lookup_programme, get_objection_response, log_call_outcome) that Sarah calls during live conversations. Fix the FastAPI tool call router to match Retell's actual webhook format. Add tool-specific fallbacks for Supabase failures. All tools must execute within 10 seconds.

</domain>

<decisions>
## Implementation Decisions

### lookup_programme Response Format
- Structured voice-ready JSON (not pre-written script, not minimal data)
- Returns: pathway name, duration, price_early_bird, price_standard, savings, early_bird_deadline, cohort_start, instalment_option, testimonial (name + story), selling_points (2-3)
- Pricing returned in lead's currency ONLY (not all 4 currencies)
- Country → currency mapping hardcoded in tool handler:
  - GBP: UK, GB, United Kingdom, England, Scotland, Wales
  - USD: US, USA, United States, Canada
  - NGN: Nigeria, NG
  - EUR: Germany, France, Ireland, Netherlands, Spain, Italy, Portugal, Belgium, Austria + other EU
  - Default: GBP (if country unknown)
- Profile → pathway mapping hardcoded in tool handler:
  - A (no tech) → Zero to Cloud DevOps (16wk)
  - B (some tech) → Zero to Cloud DevOps (16wk)
  - C (junior cloud) → DevOps Pro (16wk)
  - X (catch-all) → Cloud Computing (8wk)
- Pricing queried from Supabase pricing table using mapped bundle_size + currency
- Testimonial matched by persona (from tool_definitions.py lead_persona parameter, or passed separately):
  - career_changer → Ebunlomo ("Was a nurse in the UK, now a DevOps Engineer")
  - beginner_fearful → Adeola ("Was a full-time mum, now a DevOps Engineer")
  - upskiller → Olugbenga ("Had a Data Science Masters, now a Data Engineer in UK")
  - experienced_dev → Oluwatosin ("Became 2x AWS certified DevOps Engineer")
  - price_sensitive → Dorcas ("Came from agriculture, landed first Cloud role")
  - time_constrained → Olumide ("Career transitioner, landed dream Cloud DevOps job")
  - Fallback → Ebunlomo

### get_objection_response Matching
- Exact key match: `WHERE objection_key = $1` against objection_responses table
- If no match: return generic A.D.Q. framework response ("That's a fair point. Can I ask what specifically concerns you about that?")
- Response includes: multiple response scripts (A/B/C), cultural nuances for lead's country, recovery script
- The objection keys listed in tool_definitions.py are authoritative (too_expensive, need_to_check_finances, found_cheaper_alternative, etc.)

### log_call_outcome Behavior
- Auto-updates lead status in one transaction:
  - COMMITTED → 'committed' (in_call → committed)
  - FOLLOW_UP → 'follow_up' (in_call → follow_up) + sets leads.follow_up_at
  - DECLINED → 'declined' (in_call → declined)
  - NOT_QUALIFIED → 'not_qualified' (in_call → not_qualified)
  - NO_ANSWER → skip lead update (handled by webhook, not tool)
- Inserts into call_logs with all fields (outcome, strategy, persona, motivation, capacity, objections, summary)
- DB trigger auto-inserts pipeline_logs on lead status change
- lead_id obtained from Retell call metadata (passed during call initiation, available in webhook payload)

### Failure Fallbacks (tool-specific)
- **lookup_programme fails:** "I have the details right here actually. The programme is 16 weeks, live Saturday classes, and it includes career support. Let me get you the exact pricing and I'll send it to you right after our chat."
- **get_objection_response fails:** "That's a really fair point. And I want to give you a proper answer on that. Can I come back to it in just a moment?"
- **log_call_outcome fails:** Silent — Sarah doesn't mention logging. Backend retries via webhook call_ended event.

### Tool Call Router (BACK-01)
- Fix main.py ToolCallPayload Pydantic model to match Retell's actual webhook payload format (research will determine exact format)
- Extract lead_id from call metadata before passing to tool handlers
- Update execute_tool() signature to accept lead_id for log_call_outcome

### Retell Tool Response Format
- Claude's discretion — research determines the exact JSON structure Retell expects back from the webhook

### Claude's Discretion
- Exact Retell webhook payload format (from research)
- Retell tool response JSON structure
- Supabase query optimization (indexes already exist from Phase 1)
- Error handling patterns (try/except, timeout handling)
- How to pass lead_id through the tool call chain
- Whether to add a persona parameter to lookup_programme or derive it from call context

</decisions>

<specifics>
## Specific Ideas

- The tool-specific fallbacks must sound conversational, not robotic. Sarah should never say "there was an error" or "the system is down."
- lookup_programme is the most important tool — it drives the solution presentation. The response must give Sarah everything she needs to present the programme naturally (per Playbook Section 7).
- The 10-second timeout is hard — Supabase queries must be fast. The programmes/pricing/objections tables are small (4/16/30 rows), so queries should complete in <500ms.
- log_call_outcome is called at end of EVERY call (per tool_definitions.py). Even if the lead hangs up mid-conversation, Sarah should try to log what she learned.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `execution/backend/tools.py` — 3 stub handlers + TOOL_HANDLERS registry + execute_tool() wrapper with fallback. This is the file being modified.
- `execution/backend/scripts/tool_definitions.py` — Authoritative tool schemas with all parameter definitions. Tool handlers must accept these exact args.
- `execution/backend/main.py` — POST /retell/tool endpoint + ToolCallPayload model + verify_retell_signature(). Router needs updating.
- `execution/backend/supabase_client.py` — Supabase client singleton. Used by all tool handlers.
- `execution/backend/seeds/` — Seed data defines exact table schemas and data shapes the handlers query.

### Established Patterns
- Async handlers: `async def lookup_programme(args: dict) -> dict`
- Tool registry: `TOOL_HANDLERS = {"lookup_programme": lookup_programme, ...}`
- Fallback pattern: try/except in execute_tool() returns graceful JSON
- Supabase queries: `supabase.table("x").select("*").eq("key", value).execute()`

### Integration Points
- main.py POST /retell/tool → execute_tool() → handler → Supabase
- Retell sends webhook with call_id + tool name + args + metadata
- Tool response goes back to Retell → LLM → Sarah speaks the result
- call_logs INSERT references leads.id via lead_id from metadata
- leads.status UPDATE fires DB trigger → pipeline_logs INSERT

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 04-tool-execution-backend*
*Context gathered: 2026-03-25*
