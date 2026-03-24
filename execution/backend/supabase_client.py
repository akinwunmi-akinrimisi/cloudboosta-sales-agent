"""Supabase connection and query helpers."""

import os

from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()


def get_supabase() -> Client:
    """Create and return a Supabase client using the service key."""
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_KEY"]
    return create_client(url, key)


supabase: Client = get_supabase()
