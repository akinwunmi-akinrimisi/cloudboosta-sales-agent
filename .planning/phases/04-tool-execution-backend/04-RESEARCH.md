# Phase 4: Tool Execution Backend - Research

**Researched:** 2026-03-25
**Domain:** Retell AI custom tool webhooks, Supabase Python queries, FastAPI tool call routing
**Confidence:** HIGH

## Summary

Phase 4 implements the three tool handlers (lookup_programme, get_objection_response, log_call_outcome) that Sarah calls during live conversations, fixes the FastAPI tool call router to match Retell's actual webhook payload format, and adds tool-specific fallbacks for graceful failure handling. All tools must execute within 10 seconds.

The critical research finding is that Retell's custom function webhook sends a standard payload `{name, call, args}` when `args_at_root` is false (which is the project's configuration, confirmed in Phase 2). The current `ToolCallPayload` model in main.py expects `{call_id, name, args}` which is incorrect -- it must be restructured to extract `call_id` from the nested `call` object. Additionally, `lead_id` must be passed through call `metadata` during call initiation and extracted from `call.metadata` in the tool webhook handler.

The Supabase tables are small (4 programmes, 16 pricing rows, 30+ objection responses), so queries will complete well within the 10-second timeout. The current sync Supabase client works adequately in async FastAPI handlers for these sub-500ms queries. The webhook signature verification must switch from custom HMAC to Retell SDK's `retell.verify()` method using the API key.

**Primary recommendation:** Restructure the tool call endpoint to parse Retell's standard `{name, call, args}` payload, pass lead_id via call metadata, implement all three handlers with Supabase queries, and add tool-specific conversational fallbacks.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **lookup_programme**: Structured voice-ready JSON response, country-to-currency map hardcoded, profile-to-pathway map hardcoded, testimonial matched by persona, pricing from Supabase
- **get_objection_response**: Exact key match (`WHERE objection_key = $1`), A.D.Q. fallback if no match
- **log_call_outcome**: Auto-update lead status + insert call_logs in one transaction, lead_id from call metadata, FOLLOW_UP sets follow_up_at
- **Tool-specific fallbacks**: lookup -> generic pitch, objection -> "fair point, come back", log -> silent retry
- **BACK-01**: Fix ToolCallPayload to match Retell's actual webhook format
- **Tool-specific fallback messages**: Must sound conversational, never mention errors or systems being down

### Claude's Discretion
- Exact Retell webhook payload format (determined by research -- see findings below)
- Retell tool response JSON structure (determined by research -- see findings below)
- Supabase query optimization patterns
- Error handling patterns (try/except, timeout handling)
- How to pass lead_id through the tool call chain
- Whether to add a persona parameter to lookup_programme or derive it from call context

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TOOL-01 | lookup_programme returns programme details with multi-currency pricing based on lead country | Country-to-currency map, profile-to-pathway map, Supabase pricing query pattern, voice-ready JSON response structure |
| TOOL-02 | get_objection_response returns multi-layer responses for 11 objection types | Exact key match query pattern, objection_responses table schema, A.D.Q. fallback for unmatched keys |
| TOOL-03 | log_call_outcome records outcome, strategy, persona per call | call_logs INSERT + leads UPDATE pattern, lead_id extraction from call metadata, follow_up_at handling |
| TOOL-04 | All 3 tools execute within 10 seconds with hardcoded fallback responses | Small table sizes (4/16/30 rows), sub-500ms query times, tool-specific fallback strings |
| TOOL-05 | Speak-during-execution enabled on all tools to avoid dead air | Already configured in Phase 2 tool definitions (speak_during_execution=True on lookup and objection, False on log) |
| BACK-01 | FastAPI server with tool call router dispatching to 3 tool handlers at POST /retell/tool | Retell standard payload format {name, call, args}, ToolCallPayload Pydantic model redesign, signature verification fix |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| FastAPI | 0.115.x | Webhook server | Already pinned, handles Retell Content-Type correctly |
| supabase | 2.12.0 | Database queries | Already installed, sync client sufficient for small tables |
| retell-sdk | 5.8.0 | Webhook signature verification via `Retell.verify()` | Already installed, provides SDK verify method |
| pydantic | 2.9.0 | Request/response validation | Already installed, models for payload parsing |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| python-dotenv | 1.0.1 | Environment variables | Already installed, loads .env |
| logging (stdlib) | N/A | Structured logging | All tool handlers log execution and errors |

**Installation:** No new dependencies needed. All required packages are already in `requirements.txt`.

## Architecture Patterns

### Recommended Project Structure
```
execution/backend/
  main.py             # POST /retell/tool endpoint (FIX ToolCallPayload)
  tools.py            # 3 tool handlers + execute_tool() + fallbacks
  supabase_client.py  # Sync Supabase client (unchanged)
  retell_config.py    # Retell client for verify() (unchanged)
```

### Pattern 1: Retell Custom Function Webhook Payload (Standard Mode)

**What:** When `args_at_root` is false (our configuration), Retell POSTs a standard payload to the tool webhook URL.

**Confidence:** HIGH -- verified from official Retell docs, Phase 2 research, and create_llm.py comments.

**Incoming payload format:**
```json
{
  "name": "lookup_programme",
  "call": {
    "call_id": "Jabr9TXYYJHfvl6Syypi88rdAHYHmcq6",
    "call_type": "phone_call",
    "agent_id": "oBeDLoLOeuAbiuaMFXRtDOLriTJ5tSxD",
    "call_status": "ongoing",
    "metadata": {
      "lead_id": "uuid-of-the-lead"
    },
    "retell_llm_dynamic_variables": {
      "lead_name": "John",
      "lead_location": "Nigeria"
    },
    "transcript": "Agent: Hi John, this is Sarah...\nUser: Hi Sarah...",
    "from_number": "+17405085360",
    "to_number": "+2348012345678"
  },
  "args": {
    "profile": "A",
    "country": "Nigeria"
  }
}
```

**Key fields:**
- `name` -- tool function name (used for dispatch)
- `call.call_id` -- unique call identifier
- `call.metadata` -- arbitrary object set during `create_phone_call()`, contains `lead_id`
- `call.retell_llm_dynamic_variables` -- variables injected into prompt
- `args` -- function arguments matching the tool's parameter schema

**Source:** [Retell Custom Function Docs](https://docs.retellai.com/build/single-multi-prompt/custom-function), [Retell Get Call API](https://docs.retellai.com/api-references/get-call)

### Pattern 2: Retell Tool Response Format

**What:** The server returns a response that Retell converts to string and passes to the LLM.

**Confidence:** HIGH -- verified from multiple Retell docs pages.

**Response rules:**
- HTTP status code must be 200-299
- Body can be: string, JSON object, buffer, or blob
- All formats are converted to string before sending to LLM
- Response is capped at 15,000 characters
- No special wrapper required -- just return the data

**Recommended format:**
```python
# Return a JSON dict directly -- FastAPI serializes it
return {
    "programme": "Zero to Cloud DevOps",
    "duration": "16 weeks",
    "price_standard": "3000",
    "currency": "GBP",
    # ... more fields
}
```

Retell converts the entire JSON to a string and passes it to the LLM as the tool result. The LLM then uses this data to generate Sarah's spoken response.

**Source:** [Retell Custom Function Docs](https://docs.retellai.com/build/single-multi-prompt/custom-function)

### Pattern 3: Passing lead_id Through Call Metadata

**What:** The `create_phone_call()` API accepts a `metadata` field -- an arbitrary object stored with the call. This metadata is included in the `call` object sent to custom function webhooks.

**Confidence:** HIGH -- verified from [Create Phone Call API](https://docs.retellai.com/api-references/create-phone-call) and [Get Call API](https://docs.retellai.com/api-references/get-call).

**Set metadata during call initiation:**
```python
call = retell_client.call.create_phone_call(
    from_number="+17405085360",
    to_number=lead_data["phone"],
    metadata={"lead_id": str(req.lead_id)},  # ADD THIS
    retell_llm_dynamic_variables={
        "lead_name": lead_data["name"],
        "lead_location": lead_data.get("location", "unknown"),
    },
)
```

**Extract in tool webhook handler:**
```python
lead_id = payload["call"].get("metadata", {}).get("lead_id")
```

This is the correct way to pass lead_id through the tool call chain. The current `initiate_call` endpoint does NOT pass metadata -- this must be added.

### Pattern 4: Webhook Signature Verification Fix

**What:** The current main.py uses custom HMAC-SHA256 with `WEBHOOK_SECRET`. Retell actually signs webhooks using the API key and provides `Retell.verify()` in the SDK.

**Confidence:** HIGH -- verified from [Retell Secure Webhook Docs](https://docs.retellai.com/features/secure-webhook) and Phase 2 research.

**Current (incorrect):**
```python
# main.py -- uses WEBHOOK_SECRET env var with manual HMAC
expected = hmac.new(WEBHOOK_SECRET.encode(), body, hashlib.sha256).hexdigest()
```

**Correct approach:**
```python
from retell import Retell
import os

retell = Retell(api_key=os.environ["RETELL_API_KEY"])

valid_signature = retell.verify(
    json.dumps(post_data, separators=(",", ":"), ensure_ascii=False),
    api_key=str(os.environ["RETELL_API_KEY"]),
    signature=str(request.headers.get("X-Retell-Signature")),
)
```

**Important:** The verify method requires the body serialized with `separators=(",", ":")` and `ensure_ascii=False`. This is specific to the Retell SDK's verification algorithm.

**Note:** The existing `verify_retell_signature()` function is also used by the lifecycle webhook endpoint (`POST /retell/webhook`). Both endpoints should use the same Retell SDK verification. The `WEBHOOK_SECRET` env var can be removed.

### Pattern 5: Sync Supabase Client in Async FastAPI

**What:** The existing code uses the sync `supabase` client (`create_client` from `supabase`) inside `async def` handlers. This blocks the event loop during HTTP requests to Supabase.

**Confidence:** HIGH -- verified from existing codebase (supabase_client.py, dialer.py, main.py all use sync client in async functions).

**Decision: Keep sync client for Phase 4.**

Rationale:
- Tables are tiny (4/16/30 rows) -- queries complete in <500ms
- Supabase Python async client requires `from supabase._async.client import AsyncClient, create_client` and `await` on every query
- Migrating to async would touch every file that uses supabase (main.py, dialer.py, tools.py, test_phase1.py)
- For Phase 4's scope (tool handlers only), the sync client is acceptable
- Single-server, single-concurrent-call architecture means no event loop contention

**Alternative for future:** If performance becomes an issue, migrate to async client:
```python
from supabase._async.client import AsyncClient, create_client

async def get_supabase() -> AsyncClient:
    return await create_client(url, key)
```

### Anti-Patterns to Avoid
- **Returning error messages to Sarah:** Tool failures must return conversational fallback text, never "Error: database connection failed" or similar technical language. The LLM will speak whatever you return.
- **Making external API calls during tool execution:** All data is pre-loaded in Supabase. No external HTTP calls during tool handlers.
- **Using args_at_root=true:** Would break the payload structure. Keep standard format.
- **Hardcoding call_id extraction from root level:** The current ToolCallPayload has `call_id: str` at root -- but Retell nests it under `call.call_id`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Webhook signature verification | Custom HMAC-SHA256 | `retell_client.verify()` from retell-sdk | SDK handles serialization quirks, keeps in sync with Retell's algorithm changes |
| Currency formatting | Custom currency symbols and decimal handling | Hardcoded map + raw decimal from DB | Small fixed set (4 currencies), over-engineering to build a formatter |
| Objection matching/fuzzy search | NLP-based objection classifier | Exact key match `WHERE objection_key = $1` | The LLM already classifies the objection type -- the tool just looks up the response |
| Retry logic for failed tool calls | Custom retry decorator | Retell's built-in retry (up to 3 times on timeout) + tool-specific fallback on our side | Double-retry would cause duplicate side effects |

**Key insight:** The LLM handles all the intelligence (classifying objections, selecting profiles, deciding when to call tools). Our tool handlers are simple database lookups and inserts. Keep them as thin data-access layers.

## Common Pitfalls

### Pitfall 1: ToolCallPayload Pydantic Model Mismatch
**What goes wrong:** FastAPI rejects Retell's webhook payload with 422 Validation Error because the Pydantic model expects `{call_id, name, args}` but Retell sends `{name, call: {call_id, ...}, args: {...}}`.
**Why it happens:** The original main.py was written with an assumed payload format before the Retell docs were consulted.
**How to avoid:** Redesign ToolCallPayload to match the actual payload: `name: str`, `call: dict`, `args: dict`. Extract `call_id` and `lead_id` from the nested `call` object.
**Warning signs:** All tool calls fail with 422 during testing.

### Pitfall 2: Missing lead_id in Call Metadata
**What goes wrong:** `log_call_outcome` cannot update the correct lead because there's no lead_id available in the tool call context.
**Why it happens:** The current `initiate_call` endpoint passes `retell_llm_dynamic_variables` but not `metadata`. Dynamic variables inject into the prompt text but are not designed for data passing to tool handlers.
**How to avoid:** Add `metadata={"lead_id": str(req.lead_id)}` to the `create_phone_call()` call. Extract from `payload["call"]["metadata"]["lead_id"]` in the tool handler.
**Warning signs:** log_call_outcome silently fails or logs to wrong lead.

### Pitfall 3: Signature Verification Body Serialization
**What goes wrong:** `retell.verify()` returns False even with valid webhooks because the body was serialized differently than Retell expects.
**Why it happens:** Retell signs the body with specific JSON serialization: `separators=(",", ":")` and `ensure_ascii=False`. If FastAPI's `request.body()` returns bytes that don't match this serialization, verification fails.
**How to avoid:** Read raw body bytes from request, decode to string, parse to dict, then re-serialize with the exact separators for verification. Or use the raw body bytes directly if the SDK accepts bytes.
**Warning signs:** All webhooks return 401 in production.

### Pitfall 4: Tool Response Too Large
**What goes wrong:** Retell truncates the tool response or the LLM gets confused because the response exceeds 15,000 characters.
**Why it happens:** Returning the entire call object, full programme descriptions, or verbose JSON.
**How to avoid:** Keep tool responses concise and voice-ready. Only include fields Sarah needs to speak. The 15K cap is generous but keep responses focused.
**Warning signs:** Sarah reads partial or garbled information.

### Pitfall 5: Database Transaction for log_call_outcome
**What goes wrong:** Lead status updates but call_log insert fails (or vice versa), leaving data inconsistent.
**Why it happens:** Two separate Supabase queries without transactional guarantees.
**How to avoid:** Use try/except with rollback logic. If call_log insert succeeds but lead update fails, the DB trigger on lead status change won't fire. Consider ordering: insert call_log first, then update lead status (since the trigger fires on lead update, it's better to have the call_log row already present).
**Warning signs:** Pipeline logs show status transitions but call_logs table is missing entries.

### Pitfall 6: Hardcoded Phone Number Outdated
**What goes wrong:** Call initiation uses the old phone number +17404943597 (already replaced by +17405085360 in Phase 3).
**Why it happens:** Hardcoded phone number in main.py was not updated after Phase 3 phone purchase.
**How to avoid:** Update the hardcoded `from_number` in `initiate_call()` to +17405085360. Better yet, read from environment variable `FROM_NUMBER`.
**Warning signs:** Calls fail with "phone number not found" error.

## Code Examples

### Example 1: Corrected ToolCallPayload Model
```python
# Source: Retell Custom Function docs + Phase 2 research
from pydantic import BaseModel, field_validator
from typing import Any, Optional

class ToolCallPayload(BaseModel):
    """Retell custom function webhook payload (args_at_root=false)."""
    name: str
    call: dict[str, Any]  # Full call object from Retell
    args: dict[str, Any]  # Tool arguments matching parameter schema

    @field_validator("name")
    @classmethod
    def valid_function_name(cls, v):
        allowed = {"lookup_programme", "get_objection_response", "log_call_outcome"}
        if v not in allowed:
            raise ValueError(f"Unknown function: {v}")
        return v

    @property
    def call_id(self) -> str:
        return self.call.get("call_id", "unknown")

    @property
    def lead_id(self) -> Optional[str]:
        return self.call.get("metadata", {}).get("lead_id")
```

### Example 2: Updated Tool Call Endpoint
```python
@app.post("/retell/tool")
async def retell_tool(request: Request):
    body = await request.body()

    # Verify signature using Retell SDK
    post_data = json.loads(body)
    valid = retell_client.verify(
        json.dumps(post_data, separators=(",", ":"), ensure_ascii=False),
        api_key=str(os.environ["RETELL_API_KEY"]),
        signature=str(request.headers.get("X-Retell-Signature", "")),
    )
    if not valid:
        raise HTTPException(status_code=401, detail="Invalid signature")

    payload = ToolCallPayload(**post_data)
    result = await execute_tool(
        name=payload.name,
        args=payload.args,
        call_id=payload.call_id,
        lead_id=payload.lead_id,
    )
    return json.loads(result)
```

### Example 3: lookup_programme Handler
```python
# Maps from CONTEXT.md decisions
COUNTRY_CURRENCY_MAP = {
    "UK": "GBP", "GB": "GBP", "United Kingdom": "GBP",
    "England": "GBP", "Scotland": "GBP", "Wales": "GBP",
    "US": "USD", "USA": "USD", "United States": "USD", "Canada": "USD",
    "Nigeria": "NGN", "NG": "NGN",
    # EU countries -> EUR
    "Germany": "EUR", "France": "EUR", "Ireland": "EUR",
    "Netherlands": "EUR", "Spain": "EUR", "Italy": "EUR",
    "Portugal": "EUR", "Belgium": "EUR", "Austria": "EUR",
}
DEFAULT_CURRENCY = "GBP"

PROFILE_PATHWAY_MAP = {
    "A": {"bundle_slug": "zero-to-cloud-devops", "pathway_name": "Zero to Cloud DevOps", "duration": "16 weeks"},
    "B": {"bundle_slug": "zero-to-cloud-devops", "pathway_name": "Zero to Cloud DevOps", "duration": "16 weeks"},
    "C": {"bundle_slug": "devops-pro", "pathway_name": "DevOps Pro", "duration": "16 weeks"},
    "X": {"bundle_slug": "cloud-computing", "pathway_name": "Cloud Computing", "duration": "8 weeks"},
}

PERSONA_TESTIMONIALS = {
    "career_changer": {"name": "Ebunlomo", "story": "Was a nurse in the UK, now a DevOps Engineer"},
    "beginner_fearful": {"name": "Adeola", "story": "Was a full-time mum, now a DevOps Engineer"},
    "upskiller": {"name": "Olugbenga", "story": "Had a Data Science Masters, now a Data Engineer in UK"},
    "experienced_dev": {"name": "Oluwatosin", "story": "Became 2x AWS certified DevOps Engineer"},
    "price_sensitive": {"name": "Dorcas", "story": "Came from agriculture, landed first Cloud role"},
    "time_constrained": {"name": "Olumide", "story": "Career transitioner, landed dream Cloud DevOps job"},
}
DEFAULT_TESTIMONIAL = {"name": "Ebunlomo", "story": "Was a nurse in the UK, now a DevOps Engineer"}

async def lookup_programme(args: dict) -> dict:
    profile = args.get("profile", "X")
    country = args.get("country", "")
    lead_persona = args.get("lead_persona", "")

    # Map profile to pathway
    pathway = PROFILE_PATHWAY_MAP.get(profile, PROFILE_PATHWAY_MAP["X"])

    # Map country to currency
    currency = COUNTRY_CURRENCY_MAP.get(country, DEFAULT_CURRENCY)

    # Query pricing from Supabase
    pricing = (
        supabase.table("pricing")
        .select("*")
        .eq("bundle_slug", pathway["bundle_slug"])
        .eq("currency", currency)
        .single()
        .execute()
    )

    if not pricing.data:
        raise ValueError(f"No pricing found for {pathway['bundle_slug']}/{currency}")

    p = pricing.data

    # Match testimonial by persona
    testimonial = PERSONA_TESTIMONIALS.get(lead_persona, DEFAULT_TESTIMONIAL)

    return {
        "programme": pathway["pathway_name"],
        "duration": pathway["duration"],
        "price_standard": str(p["standard_price"]),
        "price_early_bird": str(p["early_bird_price"]),
        "savings": str(float(p["standard_price"]) - float(p["early_bird_price"])),
        "currency": currency,
        "early_bird_deadline": str(p.get("early_bird_deadline", "")),
        "cohort_start": str(p.get("cohort_start_date", "")),
        "instalment_option": f"2 instalments at {p.get('instalment_2_total', 'N/A')} or 3 at {p.get('instalment_3_total', 'N/A')}",
        "testimonial_name": testimonial["name"],
        "testimonial_story": testimonial["story"],
        "selling_points": [
            "Live Saturday classes with experienced instructors",
            "Career support and job placement assistance",
            "Hands-on projects for your portfolio",
        ],
    }
```

### Example 4: get_objection_response Handler
```python
ADQ_FALLBACK = {
    "responses": [
        {"label": "A.D.Q. Framework", "script": "That's a really fair point. And I want to give you a proper answer on that. Can I come back to it in just a moment?"}
    ],
    "cultural_nuances": {},
    "recovery_script": "I appreciate you sharing that concern. What specifically worries you most about it?"
}

async def get_objection_response(args: dict) -> dict:
    objection_type = args.get("objection_type", "")

    result = (
        supabase.table("objection_responses")
        .select("responses, cultural_nuances, recovery_script")
        .eq("objection_key", objection_type)
        .maybe_single()
        .execute()
    )

    if not result.data:
        return ADQ_FALLBACK

    return {
        "responses": result.data["responses"],
        "cultural_nuances": result.data.get("cultural_nuances", {}),
        "recovery_script": result.data.get("recovery_script", ""),
    }
```

### Example 5: log_call_outcome Handler
```python
async def log_call_outcome(args: dict, lead_id: str | None = None, call_id: str = "") -> dict:
    outcome = args.get("outcome", "DECLINED")
    summary = args.get("summary", "")
    strategy = args.get("closing_strategy_used", "")
    persona = args.get("lead_persona", "")
    programme = args.get("programme_recommended", "")
    follow_up_date = args.get("follow_up_date")
    objections = args.get("objections_raised", "")
    motivation = args.get("motivation_strength", "")
    capacity = args.get("capacity_assessment", "")

    # 1. Insert call_log
    supabase.table("call_logs").insert({
        "retell_call_id": call_id,
        "lead_id": lead_id,
        "outcome": outcome,
        "closing_strategy_used": strategy,
        "detected_persona": persona,
        "summary": summary,
    }).execute()

    # 2. Update lead status (fires DB trigger -> pipeline_logs)
    if lead_id and outcome != "NO_ANSWER":
        status_map = {
            "COMMITTED": "committed",
            "FOLLOW_UP": "follow_up",
            "DECLINED": "declined",
            "NOT_QUALIFIED": "not_qualified",
        }
        new_status = status_map.get(outcome)
        if new_status:
            update_data = {
                "status": new_status,
                "last_strategy_used": strategy,
                "detected_persona": persona,
                "programme_recommended": programme,
                "outcome": outcome,
            }
            if outcome == "FOLLOW_UP" and follow_up_date:
                update_data["follow_up_at"] = follow_up_date

            supabase.table("leads").update(update_data).eq("id", lead_id).execute()

    return {"result": f"Outcome '{outcome}' logged successfully"}
```

### Example 6: Tool-Specific Fallbacks in execute_tool
```python
TOOL_FALLBACKS = {
    "lookup_programme": {
        "result": "I have the details right here actually. The programme is 16 weeks, "
                  "live Saturday classes, and it includes career support. Let me get you "
                  "the exact pricing and I'll send it to you right after our chat."
    },
    "get_objection_response": {
        "result": "That's a really fair point. And I want to give you a proper answer "
                  "on that. Can I come back to it in just a moment?"
    },
    "log_call_outcome": {
        "result": "Outcome logged successfully"  # Silent -- Sarah doesn't mention this
    },
}
DEFAULT_FALLBACK = {
    "result": "I don't have that information right now. Let me have someone follow up with you."
}

async def execute_tool(name: str, args: dict, call_id: str, lead_id: str | None = None) -> str:
    try:
        handler = TOOL_HANDLERS.get(name)
        if not handler:
            raise ValueError(f"Unknown tool: {name}")

        if name == "log_call_outcome":
            result = await handler(args, lead_id=lead_id, call_id=call_id)
        else:
            result = await handler(args)

        return json.dumps(result)
    except Exception as e:
        logger.error("Tool %s failed for call %s: %s", name, call_id, e)
        fallback = TOOL_FALLBACKS.get(name, DEFAULT_FALLBACK)
        return json.dumps(fallback)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual HMAC-SHA256 verification | Retell SDK `verify()` method | Retell SDK 4.x+ | Must migrate from custom HMAC to SDK method |
| `call_id` at payload root | `call` object with nested `call_id` | Standard Retell format (args_at_root=false) | ToolCallPayload model must be restructured |
| No call metadata | `metadata` field in `create_phone_call()` | Retell API v2 | Enables passing lead_id through tool call chain |

## Open Questions

1. **Supabase `.maybe_single()` vs `.single()` behavior**
   - What we know: `.single()` raises an error if 0 or >1 rows returned. `.maybe_single()` returns None for 0 rows.
   - What's unclear: Whether the supabase-py 2.12 client supports `.maybe_single()` -- it may only be available in newer versions.
   - Recommendation: Test `.maybe_single()`. If not available, use `.execute()` and check `result.data` length manually.

2. **persona parameter for lookup_programme**
   - What we know: The tool_definitions.py does NOT include a `lead_persona` parameter for lookup_programme. It only has `profile` and `country`.
   - What's unclear: Whether the LLM can pass persona through tool args, or whether we should derive it from the `call` object's dynamic variables.
   - Recommendation: Since tool_definitions.py is the authoritative schema and does not include `lead_persona` for lookup_programme, use a default testimonial for now. The log_call_outcome tool does capture `lead_persona` separately.

3. **retell.verify() exact method signature on instance vs class**
   - What we know: Docs show `retell.verify(body, api_key, signature)` where retell is a Retell instance.
   - What's unclear: Whether `verify` is an instance method or a class/static method in retell-sdk 5.8.0.
   - Recommendation: Test both `retell_client.verify(...)` and `Retell.verify(...)` during implementation. The official example uses an instance.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest (not yet configured -- Wave 0 gap) |
| Config file | none -- see Wave 0 |
| Quick run command | `cd execution/backend && python -m pytest tests/ -x -q` |
| Full suite command | `cd execution/backend && python -m pytest tests/ -v` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TOOL-01 | lookup_programme returns correct programme/pricing/testimonial for each profile+country combo | unit | `python -m pytest tests/test_tools.py::test_lookup_programme -x` | No -- Wave 0 |
| TOOL-02 | get_objection_response returns correct response for known key, fallback for unknown | unit | `python -m pytest tests/test_tools.py::test_get_objection_response -x` | No -- Wave 0 |
| TOOL-03 | log_call_outcome inserts call_log and updates lead status | integration | `python -m pytest tests/test_tools.py::test_log_call_outcome -x` | No -- Wave 0 |
| TOOL-04 | All tools return within 10 seconds, fallbacks return on exception | unit | `python -m pytest tests/test_tools.py::test_tool_fallbacks -x` | No -- Wave 0 |
| TOOL-05 | speak_during_execution configured | manual-only | Verify in Retell dashboard -- already set in Phase 2 | N/A |
| BACK-01 | POST /retell/tool accepts Retell payload and dispatches correctly | integration | `python -m pytest tests/test_main.py::test_tool_endpoint -x` | No -- Wave 0 |

### Sampling Rate
- **Per task commit:** Manual curl test against running server
- **Per wave merge:** Full test suite if tests exist
- **Phase gate:** Verify all 3 tools return correct data via curl

### Wave 0 Gaps
- [ ] `tests/test_tools.py` -- unit tests for all 3 tool handlers + fallbacks
- [ ] `tests/test_main.py` -- integration test for POST /retell/tool endpoint
- [ ] `tests/conftest.py` -- shared fixtures (mock Supabase, sample payloads)
- [ ] `pytest.ini` or `pyproject.toml` [tool.pytest.ini_options] -- pytest configuration

*(Tests are out of scope for Phase 4 per REQUIREMENTS.md -- testing is Phase 9. However, manual curl verification is required.)*

## Sources

### Primary (HIGH confidence)
- [Retell Custom Function Docs (single/multi-prompt)](https://docs.retellai.com/build/single-multi-prompt/custom-function) -- webhook payload format {name, call, args}, args_at_root behavior, response format (string/JSON/buffer, 200-299 status, 15K char cap)
- [Retell Custom Function Docs (conversation flow)](https://docs.retellai.com/build/conversation-flow/custom-function) -- same payload format, "Payload: args only" toggle, code examples
- [Retell Get Call API](https://docs.retellai.com/api-references/get-call) -- complete call object structure including metadata and retell_llm_dynamic_variables fields
- [Retell Create Phone Call API](https://docs.retellai.com/api-references/create-phone-call) -- metadata parameter for passing custom data (lead_id) through call lifecycle
- [Retell Secure Webhook Docs](https://docs.retellai.com/features/secure-webhook) -- signature verification using API key + Retell.verify() SDK method, allowlist IP 100.20.5.228
- Phase 2 Research (02-RESEARCH.md) -- confirmed args_at_root=false, signature verification pitfall, payload format
- create_llm.py line 66-68 -- explicit comment noting Phase 4 must update ToolCallPayload

### Secondary (MEDIUM confidence)
- [Supabase Python discussions](https://github.com/orgs/supabase/discussions/28843) -- async client pattern with FastAPI Depends, import path `supabase._async.client`
- [RetellAI Python Demo](https://github.com/RetellAI/retell-custom-llm-python-demo/blob/main/app/server.py) -- retell.verify() usage pattern with exact serialization params

### Tertiary (LOW confidence)
- `.maybe_single()` availability in supabase-py 2.12 -- needs runtime validation
- Exact `Retell.verify()` method signature (instance vs class) in SDK 5.8.0 -- needs runtime validation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- all libraries already installed and verified in prior phases
- Architecture (webhook payload format): HIGH -- verified from multiple official Retell docs and Phase 2 research
- Architecture (Supabase queries): HIGH -- table schemas and seed data reviewed, queries are simple
- Architecture (lead_id via metadata): HIGH -- verified from Create Phone Call and Get Call API docs
- Pitfalls: HIGH -- based on direct code review of main.py vs Retell docs
- Signature verification: MEDIUM -- SDK verify() method confirmed in docs but exact Python 5.8 signature not tested

**Research date:** 2026-03-25
**Valid until:** 2026-04-25 (stable -- Retell webhook format unlikely to change)
