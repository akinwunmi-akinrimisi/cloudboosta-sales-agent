#!/usr/bin/env python3
"""Verify Sarah's Retell voice agent configuration.

Checks: voice, backchannel, voicemail, phone binding, ambient sound.

Usage:
    cd execution/backend
    python scripts/verify_agent.py                 # Full verification
    python scripts/verify_agent.py --check-voice    # Voice only
    python scripts/verify_agent.py --check-backchannel  # Backchannel only
    python scripts/verify_agent.py --check-voicemail    # Voicemail only
    python scripts/verify_agent.py --check-phone        # Phone binding only
    python scripts/verify_agent.py --check-ambient      # Ambient sound only
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


def check_voice(agent) -> bool:
    """Check voice_id, language, and voice_speed."""
    passed = True

    voice_id = getattr(agent, "voice_id", None)
    if voice_id == "cartesia-Willa":
        print(f"  PASS: voice_id = '{voice_id}'")
    else:
        print(f"  FAIL: voice_id is '{voice_id}', expected 'cartesia-Willa'")
        passed = False

    language = getattr(agent, "language", None)
    if language == "en-GB":
        print(f"  PASS: language = '{language}'")
    else:
        print(f"  FAIL: language is '{language}', expected 'en-GB'")
        passed = False

    voice_speed = getattr(agent, "voice_speed", None)
    if voice_speed == 1.0:
        print(f"  PASS: voice_speed = {voice_speed}")
    else:
        print(f"  FAIL: voice_speed is {voice_speed}, expected 1.0")
        passed = False

    return passed


def check_backchannel(agent) -> bool:
    """Check backchannel is enabled with frequency 0.8."""
    passed = True

    enabled = getattr(agent, "enable_backchannel", None)
    if enabled is True:
        print("  PASS: backchannel enabled")
    else:
        print(f"  FAIL: enable_backchannel is {enabled}, expected True")
        passed = False

    frequency = getattr(agent, "backchannel_frequency", None)
    if frequency == 0.8:
        print(f"  PASS: backchannel_frequency = {frequency}")
    else:
        print(f"  FAIL: backchannel_frequency is {frequency}, expected 0.8")
        passed = False

    return passed


def check_voicemail(agent) -> bool:
    """Check voicemail_option has static_text action containing 'Cloudboosta'."""
    passed = True

    vm_option = getattr(agent, "voicemail_option", None)
    if vm_option is None:
        print("  FAIL: voicemail_option is not set")
        return False

    # Handle both dict and object access
    if isinstance(vm_option, dict):
        action = vm_option.get("action", {})
    else:
        action = getattr(vm_option, "action", None)
        if action and not isinstance(action, dict):
            # Convert object to dict-like access
            action = {
                "type": getattr(action, "type", None),
                "text": getattr(action, "text", None),
            }
        elif action is None:
            action = {}

    action_type = action.get("type") if isinstance(action, dict) else getattr(action, "type", None)
    if action_type == "static_text":
        print(f"  PASS: voicemail action type = '{action_type}'")
    else:
        print(f"  FAIL: voicemail action type is '{action_type}', expected 'static_text'")
        passed = False

    action_text = action.get("text") if isinstance(action, dict) else getattr(action, "text", None)
    if action_text and "Cloudboosta" in action_text:
        print(f"  PASS: voicemail text contains 'Cloudboosta'")
    else:
        print(f"  FAIL: voicemail text missing 'Cloudboosta': {action_text!r}")
        passed = False

    return passed


def check_phone(client, agent_id: str) -> bool:
    """Check phone number +17404943597 has agent as outbound and inbound agent.

    Supports retell-sdk 5.x (outbound_agent_id / inbound_agent_id).
    """
    passed = True

    phone_number = os.environ.get("RETELL_PHONE_NUMBER", "+17404943597")

    try:
        phone = client.phone_number.retrieve(phone_number)
    except Exception as e:
        print(f"  FAIL: Could not retrieve phone number '{phone_number}': {e}")
        return False

    # Check outbound agent (sdk 5.x: outbound_agent_id)
    outbound_id = getattr(phone, "outbound_agent_id", None)
    if outbound_id == agent_id:
        print(f"  PASS: outbound_agent_id = {agent_id} for {phone_number}")
    else:
        print(f"  FAIL: outbound_agent_id is '{outbound_id}', expected '{agent_id}' for {phone_number}")
        passed = False

    # Check inbound agent (sdk 5.x: inbound_agent_id)
    inbound_id = getattr(phone, "inbound_agent_id", None)
    if inbound_id == agent_id:
        print(f"  PASS: inbound_agent_id = {agent_id} for {phone_number}")
    else:
        print(f"  FAIL: inbound_agent_id is '{inbound_id}', expected '{agent_id}' for {phone_number}")
        passed = False

    return passed


def check_ambient(agent) -> bool:
    """Check ambient sound is call-center at volume 0.3."""
    passed = True

    ambient = getattr(agent, "ambient_sound", None)
    if ambient == "call-center":
        print(f"  PASS: ambient_sound = '{ambient}'")
    else:
        print(f"  FAIL: ambient_sound is '{ambient}', expected 'call-center'")
        passed = False

    volume = getattr(agent, "ambient_sound_volume", None)
    if volume == 0.3:
        print(f"  PASS: ambient_sound_volume = {volume}")
    else:
        print(f"  FAIL: ambient_sound_volume is {volume}, expected 0.3")
        passed = False

    return passed


def main() -> None:
    """Run agent verification checks."""
    parser = argparse.ArgumentParser(description="Verify Sarah's Retell voice agent")
    parser.add_argument("--check-voice", action="store_true", help="Check voice config only")
    parser.add_argument("--check-backchannel", action="store_true", help="Check backchannel only")
    parser.add_argument("--check-voicemail", action="store_true", help="Check voicemail only")
    parser.add_argument("--check-phone", action="store_true", help="Check phone binding only")
    parser.add_argument("--check-ambient", action="store_true", help="Check ambient sound only")
    args = parser.parse_args()

    # Determine which checks to run (all if no flag specified)
    run_all = not (
        args.check_voice
        or args.check_backchannel
        or args.check_voicemail
        or args.check_phone
        or args.check_ambient
    )

    # Load environment
    load_dotenv(BACKEND_DIR / ".env")
    load_dotenv(BACKEND_DIR.parent.parent / ".env")  # project root .env

    api_key = os.environ.get("RETELL_API_KEY")
    if not api_key:
        print("ERROR: RETELL_API_KEY not set in environment or .env")
        sys.exit(1)

    agent_id = os.environ.get("RETELL_AGENT_ID")
    if not agent_id:
        print("ERROR: RETELL_AGENT_ID not set in environment or .env")
        print("Run create_agent.py first, then add the returned ID to .env")
        sys.exit(1)

    # Fetch agent from Retell
    client = Retell(api_key=api_key)
    try:
        agent = client.agent.retrieve(agent_id)
    except Exception as e:
        print(f"ERROR: Could not retrieve agent '{agent_id}': {e}")
        sys.exit(1)

    print(f"Retrieved agent: {agent_id}")
    print(f"  Name: {getattr(agent, 'agent_name', 'unknown')}")
    print()

    results: dict[str, bool] = {}

    # Check 1: Voice
    if run_all or args.check_voice:
        print("[Check 1] Voice Configuration")
        results["voice"] = check_voice(agent)
        print()

    # Check 2: Backchannel
    if run_all or args.check_backchannel:
        print("[Check 2] Backchannel")
        results["backchannel"] = check_backchannel(agent)
        print()

    # Check 3: Voicemail
    if run_all or args.check_voicemail:
        print("[Check 3] Voicemail")
        results["voicemail"] = check_voicemail(agent)
        print()

    # Check 4: Phone binding
    if run_all or args.check_phone:
        print("[Check 4] Phone Number Binding")
        results["phone"] = check_phone(client, agent_id)
        print()

    # Check 5: Ambient sound
    if run_all or args.check_ambient:
        print("[Check 5] Ambient Sound")
        results["ambient"] = check_ambient(agent)
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
