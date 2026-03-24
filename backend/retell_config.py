"""Retell AI SDK configuration — LLM, Agent, and Phone setup."""

import os

from dotenv import load_dotenv
from retell import Retell

load_dotenv()


def get_retell_client() -> Retell:
    """Create and return an authenticated Retell client."""
    api_key = os.environ["RETELL_API_KEY"]
    return Retell(api_key=api_key)


retell_client: Retell = get_retell_client()
