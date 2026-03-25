# Phase 3: Voice Agent Creation - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Create Sarah as a callable voice agent on Retell with natural British speech, backchannel, and phone number assigned. Update system prompt with name exchange flow. Make a test call to verify the full chain works.

</domain>

<decisions>
## Implementation Decisions

### Voice Selection
- Voice ID: `cartesia-Willa` (Cartesia provider, British female)
- Tone: Warm + professional — knowledgeable friend, not salesperson
- Speed: Normal conversational pace (no speed adjustment)
- Language: en-GB (British English)

### Agent Behavior Tuning
- Backchannel: enabled, frequency 0.8 (per PROJECT.md)
- Interruption handling: Responsive — low threshold (~0.5s), Sarah stops quickly when lead talks. Matches playbook principle "If they interrupt with agreement, stop and move forward."
- Silence tolerance: Long (3-5 seconds before filling). Playbook golden rule: "silence after the close." Gives leads time to think after emotional moments (pain stack, closing question).
- Ambient sound: Subtle office ambience — faint background to make Sarah feel like she's in a real call center. Helps mask TTS artifacts.

### Phone Number Assignment
- Assign during agent creation (one-shot flow):
  1. Create agent → get RETELL_AGENT_ID
  2. Run migrate_phone_number.py → assign +17404943597 with weighted agents
  3. Set both outbound_agents and inbound_agents to [{agent_id, weight: 1.0}]
  4. Verify phone number shows correct agent binding
- Phone number: +17404943597 (already in Retell from Twilio import, or import during this phase)

### Begin Message (Updated)
- begin_message: "Good {{current_time_period}}."
- No name in greeting — database may not have lead names
- System prompt handles everything after the lead responds

### Name Exchange Flow (NEW — replaces old identity confirmation)
- Sarah does NOT assume she knows the lead's name
- After greeting + intro, Sarah asks: "Can I get your name please?"
- Repeats name back to confirm: "Did I get that right — [Name]?"
- If full name given (e.g., "Oluwaseun Adebayo"), Sarah picks one and asks: "Is it okay if I call you Oluwaseun?"
- Lead confirms or offers preferred name / nickname
- Sarah uses the confirmed name throughout the entire call
- {{lead_name}} dynamic variable becomes optional — fallback 'there' still works but prompt no longer depends on it

### System Prompt Update (Part of Phase 3)
- Update sarah_system_prompt.txt:
  - Remove: "Am I speaking with {{lead_name}}?" identity confirmation step
  - Add: Full name exchange flow (ask → confirm → pick → use)
  - Make {{lead_name}} optional — if available, use it; if not, ask for it
- Run update_llm.py --prompt-only to push change to Retell
- Verify token count still under 8K after changes

### Voicemail Handling
- Sarah leaves a voicemail message when detected (every attempt, not just last retry)
- Voicemail script: "Hi, this is Sarah from Cloudboosta. I was reaching out about our Cloud DevOps training programme. I'll try you again soon. No need to call back. Have a lovely day."
- "No need to call back" — controls next touchpoint, avoids inbound callback without context
- After voicemail: log status as 'voicemail', increment retry count, requeue after 60min backoff

### Test Call
- Create a test lead in Supabase with the operator's real phone number (provided during execution checkpoint)
- Initiate call via Retell API using the full pipeline (not Retell test call feature)
- Success: Sarah speaks her opening line ("Good afternoon."), pauses, lead responds, Sarah continues with intro
- Test validates: voice sounds correct, backchannel works, LLM responds, begin_message plays

### Claude's Discretion
- Exact Retell agent creation API parameters (response_engine, webhook settings)
- How to configure voicemail detection on Retell (built-in or custom)
- Agent-level webhook URL configuration
- Ambient sound implementation (Retell may not support this natively — research needed)
- How to handle the phone number import if it's not yet on Retell

</decisions>

<specifics>
## Specific Ideas

- The name exchange must feel natural, not robotic. Sarah should react to the name: "That's a lovely name" or "Great to meet you, Seun." Conversational, not form-filling.
- cartesia-Willa is already used on one of the existing Retell agents — consistent voice across the platform.
- The voicemail message should sound warm and brief — no pitch, no pressure, just a friendly heads-up.
- The test call is the first time anyone hears Sarah. It's a milestone moment.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `execution/backend/scripts/create_llm.py` — Pattern for Retell SDK script structure (env loading, client init, error handling)
- `execution/backend/scripts/update_llm.py` — Has `--prompt-only` flag for updating just the system prompt
- `execution/backend/scripts/verify_llm.py` — Verification pattern to reuse for agent verification
- `execution/backend/scripts/tool_definitions.py` — Shared tool definitions (agents reference the LLM which has tools)
- `execution/backend/migrate_phone_number.py` — Ready to run once RETELL_AGENT_ID exists
- `execution/backend/prompts/sarah_system_prompt.txt` — Current system prompt (2,329 tokens)

### Established Patterns
- All Retell scripts use: `load_dotenv('../../.env')`, `Retell(api_key=...)`, try/except with clear error messages
- Verification scripts use granular `--check-*` flags
- .env.example updated alongside .env changes

### Integration Points
- RETELL_LLM_ID (llm_bcdf71209cc7bc80ab5477145a88) → agent creation links to this LLM
- RETELL_AGENT_ID → needed by migrate_phone_number.py, main.py, and future phases
- RETELL_PHONE_NUMBER → +17404943597, used in main.py create_phone_call
- System prompt update → update_llm.py --prompt-only → Retell API

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-voice-agent-creation*
*Context gathered: 2026-03-25*
