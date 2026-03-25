#!/usr/bin/env python3
"""Verify Sarah's Retell LLM configuration.

Checks: LLM exists, prompt loaded, 3 tools registered, dynamic variables set.

Usage:
    cd execution/backend
    python scripts/verify_llm.py                    # Full verification
    python scripts/verify_llm.py --check-tools       # Tools only
    python scripts/verify_llm.py --check-variables   # Variables only
    python scripts/verify_llm.py --check-prompt-length  # Prompt length only
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

# Expected tool names and their required parameters
EXPECTED_TOOLS = {
    "lookup_programme": ["profile", "country"],
    "get_objection_response": ["objection_type"],
    "log_call_outcome": ["outcome", "summary"],
}

EXPECTED_VARIABLES = ["lead_name", "lead_location"]


def check_prompt_length(llm) -> bool:
    """Check that the system prompt is loaded and under 8000 tokens."""
    passed = True
    prompt = getattr(llm, "general_prompt", None) or ""

    if not prompt:
        print("  FAIL: general_prompt is empty")
        return False

    char_count = len(prompt)
    # Rough token estimate: ~4 chars per token for English text
    estimated_tokens = char_count // 4

    print(f"  Prompt length: {char_count} chars (~{estimated_tokens} tokens)")

    if estimated_tokens > 8000:
        print(f"  FAIL: Estimated tokens ({estimated_tokens}) exceeds 8000 limit")
        passed = False
    else:
        print(f"  PASS: Under 8000 token limit ({estimated_tokens}/8000)")

    return passed


def check_tools(llm) -> bool:
    """Check that all 3 tools are registered with correct parameters."""
    passed = True
    tools = getattr(llm, "general_tools", None) or []

    if len(tools) != 3:
        print(f"  FAIL: Expected 3 tools, found {len(tools)}")
        passed = False

    tool_names = set()
    for tool in tools:
        name = tool.get("name") if isinstance(tool, dict) else getattr(tool, "name", None)
        tool_names.add(name)

        # Check timeout
        timeout = tool.get("timeout_ms") if isinstance(tool, dict) else getattr(tool, "timeout_ms", None)
        if timeout != 10000:
            print(f"  FAIL: {name} timeout_ms is {timeout}, expected 10000")
            passed = False

        # Check speak_during_execution
        speak = tool.get("speak_during_execution") if isinstance(tool, dict) else getattr(tool, "speak_during_execution", None)
        if name == "log_call_outcome":
            if speak is not False:
                print(f"  FAIL: {name} speak_during_execution should be False")
                passed = False
        elif name in ("lookup_programme", "get_objection_response"):
            if speak is not True:
                print(f"  FAIL: {name} speak_during_execution should be True")
                passed = False

        # Check required parameters
        if name in EXPECTED_TOOLS:
            params = tool.get("parameters") if isinstance(tool, dict) else getattr(tool, "parameters", None)
            if params:
                required = params.get("required") if isinstance(params, dict) else getattr(params, "required", None)
                expected_required = EXPECTED_TOOLS[name]
                if required is None:
                    print(f"  FAIL: {name} has no required parameters defined")
                    passed = False
                elif set(required) != set(expected_required):
                    print(f"  FAIL: {name} required params {required} != expected {expected_required}")
                    passed = False
                else:
                    print(f"  PASS: {name} required params: {required}")
            else:
                print(f"  FAIL: {name} has no parameters defined")
                passed = False

    # Check all expected tools are present
    for expected_name in EXPECTED_TOOLS:
        if expected_name in tool_names:
            print(f"  PASS: Tool '{expected_name}' registered")
        else:
            print(f"  FAIL: Tool '{expected_name}' missing")
            passed = False

    return passed


def check_variables(llm) -> bool:
    """Check that dynamic variable defaults are configured."""
    passed = True
    variables = getattr(llm, "default_dynamic_variables", None) or {}

    # Handle both dict and object with attribute access
    if not isinstance(variables, dict):
        try:
            variables = dict(variables)
        except (TypeError, ValueError):
            variables = {}

    for var_name in EXPECTED_VARIABLES:
        if var_name in variables:
            print(f"  PASS: Variable '{var_name}' = '{variables[var_name]}'")
        else:
            print(f"  FAIL: Variable '{var_name}' not set")
            passed = False

    return passed


def check_model_and_begin(llm) -> bool:
    """Check model is gpt-4o-mini and begin_message uses lead_name."""
    passed = True

    model = getattr(llm, "model", None)
    if model == "gpt-4o-mini":
        print(f"  PASS: Model is '{model}'")
    else:
        print(f"  FAIL: Model is '{model}', expected 'gpt-4o-mini'")
        passed = False

    begin_msg = getattr(llm, "begin_message", None) or ""
    if "{{lead_name}}" in begin_msg:
        print(f"  PASS: begin_message contains '{{{{lead_name}}}}'")
    else:
        print(f"  FAIL: begin_message missing '{{{{lead_name}}}}': {begin_msg!r}")
        passed = False

    return passed


def main() -> None:
    """Run LLM verification checks."""
    parser = argparse.ArgumentParser(description="Verify Sarah's Retell LLM")
    parser.add_argument("--check-tools", action="store_true", help="Check tools only")
    parser.add_argument("--check-variables", action="store_true", help="Check variables only")
    parser.add_argument("--check-prompt-length", action="store_true", help="Check prompt length only")
    args = parser.parse_args()

    # Determine which checks to run (all if no flag specified)
    run_all = not (args.check_tools or args.check_variables or args.check_prompt_length)

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

    # Fetch LLM from Retell
    client = Retell(api_key=api_key)
    try:
        llm = client.llm.retrieve(llm_id)
    except Exception as e:
        print(f"ERROR: Could not retrieve LLM '{llm_id}': {e}")
        sys.exit(1)

    print(f"Retrieved LLM: {llm_id}")
    print()

    results: dict[str, bool] = {}

    # Check 1: Prompt length
    if run_all or args.check_prompt_length:
        print("[Check 1] Prompt Length")
        results["prompt_length"] = check_prompt_length(llm)
        print()

    # Check 2: Tools
    if run_all or args.check_tools:
        print("[Check 2] Tools")
        results["tools"] = check_tools(llm)
        print()

    # Check 3: Dynamic variables
    if run_all or args.check_variables:
        print("[Check 3] Dynamic Variables")
        results["variables"] = check_variables(llm)
        print()

    # Check 4: Model and begin message (full only)
    if run_all:
        print("[Check 4] Model & Begin Message")
        results["model_and_begin"] = check_model_and_begin(llm)
        print()

    # Summary
    print("=" * 60)
    all_passed = all(results.values())
    for check_name, passed in results.items():
        status = "PASS" if passed else "FAIL"
        print(f"  {status}: {check_name}")
    print("=" * 60)

    if all_passed:
        print("  ALL CHECKS PASSED")
        sys.exit(0)
    else:
        print("  SOME CHECKS FAILED")
        sys.exit(1)


if __name__ == "__main__":
    main()
