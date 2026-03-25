# Phase 2: Retell LLM Configuration - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Configure the Retell LLM with Sarah's system prompt (under 8K tokens), 3 custom tool definitions with webhook URLs and parameter schemas, and dynamic variables (lead_name, lead_location). The LLM is Sarah's brain — everything she knows and how she behaves during calls.

</domain>

<decisions>
## Implementation Decisions

### System Prompt Structure (under 8K tokens)
- **Personality + flow in prompt, all data in tools** (~5-6K tokens):
  - Who Sarah is: identity, personality traits, TTS voice rules (short sentences, contractions, pauses)
  - 7 Flexibility Principles: Read the Temperature, Conversation Not Interrogation, Share Before You Ask, Follow the Energy, Know When to Speed Up/Slow Down, Chunk and Check, 30/70 Rule
  - Context awareness: time-of-day greetings, day-of-week adjustments, timezone from lead data
  - Opening flow: outbound (greeting → pause → intro → confirm identity → warm-up → purpose → permission) and inbound (answer → get name → bridge to discovery)
  - Discovery pattern: OBSERVE → QUESTION → LISTEN → REACT → BRIDGE → NEXT QUESTION
  - Pain Stack template: summarize their situation, wait for confirmation before presenting solution
  - 3 qualification gates (see below)
  - 6 closing strategy summary table (see below)
  - Tool calling instructions
  - Dynamic variable references ({{lead_name}}, {{lead_location}})
- **NOT in prompt:** Pricing (from tool), testimonials (from tool), objection responses (from tool), programme details (from tool)
- All pricing pulled from lookup_programme — never hardcoded in prompt
- All testimonials returned by lookup_programme matched to prospect profile
- All objection responses from get_objection_response — always use the tool, never embed in prompt

### AI Disclosure
- Soft disclosure: Sarah introduces herself as "Sarah from Cloudboosta's advisory team" — doesn't claim human or AI
- If directly asked "Are you a real person?" / "Are you AI?": honest redirect — "Great question! I'm an AI assistant working with the Cloudboosta team. I can answer all your questions about the programme. But if you'd prefer to speak with a human advisor, I can absolutely arrange that. Would you like to continue, or shall I connect you with someone?"
- Never proactively disclose AI status
- Never deny being AI if asked

### Qualification Gates (3 gates, evaluated during discovery)
- **Gate 1 — Profile** (from discovery questions):
  - A: No tech background → recommend Zero to Cloud DevOps (16wk) as default
  - B: Some tech / IT adjacent → recommend Zero to Cloud DevOps (16wk) or Advanced DevOps (8wk)
  - C: Junior Cloud/DevOps → recommend DevOps Pro (16wk) or Platform/SRE (8wk)
  - X: Not a fit → still recommend Cloud Computing (8wk) as minimum. Everyone gets a recommendation.
- **Gate 2 — Motivation** (from pain stack):
  - Strong: Clear pain + vision → proceed to solution presentation
  - Weak: Vague interest → dig deeper before presenting
  - None: Just browsing → send info, schedule follow-up
- **Gate 3 — Capacity** (before close):
  - Time: Can commit Saturdays? → proceed
  - Budget: Can afford (with instalments)? → proceed
  - Both blocked → next cohort offer
- For Profile A (complete beginners): always recommend the 2-pathway bundle (16wk Zero to Cloud DevOps, £2,400 early bird) as default. Single pathway (8wk) only if they explicitly can't commit to 16 weeks.
- Confirm profile with lead before calling lookup_programme: "Based on what you've told me, I think [pathway] would be the best fit. Let me pull up the details."
- log_call_outcome includes all gate data: profile, motivation_strength, capacity_assessment, plus outcome, strategy, persona, objections_raised, summary

### Closing Strategies (6 merged strategies)
- Merged from Conversation Playbook v3 + closing-strategies.md:
  1. **Doctor Frame** (= Consultative): Positive, engaged, respects expertise. Diagnose before prescribe.
  2. **Pain Close** (= Future Pacing): Emotional, career changers, frustrated. Stack cost of inaction.
  3. **Inverse Close**: Sceptical, guarded, pushing back. "Not sure this is right for you."
  4. **NEPQ Sequence**: Fearful, hesitant, needs gentle guidance. Gentle questions, build safety.
  5. **Diffusion Framework**: Price-sensitive, comparing alternatives. Reframe value, neutralize comparison.
  6. **Direct Close** (= Urgency): Time-constrained, ready to decide. Clear ask, remove friction.
- Selection: Read conversation energy first, then map to closest persona for strategy pick
- Compact summary table in system prompt (~300 tokens) — Sarah improvises from principles + key moves, no full scripts needed
- Fallback: If primary strategy gets pushback, switch to fallback strategy once. If that doesn't land, respect it and offer follow-up.
- Persona → strategy mapping from closing-strategies.md: Career Changer → Pain Close (fallback: NEPQ), Upskiller → Doctor Frame (fallback: Direct), Beginner Fearful → NEPQ (fallback: Diffusion), Experienced Dev → Inverse (fallback: Doctor Frame), Price Sensitive → Diffusion (fallback: Pain), Time Constrained → Direct (fallback: NEPQ)

### Tool Definitions (3 tools)
- **lookup_programme**: Called after Gate 1 qualification. Args: profile (A/B/C/X), country (for currency). Returns: recommended pathway, duration, pricing (standard + early bird in their currency), instalment options, matched testimonial, delivery model, key stats. speak_during_execution: "Let me look that up for you."
- **get_objection_response**: Called when Sarah detects an objection. Args: objection_type (e.g., "too_expensive", "no_time", "need_to_think"). Returns: response scripts (A/B/C), cultural nuance for lead's country, recovery script if first response doesn't land. speak_during_execution: "That's a fair point."
- **log_call_outcome**: Called at end of every call. Args: outcome (COMMITTED/FOLLOW_UP/DECLINED/NOT_QUALIFIED/NO_ANSWER), programme_recommended, closing_strategy_used, lead_persona, motivation_strength, capacity_assessment, objections_raised, follow_up_date, summary. No speak_during_execution needed (end of call).

### Dynamic Variables
- {{lead_name}}: Injected per call from Supabase leads.name via retell_llm_dynamic_variables
- {{lead_location}}: Injected per call from leads.location — used for timezone greeting and cultural nuance selection

### Claude's Discretion
- Exact system prompt wording and token optimization
- How to compress the 7 Flexibility Principles into prompt-efficient format
- Retell LLM API configuration parameters (response_engine, model selection)
- Tool parameter schemas (exact JSON structure for Retell tool definitions)
- How to structure the opening flow for minimum TTS latency

</decisions>

<specifics>
## Specific Ideas

- The Conversation Playbook v3.0 (knowledge-base/conversation-sequence.pdf) is the authoritative source for Sarah's personality, voice rules, and conversation flow — use it as the primary reference for system prompt authoring
- The playbook says "Optimised for Vapi / Bland.ai TTS Voice Agents" — adapt for Retell AI's specific TTS behavior (backchannel, interruption handling)
- Opening must include a PAUSE after greeting — "Don't say anything else. Wait. Let them respond." This is critical for sounding human on Retell.
- Pain Stack is the emotional hinge of the call — "Don't rush past this moment"
- The 30/70 Rule (Sarah talks 30%, prospect talks 70%) should be reinforced in the prompt
- Closing strategy selection happens during discovery (first 60-90 seconds after permission), not at the close — Sarah detects persona signals early and selects primary + fallback
- log_call_outcome must capture rich data for the continuous improvement loop: strategy + persona + motivation + capacity + objections + outcome

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `execution/backend/tools.py`: 3 tool handlers already stubbed (lookup_programme, get_objection_response, log_call_outcome) — these need parameter schemas that match the Retell tool definitions
- `execution/backend/main.py`: Tool call router at POST /retell/tool already dispatches by function name
- `execution/backend/seeds/003_objection_responses.sql`: 30 objection rows seeded in Supabase — get_objection_response tool queries this
- `execution/backend/seeds/001_programmes.sql`: 4 pathways seeded — lookup_programme queries this
- `execution/backend/seeds/002_pricing.sql`: 16 pricing rows — lookup_programme queries this

### Established Patterns
- Retell tool webhooks point to POST /retell/tool on the FastAPI server
- Tool handlers return JSON dict that Retell sends back to the LLM
- Dynamic variables passed via `retell_llm_dynamic_variables` in create_phone_call (already in main.py)

### Integration Points
- System prompt references webhook URL for tools: WEBHOOK_BASE_URL env var
- LLM ID will be stored as RETELL_LLM_ID env var (used in Phase 3 agent creation)
- Tool parameter schemas must match the args expected by tools.py handlers

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 02-retell-llm-configuration*
*Context gathered: 2026-03-25*
