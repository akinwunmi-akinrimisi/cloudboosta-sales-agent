"""Shared Retell LLM tool definitions for John.

Single source of truth for custom tool schemas used by create_llm.py
and update_llm.py. Keeping definitions here ensures they stay in sync.
"""


def build_tool_definitions(webhook_url: str) -> list[dict]:
    """Return the 7 custom tool definitions for John's Retell LLM.

    Args:
        webhook_url: Full URL for the tool call webhook
                     (e.g. https://your-endpoint.com/retell/tool).
    """
    return [
        # --- Tool 1: lookup_programme ---
        {
            "type": "custom",
            "name": "lookup_programme",
            "description": (
                "Look up the recommended programme, pricing in the lead's local "
                "currency, and a matching testimonial. Call this AFTER Gate 1 "
                "qualification and AFTER confirming the pathway with the lead. "
                "Example: 'Based on what you've told me, the Advanced DevOps "
                "pathway sounds like the right fit. Let me pull up the details "
                "for you.'"
            ),
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
                        "description": (
                            "Lead's qualification profile from Gate 1. "
                            "A = no tech background (recommend Zero to Cloud "
                            "DevOps 16wk), B = some tech or IT adjacent, "
                            "C = junior cloud/devops experience, X = not a "
                            "clear fit (recommend Cloud Computing 8wk as default)."
                        ),
                    },
                    "country": {
                        "type": "string",
                        "description": (
                            "Lead's country for currency selection. Determines "
                            "which currency pricing is returned in. Examples: "
                            "UK, US, Nigeria, Germany, Canada."
                        ),
                    },
                },
            },
        },
        # --- Tool 2: get_objection_response ---
        {
            "type": "custom",
            "name": "get_objection_response",
            "description": (
                "Get response scripts for handling a specific objection. Call "
                "this EVERY TIME the lead raises an objection. Never try to "
                "handle objections from memory. The tool returns multi-layer "
                "response options and cultural nuances for the lead's country."
            ),
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
                        "description": (
                            "The objection category. Common types: "
                            "price_too_expensive, need_to_check_finances, "
                            "found_cheaper_alternative, no_time_too_busy, "
                            "bad_timing, family_commitments, fear_of_failure, "
                            "not_technical_enough, too_old_career_change, "
                            "saturated_market, ai_replacing_jobs, "
                            "no_job_guarantee, prefer_in_person, "
                            "need_to_ask_spouse, self_study_preference, "
                            "already_have_skills, never_heard_of_cloudboosta, "
                            "not_interested, call_me_back_later, "
                            "send_me_email, want_to_research_more. "
                            "Pick the closest match."
                        ),
                    },
                },
            },
        },
        # --- Tool 3: log_call_outcome ---
        {
            "type": "custom",
            "name": "log_call_outcome",
            "description": (
                "Log the call outcome at the end of EVERY call. This MUST be "
                "called before ending any call, regardless of outcome. Records "
                "qualification gate results, strategy used, and a summary for "
                "the continuous improvement loop."
            ),
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
                        "description": (
                            "Call outcome. WEBINAR_INVITED = accepted webinar "
                            "invite. REMINDER_COMPLETED = reminder call done. "
                            "COMMITTED = agreed to enrol. FOLLOW_UP = interested "
                            "but needs time. DECLINED = said no clearly. "
                            "NOT_QUALIFIED = not a fit. NO_ANSWER = didn't connect."
                        ),
                    },
                    "programme_recommended": {
                        "type": "string",
                        "description": (
                            "Programme or bundle recommended during the call. "
                            "E.g. 'Zero to Cloud DevOps (16wk)', "
                            "'Cloud Computing (8wk)', 'Advanced DevOps (8wk)'."
                        ),
                    },
                    "closing_strategy_used": {
                        "type": "string",
                        "description": (
                            "Primary closing strategy used. One of: "
                            "doctor_frame, pain_close, inverse_close, "
                            "nepq_sequence, diffusion, direct_close."
                        ),
                    },
                    "lead_persona": {
                        "type": "string",
                        "description": (
                            "Detected lead persona. One of: career_changer, "
                            "upskiller, beginner_fearful, experienced_dev, "
                            "price_sensitive, time_constrained."
                        ),
                    },
                    "motivation_strength": {
                        "type": "string",
                        "description": (
                            "Gate 2 result. One of: strong, weak, none."
                        ),
                    },
                    "capacity_assessment": {
                        "type": "string",
                        "description": (
                            "Gate 3 result. One of: both_clear, time_blocked, "
                            "budget_blocked, both_blocked."
                        ),
                    },
                    "objections_raised": {
                        "type": "string",
                        "description": (
                            "Comma-separated list of objection types raised "
                            "during the call. E.g. "
                            "'price_too_expensive,need_to_check_finances'. "
                            "Empty string if no objections."
                        ),
                    },
                    "confirmed_email": {
                        "type": "string",
                        "description": (
                            "The lead's confirmed or newly collected email address. "
                            "If the lead confirmed their existing email, pass it here. "
                            "If they gave a new/different email, pass the new one. "
                            "This is where payment details and follow-up info will be sent."
                        ),
                    },
                    "call_type": {
                        "type": "string",
                        "description": (
                            "Type of call being logged. One of: invite, "
                            "reminder, follow_up, direct_sell."
                        ),
                    },
                    "webinar_date": {
                        "type": "string",
                        "description": (
                            "ISO date of the webinar referenced in this call "
                            "(e.g. '2026-04-03'). Only for invite, reminder, "
                            "and follow_up calls."
                        ),
                    },
                    "webinar_attended": {
                        "type": "string",
                        "description": (
                            "Whether the lead attended the webinar. 'true' or "
                            "'false'. Only set on follow_up calls after asking "
                            "the lead."
                        ),
                    },
                    "follow_up_date": {
                        "type": "string",
                        "description": (
                            "Scheduled follow-up date if outcome is FOLLOW_UP. "
                            "ISO format: YYYY-MM-DD. Omit if not applicable."
                        ),
                    },
                    "preferred_call_time": {
                        "type": "string",
                        "description": (
                            "Lead's preferred time for the advisory call with "
                            "Akinwunmi. ISO format: YYYY-MM-DDTHH:MM:SS. "
                            "Set this when the lead agrees to an advisory call "
                            "and confirms a time slot."
                        ),
                    },
                    "summary": {
                        "type": "string",
                        "description": (
                            "Brief 2-3 sentence summary of the call. What was "
                            "discussed, lead's situation, and outcome reason."
                        ),
                    },
                },
            },
        },
        # --- Tool 4: get_lead_context ---
        {
            "type": "custom",
            "name": "get_lead_context",
            "description": (
                "Retrieve previous call history for this lead. Call this at the "
                "START of every call to a returning lead (when is_returning_lead "
                "is 'yes' in dynamic variables). Returns summaries of previous "
                "calls including what was discussed, objections raised, and "
                "strategy used. Use this to personalize the conversation."
            ),
            "url": webhook_url,
            "method": "POST",
            "speak_during_execution": False,
            "speak_after_execution": False,
            "timeout_ms": 10000,
            "parameters": {
                "type": "object",
                "required": [],
                "properties": {},
            },
        },
        # --- Tool 5: check_advisor_availability ---
        {
            "type": "custom",
            "name": "check_advisor_availability",
            "description": (
                "Check Akinwunmi's (senior technical advisor) availability for "
                "a specific date. Call this when the lead is interested in "
                "speaking with the advisor and you need to find available time "
                "slots. Returns a list of available times and the booking link. "
                "Use the results to suggest times to the lead naturally: "
                "'Akinwunmi has slots at 10 AM and 2 PM on Tuesday — which works better for you?'"
            ),
            "url": webhook_url,
            "method": "POST",
            "speak_during_execution": True,
            "execution_message_description": "Let me check what times are available.",
            "speak_after_execution": True,
            "timeout_ms": 10000,
            "parameters": {
                "type": "object",
                "required": ["date"],
                "properties": {
                    "date": {
                        "type": "string",
                        "description": (
                            "The date to check availability for in YYYY-MM-DD "
                            "format. Ask the lead what day works for them first, "
                            "then check that date."
                        ),
                    },
                },
            },
        },
        # --- Tool 6: send_brochure ---
        {
            "type": "custom",
            "name": "send_brochure",
            "description": (
                "Send the programme brochure, pricing details, and webinar link "
                "to the lead's email. Call this when the lead asks to receive "
                "details, the brochure, or payment information. Requires the "
                "lead's email — if you don't have it, ask for it and call "
                "save_email first, then call send_brochure."
            ),
            "url": webhook_url,
            "method": "POST",
            "speak_during_execution": True,
            "execution_message_description": "I'll send that over to you right now.",
            "speak_after_execution": True,
            "timeout_ms": 10000,
            "parameters": {
                "type": "object",
                "required": [],
                "properties": {
                    "programme": {
                        "type": "string",
                        "description": (
                            "Which programme details to send. One of: "
                            "cloud_computing, advanced_devops, platform_engineering, "
                            "sre, all. Defaults to 'all' if unsure."
                        ),
                    },
                    "include_webinar_link": {
                        "type": "boolean",
                        "description": "Whether to include the webinar link. Default true.",
                    },
                },
            },
        },
    ]
