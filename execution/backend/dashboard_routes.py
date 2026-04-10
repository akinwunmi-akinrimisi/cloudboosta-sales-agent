"""CRM Dashboard API Router.

All endpoints require Bearer token matching DASHBOARD_SECRET_KEY.
Organized by module: leads, outreach, calls, analytics, post-call, system.
"""

import logging
import os

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from slowapi import Limiter
from slowapi.util import get_remote_address
from typing import Optional

from supabase_client import supabase

logger = logging.getLogger("sarah.dashboard")

router = APIRouter(prefix="/api", tags=["dashboard-v2"])

# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------
DASHBOARD_SECRET_KEY = os.environ.get("DASHBOARD_SECRET_KEY", "")
bearer_scheme = HTTPBearer(auto_error=True)


async def verify_token(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> str:
    if not DASHBOARD_SECRET_KEY:
        raise HTTPException(status_code=500, detail="Server misconfigured")
    if credentials.credentials != DASHBOARD_SECRET_KEY:
        raise HTTPException(status_code=401, detail="Unauthorized")
    return credentials.credentials


# ---------------------------------------------------------------------------
# Rate limiter
# ---------------------------------------------------------------------------
limiter = Limiter(key_func=get_remote_address)


# ===================================================================
# MODULE 4: ANALYTICS
# ===================================================================

@router.get("/analytics/today")
@limiter.limit("30/minute")
async def analytics_today(request: Request, _t: str = Depends(verify_token)):
    """Today's overview stats from dashboard_today view."""
    result = supabase.table("dashboard_today").select("*").execute()
    if result.data:
        return result.data[0]
    return {
        "calls_today": 0, "commitments_today": 0, "follow_ups_today": 0,
        "declines_today": 0, "no_answers_today": 0, "avg_duration_sec": 0,
        "pickup_rate_pct": 0, "outreach_sent_today": 0, "bookings_today": 0,
    }


# ===================================================================
# MODULE 3: CALL OPERATIONS
# ===================================================================

@router.get("/calls/live")
@limiter.limit("60/minute")
async def calls_live(request: Request, _t: str = Depends(verify_token)):
    """Currently active call (if any)."""
    result = (
        supabase.table("leads")
        .select("id, name, first_name, last_name, phone, status, programme_recommended, last_strategy_used, last_call_at, detected_persona")
        .in_("status", ["calling", "in_call"])
        .limit(1)
        .execute()
    )
    return {"active_call": result.data[0] if result.data else None}


@router.get("/dialer/status")
@limiter.limit("30/minute")
async def dialer_status(request: Request, _t: str = Depends(verify_token)):
    """Auto-dialer current status."""
    next_lead_result = (
        supabase.table("leads")
        .select("id, name, phone, priority")
        .eq("status", "queued")
        .order("priority", desc=True)
        .order("created_at", desc=False)
        .limit(1)
        .execute()
    )
    next_lead = next_lead_result.data[0] if next_lead_result.data else None

    today_calls = (
        supabase.table("call_logs")
        .select("id", count="exact")
        .gte("started_at", "today")
        .execute()
    )

    schedule_result = (
        supabase.table("dial_schedules")
        .select("*")
        .eq("is_active", True)
        .limit(1)
        .execute()
    )
    schedule = schedule_result.data[0] if schedule_result.data else None

    return {
        "running": False,
        "schedule": schedule,
        "next_lead": next_lead,
        "calls_today": today_calls.count or 0,
        "calls_remaining": 200 - (today_calls.count or 0),
    }


@router.get("/calls")
@limiter.limit("20/minute")
async def calls_list(
    request: Request,
    _t: str = Depends(verify_token),
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    outcome: Optional[str] = None,
    strategy: Optional[str] = None,
    lead_id: Optional[str] = None,
    sort_by: str = Query("started_at"),
    sort_order: str = Query("desc"),
):
    """Paginated call history."""
    query = supabase.table("call_logs").select(
        "id, lead_id, retell_call_id, started_at, ended_at, duration_seconds, "
        "outcome, closing_strategy_used, detected_persona, summary, recording_url, "
        "from_number, to_number",
        count="exact",
    )
    if outcome:
        query = query.eq("outcome", outcome)
    if strategy:
        query = query.eq("closing_strategy_used", strategy)
    if lead_id:
        query = query.eq("lead_id", lead_id)

    desc = sort_order == "desc"
    query = query.order(sort_by, desc=desc)
    offset = (page - 1) * per_page
    query = query.range(offset, offset + per_page - 1)
    result = query.execute()

    return {
        "calls": result.data or [],
        "total": result.count or 0,
        "page": page,
        "per_page": per_page,
    }


@router.get("/calls/{call_id}")
@limiter.limit("30/minute")
async def call_detail(request: Request, call_id: str, _t: str = Depends(verify_token)):
    """Full call record with transcript."""
    result = (
        supabase.table("call_logs")
        .select("*")
        .eq("id", call_id)
        .limit(1)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Call not found")
    return result.data[0]


# ===================================================================
# MODULE 6: SYSTEM
# ===================================================================

@router.get("/health/services")
@limiter.limit("10/minute")
async def health_services(request: Request, _t: str = Depends(verify_token)):
    """Check connectivity to all external services."""
    import httpx

    checks = {}

    # Supabase
    try:
        supabase.table("leads").select("id").limit(1).execute()
        checks["supabase"] = "up"
    except Exception:
        checks["supabase"] = "down"

    # Retell
    try:
        from retell_config import retell_client
        retell_client.agent.list()
        checks["retell"] = "up"
    except Exception:
        checks["retell"] = "down"

    # n8n
    n8n_base = os.environ.get("N8N_WEBHOOK_BASE", "")
    if n8n_base:
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                r = await client.get(n8n_base.rstrip("/").replace("/webhook", "") + "/healthz")
                checks["n8n"] = "up" if r.status_code < 500 else "down"
        except Exception:
            checks["n8n"] = "down"
    else:
        checks["n8n"] = "unknown"

    # OpenClaw
    openclaw_url = os.environ.get("OPENCLAW_API_URL", "")
    if openclaw_url:
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                r = await client.get(openclaw_url.rstrip("/") + "/instance/connectionState",
                                     headers={"apikey": os.environ.get("OPENCLAW_API_KEY", "")})
                checks["openclaw"] = "up" if r.status_code == 200 else "down"
        except Exception:
            checks["openclaw"] = "down"
    else:
        checks["openclaw"] = "unknown"

    # Cal.com
    cal_url = os.environ.get("CAL_COM_URL", "")
    if cal_url:
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                r = await client.get(cal_url.rstrip("/") + "/api/v1/me",
                                     headers={"Authorization": f"Bearer {os.environ.get('CAL_COM_API_KEY', '')}"})
                checks["calcom"] = "up" if r.status_code == 200 else "down"
        except Exception:
            checks["calcom"] = "down"
    else:
        checks["calcom"] = "unknown"

    return checks


@router.post("/auth/login")
async def auth_login(request: Request):
    """Validate dashboard token."""
    body = await request.json()
    token = body.get("token", "")
    if not DASHBOARD_SECRET_KEY:
        raise HTTPException(status_code=500, detail="Server misconfigured")
    if token != DASHBOARD_SECRET_KEY:
        raise HTTPException(status_code=401, detail="Invalid token")
    return {"authenticated": True}
