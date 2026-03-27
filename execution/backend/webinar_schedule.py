"""Parse webinar-schedule.md and provide webinar context for call routing.

Reads the structured markdown file, extracts dates/topics/summaries,
and determines what call type a lead should receive based on their
state and the webinar schedule.
"""

import os
import re
import logging
from datetime import date, datetime, timedelta
from typing import Optional

logger = logging.getLogger(__name__)

SCHEDULE_PATH = os.environ.get(
    "WEBINAR_SCHEDULE_PATH",
    os.path.join(os.path.dirname(__file__), "knowledge-base", "webinar-schedule.md"),
)


def _parse_schedule(path: str = SCHEDULE_PATH) -> list[dict]:
    """Parse webinar-schedule.md into a list of webinar dicts.

    Each dict has: date (date), date_iso (str), topic (str), summary (str).
    """
    if not os.path.isfile(path):
        logger.warning("Webinar schedule not found: %s", path)
        return []

    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    webinars = []
    pattern = re.compile(
        r"^## (\d{4}-\d{2}-\d{2}) \| (.+)$", re.MULTILINE
    )

    matches = list(pattern.finditer(content))
    for i, match in enumerate(matches):
        date_str = match.group(1)
        topic = match.group(2).strip()

        start = match.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(content)
        section = content[start:end].strip()

        summary_lines = []
        in_summary = False
        for line in section.split("\n"):
            if "Summary for Sarah" in line:
                in_summary = True
                continue
            if in_summary and line.strip().startswith("- "):
                summary_lines.append(line.strip()[2:])

        webinars.append({
            "date": datetime.strptime(date_str, "%Y-%m-%d").date(),
            "date_iso": date_str,
            "topic": topic,
            "summary": "\n".join(summary_lines),
        })

    return webinars


def get_next_webinar(today: Optional[date] = None) -> Optional[dict]:
    """Return the next upcoming webinar (today or later), or None."""
    if today is None:
        today = date.today()
    webinars = _parse_schedule()
    upcoming = [w for w in webinars if w["date"] >= today]
    return upcoming[0] if upcoming else None


def get_webinar_by_date(date_iso: str) -> Optional[dict]:
    """Return a specific webinar by ISO date string."""
    webinars = _parse_schedule()
    for w in webinars:
        if w["date_iso"] == date_iso:
            return w
    return None


def determine_call_type(
    lead: dict,
    today: Optional[date] = None,
) -> dict:
    """Determine what call type to make and return full context.

    Returns dict with:
        call_type: "invite" | "reminder" | "follow_up" | "direct_sell"
        webinar: dict or None (the relevant webinar)
        is_returning: bool (lead has been called before)
    """
    if today is None:
        today = date.today()

    webinars_invited = lead.get("webinars_invited") or []
    next_call_type = lead.get("next_call_type")
    call_count = lead.get("call_count") or 0
    is_returning = call_count > 0 or len(webinars_invited) > 0

    # If explicitly scheduled for a call type, honor it
    if next_call_type == "reminder":
        if webinars_invited:
            webinar = get_webinar_by_date(webinars_invited[-1])
            return {"call_type": "reminder", "webinar": webinar, "is_returning": is_returning}

    if next_call_type == "follow_up":
        if webinars_invited:
            webinar = get_webinar_by_date(webinars_invited[-1])
            return {"call_type": "follow_up", "webinar": webinar, "is_returning": is_returning}

    if next_call_type == "direct_sell":
        return {"call_type": "direct_sell", "webinar": None, "is_returning": is_returning}

    # Auto-determine: is there an upcoming webinar?
    next_webinar = get_next_webinar(today)
    if next_webinar:
        if next_webinar["date_iso"] in webinars_invited:
            if next_webinar["date"] < today:
                return {"call_type": "follow_up", "webinar": next_webinar, "is_returning": is_returning}
            elif next_webinar["date"] == today:
                return {"call_type": "reminder", "webinar": next_webinar, "is_returning": is_returning}
            else:
                all_webinars = _parse_schedule()
                upcoming = [w for w in all_webinars if w["date"] >= today and w["date_iso"] not in webinars_invited]
                if upcoming:
                    return {"call_type": "invite", "webinar": upcoming[0], "is_returning": is_returning}
                else:
                    return {"call_type": "direct_sell", "webinar": None, "is_returning": is_returning}
        else:
            return {"call_type": "invite", "webinar": next_webinar, "is_returning": is_returning}
    else:
        return {"call_type": "direct_sell", "webinar": None, "is_returning": is_returning}
