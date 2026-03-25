"""Tool execution handlers for Retell custom functions.

Each handler receives args from the Retell tool call webhook
and returns a dict that Retell sends back to the LLM.
"""

import json
import logging
from typing import Any

from supabase_client import supabase

logger = logging.getLogger(__name__)


async def lookup_programme(args: dict) -> dict:
    """Look up programme details based on experience level and interest."""
    experience = args.get("experience_level", "beginner")
    interest = args.get("interest_area", "cloud")
    # TODO: Query programmes table in Supabase (Phase 4.2)
    return {"result": f"Programme lookup for {experience}/{interest} — not yet implemented"}


async def get_objection_response(args: dict) -> dict:
    """Retrieve multi-layer objection response by type."""
    objection_type = args.get("objection_type", "")
    # TODO: Query objections table in Supabase (Phase 4.2)
    return {"result": f"Objection response for '{objection_type}' — not yet implemented"}


async def log_call_outcome(args: dict, lead_id: str | None = None, call_id: str = "") -> dict:
    """Log the call outcome to Supabase. Called at end of every call."""
    outcome = args.get("outcome", "DECLINED")
    programme = args.get("programme_recommended", "")
    summary = args.get("summary", "")
    strategy = args.get("closing_strategy_used", "")
    persona = args.get("lead_persona", "")
    follow_up = args.get("follow_up_date")
    objections = args.get("objections_raised", "")

    logger.info("Call outcome logged: %s (strategy: %s, persona: %s)", outcome, strategy, persona)
    # TODO: Insert into call_logs + update lead status (Phase 4.1)
    return {"result": f"Outcome '{outcome}' logged successfully"}


# Registry of tool handlers keyed by Retell function name
TOOL_HANDLERS: dict[str, Any] = {
    "lookup_programme": lookup_programme,
    "get_objection_response": get_objection_response,
    "log_call_outcome": log_call_outcome,
}

# Conversational fallbacks per tool -- Sarah never mentions system errors during live calls
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
        "result": "Outcome logged successfully"
    },
}
DEFAULT_FALLBACK = {
    "result": "I don't have that information right now. Let me have someone follow up with you."
}


async def execute_tool(name: str, args: dict, call_id: str, lead_id: str | None = None) -> str:
    """Execute a tool call. On failure, return a conversational fallback for Sarah."""
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
