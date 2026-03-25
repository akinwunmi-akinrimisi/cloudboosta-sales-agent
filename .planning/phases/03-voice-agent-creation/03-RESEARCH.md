# Phase 3: Voice Agent Creation - Research

**Researched:** 2026-03-25
**Domain:** Retell AI agent creation, voice configuration, phone assignment, voicemail detection
**Confidence:** HIGH

## Summary

Phase 3 creates Sarah as a callable voice agent on Retell. The Retell `agent.create()` API accepts all required parameters (voice, backchannel, interruption, ambient sound, voicemail, webhook) in a single call. The `cartesia-Willa` voice is confirmed available in the user's Retell account. The phone number assignment via `migrate_phone_number.py` is already built and ready -- it just needs the `RETELL_AGENT_ID` output from agent creation.

**Critical finding:** The `begin_message` is configured at the **LLM level** (not the agent level), and `{{current_time_period}}` is NOT a built-in Retell dynamic variable. Retell provides `{{current_hour_Europe/London}}` (returns fractional hour) but has no variable that resolves to "morning"/"afternoon"/"evening". The solution is to set `begin_message` to `null` on the LLM, which causes the LLM to dynamically generate the first utterance using the system prompt's greeting instructions and `{{current_hour_Europe/London}}`. This produces the natural time-aware greeting the user wants.

**Primary recommendation:** Create agent with full configuration in one script, update `begin_message` to null on the LLM (so it generates "Good afternoon." dynamically), update system prompt with name exchange flow, assign phone number, and verify with a test call.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Voice ID: `cartesia-Willa` (Cartesia provider, British female)
- Tone: Warm + professional -- knowledgeable friend, not salesperson
- Speed: Normal conversational pace (no speed adjustment)
- Language: en-GB (British English)
- Backchannel: enabled, frequency 0.8
- Interruption handling: Responsive -- low threshold (~0.5s), Sarah stops quickly when lead talks
- Silence tolerance: Long (3-5 seconds before filling)
- Ambient sound: Subtle office ambience
- Phone number assignment: One-shot flow after agent creation using migrate_phone_number.py
- Phone number: +17404943597
- Begin message: "Good {{current_time_period}}." (no name -- database may not have names)
- Name exchange flow: Sarah asks for name, confirms, picks first name, gets permission
- System prompt update: Remove old identity confirmation, add name exchange flow
- Voicemail: Leave brief message every attempt ("Hi, this is Sarah from Cloudboosta...")
- Test call: Full pipeline call to operator's real phone number

### Claude's Discretion
- Exact Retell agent creation API parameters (response_engine, webhook settings)
- How to configure voicemail detection on Retell (built-in or custom)
- Agent-level webhook URL configuration
- Ambient sound implementation (Retell may not support this natively -- research needed)
- How to handle the phone number import if it's not yet on Retell

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| VOICE-03 | Voice agent created with British female voice, backchannel enabled (frequency 0.8) | Full API parameters documented below: `voice_id="cartesia-Willa"`, `language="en-GB"`, `enable_backchannel=True`, `backchannel_frequency=0.8`. Agent creation is a single SDK call with all configuration. |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| retell-sdk | 5.8.0 | Agent creation, phone update, call initiation | Already pinned in requirements.txt. SDK 5.x required for weighted agents. |
| python-dotenv | 1.0.1 | Environment variable loading | Established pattern in all scripts |
| tiktoken | 0.7.0 | Token counting for prompt verification | Already used in Phase 2 scripts |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| argparse | stdlib | CLI flags for verification scripts | Verification scripts with --check-* flags |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Setting begin_message to null (dynamic) | Custom dynamic variable current_time_period | Null approach is simpler -- LLM generates from prompt. Custom variable adds call-initiation complexity. |
| voicemail_option with static_text | voicemail_option with prompt | static_text is deterministic -- same message every time. Prompt may vary unpredictably. Use static_text for voicemail. |

**Installation:** No new packages needed. All dependencies already in requirements.txt.

## Architecture Patterns

### Script Structure (Established in Phase 2)
```
execution/backend/scripts/
  create_agent.py         # New: creates agent, returns RETELL_AGENT_ID
  verify_agent.py         # New: verifies agent config, phone binding
  update_llm.py           # Existing: --prompt-only to push prompt changes
  verify_llm.py           # Existing: verify LLM after prompt update
execution/backend/
  migrate_phone_number.py # Existing: assigns phone to agent
  prompts/
    sarah_system_prompt.txt  # Existing: update with name exchange flow
```

### Pattern 1: Agent Creation Script
**What:** Single script that creates the Retell agent with all configuration parameters
**When to use:** One-time setup, outputs RETELL_AGENT_ID for .env
**Example:**
```python
# Source: Retell AI Create Agent API docs
# https://docs.retellai.com/api-references/create-agent
from retell import Retell

client = Retell(api_key=api_key)

agent = client.agent.create(
    agent_name="Sarah - Cloudboosta Sales Agent",
    response_engine={
        "type": "retell-llm",
        "llm_id": os.environ["RETELL_LLM_ID"],
    },
    voice_id="cartesia-Willa",
    voice_model="sonic-3",                    # Cartesia Sonic 3 (latest, best quality)
    voice_speed=1.0,                          # Normal pace
    voice_temperature=0.8,                    # Some variation for naturalness
    language="en-GB",
    # Backchannel
    enable_backchannel=True,
    backchannel_frequency=0.8,
    backchannel_words=["yeah", "uh-huh", "I see", "right", "absolutely"],
    # Responsiveness & Interruption
    responsiveness=0.7,                       # Slightly relaxed (not instant)
    interruption_sensitivity=0.8,             # High -- Sarah stops quickly
    # Silence tolerance
    reminder_trigger_ms=4000,                 # 4s silence before gentle fill
    reminder_max_count=2,                     # Max 2 reminders
    end_call_after_silence_ms=30000,          # 30s total silence = end call
    # Ambient sound
    ambient_sound="call-center",              # Subtle office/call center ambience
    ambient_sound_volume=0.3,                 # Low volume -- subtle, not distracting
    # Voicemail
    voicemail_detection_timeout_ms=30000,     # 30s detection window
    voicemail_message="Hi, this is Sarah from Cloudboosta. I was reaching out about our Cloud DevOps training programme. I'll try you again soon. No need to call back. Have a lovely day.",
    voicemail_option={
        "action": {
            "type": "static_text",
            "text": "Hi, this is Sarah from Cloudboosta. I was reaching out about our Cloud DevOps training programme. I'll try you again soon. No need to call back. Have a lovely day.",
        }
    },
    # Webhook
    webhook_url=os.environ["WEBHOOK_BASE_URL"].rstrip("/") + "/retell/webhook",
    webhook_events=["call_started", "call_ended", "call_analyzed"],
    # Noise handling
    denoising_mode="noise-cancellation",
    # Speech normalization for prices/dates
    normalize_for_speech=True,
    # Boosted keywords for transcription accuracy
    boosted_keywords=["Cloudboosta", "DevOps", "cloud computing", "Sarah"],
)
```

### Pattern 2: begin_message as null (Dynamic Generation)
**What:** Set begin_message to null on the LLM so it generates the greeting dynamically
**When to use:** When the greeting depends on runtime context (time of day) that has no built-in variable
**Why:** Retell has NO `{{current_time_period}}` variable. Available: `{{current_hour_Europe/London}}` (fractional hour). Setting begin_message=null lets the LLM use the system prompt's greeting logic.
**Example:**
```python
# Source: Retell AI Update LLM API docs
# https://docs.retellai.com/api-references/update-retell-llm
# begin_message behavior:
#   - null: LLM dynamically generates first utterance from system prompt
#   - "": Agent waits for user to speak first
#   - "text": Agent says exact text

# Update LLM to remove static begin_message:
client.llm.update(
    llm_id,
    begin_message=None,  # LLM generates: "Good afternoon." based on current_hour
    general_prompt=updated_system_prompt,  # Contains greeting instructions
)
```

### Pattern 3: Voicemail Configuration
**What:** Configure agent to detect voicemail and leave a static message
**When to use:** Outbound cold calls where voicemail is common
**Example:**
```python
# Source: Retell AI Handle Voicemail docs
# https://docs.retellai.com/build/handle-voicemail
# voicemail_option.action types: prompt, static_text, hangup, bridge_transfer
# Use static_text for deterministic voicemail message

voicemail_option={
    "action": {
        "type": "static_text",
        "text": "Hi, this is Sarah from Cloudboosta. I was reaching out about our Cloud DevOps training programme. I'll try you again soon. No need to call back. Have a lovely day.",
    }
}
```

### Pattern 4: Test Call via SDK
**What:** Initiate a test outbound call to verify the full chain
**When to use:** After agent creation and phone assignment
**Example:**
```python
# Source: Retell AI Create Phone Call API docs
# https://docs.retellai.com/api-references/create-phone-call
call = client.call.create_phone_call(
    from_number="+17404943597",
    to_number=test_lead_phone,          # Operator's real phone number
    retell_llm_dynamic_variables={
        "lead_name": "there",           # No name for test lead
        "lead_location": "UK",
    },
    metadata={
        "test": True,
        "purpose": "Phase 3 verification",
    },
)
```

### Anti-Patterns to Avoid
- **Setting begin_message with {{current_time_period}}:** This variable does not exist in Retell. It will render as raw `{{current_time_period}}` text in the greeting. Use null begin_message instead.
- **Using voicemail_message without voicemail_option:** The `voicemail_message` field alone may not enable detection. Always set `voicemail_option` with an action to ensure detection is active.
- **Hardcoding agent_id in main.py:** The agent_id is determined by the phone number's `outbound_agents` binding. Do not pass agent_id to `create_phone_call()` -- SDK 5.x removed this parameter. Use `override_agent_id` only for testing.
- **Setting responsiveness too high (1.0):** This makes Sarah respond too fast, cutting off natural pauses. 0.7 allows the "silence after the close" the playbook requires.
- **Using current_hour without timezone suffix:** `{{current_hour}}` defaults to America/Los_Angeles. Must use `{{current_hour_Europe/London}}` for UK timezone.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Voicemail detection | Custom audio analysis or silence detection | Retell's built-in `voicemail_option` | Retell runs detection in first 3 min automatically. Custom detection is unreliable and adds latency. |
| Time-of-day greeting | Custom middleware to compute time period | Retell's `begin_message=null` + system prompt logic | LLM reads `{{current_hour_Europe/London}}` from system prompt and generates appropriate greeting. Zero code needed. |
| Phone number assignment | Direct Retell REST API calls | `migrate_phone_number.py` (already built) | Script handles weighted agents format, error handling, and verification. |
| Voice selection/testing | Manual trial and error | `client.voice.list()` to verify voice exists | SDK method confirms voice_id is valid before agent creation. |

**Key insight:** Retell handles voicemail detection, ambient sound, backchannel, and dynamic greetings natively. The only custom code needed is the agent creation script, system prompt update, and verification.

## Common Pitfalls

### Pitfall 1: begin_message Uses Non-Existent Variable
**What goes wrong:** Setting `begin_message="Good {{current_time_period}}."` results in Sarah saying "Good {{current_time_period}}." literally, because the variable is not resolved.
**Why it happens:** Retell's built-in variables are `current_time`, `current_hour`, `current_time_[timezone]`, `current_hour_[timezone]`, `current_calendar`. There is NO `current_time_period`.
**How to avoid:** Set `begin_message=None` (null) on the LLM. This causes the LLM to dynamically generate the first utterance using the system prompt's greeting instructions, which reference `{{current_hour_Europe/London}}` and map hours to morning/afternoon/evening.
**Warning signs:** Sarah saying raw template text like "Good current_time_period" during test call.

### Pitfall 2: current_hour Defaults to Los Angeles Timezone
**What goes wrong:** The system prompt currently uses `{{current_hour}}` which resolves to America/Los_Angeles timezone. At 2 PM London time, it would return ~6 AM LA time, causing Sarah to say "Good morning" when it's afternoon.
**Why it happens:** Retell defaults all time variables to America/Los_Angeles unless timezone suffix is specified.
**How to avoid:** Update system prompt to use `{{current_hour_Europe/London}}` instead of `{{current_hour}}`. This is already partially done (the `current_time` variable uses Europe/London) but the `current_hour` reference does not.
**Warning signs:** Wrong time-of-day greeting during UK business hours.

### Pitfall 3: voicemail_option vs voicemail_message Confusion
**What goes wrong:** Setting only `voicemail_message` without `voicemail_option` may not enable voicemail detection at all.
**Why it happens:** Retell uses `voicemail_option` to control detection behavior (hangup, leave message, etc.) and `voicemail_message` as a legacy/convenience field. The `voicemail_option` with an `action` is the authoritative config.
**How to avoid:** Always set `voicemail_option` with the desired action type. Use `{"action": {"type": "static_text", "text": "..."}}` for deterministic voicemail messages.
**Warning signs:** Voicemail not being detected; call continuing to speak to voicemail without proper handling.

### Pitfall 4: Agent Created But LLM begin_message Not Updated
**What goes wrong:** Agent is created correctly, but the LLM still has the old `begin_message` from Phase 2 ("Hi {{lead_name}}, this is Sarah calling from Cloudboosta."). Sarah greets with the old message instead of the new time-aware greeting.
**Why it happens:** `begin_message` is an LLM-level setting, not an agent-level setting. Creating the agent does not change the LLM's begin_message.
**How to avoid:** Explicitly update the LLM's `begin_message` to `None` (null) using `client.llm.update()` as part of Phase 3. This is a separate step from agent creation.
**Warning signs:** Sarah still says "Hi there, this is Sarah calling from Cloudboosta." instead of "Good afternoon."

### Pitfall 5: Ambient Sound Too Loud
**What goes wrong:** Office ambience is distracting, makes Sarah sound like she's in a noisy call center. Lead perceives low quality.
**Why it happens:** Default `ambient_sound_volume` is 1.0. The "call-center" ambient sound at full volume is quite prominent.
**How to avoid:** Set `ambient_sound_volume=0.3` (low). Test and adjust during the verification call. Can be updated post-creation via `client.agent.update()`.
**Warning signs:** Lead asks "What's that noise?" or seems distracted during test call.

### Pitfall 6: Name Exchange Flow Breaks with Known Names
**What goes wrong:** System prompt now asks "Can I get your name please?" even when `{{lead_name}}` is available (not "there"), creating an awkward interaction.
**Why it happens:** The prompt update removes the old identity confirmation but doesn't conditionally branch based on whether lead_name is populated.
**How to avoid:** Make the name exchange flow conditional in the system prompt: if `{{lead_name}}` is not "there" or empty, use it to confirm ("Am I speaking with {{lead_name}}?"). If it's "there" or empty, ask for the name.
**Warning signs:** Sarah asks for a name she already has, or uses "there" as a name.

## Code Examples

### Agent Creation Script Structure
```python
# Source: Pattern from create_llm.py + Retell Agent API docs
#!/usr/bin/env python3
"""Create Sarah's Retell voice agent with voice, backchannel, and voicemail config.

Run once to create the agent. Store the returned agent_id in .env as RETELL_AGENT_ID.
Then run migrate_phone_number.py to assign the phone number.

Usage:
    cd execution/backend
    python scripts/create_agent.py
"""

import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from retell import Retell

SCRIPT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = SCRIPT_DIR.parent

def main() -> None:
    load_dotenv(BACKEND_DIR / ".env")
    load_dotenv(BACKEND_DIR.parent.parent / ".env")

    api_key = os.environ.get("RETELL_API_KEY")
    llm_id = os.environ.get("RETELL_LLM_ID")
    webhook_base_url = os.environ.get("WEBHOOK_BASE_URL")

    # Validate required env vars
    if not all([api_key, llm_id, webhook_base_url]):
        print("ERROR: Missing required env vars (RETELL_API_KEY, RETELL_LLM_ID, WEBHOOK_BASE_URL)")
        sys.exit(1)

    client = Retell(api_key=api_key)

    try:
        agent = client.agent.create(
            agent_name="Sarah - Cloudboosta Sales Agent",
            response_engine={"type": "retell-llm", "llm_id": llm_id},
            voice_id="cartesia-Willa",
            voice_model="sonic-3",
            voice_speed=1.0,
            voice_temperature=0.8,
            language="en-GB",
            enable_backchannel=True,
            backchannel_frequency=0.8,
            backchannel_words=["yeah", "uh-huh", "I see", "right", "absolutely"],
            responsiveness=0.7,
            interruption_sensitivity=0.8,
            reminder_trigger_ms=4000,
            reminder_max_count=2,
            end_call_after_silence_ms=30000,
            ambient_sound="call-center",
            ambient_sound_volume=0.3,
            voicemail_detection_timeout_ms=30000,
            voicemail_option={
                "action": {
                    "type": "static_text",
                    "text": (
                        "Hi, this is Sarah from Cloudboosta. I was reaching out "
                        "about our Cloud DevOps training programme. I'll try you "
                        "again soon. No need to call back. Have a lovely day."
                    ),
                }
            },
            webhook_url=webhook_base_url.rstrip("/") + "/retell/webhook",
            webhook_events=["call_started", "call_ended", "call_analyzed"],
            denoising_mode="noise-cancellation",
            normalize_for_speech=True,
            boosted_keywords=["Cloudboosta", "DevOps", "cloud computing", "Sarah"],
        )
    except Exception as e:
        print(f"ERROR: Agent creation failed: {e}")
        sys.exit(1)

    agent_id = agent.agent_id
    print(f"Agent created: {agent_id}")
    print(f"Add to .env: RETELL_AGENT_ID={agent_id}")

if __name__ == "__main__":
    main()
```

### LLM Update for begin_message and System Prompt
```python
# Source: Retell AI Update LLM API docs
# Update begin_message to null + push new system prompt with name exchange flow
client.llm.update(
    llm_id,
    begin_message=None,   # null = LLM dynamically generates from prompt
    general_prompt=updated_prompt,
)
```

### System Prompt Name Exchange Addition
```
## Opening Flow

This is an outbound cold call. Follow this sequence exactly:

1. Time-aware greeting based on {{current_hour_Europe/London}}:
   - Before 12: "Good morning."
   - 12-17: "Good afternoon."
   - 17-20: "Good evening."
   STOP. Wait for their response. Do not say anything else yet.

2. After they respond: "Hi there. My name's Sarah, I'm a Programme Advisor at Cloudboosta. We help people transition into cloud and DevOps careers."

3. Name exchange:
   - If {{lead_name}} is available and not "there": "Am I speaking with {{lead_name}}?"
   - If {{lead_name}} is "there" or unavailable: "Can I get your name please?"
   - When they give their name, repeat back: "Did I get that right -- [Name]?"
   - If full name given (e.g. "Oluwaseun Adebayo"), pick one: "Is it okay if I call you Oluwaseun?"
   - Use their confirmed name throughout the entire call.

4. Warm-up (match the time of day):
   ...
```

### Agent Verification Script Structure
```python
# Source: Pattern from verify_llm.py
# Check: agent exists, voice correct, backchannel on, phone number bound
def check_voice(agent) -> bool:
    if agent.voice_id != "cartesia-Willa":
        print(f"  FAIL: voice_id is {agent.voice_id}, expected cartesia-Willa")
        return False
    print(f"  PASS: voice_id = {agent.voice_id}")
    return True

def check_backchannel(agent) -> bool:
    if not agent.enable_backchannel:
        print("  FAIL: backchannel not enabled")
        return False
    if agent.backchannel_frequency != 0.8:
        print(f"  FAIL: backchannel_frequency = {agent.backchannel_frequency}, expected 0.8")
        return False
    print(f"  PASS: backchannel enabled, frequency = {agent.backchannel_frequency}")
    return True

def check_phone_binding(client, agent_id) -> bool:
    phone = client.phone_number.get(phone_number="+17404943597")
    outbound = phone.outbound_agents or []
    bound = any(a.get("agent_id") == agent_id for a in outbound)
    if not bound:
        print(f"  FAIL: Agent {agent_id} not in outbound_agents for +17404943597")
        return False
    print(f"  PASS: Phone number bound to agent {agent_id}")
    return True
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `inbound_agent_id`/`outbound_agent_id` on phone | `inbound_agents`/`outbound_agents` weighted arrays | March 2026 deprecation deadline | Phone must use weighted agents format -- already done in Phase 1 |
| ElevenLabs voices | Cartesia Sonic 3 voices | Late 2025 | Lower latency, better naturalness, emotion control support |
| `begin_message` as static text | `begin_message=null` for dynamic generation | Always available | Enables time-aware greetings without custom variable injection |
| `voicemail_message` string | `voicemail_option` object with action types | 2025 | More control: prompt, static_text, hangup, bridge_transfer |

**Deprecated/outdated:**
- `agent_id` parameter in `create_phone_call()` -- removed in SDK 5.x. Phone binding determines agent.
- Old verify_llm.py check for `{{lead_name}}` in begin_message -- begin_message will be null after Phase 3.

## Retell Agent API Parameter Reference

Complete parameter map for Sarah's agent, with values derived from CONTEXT.md decisions:

| Parameter | Value | Source |
|-----------|-------|--------|
| agent_name | "Sarah - Cloudboosta Sales Agent" | Discretion |
| response_engine | {"type": "retell-llm", "llm_id": RETELL_LLM_ID} | Required |
| voice_id | "cartesia-Willa" | CONTEXT.md locked |
| voice_model | "sonic-3" | Discretion (latest Cartesia model) |
| voice_speed | 1.0 | CONTEXT.md: normal pace |
| voice_temperature | 0.8 | Discretion: warm variation |
| language | "en-GB" | CONTEXT.md locked |
| enable_backchannel | True | CONTEXT.md locked |
| backchannel_frequency | 0.8 | CONTEXT.md locked |
| backchannel_words | ["yeah", "uh-huh", "I see", "right", "absolutely"] | Directive 03 |
| responsiveness | 0.7 | Discretion: slightly relaxed for natural pauses |
| interruption_sensitivity | 0.8 | CONTEXT.md: responsive, Sarah stops quickly |
| reminder_trigger_ms | 4000 | CONTEXT.md: 3-5s tolerance, use 4s |
| reminder_max_count | 2 | Directive 03 default |
| end_call_after_silence_ms | 30000 | Discretion: 30s total silence = end |
| ambient_sound | "call-center" | CONTEXT.md: office ambience. Options: coffee-shop, convention-hall, summer-outdoor, mountain-outdoor, static-noise, call-center |
| ambient_sound_volume | 0.3 | Discretion: subtle, not distracting |
| voicemail_detection_timeout_ms | 30000 | Default (30s detection window) |
| voicemail_option | {"action": {"type": "static_text", "text": "..."}} | CONTEXT.md: deterministic voicemail message |
| webhook_url | WEBHOOK_BASE_URL + "/retell/webhook" | Discretion |
| webhook_events | ["call_started", "call_ended", "call_analyzed"] | Standard 3 events |
| denoising_mode | "noise-cancellation" | Discretion: default, good for phone |
| normalize_for_speech | True | Discretion: natural price/date reading |
| boosted_keywords | ["Cloudboosta", "DevOps", ...] | Discretion: transcription accuracy |

## Key Integration Points

### LLM Updates Required in Phase 3

The agent references the existing LLM (RETELL_LLM_ID). Two LLM-level changes are needed:

1. **begin_message = null** (currently: "Hi {{lead_name}}, this is Sarah calling from Cloudboosta.")
   - Must be set to null so LLM generates greeting dynamically
   - Uses system prompt's greeting instructions with `{{current_hour_Europe/London}}`

2. **System prompt update** (name exchange flow):
   - Remove: "Am I speaking with {{lead_name}}?" identity confirmation step
   - Add: Full name exchange flow (ask, confirm, pick, use)
   - Fix: Change `{{current_hour}}` to `{{current_hour_Europe/London}}` in greeting logic
   - Make `{{lead_name}}` conditional -- if available, use it; if "there", ask for name
   - Run token count check after changes (currently 2,329 tokens, well under 8K)

### Execution Order Within Phase 3

1. Update system prompt text file (name exchange flow + current_hour fix)
2. Update LLM via update_llm.py (begin_message=null + new prompt)
3. Verify LLM via verify_llm.py (prompt length + tools intact)
4. Create agent via create_agent.py (returns RETELL_AGENT_ID)
5. Store RETELL_AGENT_ID in .env
6. Run migrate_phone_number.py (assigns phone to agent)
7. Verify agent via verify_agent.py (voice, backchannel, phone binding)
8. Create test lead in Supabase (operator's phone number)
9. Initiate test call via create_phone_call API
10. Verify: Sarah speaks time-aware greeting, voice sounds correct, backchannel works

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Manual verification scripts + live test call |
| Config file | None -- scripts are standalone |
| Quick run command | `python scripts/verify_agent.py` |
| Full suite command | `python scripts/verify_agent.py && python scripts/verify_llm.py` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VOICE-03 | Voice agent created with British female voice, backchannel 0.8 | smoke | `python scripts/verify_agent.py --check-voice --check-backchannel` | No -- Wave 0 |
| VOICE-03 | Phone number assigned to agent | smoke | `python scripts/verify_agent.py --check-phone` | No -- Wave 0 |
| VOICE-03 | Test outbound call works end-to-end | manual-only | Manual: operator answers phone, confirms voice + greeting | N/A |

### Sampling Rate
- **Per task commit:** `python scripts/verify_agent.py` (5s, checks Retell API)
- **Per wave merge:** `python scripts/verify_agent.py && python scripts/verify_llm.py`
- **Phase gate:** All checks green + test call completed successfully

### Wave 0 Gaps
- [ ] `execution/backend/scripts/create_agent.py` -- agent creation script
- [ ] `execution/backend/scripts/verify_agent.py` -- agent verification with --check-* flags
- [ ] Test call initiation (can use existing POST /retell/initiate-call endpoint or a standalone script)

## Open Questions

1. **voicemail_option vs voicemail_message: Are both needed?**
   - What we know: `voicemail_option` with action object is the modern config. `voicemail_message` is a string field also available on the agent.
   - What's unclear: Whether `voicemail_message` is ignored when `voicemail_option` is set, or if both are required.
   - Recommendation: Set both to the same text. The `voicemail_option` with `static_text` action is authoritative; `voicemail_message` as backup. LOW risk -- worst case, message plays twice (detectable in test call).

2. **cartesia-Willa voice_model: Should it be "sonic-3" or "sonic-3-latest"?**
   - What we know: Both are valid enum values. "sonic-3-latest" would auto-update to the latest Sonic 3 revision.
   - What's unclear: Whether Retell auto-selects the model when `voice_model` is omitted for Cartesia voices.
   - Recommendation: Use `"sonic-3"` for stability. If omitted, Retell may default to an older model. Can test both.

3. **begin_message null behavior with Retell LLM**
   - What we know: Retell docs state "If not set [null], the LLM will dynamically generate a message."
   - What's unclear: Whether the dynamic generation uses the full system prompt context including `{{current_hour_Europe/London}}`. HIGH confidence it does based on docs.
   - Recommendation: Implement and verify during test call. If greeting is wrong, fallback to computing `current_time_period` at call initiation and injecting as a custom dynamic variable.

## Sources

### Primary (HIGH confidence)
- [Retell AI Create Agent API](https://docs.retellai.com/api-references/create-agent) - Full parameter list, voice_id format, backchannel, ambient_sound, voicemail_option
- [Retell AI Get Agent API](https://docs.retellai.com/api-references/get-agent) - Agent response schema, all configurable fields
- [Retell AI Create Phone Call API](https://docs.retellai.com/api-references/create-phone-call) - Call initiation params, override_agent_id, metadata, dynamic variables
- [Retell AI Dynamic Variables](https://docs.retellai.com/build/dynamic-variables) - Built-in variables, NO current_time_period, current_hour_[timezone] format
- [Retell AI Handle Voicemail](https://docs.retellai.com/build/handle-voicemail) - voicemail_option actions: prompt, static_text, hangup, bridge_transfer
- [Retell AI Create/Update Retell LLM](https://docs.retellai.com/api-references/create-retell-llm) - begin_message at LLM level, null=dynamic generation
- [retell-sdk Python SDK agent_create_params.py](https://github.com/RetellAI/retell-python-sdk) - SDK type definitions, parameter types

### Secondary (MEDIUM confidence)
- [Cartesia Voices](https://cartesia.ai/voices) - Voice library, British accent category confirmed
- [Retell AI Changelog](https://www.retellai.com/changelog) - Sonic 3 support, voice emotion control
- CONTEXT.md user statement: "cartesia-Willa is already used on one of the existing Retell agents"

### Tertiary (LOW confidence)
- `voice_model="sonic-3"` vs `"sonic-3-latest"` -- unclear which Retell defaults to for Cartesia voices
- Exact interaction between `voicemail_message` and `voicemail_option` when both are set

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries already in requirements.txt, no new dependencies
- Architecture: HIGH - Script pattern established in Phase 2, API parameters verified against official docs
- Pitfalls: HIGH - Critical begin_message/current_time_period issue verified against Retell Dynamic Variables docs
- Voicemail config: MEDIUM - voicemail_option structure confirmed from API docs, but exact interaction with voicemail_message unclear
- Ambient sound: HIGH - "call-center" enum value confirmed in official API docs

**Research date:** 2026-03-25
**Valid until:** 2026-04-25 (Retell API is stable; no imminent deprecations beyond March 31 phone number migration already handled)
