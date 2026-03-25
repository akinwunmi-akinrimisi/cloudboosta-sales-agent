# Phase 2: Retell LLM Configuration - Research

**Researched:** 2026-03-25
**Domain:** Retell AI LLM creation, system prompt engineering for voice agents, custom tool/function definitions
**Confidence:** HIGH

## Summary

Phase 2 configures Sarah's brain on Retell AI: a single-prompt LLM with the system prompt (under 8K tokens), 3 custom tools pointing to the FastAPI webhook server, and dynamic variables for per-call personalization. The Retell Python SDK (`retell-sdk 5.8.0`) provides `client.llm.create()` which accepts `general_prompt`, `general_tools`, `begin_message`, `model`, and `default_dynamic_variables` as the primary parameters. This is a well-documented API with stable patterns.

The system prompt must be designed specifically for voice/TTS output: short sentences, contractions, natural speech patterns. All data-heavy content (pricing, objection responses, programme details) is offloaded to the 3 custom tools, keeping the prompt focused on personality, flow, gates, and strategy selection. The 3 tools (`lookup_programme`, `get_objection_response`, `log_call_outcome`) are registered as custom tool definitions with webhook URL pointing to `WEBHOOK_BASE_URL/retell/tool`, JSON schema parameters, and `speak_during_execution` configuration.

**Primary recommendation:** Use `client.llm.create()` with `model="gpt-4o-mini"` (confirmed still available on Retell as of March 2026), a single `general_prompt` (no states needed for v1), 3 custom tools in `general_tools`, and `begin_message` with `{{lead_name}}` dynamic variable. Store the returned `llm_id` as `RETELL_LLM_ID` in `.env`. Consider upgrading to `gpt-4.1-mini` for better latency and lower cost, but GPT-4o-mini is the user's stated choice and remains valid.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **System Prompt Structure (under 8K tokens):** Personality + flow in prompt, all data in tools (~5-6K tokens). Includes: identity, TTS voice rules, 7 Flexibility Principles, context awareness, opening flow (outbound + inbound), discovery pattern (OBSERVE-QUESTION-LISTEN-REACT-BRIDGE-NEXT), Pain Stack template, 3 qualification gates, 6 closing strategy summary table, tool calling instructions, dynamic variable references.
- **NOT in prompt:** Pricing, testimonials, objection responses, programme details -- all from tools.
- **AI Disclosure:** Soft -- "Cloudboosta's advisory team". Honest if asked directly.
- **3 Qualification Gates:** Profile (A/B/C/X) -> Motivation (strong/weak/none) -> Capacity (time/budget).
- **6 Closing Strategies:** Doctor Frame, Pain Close, Inverse Close, NEPQ Sequence, Diffusion Framework, Direct Close. Compact summary table in prompt (~300 tokens). Persona -> strategy mapping included.
- **lookup_programme:** Called after Gate 1. Args: profile (A/B/C/X), country. Returns pricing in lead's currency only.
- **get_objection_response:** Always use tool, never embed in prompt. Args: objection_type. Returns response scripts + cultural nuances + recovery.
- **log_call_outcome:** End of every call. Args: outcome, programme_recommended, closing_strategy_used, lead_persona, motivation_strength, capacity_assessment, objections_raised, follow_up_date, summary.
- **Dynamic Variables:** {{lead_name}}, {{lead_location}} via retell_llm_dynamic_variables.
- **Model:** GPT-4o-mini (128K context, system prompt under 8K tokens).

### Claude's Discretion
- Exact system prompt wording and token optimization
- How to compress the 7 Flexibility Principles into prompt-efficient format
- Retell LLM API configuration parameters (response_engine, model selection)
- Tool parameter schemas (exact JSON structure for Retell tool definitions)
- How to structure the opening flow for minimum TTS latency

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| VOICE-01 | Retell LLM configured with Sarah's system prompt (under 8K tokens) including qualification gates and 6 closing strategies | `client.llm.create()` with `general_prompt` parameter. Prompt structure researched with Retell's recommended sectional approach: Identity, Style, Response Guidelines, Task Instructions. Token optimization via offloading data to tools. |
| VOICE-02 | 3 custom tool definitions (lookup_programme, get_objection_response, log_call_outcome) registered on Retell LLM with webhook URLs | `general_tools` parameter accepts array of custom tool objects with `type: "custom"`, `url`, `name`, `description`, `parameters` (JSON Schema), `speak_during_execution`, `execution_message_description`. All point to `WEBHOOK_BASE_URL/retell/tool`. |
| VOICE-05 | Dynamic voice variables (lead_name, lead_location) injected per outbound call via retell_llm_dynamic_variables | `default_dynamic_variables` on LLM for fallbacks. Per-call injection via `retell_llm_dynamic_variables` in `create_phone_call()` (already coded in main.py). `{{lead_name}}` and `{{lead_location}}` syntax in prompt. System variables like `{{current_time}}` available automatically. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| retell-sdk | 5.8.0 | Python SDK for Retell LLM creation API | Already installed in Phase 1. Provides `client.llm.create()` with typed parameters. |
| GPT-4o-mini | Current on Retell | LLM backbone for voice agent | User's locked decision. Still available on Retell (confirmed March 2026). 128K context window. |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| tiktoken | 0.9.x | Token counting for system prompt | Use during prompt authoring to verify <8K tokens. Install as dev dependency. |
| python-dotenv | 1.0.1 | Store RETELL_LLM_ID in .env | Already installed. Store LLM ID after creation. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| GPT-4o-mini | GPT-4.1-mini | 50% lower latency, 83% cheaper per token, 1M context. But user explicitly chose GPT-4o-mini. Could recommend upgrade post-Wave 0. |
| Single prompt (no states) | Multi-prompt with states | States could model the 8-stage conversation flow, but adds complexity. Single prompt is simpler for v1 and sufficient per CONTEXT.md. |
| Retell LLM (hosted) | Custom LLM (self-hosted WebSocket) | Custom gives full control but requires WebSocket streaming, much more code. Retell LLM is the right choice for this project. |

**Installation (dev dependency for token counting):**
```bash
pip install tiktoken
```

## Architecture Patterns

### Recommended Project Structure
```
execution/backend/
  prompts/
    sarah_system_prompt.txt    # The actual system prompt text (~5-6K tokens)
  scripts/
    create_llm.py              # One-time script: creates LLM on Retell, prints llm_id
    update_llm.py              # Update script: modifies existing LLM prompt/tools
    count_tokens.py            # Utility: counts tokens in system prompt
  tools.py                     # Tool handlers (already exists, stubs from Phase 1)
  main.py                      # FastAPI server (already exists)
  retell_config.py             # Retell client (already exists)
```

### Pattern 1: LLM Creation via Python Script
**What:** A standalone Python script that creates the Retell LLM using the SDK, rather than embedding creation logic in the FastAPI server.
**When to use:** One-time setup and iterative prompt updates during development.
**Example:**
```python
# Source: Retell AI Python SDK + API docs
from retell import Retell
import os

client = Retell(api_key=os.environ["RETELL_API_KEY"])

# Load system prompt from file
with open("prompts/sarah_system_prompt.txt") as f:
    system_prompt = f.read()

llm_response = client.llm.create(
    model="gpt-4o-mini",
    general_prompt=system_prompt,
    begin_message="Hi {{lead_name}}, this is Sarah calling from Cloudboosta.",
    general_tools=[
        {
            "type": "custom",
            "name": "lookup_programme",
            "description": "Look up programme details and pricing based on the lead's qualification profile and country. Call this after completing Gate 1 qualification.",
            "url": os.environ["WEBHOOK_BASE_URL"] + "/retell/tool",
            "speak_during_execution": True,
            "execution_message_description": "Let me look that up for you.",
            "speak_after_execution": True,
            "timeout_ms": 10000,
            "parameters": {
                "type": "object",
                "required": ["profile", "country"],
                "properties": {
                    "profile": {
                        "type": "string",
                        "description": "Lead's qualification profile: A (no tech), B (some tech), C (junior cloud/devops), X (not a fit)"
                    },
                    "country": {
                        "type": "string",
                        "description": "Lead's country for currency selection (e.g. 'UK', 'Nigeria', 'US')"
                    }
                }
            }
        },
        # ... other tools
    ],
    default_dynamic_variables={
        "lead_name": "there",
        "lead_location": "unknown",
    },
    tool_call_strict_mode=True,
    model_temperature=0.3,
)

print(f"LLM created: {llm_response.llm_id}")
print(f"Add to .env: RETELL_LLM_ID={llm_response.llm_id}")
```

### Pattern 2: System Prompt as Separate File
**What:** Store the system prompt as a plain text file, not inline in code.
**When to use:** Always. Enables prompt iteration without code changes. Version-controlled via git.
**Rationale:** The prompt is ~5-6K tokens of carefully crafted text. Editing it inline in Python code is error-prone. A `.txt` file allows easy review, diffing, and token counting.

### Pattern 3: Custom Tool with Standard Webhook URL
**What:** All 3 tools point to the same webhook URL (`/retell/tool`), with Retell including the function `name` in the request body for dispatch.
**When to use:** This project uses a single endpoint for all tools (already established in main.py).
**Request format from Retell (standard, not "args only"):**
```json
{
  "name": "lookup_programme",
  "call": {
    "call_id": "abc123",
    "transcript": "...",
    "retell_llm_dynamic_variables": {"lead_name": "John", "lead_location": "UK"}
  },
  "args": {
    "profile": "A",
    "country": "UK"
  }
}
```
**Response format (any of these work, all converted to string for LLM):**
```json
{
  "result": "Based on your profile, I recommend Zero to Cloud DevOps (16 weeks)..."
}
```
**Character limit:** Function result capped at 15,000 characters.

### Pattern 4: Dynamic Variable Injection
**What:** `{{lead_name}}` and `{{lead_location}}` in the prompt are replaced at call time.
**How it works:**
1. `default_dynamic_variables` on the LLM provides fallback values (e.g., `{"lead_name": "there"}`)
2. Per-call values override defaults via `retell_llm_dynamic_variables` in `create_phone_call()` (already coded in main.py)
3. System variables like `{{current_time}}`, `{{current_hour}}`, `{{user_number}}`, `{{call_id}}` are available automatically without configuration
**Where variables work:** Prompt text, begin_message, tool descriptions, tool URLs, tool parameter const values

### Anti-Patterns to Avoid
- **Embedding all data in the system prompt:** Pricing, objection responses, and programme details will blow past 8K tokens. All data must be in tools.
- **Using states for v1:** Multi-prompt with states adds complexity for marginal benefit. Single prompt with clear section headers is sufficient for the 8-stage sales flow.
- **Hardcoding webhook URL:** Always use `WEBHOOK_BASE_URL` environment variable in the tool URL. Never hardcode the URL in the LLM config.
- **Setting temperature too high:** For sales conversations with tool calls, keep temperature low (0.2-0.4). Retell docs recommend lower temperature for function call accuracy.
- **Ignoring TTS formatting:** Writing prompts as if for text output. Voice prompts need short sentences, contractions, and natural speech patterns.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Token counting | Manual character estimation | `tiktoken` library with `cl100k_base` encoding (GPT-4o-mini's tokenizer) | Character count != token count. tiktoken gives exact counts. |
| Webhook signature verification | Custom HMAC implementation | `Retell.verify(body, api_key, signature)` from retell-sdk | SDK method handles serialization edge cases correctly. The existing main.py uses manual HMAC -- should be updated to use SDK's `Retell.verify()`. |
| LLM configuration via dashboard | Manual dashboard clicks | Python script using `client.llm.create()` | Script is repeatable, version-controlled, and can be re-run for updates. |
| Dynamic time greetings | Custom time logic in prompt | `{{current_time}}` and `{{current_hour}}` system variables | Retell provides these automatically, no need to compute in the prompt. |

**Key insight:** Retell provides built-in system variables (`{{current_time}}`, `{{current_hour}}`, `{{current_time_Europe/London}}`) that eliminate the need for custom time-of-day greeting logic. The prompt can simply reference these variables for context-aware greetings.

## Common Pitfalls

### Pitfall 1: System Prompt Exceeds 8K Tokens
**What goes wrong:** Prompt is too long, either causing errors or degrading LLM performance (latency increases linearly with prompt length).
**Why it happens:** Trying to include all conversation data (objection responses, pricing tables, testimonials) directly in the prompt.
**How to avoid:** Strict separation: personality, flow, gates, strategy table IN prompt. All data (pricing, objections, programmes, testimonials) accessed VIA tools. Use tiktoken to measure: `len(encoding.encode(prompt))` must be under 8000.
**Warning signs:** Prompt file exceeds ~30KB, or tiktoken count exceeds 7500 (leave buffer for dynamic variable expansion).
**Cost impact:** Retell charges at base rate up to 3,500 tokens. A 10K token prompt costs ~30% more per minute.

### Pitfall 2: Tool Webhook URL Not Accessible
**What goes wrong:** Retell calls the webhook URL during a live call and gets connection refused or timeout. Sarah goes silent.
**Why it happens:** WEBHOOK_BASE_URL points to localhost, or the server isn't running, or firewall blocks the request.
**How to avoid:** WEBHOOK_BASE_URL must be a publicly accessible HTTPS URL (use ngrok for dev, or deploy to a public server). Verify the URL is reachable from outside your network before creating the LLM.
**Warning signs:** Tool calls timeout (default 120s, should be set to 10s for this project). Sarah says "Let me look that up" but never follows up.

### Pitfall 3: Mismatched Tool Parameter Schemas
**What goes wrong:** Retell sends different arg names/types than what tools.py expects. Tool handler crashes or returns wrong data.
**Why it happens:** Tool parameter schema on Retell doesn't match the expected args in tools.py handlers.
**How to avoid:** Define schemas in one place (the create_llm.py script) and ensure tools.py handlers use the exact same parameter names. The Retell tool schema `properties` keys must match `args.get("key_name")` in tools.py.
**Warning signs:** Tool fallback responses appearing in transcripts when they shouldn't be.

### Pitfall 4: Webhook Signature Verification Method Mismatch
**What goes wrong:** Existing code in main.py uses manual HMAC-SHA256 with `WEBHOOK_SECRET`, but Retell's custom function webhooks use `x-retell-signature` signed with the API key.
**Why it happens:** The existing code was written before the SDK's `Retell.verify()` method was understood. Retell signs webhooks using the account's API key, not a separate webhook secret.
**How to avoid:** For Retell tool call endpoints, use `Retell.verify(body, api_key, signature)`. The WEBHOOK_SECRET is still used for lifecycle webhooks if configured separately in the dashboard. Clarify which verification method applies to which endpoint.
**Warning signs:** All tool calls return 401 in production because signature doesn't match.

### Pitfall 5: begin_message TTS Latency
**What goes wrong:** First utterance is too long, causing noticeable delay before Sarah speaks.
**Why it happens:** begin_message is a complete paragraph that the TTS must synthesize before playback begins.
**How to avoid:** Keep begin_message short -- just the greeting. The full opening flow should be in the prompt instructions, not all in begin_message. Retell streams TTS from the first sentence, so the first sentence should be short.
**Warning signs:** Callee hears silence for 2+ seconds before Sarah speaks.

### Pitfall 6: "Payload: args only" Mode Confusion
**What goes wrong:** If "Payload: args only" is enabled on the tool definition, Retell sends ONLY the args as the root JSON body, without `name` or `call` wrappers. The existing main.py expects `name` in the body for dispatch.
**Why it happens:** Retell offers two payload modes, and the default may differ from what the code expects.
**How to avoid:** Do NOT enable "args_at_root" in the tool definition. Keep the standard format with `name`, `call`, and `args` fields. This matches the existing ToolCallPayload model in main.py.
**Warning signs:** FastAPI validation errors on incoming tool calls (missing `name` field).

## Code Examples

### Example 1: Complete LLM Creation with 3 Tools
```python
# Source: Retell AI API docs + retell-sdk 5.8.0 type definitions
from retell import Retell
import os

client = Retell(api_key=os.environ["RETELL_API_KEY"])
webhook_url = os.environ["WEBHOOK_BASE_URL"] + "/retell/tool"

with open("prompts/sarah_system_prompt.txt") as f:
    system_prompt = f.read()

llm = client.llm.create(
    model="gpt-4o-mini",
    model_temperature=0.3,
    general_prompt=system_prompt,
    begin_message="Hi {{lead_name}}, this is Sarah calling from Cloudboosta.",
    tool_call_strict_mode=True,
    default_dynamic_variables={
        "lead_name": "there",
        "lead_location": "unknown",
    },
    general_tools=[
        {
            "type": "custom",
            "name": "lookup_programme",
            "description": "Look up recommended programme, pricing, and testimonial based on lead profile and country. Call after Gate 1 qualification. Confirm profile with lead before calling.",
            "url": webhook_url,
            "method": "POST",
            "speak_during_execution": True,
            "execution_message_description": "Let me look that up for you.",
            "speak_after_execution": True,
            "timeout_ms": 10000,
            "parameters": {
                "type": "object",
                "required": ["profile", "country"],
                "properties": {
                    "profile": {
                        "type": "string",
                        "description": "Lead qualification profile. A = no tech background, B = some tech/IT adjacent, C = junior cloud/devops, X = not a fit."
                    },
                    "country": {
                        "type": "string",
                        "description": "Lead's country for currency selection. Examples: UK, US, Nigeria, Germany."
                    }
                }
            }
        },
        {
            "type": "custom",
            "name": "get_objection_response",
            "description": "Get response scripts for a specific objection. Call whenever the lead raises an objection. Never try to handle objections without this tool.",
            "url": webhook_url,
            "method": "POST",
            "speak_during_execution": True,
            "execution_message_description": "That's a fair point.",
            "speak_after_execution": True,
            "timeout_ms": 10000,
            "parameters": {
                "type": "object",
                "required": ["objection_type"],
                "properties": {
                    "objection_type": {
                        "type": "string",
                        "description": "The type of objection. Must be one of: price_too_expensive, need_to_check_finances, found_cheaper_alternative, no_time_too_busy, bad_timing, family_disapproval, not_sure_i_can, market_saturated, prefer_in_person, need_to_think, already_have_certification."
                    }
                }
            }
        },
        {
            "type": "custom",
            "name": "log_call_outcome",
            "description": "Log the call outcome at the end of every call. Must be called before ending any call, regardless of outcome.",
            "url": webhook_url,
            "method": "POST",
            "speak_during_execution": False,
            "speak_after_execution": False,
            "timeout_ms": 10000,
            "parameters": {
                "type": "object",
                "required": ["outcome", "summary"],
                "properties": {
                    "outcome": {
                        "type": "string",
                        "description": "Call outcome. COMMITTED = agreed to enrol, FOLLOW_UP = interested but not ready, DECLINED = said no, NOT_QUALIFIED = not a fit for any programme, NO_ANSWER = did not connect."
                    },
                    "programme_recommended": {
                        "type": "string",
                        "description": "Programme/bundle recommended during the call, if any."
                    },
                    "closing_strategy_used": {
                        "type": "string",
                        "description": "Primary closing strategy used: doctor_frame, pain_close, inverse_close, nepq_sequence, diffusion, direct_close."
                    },
                    "lead_persona": {
                        "type": "string",
                        "description": "Detected persona: career_changer, upskiller, beginner_fearful, experienced_dev, price_sensitive, time_constrained."
                    },
                    "motivation_strength": {
                        "type": "string",
                        "description": "Gate 2 result: strong, weak, or none."
                    },
                    "capacity_assessment": {
                        "type": "string",
                        "description": "Gate 3 result: both_clear, time_blocked, budget_blocked, both_blocked."
                    },
                    "objections_raised": {
                        "type": "string",
                        "description": "Comma-separated list of objection types raised during the call."
                    },
                    "follow_up_date": {
                        "type": "string",
                        "description": "Scheduled follow-up date if outcome is FOLLOW_UP. Format: YYYY-MM-DD."
                    },
                    "summary": {
                        "type": "string",
                        "description": "Brief 2-3 sentence summary of the call."
                    }
                }
            }
        }
    ],
)

print(f"LLM ID: {llm.llm_id}")
```

### Example 2: System Prompt Structure Template (Voice-Optimized)
```text
## Identity
You are Sarah, a warm and knowledgeable training advisor on Cloudboosta's advisory team.
You help professionals transition into cloud computing and DevOps careers.
You speak with a neutral British accent. You are confident but never pushy.

## Voice Rules
- Keep sentences short. Under 15 words when possible.
- Use contractions: "you're", "it's", "that's", "I'd".
- Pause naturally. Don't rush.
- The lead talks 70% of the time. You talk 30%.
- Use {{lead_name}} 2-3 times during the call, not more.
- Never spell out URLs or email addresses during the call.

## Context
- Current time: {{current_time_Europe/London}}
- Lead name: {{lead_name}}
- Lead location: {{lead_location}}

## Opening (Outbound Cold Call)
1. "Hi {{lead_name}}, this is Sarah calling from Cloudboosta."
2. [PAUSE - wait for response]
3. "I help professionals transition into cloud and DevOps careers."
4. "I know this is out of the blue. Do you have 2 minutes for a quick chat?"
5. If YES -> proceed to Discovery
6. If NO -> "No problem. When would be a better time?" -> log FOLLOW_UP
7. If HOSTILE -> "I completely understand. Sorry to have disturbed you." -> log DECLINED

## Discovery Pattern
OBSERVE what they say -> QUESTION to dig deeper -> LISTEN without interrupting ->
REACT with empathy -> BRIDGE to next topic -> NEXT QUESTION

## Flexibility Principles
1. Read the Temperature: Match their energy. Upbeat? Be upbeat. Reserved? Be calm.
2. Conversation Not Interrogation: Share before you ask. Give context for each question.
3. Follow the Energy: If they're excited about something, explore it.
4. Know When to Speed Up: If buying signals appear early, skip to the close.
5. Chunk and Check: After every key point, ask "Does that make sense?"
6. 30/70 Rule: You talk 30%, they talk 70%. Ask open questions.
7. Share Before You Ask: "A lot of our graduates come from [similar background]. What's your current role?"

## Qualification Gates
[Gate 1 - Profile] ... [Gate 2 - Motivation] ... [Gate 3 - Capacity] ...

## Closing Strategies (Summary Table)
| Strategy | Best For | Key Move |
|----------|----------|----------|
| Doctor Frame | Upskillers, respects expertise | Diagnose before prescribe |
| Pain Close | Career changers, frustrated | Stack cost of inaction |
| Inverse Close | Sceptical, guarded | "Not sure this is right for you" |
| NEPQ Sequence | Fearful, hesitant | Gentle questions, build safety |
| Diffusion | Price-sensitive, comparing | Reframe value, uncover real blocker |
| Direct Close | Ready to decide, time-pressed | Clean ask, remove friction |

[Selection: Read energy -> map persona -> pick primary + fallback]
[Fallback: If primary gets pushback, switch once. If that doesn't land, offer follow-up.]

## Tool Instructions
- After Gate 1: call lookup_programme with profile and country
- On any objection: call get_objection_response with objection_type
- End of every call: call log_call_outcome with all gate results and summary
- NEVER make up pricing. ALWAYS use lookup_programme.
- NEVER improvise objection responses. ALWAYS use get_objection_response.

## AI Disclosure
- Introduce yourself as "Sarah from Cloudboosta's advisory team"
- If asked "Are you AI?" or "Are you a real person?": "Great question! I'm an AI assistant working with the Cloudboosta team. I can answer all your questions about the programme. But if you'd prefer to speak with a human advisor, I can absolutely arrange that. Would you like to continue, or shall I connect you with someone?"
- Never proactively disclose AI status
- Never deny being AI if asked

## Outcome Classification
Every call ends with ONE of: COMMITTED, FOLLOW_UP, DECLINED, NOT_QUALIFIED, NO_ANSWER
Always call log_call_outcome before the call ends.
```

### Example 3: Webhook Signature Verification (Retell SDK method)
```python
# Source: Retell AI official docs - webhook verification
from retell import Retell
import json, os

retell = Retell(api_key=os.environ["RETELL_API_KEY"])

@app.post("/retell/tool")
async def retell_tool(request: Request):
    post_data = await request.json()
    valid = retell.verify(
        json.dumps(post_data, separators=(",", ":"), ensure_ascii=False),
        api_key=str(os.environ["RETELL_API_KEY"]),
        signature=str(request.headers.get("X-Retell-Signature", "")),
    )
    if not valid:
        raise HTTPException(status_code=401, detail="Invalid signature")

    name = post_data["name"]
    args = post_data["args"]
    call_id = post_data.get("call", {}).get("call_id", "unknown")
    result = await execute_tool(name, args, call_id)
    return json.loads(result)
```

### Example 4: Token Counting Utility
```python
# Utility to verify system prompt is under 8K tokens
import tiktoken

encoding = tiktoken.encoding_for_model("gpt-4o-mini")  # cl100k_base

with open("prompts/sarah_system_prompt.txt") as f:
    prompt = f.read()

token_count = len(encoding.encode(prompt))
print(f"System prompt: {token_count} tokens ({token_count/8000*100:.1f}% of 8K limit)")

if token_count > 7500:
    print("WARNING: Close to 8K limit. Consider compressing or offloading more to tools.")
elif token_count > 8000:
    print("ERROR: Exceeds 8K token limit. Must reduce prompt size.")
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| GPT-4o-mini as default model | GPT-4.1 as default model on Retell | April 2025 | GPT-4.1 family is now recommended. GPT-4o-mini still available but no longer the default. User chose GPT-4o-mini explicitly. |
| Webhook verification with separate secret | `Retell.verify()` using API key | 2025 | SDK provides built-in verification method. No need for separate WEBHOOK_SECRET for Retell endpoints. |
| No system time variables | `{{current_time}}`, `{{current_hour}}`, `{{current_time_[timezone]}}` auto-available | March 2025 | Eliminates need for custom time-of-day logic in prompt. Use `{{current_time_Europe/London}}` directly. |
| Dynamic variable defaults not supported | `default_dynamic_variables` on LLM | March 2025 | Provides fallback values when per-call variables aren't set. Prevents raw `{{lead_name}}` appearing in speech. |
| GET only for custom functions | GET, POST, PUT, PATCH, DELETE supported | June 2025 | POST is now fully supported for custom tool webhooks. |
| No MCP support | MCP client available | July 2025 | Could use MCP for tool integration, but custom webhook is simpler for this project. |

**Deprecated/outdated:**
- `gpt-4o-mini-realtime` was deprecated and auto-migrated to `gpt-realtime-mini` (February 2026). Does not affect this project (we use text LLM, not speech-to-speech).
- Several Claude and Gemini model versions were deprecated in February 2026 and auto-migrated. Does not affect this project.

## Retell LLM API Reference (Key Parameters)

Complete parameter reference for `client.llm.create()`:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `general_prompt` | str | None | System prompt text. No states = this is the full prompt. |
| `general_tools` | list[dict] | None | Tools available in all states. For no-state LLM, this is the full tool list. |
| `begin_message` | str | None | First utterance. Supports `{{dynamic_vars}}`. Empty string = agent waits for user. |
| `model` | str | "gpt-4.1" | LLM model. Options: gpt-4o-mini, gpt-4.1, gpt-4.1-mini, gpt-5, etc. |
| `model_temperature` | float | 0 | Randomness [0-1]. Lower = deterministic, better for tool calls. |
| `tool_call_strict_mode` | bool | False | Strict validation on tool call parameters. |
| `default_dynamic_variables` | dict[str, str] | None | Fallback values for dynamic variables. All values must be strings. |
| `start_speaker` | str | Required | "agent" (outbound) or "user" (inbound). |
| `states` | list | None | Multi-prompt state definitions. Not needed for single-prompt. |
| `starting_state` | str | None | Required only if states are defined. |
| `model_high_priority` | bool | False | Dedicated resources for lower latency (costs more). |
| `knowledge_base_ids` | list[str] | None | RAG knowledge base IDs. Not needed -- data is in Supabase via tools. |

### Custom Tool Definition Schema
```json
{
    "type": "custom",
    "name": "string (a-z, A-Z, 0-9, _, -)",
    "description": "string (what this tool does and when to call it)",
    "url": "string (webhook endpoint URL)",
    "method": "POST",
    "parameters": {
        "type": "object",
        "required": ["param1"],
        "properties": {
            "param1": {
                "type": "string",
                "description": "Description for LLM to know what to fill"
            }
        }
    },
    "speak_during_execution": true,
    "execution_message_description": "What agent says while tool executes",
    "execution_message_type": "prompt",
    "speak_after_execution": true,
    "timeout_ms": 10000,
    "headers": {},
    "query_params": {},
    "response_variables": {},
    "args_at_root": false
}
```

**Critical fields:**
- `args_at_root`: Must be `false` (or omitted) to match existing main.py ToolCallPayload model that expects `name` and `args` in body.
- `timeout_ms`: Set to 10000 (10s) per TOOL-04 requirement. Default is 120000 which is way too long for live calls.
- `execution_message_type`: Use `"prompt"` to let the LLM generate natural filler speech, or `"static_text"` for exact phrases.
- `speak_during_execution`: `true` for lookup_programme and get_objection_response, `false` for log_call_outcome.
- `speak_after_execution`: `true` for lookup_programme and get_objection_response (Sarah should discuss the results), `false` for log_call_outcome (end of call).
- Function result capped at 15,000 characters.

## Open Questions

1. **Exact objection_type enum values for get_objection_response tool**
   - What we know: Seed data has 30+ objections across 10 categories with keys like `price_too_expensive`, `no_time_too_busy`, etc.
   - What's unclear: The full list of objection_key values that the tool schema should enumerate in its description.
   - Recommendation: Read all objection_key values from 003_objection_responses.sql and list them in the tool description. This helps the LLM pick the correct key. The full seed data has ~30 keys -- list the most common ones and add "or other matching key from the objection database" as a fallback.

2. **System prompt token count estimation**
   - What we know: Target is 5-6K tokens. Prompt includes personality, flow, gates, strategy table, tool instructions, AI disclosure.
   - What's unclear: Exact count won't be known until prompt is authored.
   - Recommendation: Author the prompt, measure with tiktoken, iterate to compress if over 7500 tokens. The strategy summary table (~300 tokens) and qualification gates (~400 tokens) are the most compressible sections.

3. **Webhook signature verification method for tool calls**
   - What we know: Retell docs show `Retell.verify(body, api_key, signature)` using the API key. Existing code uses manual HMAC with `WEBHOOK_SECRET`.
   - What's unclear: Whether custom function tool calls use the same signature scheme as lifecycle webhooks.
   - Recommendation: Use `Retell.verify()` from the SDK for tool call endpoints. This is the documented approach. Update main.py's `verify_retell_signature()` to use the SDK method. Keep `WEBHOOK_SECRET` as a fallback during development.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Manual verification + Python scripts |
| Config file | None (Phase 2 is configuration, not application code) |
| Quick run command | `python scripts/count_tokens.py` |
| Full suite command | `python scripts/verify_llm.py` (checks LLM exists, tools registered, prompt length) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VOICE-01 | LLM exists with system prompt under 8K tokens | smoke | `python execution/backend/scripts/verify_llm.py --check-prompt-length` | No - Wave 0 |
| VOICE-02 | 3 custom tools registered on LLM with correct webhook URLs | smoke | `python execution/backend/scripts/verify_llm.py --check-tools` | No - Wave 0 |
| VOICE-05 | Dynamic variables defined with defaults and referenced in prompt | smoke | `python execution/backend/scripts/verify_llm.py --check-variables` | No - Wave 0 |

### Sampling Rate
- **Per task commit:** `python execution/backend/scripts/count_tokens.py` (verify prompt under 8K)
- **Per wave merge:** `python execution/backend/scripts/verify_llm.py` (full verification)
- **Phase gate:** LLM exists on Retell, 3 tools registered, prompt under 8K tokens, dynamic variables configured

### Wave 0 Gaps
- [ ] `execution/backend/scripts/create_llm.py` -- LLM creation script
- [ ] `execution/backend/scripts/verify_llm.py` -- Verification script: fetches LLM, checks prompt length, tool count, variable defaults
- [ ] `execution/backend/scripts/count_tokens.py` -- Token counting utility
- [ ] `execution/backend/prompts/sarah_system_prompt.txt` -- System prompt file

## Sources

### Primary (HIGH confidence)
- [Retell AI Create Retell LLM API](https://docs.retellai.com/api-references/create-retell-llm) -- Complete API parameters, tool definition schema, model options
- [retell-sdk Python types (llm_create_params.py)](https://github.com/RetellAI/retell-python-sdk/blob/main/src/retell/types/llm_create_params.py) -- Typed parameter definitions for `client.llm.create()`
- [Retell AI Custom Function docs](https://docs.retellai.com/build/single-multi-prompt/custom-function) -- Webhook format, parameter schema, response limits (15K chars), speak_during_execution
- [Retell AI Dynamic Variables](https://docs.retellai.com/build/dynamic-variables) -- `{{variable}}` syntax, default_dynamic_variables, system variables, per-call injection
- [Retell AI Webhook docs](https://docs.retellai.com/features/webhook) -- Lifecycle webhook format, `Retell.verify()` signature verification, Python example
- [Retell AI Prompt Engineering Guide](https://docs.retellai.com/build/prompt-engineering-guide) -- Sectional prompt structure, tool call instructions, voice-specific guidance
- [Retell AI Changelog](https://www.retellai.com/changelog) -- GPT-4o-mini still available, system variables added March 2025, model deprecations

### Secondary (MEDIUM confidence)
- [Retell AI Outbound Call docs](https://docs.retellai.com/deploy/outbound-call) -- retell_llm_dynamic_variables in create_phone_call, agent_override
- [Retell AI Blog: Prompt Situation Guide](https://docs.retellai.com/build/prompt-situation-guide) -- TTS-specific formatting (phone numbers, email, time)
- [Retell AI Blog: 5 Useful Prompts](https://www.retellai.com/blog/5-useful-prompts-for-building-ai-voice-agents-on-retell-ai) -- Dynamic variable patterns, multi-step design
- [GPT-4.1 vs GPT-4o-mini comparison](https://www.retellai.com/blog/chatgpt-4-1-ai-phone-calling-retell) -- Latency and cost comparison

### Tertiary (LOW confidence)
- Token count estimation for full system prompt (~5-6K tokens) -- based on content analysis of CONTEXT.md requirements, not measured
- Exact tool call request format with `name`/`call`/`args` fields -- confirmed by docs but not tested with retell-sdk 5.8.0

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- retell-sdk 5.8.0 types verified directly from GitHub source, API docs cross-referenced
- Architecture: HIGH -- Single-prompt LLM with custom tools is well-documented standard pattern. Webhook format confirmed.
- Pitfalls: HIGH -- Based on official docs (token limits, signature verification, timeout defaults) and direct code inspection (main.py ToolCallPayload schema)
- Tool schemas: MEDIUM -- Parameter definitions are from user CONTEXT.md decisions, mapped to Retell JSON Schema format. Actual tool handler behavior depends on Phase 4 implementation.
- System prompt content: MEDIUM -- Structure is well-defined, but exact wording and token count depend on prompt authoring (Claude's discretion area)

**Research date:** 2026-03-25
**Valid until:** 2026-04-25 (Retell API is stable, no upcoming deprecations announced)
