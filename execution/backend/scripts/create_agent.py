#!/usr/bin/env python3
"""Create Sarah's Retell voice agent with voice, backchannel, and voicemail config.

Run once to create the agent. Store the returned agent_id in .env as RETELL_AGENT_ID.
Then run migrate_phone_number.py to assign the phone number.

Usage:
    cd execution/backend
    python scripts/create_agent.py
"""

import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from retell import Retell

# Resolve paths relative to this script's location
SCRIPT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = SCRIPT_DIR.parent


def main() -> None:
    """Create Sarah's voice agent on the Retell platform."""
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
        print("Set it to your public backend URL (e.g. https://your-endpoint.com)")
        sys.exit(1)

    print(f"Using LLM: {llm_id}")
    print(f"Webhook base: {webhook_base_url}")

    client = Retell(api_key=api_key)

    try:
        agent = client.agent.create(
            agent_name="Sarah - Cloudboosta Sales Agent",
            response_engine={"type": "retell-llm", "llm_id": llm_id},
            # Voice configuration (LOCKED: cartesia-Willa, en-GB)
            voice_id="cartesia-Willa",
            voice_model="sonic-3",
            voice_speed=1.0,
            voice_temperature=0.8,
            language="en-GB",
            # Backchannel (LOCKED: enabled, 0.8)
            enable_backchannel=True,
            backchannel_frequency=0.8,
            backchannel_words=["yeah", "uh-huh", "I see", "right", "absolutely"],
            # Responsiveness (LOCKED: responsive ~0.5s)
            responsiveness=0.7,
            interruption_sensitivity=0.8,
            # Silence tolerance (LOCKED: 3-5s)
            reminder_trigger_ms=4000,
            reminder_max_count=2,
            end_call_after_silence_ms=30000,
            # Ambient sound (LOCKED: call-center, subtle)
            ambient_sound="call-center",
            ambient_sound_volume=0.3,
            # Voicemail (LOCKED: static_text every attempt)
            voicemail_detection_timeout_ms=30000,
            voicemail_option={
                "action": {
                    "type": "static_text",
                    "text": (
                        "Hi, this is Sarah from Cloudboosta. I was reaching out "
                        "about our Cloud DevOps training programme. I'll try you "
                        "again soon. No need to call back. Have a lovely day."
                    ),
                }
            },
            # Webhook
            webhook_url=webhook_base_url.rstrip("/") + "/retell/webhook",
            webhook_events=["call_started", "call_ended", "call_analyzed"],
            # Audio processing
            denoising_mode="noise-cancellation",
            normalize_for_speech=True,
            boosted_keywords=["Cloudboosta", "DevOps", "cloud computing", "Sarah"],
        )
    except Exception as e:
        print(f"ERROR: Agent creation failed: {e}")
        sys.exit(1)

    agent_id = agent.agent_id
    print()
    print("=" * 60)
    print("  AGENT CREATED SUCCESSFULLY")
    print("=" * 60)
    print(f"  Agent ID: {agent_id}")
    print(f"  Name: Sarah - Cloudboosta Sales Agent")
    print(f"  Voice: cartesia-Willa (en-GB)")
    print(f"  LLM: {llm_id}")
    print()
    print("  Add to .env:")
    print(f"  RETELL_AGENT_ID={agent_id}")
    print()
    print("  Next steps:")
    print("  1. Add RETELL_AGENT_ID to .env")
    print("  2. Run: python migrate_phone_number.py")
    print("  3. Run: python scripts/verify_agent.py")
    print("=" * 60)


if __name__ == "__main__":
    main()
