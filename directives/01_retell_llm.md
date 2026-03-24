# Directive 01 — Retell LLM Configuration
## Sarah's Brain: System Prompt + Custom Functions

---

## Goal
Create the Retell LLM with Sarah's full system prompt and register all custom functions (tools) that Sarah can invoke during live calls.

## Inputs
- `knowledge-base/conversation-sequence.pdf` — 8-stage call flow + qualification gates
- `knowledge-base/objection-handling.pdf` — 11 objections with multi-layer responses
- `knowledge-base/programmes.pdf` — 4 pathways, pricing, delivery model
- `closing-strategies.md` — 6 strategies with persona detection + selection algorithm

## Tools
- Retell Python SDK: `client.llm.create()`, `client.llm.update()`

## Tasks
1. Read all 4 knowledge base sources
2. Compose system prompt (must be under 8K tokens — see constraint in AGENT.md section 12)
3. Create LLM via `client.llm.create()` with model `gpt-4o-mini`
4. Set `starting_message` with `{{lead_name}}` dynamic variable
5. Set `speak_during_execution: true`
6. Register custom functions: `lookup_programme`, `get_objection_response`, `log_call_outcome`
7. Store `llm_id` in `.env` as `RETELL_LLM_ID`

## Outputs
- Retell LLM created with full system prompt
- 3 custom functions registered, all pointing to `WEBHOOK_BASE_URL/retell/tool`
- `RETELL_LLM_ID` stored in `.env`

## System Prompt Structure
```
IDENTITY → COLD CALL OPENING → CONVERSATION FLOW (8 stages) →
QUALIFICATION GATES (3 gates) → CLOSING STRATEGIES (6 + selection algorithm) →
PROGRAMME DATA (pricing, bundles) → OBJECTION HANDLING (11 types) →
OUTCOME CLASSIFICATION → SUCCESS STORIES → RULES
```

## Edge Cases
- If system prompt exceeds 8K tokens: summarise objection responses (keep full first layers, condense later layers)
- If `gpt-4o-mini` is unavailable on Retell: fall back to `gpt-4o`

## Lessons Learned
<!-- Update this section after completing the phase -->
