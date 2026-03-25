#!/usr/bin/env python3
"""Create Sarah's Retell LLM with system prompt, tools, and dynamic variables.

Run once to create the LLM. Store the returned llm_id in .env as RETELL_LLM_ID.
For subsequent updates, use update_llm.py instead.

Usage:
    cd execution/backend
    python scripts/create_llm.py
"""

import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from retell import Retell

# Resolve paths relative to this script's location
SCRIPT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = SCRIPT_DIR.parent
PROMPT_FILE = BACKEND_DIR / "prompts" / "sarah_system_prompt.txt"

# Add scripts dir to path for shared imports
sys.path.insert(0, str(SCRIPT_DIR))
from tool_definitions import build_tool_definitions


def main() -> None:
    """Create Sarah's LLM on the Retell platform."""
    # Load environment
    load_dotenv(BACKEND_DIR / ".env")
    load_dotenv(BACKEND_DIR.parent.parent / ".env")  # project root .env

    api_key = os.environ.get("RETELL_API_KEY")
    if not api_key:
        print("ERROR: RETELL_API_KEY not set in environment or .env")
        sys.exit(1)

    webhook_base_url = os.environ.get("WEBHOOK_BASE_URL")
    if not webhook_base_url:
        print("ERROR: WEBHOOK_BASE_URL not set in environment or .env")
        print("Set it to your public backend URL (e.g. https://your-endpoint.com)")
        sys.exit(1)

    # Read system prompt
    if not PROMPT_FILE.exists():
        print(f"ERROR: System prompt file not found: {PROMPT_FILE}")
        print("Run Plan 02-01 first to create the system prompt.")
        sys.exit(1)

    system_prompt = PROMPT_FILE.read_text(encoding="utf-8").strip()
    if not system_prompt:
        print("ERROR: System prompt file is empty")
        sys.exit(1)

    print(f"Loaded system prompt: {len(system_prompt)} chars")

    # Build webhook URL and tool definitions
    # Tools registered: lookup_programme, get_objection_response, log_call_outcome
    # Definitions in tool_definitions.py — single source of truth
    # All tools use timeout_ms=10000 (10 seconds)
    webhook_url = webhook_base_url.rstrip("/") + "/retell/tool"
    tools = build_tool_definitions(webhook_url)

    # NOTE: args_at_root is NOT set (defaults to false). Retell sends standard
    # payload format: {name, call: {call_id, ...}, args: {...}}.
    # Phase 4 must update ToolCallPayload in main.py to match this format.

    # Create the LLM
    client = Retell(api_key=api_key)

    try:
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
            general_tools=tools,
        )
    except Exception as e:
        print(f"ERROR: Retell API call failed: {e}")
        sys.exit(1)

    llm_id = llm.llm_id
    print()
    print("=" * 60)
    print("  LLM CREATED SUCCESSFULLY")
    print("=" * 60)
    print(f"  LLM ID: {llm_id}")
    print()
    print("  Add this to your .env file:")
    print(f"  RETELL_LLM_ID={llm_id}")
    print()
    print(f"  Tools registered: {len(tools)}")
    for tool in tools:
        print(f"    - {tool['name']} (timeout: {tool['timeout_ms']}ms)")
    print("=" * 60)


if __name__ == "__main__":
    main()
