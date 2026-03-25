#!/usr/bin/env python3
"""Update Sarah's existing Retell LLM with current prompt and tool definitions.

Use this after editing sarah_system_prompt.txt or tool schemas.
Requires RETELL_LLM_ID in .env.

Usage:
    cd execution/backend
    python scripts/update_llm.py
    python scripts/update_llm.py --prompt-only    # Only update system prompt
"""

import argparse
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
    """Update Sarah's LLM on the Retell platform."""
    parser = argparse.ArgumentParser(description="Update Sarah's Retell LLM")
    parser.add_argument(
        "--prompt-only",
        action="store_true",
        help="Only update the system prompt (skip tools)",
    )
    args = parser.parse_args()

    # Load environment
    load_dotenv(BACKEND_DIR / ".env")
    load_dotenv(BACKEND_DIR.parent.parent / ".env")  # project root .env

    api_key = os.environ.get("RETELL_API_KEY")
    if not api_key:
        print("ERROR: RETELL_API_KEY not set in environment or .env")
        sys.exit(1)

    llm_id = os.environ.get("RETELL_LLM_ID")
    if not llm_id:
        print("ERROR: RETELL_LLM_ID not set in environment or .env")
        print("Run create_llm.py first, then add the returned ID to .env")
        sys.exit(1)

    webhook_base_url = os.environ.get("WEBHOOK_BASE_URL")
    if not webhook_base_url:
        print("ERROR: WEBHOOK_BASE_URL not set in environment or .env")
        sys.exit(1)

    # Read system prompt
    if not PROMPT_FILE.exists():
        print(f"ERROR: System prompt file not found: {PROMPT_FILE}")
        sys.exit(1)

    system_prompt = PROMPT_FILE.read_text(encoding="utf-8").strip()
    if not system_prompt:
        print("ERROR: System prompt file is empty")
        sys.exit(1)

    print(f"Loaded system prompt: {len(system_prompt)} chars")

    # Build update kwargs
    client = Retell(api_key=api_key)
    update_kwargs: dict = {
        "general_prompt": system_prompt,
    }

    if not args.prompt_only:
        webhook_url = webhook_base_url.rstrip("/") + "/retell/tool"
        tools = build_tool_definitions(webhook_url)
        update_kwargs["general_tools"] = tools
        update_kwargs["begin_message"] = (
            "Hi {{lead_name}}, this is Sarah calling from Cloudboosta."
        )
        update_kwargs["default_dynamic_variables"] = {
            "lead_name": "there",
            "lead_location": "unknown",
        }
        update_kwargs["model"] = "gpt-4o-mini"
        update_kwargs["model_temperature"] = 0.3
        update_kwargs["tool_call_strict_mode"] = True

    try:
        llm = client.llm.update(llm_id, **update_kwargs)
    except Exception as e:
        print(f"ERROR: Retell API call failed: {e}")
        sys.exit(1)

    print()
    print("=" * 60)
    print("  LLM UPDATED SUCCESSFULLY")
    print("=" * 60)
    print(f"  LLM ID: {llm_id}")
    print(f"  Prompt length: {len(system_prompt)} chars")
    if args.prompt_only:
        print("  Mode: prompt-only (tools unchanged)")
    else:
        tools_list = update_kwargs.get("general_tools", [])
        print(f"  Mode: full update (prompt + {len(tools_list)} tools)")
        for tool in tools_list:
            print(f"    - {tool['name']}")
    print("=" * 60)


if __name__ == "__main__":
    main()
