"""Auto-dialer scheduler logic.

Controls the scheduled outbound calling loop:
- Checks dial windows
- Picks next lead from queue
- Rate-limits calls
- Delegates call initiation to Retell
"""

import logging
from datetime import datetime, time, timedelta

import pytz

from supabase_client import supabase

logger = logging.getLogger(__name__)

MIN_CALL_INTERVAL_SECONDS = 120  # 1 call per 2 minutes
MAX_CONCURRENT_CALLS = 1
MAX_DAILY_CALLS = 200


async def should_dial_now() -> bool:
    """Check if current time is within an active dial schedule."""
    schedules = (
        supabase.table("dial_schedules")
        .select("*")
        .eq("is_active", True)
        .execute()
    )
    if not schedules.data:
        return False

    for s in schedules.data:
        tz = pytz.timezone(s.get("timezone", "Africa/Lagos"))
        now = datetime.now(tz)
        current_time = now.time()
        current_dow = now.isoweekday()

        start = time.fromisoformat(s["start_time"])
        end = time.fromisoformat(s["end_time"])

        if start <= current_time <= end and current_dow in s.get("days_of_week", []):
            return True

    return False


async def get_next_lead() -> dict | None:
    """Get the next queued lead ordered by priority then creation date."""
    result = (
        supabase.table("leads")
        .select("*")
        .eq("status", "queued")
        .order("priority", desc=True)
        .order("created_at")
        .limit(1)
        .execute()
    )
    return result.data[0] if result.data else None


async def is_call_active() -> bool:
    """Check if there is already a call in progress."""
    result = (
        supabase.table("leads")
        .select("id")
        .in_("status", ["calling", "in_call"])
        .limit(1)
        .execute()
    )
    return len(result.data) > 0


async def can_dial_next() -> bool:
    """Check if enough time has passed since the last call."""
    last = (
        supabase.table("call_logs")
        .select("started_at")
        .order("started_at", desc=True)
        .limit(1)
        .execute()
    )
    if not last.data:
        return True

    from dateutil.parser import parse as parse_dt

    elapsed = (datetime.utcnow() - parse_dt(last.data[0]["started_at"]).replace(tzinfo=None)).total_seconds()
    return elapsed >= MIN_CALL_INTERVAL_SECONDS


async def check_daily_limit() -> bool:
    """Check if daily call limit has been reached."""
    today = datetime.utcnow().date().isoformat()
    result = (
        supabase.table("call_logs")
        .select("id", count="exact")
        .gte("started_at", today)
        .execute()
    )
    return (result.count or 0) < MAX_DAILY_CALLS
