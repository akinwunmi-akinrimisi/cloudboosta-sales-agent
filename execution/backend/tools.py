"""Tool execution handlers for Retell custom functions.

Each handler receives args from the Retell tool call webhook
and returns a dict that Retell sends back to the LLM.
"""

import json
import logging
from typing import Any

from supabase_client import supabase

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Mapping constants (per CONTEXT.md locked decisions)
# ---------------------------------------------------------------------------

COUNTRY_CURRENCY_MAP = {
    "UK": "GBP", "GB": "GBP", "United Kingdom": "GBP",
    "England": "GBP", "Scotland": "GBP", "Wales": "GBP",
    "US": "USD", "USA": "USD", "United States": "USD", "Canada": "USD",
    "Nigeria": "NGN", "NG": "NGN",
    "Germany": "EUR", "France": "EUR", "Ireland": "EUR",
    "Netherlands": "EUR", "Spain": "EUR", "Italy": "EUR",
    "Portugal": "EUR", "Belgium": "EUR", "Austria": "EUR",
}
DEFAULT_CURRENCY = "GBP"

PROFILE_PATHWAY_MAP = {
    "A": {"bundle_slug": "zero-to-cloud-devops", "pathway_name": "Zero to Cloud DevOps", "duration": "16 weeks"},
    "B": {"bundle_slug": "zero-to-cloud-devops", "pathway_name": "Zero to Cloud DevOps", "duration": "16 weeks"},
    "C": {"bundle_slug": "devops-pro", "pathway_name": "DevOps Pro", "duration": "16 weeks"},
    "X": {"bundle_slug": "zero-to-cloud-devops", "pathway_name": "Zero to Cloud DevOps", "duration": "16 weeks"},
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

# A.D.Q. (Acknowledge, Dig, Question) fallback for unknown objection keys
ADQ_FALLBACK = {
    "responses": [
        {"label": "A.D.Q. Framework", "script": "That's a really fair point. Can I ask what specifically concerns you about that?"}
    ],
    "cultural_nuances": {},
    "recovery_script": "I appreciate you sharing that concern. What specifically worries you most about it?"
}


async def lookup_programme(args: dict) -> dict:
    """Look up programme details and pricing based on lead profile and country."""
    profile = args.get("profile", "X")
    country = args.get("country", "")
    logger.info("lookup_programme called: profile=%s country=%s", profile, country)

    # Map profile to pathway/bundle
    pathway = PROFILE_PATHWAY_MAP.get(profile, PROFILE_PATHWAY_MAP["X"])

    # Map country to currency
    currency = COUNTRY_CURRENCY_MAP.get(country, DEFAULT_CURRENCY)

    # Query Supabase pricing table
    result = supabase.table("pricing").select("*").eq(
        "bundle_slug", pathway["bundle_slug"]
    ).eq("currency", currency).execute()

    if not result.data:
        raise ValueError(
            f"No pricing found for bundle_slug={pathway['bundle_slug']} currency={currency}"
        )

    p = result.data[0]

    # Use default testimonial (tool_definitions.py does not pass persona)
    testimonial = DEFAULT_TESTIMONIAL

    return {
        "programme": pathway["pathway_name"],
        "duration": pathway["duration"],
        "price_standard": str(p["standard_price"]),
        "price_early_bird": str(p["early_bird_price"]),
        "savings": str(float(p["standard_price"]) - float(p["early_bird_price"])),
        "currency": currency,
        "early_bird_deadline": str(p.get("early_bird_deadline", "")),
        "cohort_start": str(p.get("cohort_start_date", "")),
        "instalment_option": (
            f"2 instalments at {currency} {p.get('instalment_2_total', 'N/A')}"
            f" or 3 at {currency} {p.get('instalment_3_total', 'N/A')}"
        ),
        "testimonial_name": testimonial["name"],
        "testimonial_story": testimonial["story"],
        "selling_points": [
            "Live Saturday classes with experienced instructors",
            "Career support and job placement assistance",
            "Hands-on projects for your portfolio",
        ],
    }


async def get_objection_response(args: dict) -> dict:
    """Retrieve multi-layer objection response by objection key from Supabase."""
    objection_type = args.get("objection_type", "")
    logger.info("get_objection_response called: objection_type=%s", objection_type)

    # Query Supabase objection_responses table by exact key match
    result = supabase.table("objection_responses").select(
        "responses, cultural_nuances, recovery_script"
    ).eq("objection_key", objection_type).execute()

    if not result.data:
        return ADQ_FALLBACK

    row = result.data[0]
    return {
        "responses": row["responses"],
        "cultural_nuances": row.get("cultural_nuances", {}),
        "recovery_script": row.get("recovery_script", ""),
    }


async def log_call_outcome(args: dict, lead_id: str | None = None, call_id: str = "") -> dict:
    """Log the call outcome to Supabase. Called at end of every call."""
    outcome = args.get("outcome", "DECLINED")
    summary = args.get("summary", "")
    strategy = args.get("closing_strategy_used", "")
    persona = args.get("lead_persona", "")
    programme = args.get("programme_recommended", "")
    follow_up_date = args.get("follow_up_date")
    objections = args.get("objections_raised", "")
    motivation = args.get("motivation_strength", "")
    capacity = args.get("capacity_assessment", "")

    logger.info(
        "log_call_outcome called: outcome=%s strategy=%s persona=%s call_id=%s lead_id=%s",
        outcome, strategy, persona, call_id, lead_id,
    )

    # 1. Insert into call_logs FIRST (before lead update, so the row exists
    #    when the pipeline_logs trigger fires on the leads status change).
    supabase.table("call_logs").insert({
        "retell_call_id": call_id,
        "lead_id": lead_id,
        "outcome": outcome,
        "closing_strategy_used": strategy,
        "detected_persona": persona,
        "summary": summary,
    }).execute()

    # 2. Update lead status based on outcome (skip NO_ANSWER -- handled by webhook)
    if lead_id and outcome != "NO_ANSWER":
        status_map = {
            "COMMITTED": "committed",
            "FOLLOW_UP": "follow_up",
            "DECLINED": "declined",
            "NOT_QUALIFIED": "not_qualified",
        }
        new_status = status_map.get(outcome)
        if new_status:
            update_data: dict[str, Any] = {
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
