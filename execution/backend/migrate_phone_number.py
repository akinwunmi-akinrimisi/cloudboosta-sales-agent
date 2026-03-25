"""One-time migration: Update phone number +17404943597 to weighted agents format.

DEADLINE: March 31, 2026 -- deprecated fields stop working after this date.

Usage:
  python migrate_phone_number.py           # Run migration
  python migrate_phone_number.py --verify  # Check current config only

Requires: RETELL_API_KEY, RETELL_AGENT_ID in .env
"""

import sys
import os

from dotenv import load_dotenv

load_dotenv()

from retell_config import retell_client

PHONE_NUMBER = "+17404943597"


def verify_phone_number():
    """Fetch and display current phone number configuration."""
    print(f"\n--- Verifying phone number {PHONE_NUMBER} ---\n")
    try:
        phone = retell_client.phone_number.get(phone_number=PHONE_NUMBER)
        print(f"Phone number:    {phone.phone_number}")
        print(f"Outbound agents: {phone.outbound_agents}")
        print(f"Inbound agents:  {phone.inbound_agents}")
        return phone
    except Exception as e:
        _handle_api_error(e, context="verify")
        return None


def migrate_phone_number():
    """Update phone number to weighted agents format."""
    agent_id = os.environ.get("RETELL_AGENT_ID")
    if not agent_id:
        print("ERROR: RETELL_AGENT_ID environment variable is not set.")
        print("Set it in your .env file or export it before running this script.")
        print("  export RETELL_AGENT_ID=your_agent_id_here")
        sys.exit(1)

    print(f"\n--- Migrating phone number {PHONE_NUMBER} ---")
    print(f"Agent ID: {agent_id}")
    print(f"Weight:   1.0 (single agent)\n")

    try:
        result = retell_client.phone_number.update(
            phone_number=PHONE_NUMBER,
            outbound_agents=[{"agent_id": agent_id, "weight": 1.0}],
            inbound_agents=[{"agent_id": agent_id, "weight": 1.0}],
        )
        print("Migration successful!")
        print(f"Phone number:    {result.phone_number}")
        print(f"Outbound agents: {result.outbound_agents}")
        print(f"Inbound agents:  {result.inbound_agents}")
    except Exception as e:
        _handle_api_error(e, context="migrate")
        sys.exit(1)

    # Verify the migration by re-fetching
    print("\n--- Verification (re-fetch) ---")
    verify_phone_number()


def _handle_api_error(error, context="operation"):
    """Handle Retell API errors with helpful messages."""
    # Check for retell-specific API errors
    error_type = type(error).__name__

    if hasattr(error, "status_code"):
        status = error.status_code
        message = getattr(error, "message", str(error))
        print(f"API Error during {context} (HTTP {status}): {message}")

        if status == 404:
            print(f"\nPhone number {PHONE_NUMBER} not found.")
            print("Check that this number exists in your Retell dashboard:")
            print("  https://dashboard.retellai.com/phone-numbers")
        elif status == 401:
            print("\nAuthentication failed. Check your RETELL_API_KEY.")
        elif status == 400:
            print("\nBad request. The agent_id may be invalid.")
            print("Check your RETELL_AGENT_ID in the Retell dashboard.")
    else:
        print(f"Error during {context}: {error_type}: {error}")


if __name__ == "__main__":
    verify_only = "--verify" in sys.argv or "--verify-only" in sys.argv

    if verify_only:
        verify_phone_number()
    else:
        migrate_phone_number()
