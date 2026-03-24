# Directive 03 — Voice Agent Configuration
## Retell Agent Creation, Voice Selection, Phone Assignment

---

## Goal
Create the Retell agent with the correct voice, language, and behaviour settings, then assign it to the migrated phone number.

## Inputs
- `RETELL_LLM_ID` from Directive 01
- Phone number imported in Directive 00

## Tools
- Retell Python SDK: `client.voice.list()`, `client.agent.create()`, `client.phone_number.update()`

## Tasks
1. List available voices, filter for English female British accent
2. Select the best voice — prioritise natural-sounding, warm tone
3. Create agent with these settings:
   - `agent_name`: "Sarah - Cloudboosta Cold Caller"
   - `language`: "en-GB"
   - `voice_speed`: 1.0
   - `voice_temperature`: 0.8
   - `responsiveness`: 0.9
   - `interruption_sensitivity`: 0.8
   - `enable_backchannel`: True
   - `backchannel_words`: ["yeah", "uh-huh", "I see", "right", "absolutely"]
   - `reminder_trigger_ms`: 10000 (10 second silence reminder)
   - `reminder_max_count`: 2
   - `ambient_sound`: "off"
   - `webhook_url`: WEBHOOK_BASE_URL + "/retell/webhook"
   - `webhook_events`: ["call_started", "call_ended", "call_analyzed"]
4. Store `agent_id` in `.env` as `RETELL_AGENT_ID`
5. Assign agent to phone number for both inbound and outbound

## Outputs
- Retell agent created and configured
- Agent assigned to phone number
- `RETELL_AGENT_ID` stored in `.env`

## Edge Cases
- If no British female voice available: use the closest English female voice and note in lessons learned
- If phone number assignment fails: check that number import (Directive 00) completed successfully

## Lessons Learned
<!-- Update this section after completing the phase -->
