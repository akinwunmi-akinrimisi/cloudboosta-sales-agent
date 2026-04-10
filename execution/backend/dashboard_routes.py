"""CRM Dashboard API Router.

All endpoints require Bearer token matching DASHBOARD_SECRET_KEY.
Organized by module: leads, outreach, calls, analytics, post-call, system.
"""

import csv
import io
import logging
import os
import re
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile
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
# MODULE 1: LEAD MANAGEMENT
# ===================================================================

@router.get("/leads")
@limiter.limit("30/minute")
async def leads_list(
    request: Request,
    _t: str = Depends(verify_token),
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    status: Optional[str] = None,
    search: Optional[str] = None,
    has_email: Optional[bool] = None,
    has_whatsapp: Optional[bool] = None,
    sort_by: str = Query("created_at"),
    sort_order: str = Query("desc"),
):
    """Paginated lead list with search and filters."""
    query = supabase.table("leads").select(
        "id, name, first_name, last_name, phone, email, status, has_email, has_whatsapp, "
        "timezone, detected_persona, programme_recommended, last_call_at, source, created_at",
        count="exact",
    )
    if status:
        query = query.eq("status", status)
    if search:
        query = query.or_(f"name.ilike.%{search}%,phone.ilike.%{search}%,email.ilike.%{search}%")
    if has_email is not None:
        query = query.eq("has_email", has_email)
    if has_whatsapp is not None:
        query = query.eq("has_whatsapp", has_whatsapp)

    desc = sort_order == "desc"
    query = query.order(sort_by, desc=desc)
    offset = (page - 1) * per_page
    query = query.range(offset, offset + per_page - 1)
    result = query.execute()

    return {
        "leads": result.data or [],
        "total": result.count or 0,
        "page": page,
        "per_page": per_page,
    }


@router.get("/leads/by-status")
@limiter.limit("20/minute")
async def leads_by_status(request: Request, _t: str = Depends(verify_token)):
    """Lead counts by status for pipeline kanban."""
    result = supabase.table("leads_by_status").select("*").execute()
    return {"statuses": result.data or []}


@router.get("/leads/blocked")
@limiter.limit("20/minute")
async def leads_blocked(request: Request, _t: str = Depends(verify_token)):
    """All leads with do_not_contact status."""
    result = (
        supabase.table("leads")
        .select("id, name, first_name, last_name, phone, email, updated_at, notes")
        .eq("status", "do_not_contact")
        .order("updated_at", desc=True)
        .execute()
    )
    return {"leads": result.data or []}


@router.get("/leads/follow-ups")
@limiter.limit("20/minute")
async def leads_follow_ups(request: Request, _t: str = Depends(verify_token)):
    """Follow-up queue from follow_up_queue view."""
    result = supabase.table("follow_up_queue").select("*").execute()
    return {"follow_ups": result.data or []}


@router.get("/leads/retries")
@limiter.limit("20/minute")
async def leads_retries(request: Request, _t: str = Depends(verify_token)):
    """Retry queue from retry_queue view."""
    result = supabase.table("retry_queue").select("*").execute()
    return {"retries": result.data or []}


@router.get("/leads/enrolled")
@limiter.limit("20/minute")
async def leads_enrolled(request: Request, _t: str = Depends(verify_token)):
    """All enrolled leads with payment details."""
    result = (
        supabase.table("leads")
        .select("id, name, first_name, last_name, phone, email, programme_recommended, notes, updated_at")
        .eq("status", "enrolled")
        .order("updated_at", desc=True)
        .execute()
    )
    return {"leads": result.data or []}


@router.get("/leads/{lead_id}")
@limiter.limit("60/minute")
async def lead_detail(request: Request, lead_id: str, _t: str = Depends(verify_token)):
    """Full lead record with call history and pipeline logs."""
    lead_result = (
        supabase.table("leads")
        .select("*")
        .eq("id", lead_id)
        .limit(1)
        .execute()
    )
    if not lead_result.data:
        raise HTTPException(status_code=404, detail="Lead not found")

    calls_result = (
        supabase.table("call_logs")
        .select("*")
        .eq("lead_id", lead_id)
        .order("started_at", desc=True)
        .execute()
    )

    pipeline_result = (
        supabase.table("pipeline_logs")
        .select("*")
        .eq("lead_id", lead_id)
        .order("created_at", desc=True)
        .execute()
    )

    return {
        "lead": lead_result.data[0],
        "calls": calls_result.data or [],
        "pipeline_logs": pipeline_result.data or [],
    }


@router.post("/leads/import")
@limiter.limit("5/minute")
async def leads_import(request: Request, file: UploadFile = File(...), _t: str = Depends(verify_token)):
    """Import leads from CSV file."""
    if not file.filename.endswith((".csv", ".CSV")):
        raise HTTPException(status_code=400, detail="Only CSV files accepted")

    content = await file.read()
    text = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))

    imported = 0
    duplicates = 0
    errors = []
    phone_pattern = re.compile(r'^\+[1-9]\d{6,14}$')

    for i, row in enumerate(reader, start=2):
        name = (row.get("name") or row.get("Name") or "").strip()
        phone = (row.get("phone") or row.get("Phone") or "").strip()
        email = (row.get("email") or row.get("Email") or "").strip() or None

        if not phone:
            errors.append({"row": i, "error": "Missing phone number"})
            continue

        if not phone_pattern.match(phone):
            errors.append({"row": i, "error": f"Invalid phone format: {phone}"})
            continue

        first_name = name.split(" ")[0] if name else ""
        last_name = " ".join(name.split(" ")[1:]) if " " in name else ""

        try:
            supabase.table("leads").insert({
                "name": name or first_name,
                "first_name": first_name,
                "last_name": last_name,
                "phone": phone,
                "email": email,
                "has_email": bool(email),
                "source": "csv_import",
            }).execute()
            imported += 1
        except Exception as e:
            err_str = str(e)
            if "duplicate" in err_str.lower() or "unique" in err_str.lower():
                duplicates += 1
            else:
                errors.append({"row": i, "error": err_str[:200]})

    return {
        "imported": imported,
        "duplicates": duplicates,
        "errors": len(errors),
        "error_details": errors[:50],
    }


@router.post("/leads/{lead_id}/block")
@limiter.limit("10/minute")
async def lead_block(request: Request, lead_id: str, _t: str = Depends(verify_token)):
    """Set lead status to do_not_contact."""
    body = await request.json()
    reason = body.get("reason", "Blocked from dashboard")

    lead = supabase.table("leads").select("id, status").eq("id", lead_id).limit(1).execute()
    if not lead.data:
        raise HTTPException(status_code=404, detail="Lead not found")

    supabase.table("leads").update({
        "status": "do_not_contact",
        "notes": reason,
    }).eq("id", lead_id).execute()

    return {"status": "blocked"}


@router.post("/leads/{lead_id}/unblock")
@limiter.limit("5/minute")
async def lead_unblock(request: Request, lead_id: str, _t: str = Depends(verify_token)):
    """Remove do_not_contact status, set to new."""
    lead = supabase.table("leads").select("id, status").eq("id", lead_id).limit(1).execute()
    if not lead.data:
        raise HTTPException(status_code=404, detail="Lead not found")
    if lead.data[0]["status"] != "do_not_contact":
        raise HTTPException(status_code=400, detail="Lead is not blocked")

    supabase.table("leads").update({"status": "new"}).eq("id", lead_id).execute()
    return {"status": "unblocked"}


# ===================================================================
# MODULE 2: OUTREACH MANAGEMENT
# ===================================================================

@router.get("/outreach/queue")
@limiter.limit("20/minute")
async def outreach_queue(request: Request, _t: str = Depends(verify_token)):
    """Leads pending outreach, grouped by channel capability."""
    result = (
        supabase.table("leads")
        .select("id, name, first_name, last_name, phone, email, has_email, has_whatsapp, status")
        .eq("status", "enriched")
        .order("created_at", desc=False)
        .execute()
    )
    leads = result.data or []

    both = [l for l in leads if l.get("has_email") and l.get("has_whatsapp")]
    email_only = [l for l in leads if l.get("has_email") and not l.get("has_whatsapp")]
    whatsapp_only = [l for l in leads if l.get("has_whatsapp") and not l.get("has_email")]

    return {
        "total": len(leads),
        "groups": {
            "email_and_whatsapp": {"count": len(both), "leads": both},
            "email_only": {"count": len(email_only), "leads": email_only},
            "whatsapp_only": {"count": len(whatsapp_only), "leads": whatsapp_only},
        },
    }


@router.get("/outreach/log")
@limiter.limit("20/minute")
async def outreach_log(
    request: Request,
    _t: str = Depends(verify_token),
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    channel: Optional[str] = None,
    lead_id: Optional[str] = None,
):
    """Outreach delivery log from outreach_log view."""
    query = supabase.table("outreach_log").select("*", count="exact")
    if channel:
        query = query.eq("channel", channel)
    if lead_id:
        query = query.eq("lead_id", lead_id)
    query = query.order("created_at", desc=True)
    offset = (page - 1) * per_page
    query = query.range(offset, offset + per_page - 1)
    result = query.execute()
    return {
        "logs": result.data or [],
        "total": result.count or 0,
        "page": page,
        "per_page": per_page,
    }


@router.get("/outreach/replies")
@limiter.limit("30/minute")
async def outreach_replies(request: Request, _t: str = Depends(verify_token)):
    """Recent WhatsApp replies with parsed datetime."""
    result = (
        supabase.table("pipeline_logs")
        .select("lead_id, details, created_at")
        .ilike("event", "%reply%")
        .order("created_at", desc=True)
        .limit(50)
        .execute()
    )
    logs = result.data or []

    # Enrich with lead names
    lead_ids = list(set(l["lead_id"] for l in logs if l.get("lead_id")))
    lead_map = {}
    if lead_ids:
        names_result = (
            supabase.table("leads")
            .select("id, name, phone")
            .in_("id", lead_ids)
            .execute()
        )
        for row in (names_result.data or []):
            lead_map[row["id"]] = row

    replies = []
    for log in logs:
        lead = lead_map.get(log.get("lead_id"), {})
        details = log.get("details") or {}
        replies.append({
            "lead_id": log.get("lead_id"),
            "lead_name": lead.get("name", "Unknown"),
            "lead_phone": lead.get("phone", ""),
            "message": details.get("message", ""),
            "parsed_datetime": details.get("parsed_datetime"),
            "confidence": details.get("confidence", "none"),
            "created_at": log.get("created_at"),
        })

    return {"replies": replies}


@router.get("/outreach/timeout")
@limiter.limit("20/minute")
async def outreach_timeout(request: Request, _t: str = Depends(verify_token)):
    """Leads where outreach sent >48h ago with no response."""
    from datetime import datetime, timedelta, timezone
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=48)).isoformat()

    result = (
        supabase.table("leads")
        .select("id, name, first_name, last_name, phone, email, status, updated_at")
        .eq("status", "outreach_sent")
        .lt("updated_at", cutoff)
        .order("updated_at", desc=False)
        .execute()
    )
    return {"leads": result.data or [], "count": len(result.data or [])}


@router.get("/bookings")
@limiter.limit("20/minute")
async def bookings_list(request: Request, _t: str = Depends(verify_token)):
    """Cal.com bookings matched to leads."""
    result = (
        supabase.table("leads")
        .select("id, name, first_name, last_name, phone, email, status, call_scheduled_at")
        .eq("status", "call_scheduled")
        .order("call_scheduled_at", desc=False)
        .execute()
    )
    return {"bookings": result.data or []}


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


@router.get("/analytics/strategies")
@limiter.limit("10/minute")
async def analytics_strategies(request: Request, _t: str = Depends(verify_token)):
    """Strategy performance from strategy_performance view."""
    result = supabase.table("strategy_performance").select("*").execute()
    return {"strategies": result.data or []}


@router.get("/analytics/heatmap")
@limiter.limit("10/minute")
async def analytics_heatmap(request: Request, _t: str = Depends(verify_token)):
    """Strategy x persona heatmap from strategy_persona_heatmap view."""
    result = supabase.table("strategy_persona_heatmap").select("*").execute()
    return {"cells": result.data or []}


@router.get("/analytics/trends")
@limiter.limit("10/minute")
async def analytics_trends(request: Request, _t: str = Depends(verify_token)):
    """Daily trends (last 30 days) from daily_trends view."""
    result = supabase.table("daily_trends").select("*").execute()
    return {"trends": result.data or []}


@router.get("/analytics/objections")
@limiter.limit("10/minute")
async def analytics_objections(request: Request, _t: str = Depends(verify_token)):
    """Objection frequency from objection_frequency view."""
    result = supabase.table("objection_frequency").select("*").execute()
    return {"objections": result.data or []}


@router.get("/analytics/funnel")
@limiter.limit("10/minute")
async def analytics_funnel(request: Request, _t: str = Depends(verify_token)):
    """Full funnel conversion from funnel_conversion view."""
    result = supabase.table("funnel_conversion").select("*").execute()
    if result.data:
        return result.data[0]
    return {
        "total_imported": 0, "enriched": 0, "outreach_sent": 0,
        "responded": 0, "booked_or_called": 0, "calls_completed": 0,
        "committed": 0, "enrolled": 0,
    }


@router.get("/analytics/revenue")
@limiter.limit("10/minute")
async def analytics_revenue(request: Request, _t: str = Depends(verify_token)):
    """Revenue tracking — potential vs confirmed."""
    # Committed leads (potential revenue)
    committed_result = (
        supabase.table("leads")
        .select("id, programme_recommended")
        .in_("status", ["committed", "payment_pending"])
        .execute()
    )
    # Enrolled leads (confirmed revenue)
    enrolled_result = (
        supabase.table("leads")
        .select("id, programme_recommended")
        .eq("status", "enrolled")
        .execute()
    )

    # Simple revenue estimate: count * average programme price
    # In production this would join with pricing table
    committed_count = len(committed_result.data or [])
    enrolled_count = len(enrolled_result.data or [])

    return {
        "potential": {"count": committed_count, "estimated_revenue": committed_count * 2500},
        "confirmed": {"count": enrolled_count, "estimated_revenue": enrolled_count * 2500},
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


@router.get("/calls/transfers")
@limiter.limit("10/minute")
async def calls_transfers(request: Request, _t: str = Depends(verify_token)):
    """Calls where warm transfer was executed."""
    result = (
        supabase.table("call_logs")
        .select("id, lead_id, started_at, duration_seconds, outcome, closing_strategy_used, summary")
        .ilike("summary", "%transfer%")
        .order("started_at", desc=True)
        .limit(50)
        .execute()
    )
    return {"transfers": result.data or []}


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
# MODULE 5: POST-CALL
# ===================================================================

@router.get("/post-call/emails")
@limiter.limit("20/minute")
async def post_call_emails(request: Request, _t: str = Depends(verify_token)):
    """Payment emails sent, per lead."""
    result = (
        supabase.table("pipeline_logs")
        .select("lead_id, details, created_at, status")
        .ilike("event", "%email%payment%")
        .order("created_at", desc=True)
        .execute()
    )
    logs = result.data or []

    # Enrich with lead names
    lead_ids = list(set(l["lead_id"] for l in logs if l.get("lead_id")))
    lead_map = {}
    if lead_ids:
        names_result = (
            supabase.table("leads")
            .select("id, name, email, programme_recommended")
            .in_("id", lead_ids)
            .execute()
        )
        for row in (names_result.data or []):
            lead_map[row["id"]] = row

    emails = []
    for log in logs:
        lead = lead_map.get(log.get("lead_id"), {})
        details = log.get("details") or {}
        emails.append({
            "lead_id": log.get("lead_id"),
            "lead_name": lead.get("name", "Unknown"),
            "lead_email": lead.get("email", ""),
            "programme": lead.get("programme_recommended", ""),
            "sent_at": log.get("created_at"),
            "delivery_status": details.get("delivery_status", "sent"),
            "status": log.get("status", "success"),
        })

    return {"emails": emails}


@router.get("/post-call/whatsapp")
@limiter.limit("20/minute")
async def post_call_whatsapp(request: Request, _t: str = Depends(verify_token)):
    """Post-call WhatsApp messages sent."""
    result = (
        supabase.table("pipeline_logs")
        .select("lead_id, details, created_at, status")
        .ilike("event", "%whatsapp%post%")
        .order("created_at", desc=True)
        .execute()
    )
    logs = result.data or []

    lead_ids = list(set(l["lead_id"] for l in logs if l.get("lead_id")))
    lead_map = {}
    if lead_ids:
        names_result = (
            supabase.table("leads")
            .select("id, name, phone")
            .in_("id", lead_ids)
            .execute()
        )
        for row in (names_result.data or []):
            lead_map[row["id"]] = row

    messages = []
    for log in logs:
        lead = lead_map.get(log.get("lead_id"), {})
        details = log.get("details") or {}
        messages.append({
            "lead_id": log.get("lead_id"),
            "lead_name": lead.get("name", "Unknown"),
            "lead_phone": lead.get("phone", ""),
            "sent_at": log.get("created_at"),
            "delivery_status": details.get("delivery_status", "sent"),
            "message_preview": (details.get("message", ""))[:100],
        })

    return {"messages": messages}


@router.put("/leads/{lead_id}/payment")
@limiter.limit("10/minute")
async def lead_payment(request: Request, lead_id: str, _t: str = Depends(verify_token)):
    """Mark lead as paid and move to enrolled."""
    body = await request.json()
    amount = body.get("amount")
    currency = body.get("currency", "GBP")
    payment_date = body.get("payment_date")
    notes = body.get("notes", "")

    lead = supabase.table("leads").select("id, status").eq("id", lead_id).limit(1).execute()
    if not lead.data:
        raise HTTPException(status_code=404, detail="Lead not found")

    current_status = lead.data[0]["status"]
    if current_status not in ("committed", "payment_pending"):
        raise HTTPException(status_code=400, detail=f"Lead status is {current_status}, expected committed or payment_pending")

    # Move to payment_pending first if needed, then to enrolled
    if current_status == "committed":
        supabase.table("leads").update({"status": "payment_pending"}).eq("id", lead_id).execute()

    supabase.table("leads").update({
        "status": "enrolled",
        "notes": f"Payment: {amount} {currency} on {payment_date}. {notes}".strip(),
    }).eq("id", lead_id).execute()

    # Log the payment event
    supabase.table("pipeline_logs").insert({
        "lead_id": lead_id,
        "component": "dashboard",
        "event": "payment_received",
        "details": {
            "amount": amount,
            "currency": currency,
            "payment_date": payment_date,
            "notes": notes,
        },
    }).execute()

    return {"status": "enrolled", "lead_id": lead_id}


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


@router.get("/pipeline/log")
@limiter.limit("20/minute")
async def pipeline_log(
    request: Request,
    _t: str = Depends(verify_token),
    page: int = Query(1, ge=1),
    per_page: int = Query(25, ge=1, le=100),
    component: Optional[str] = None,
    event: Optional[str] = None,
    lead_id: Optional[str] = None,
):
    """Paginated pipeline activity log."""
    query = supabase.table("pipeline_logs").select("*", count="exact")
    if component:
        query = query.eq("component", component)
    if event:
        query = query.ilike("event", f"%{event}%")
    if lead_id:
        query = query.eq("lead_id", lead_id)
    query = query.order("created_at", desc=True)
    offset = (page - 1) * per_page
    query = query.range(offset, offset + per_page - 1)
    result = query.execute()

    # Enrich with lead names
    logs = result.data or []
    lead_ids = list(set(l["lead_id"] for l in logs if l.get("lead_id")))
    lead_map = {}
    if lead_ids:
        names_result = supabase.table("leads").select("id, name").in_("id", lead_ids).execute()
        for row in (names_result.data or []):
            lead_map[row["id"]] = row.get("name", "Unknown")

    for log in logs:
        log["lead_name"] = lead_map.get(log.get("lead_id"), None)

    return {"logs": logs, "total": result.count or 0, "page": page, "per_page": per_page}


@router.get("/errors")
@limiter.limit("20/minute")
async def errors_list(request: Request, _t: str = Depends(verify_token)):
    """Error log — pipeline_logs where status='error'."""
    result = (
        supabase.table("pipeline_logs")
        .select("*", count="exact")
        .eq("status", "error")
        .order("created_at", desc=True)
        .limit(100)
        .execute()
    )
    logs = result.data or []

    # Enrich with lead names
    lead_ids = list(set(l["lead_id"] for l in logs if l.get("lead_id")))
    lead_map = {}
    if lead_ids:
        names_result = supabase.table("leads").select("id, name").in_("id", lead_ids).execute()
        for row in (names_result.data or []):
            lead_map[row["id"]] = row.get("name", "Unknown")

    for log in logs:
        log["lead_name"] = lead_map.get(log.get("lead_id"), None)

    unresolved = [l for l in logs if l.get("details", {}).get("resolved") != True]
    resolved = [l for l in logs if l.get("details", {}).get("resolved") == True]

    return {
        "errors": unresolved + resolved,
        "unresolved_count": len(unresolved),
        "total": result.count or 0,
    }


@router.post("/errors/{error_id}/resolve")
@limiter.limit("10/minute")
async def error_resolve(request: Request, error_id: str, _t: str = Depends(verify_token)):
    """Mark an error as resolved."""
    log = supabase.table("pipeline_logs").select("id, details").eq("id", error_id).limit(1).execute()
    if not log.data:
        raise HTTPException(status_code=404, detail="Error not found")

    details = log.data[0].get("details") or {}
    details["resolved"] = True
    details["resolved_at"] = datetime.now(timezone.utc).isoformat()

    supabase.table("pipeline_logs").update({"details": details}).eq("id", error_id).execute()
    return {"status": "resolved"}


@router.get("/settings")
@limiter.limit("10/minute")
async def get_settings(request: Request, _t: str = Depends(verify_token)):
    """Get all configurable settings."""
    return {
        "daily_call_cap": int(os.environ.get("DAILY_CALL_CAP", "200")),
        "dialer_rate_limit": int(os.environ.get("DIALER_RATE_LIMIT", "30")),
        "cal_booking_link": os.environ.get("CAL_BOOKING_LINK", ""),
        "warm_transfer_number": os.environ.get("WARM_TRANSFER_NUMBER", "+447592233052"),
        "timeout_hours": int(os.environ.get("OUTREACH_TIMEOUT_HOURS", "48")),
    }


@router.put("/settings")
@limiter.limit("5/minute")
async def update_settings(request: Request, _t: str = Depends(verify_token)):
    """Update settings. Note: env-based settings require restart."""
    body = await request.json()
    # For v1, log the settings change but note that env-based settings
    # require a server restart to take effect
    logger.info("Settings update requested: %s", body)
    return {"status": "acknowledged", "note": "Server restart required for env-based settings"}


@router.get("/schedules")
@limiter.limit("10/minute")
async def schedules_list(request: Request, _t: str = Depends(verify_token)):
    """All dial schedules."""
    result = supabase.table("dial_schedules").select("*").order("created_at", desc=True).execute()
    return {"schedules": result.data or []}


@router.post("/schedules")
@limiter.limit("5/minute")
async def schedule_create(request: Request, _t: str = Depends(verify_token)):
    """Create a new dial schedule."""
    body = await request.json()
    result = supabase.table("dial_schedules").insert({
        "name": body.get("name", "New Schedule"),
        "start_time": body.get("start_time", "09:00"),
        "end_time": body.get("end_time", "18:00"),
        "timezone": body.get("timezone", "Europe/London"),
        "days_of_week": body.get("days_of_week", [1, 2, 3, 4, 5]),
        "is_active": body.get("is_active", True),
    }).execute()
    return {"schedule": result.data[0] if result.data else None}


@router.put("/schedules/{schedule_id}")
@limiter.limit("5/minute")
async def schedule_update(request: Request, schedule_id: str, _t: str = Depends(verify_token)):
    """Update a dial schedule."""
    body = await request.json()
    result = (
        supabase.table("dial_schedules")
        .update(body)
        .eq("id", schedule_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Schedule not found")
    return {"schedule": result.data[0]}


@router.delete("/schedules/{schedule_id}")
@limiter.limit("5/minute")
async def schedule_delete(request: Request, schedule_id: str, _t: str = Depends(verify_token)):
    """Soft-delete a schedule (set is_active=false)."""
    result = (
        supabase.table("dial_schedules")
        .update({"is_active": False})
        .eq("id", schedule_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Schedule not found")
    return {"status": "deactivated"}


@router.get("/templates")
@limiter.limit("10/minute")
async def get_templates(request: Request, _t: str = Depends(verify_token)):
    """Get message templates (placeholder — returns defaults)."""
    return {
        "whatsapp_template": "Hi {first_name}, this is John from Cloudboosta. We help professionals transition into cloud and DevOps careers. I'd love to chat about your goals — book a time here: {booking_link}",
        "email_subject": "Cloudboosta — Your Cloud Career Path",
        "email_body": "Hi {first_name},\n\nI'm John from Cloudboosta. We specialise in helping professionals like you break into cloud and DevOps.\n\nI'd love to have a quick chat about your career goals. Book a convenient time here: {booking_link}\n\nBest,\nJohn",
    }


@router.put("/templates")
@limiter.limit("5/minute")
async def update_templates(request: Request, _t: str = Depends(verify_token)):
    """Update message templates (placeholder — logs and acknowledges)."""
    body = await request.json()
    logger.info("Templates update: %s", {k: v[:50] + "..." for k, v in body.items()})
    return {"status": "acknowledged"}


@router.get("/analytics/costs")
@limiter.limit("10/minute")
async def analytics_costs(request: Request, _t: str = Depends(verify_token)):
    """Estimated costs by component."""
    # Count this month's usage
    month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0).isoformat()

    calls_result = (
        supabase.table("call_logs")
        .select("duration_seconds, call_cost", count="exact")
        .gte("started_at", month_start)
        .execute()
    )
    calls = calls_result.data or []
    total_minutes = sum((c.get("duration_seconds") or 0) / 60 for c in calls)
    total_call_cost = sum(float(c.get("call_cost") or 0) for c in calls)

    outreach_result = (
        supabase.table("pipeline_logs")
        .select("id", count="exact")
        .ilike("event", "%outreach%")
        .gte("created_at", month_start)
        .execute()
    )

    return {
        "components": [
            {"name": "Retell", "unit": "minutes", "unit_cost": 0.07, "usage": round(total_minutes, 1), "total": round(total_call_cost or total_minutes * 0.07, 2)},
            {"name": "OpenClaw", "unit": "messages", "unit_cost": 0, "usage": outreach_result.count or 0, "total": 0, "note": "Self-hosted (free)"},
            {"name": "Resend", "unit": "emails", "unit_cost": 0.001, "usage": 0, "total": 0},
            {"name": "Twilio", "unit": "minutes", "unit_cost": 0.015, "usage": round(total_minutes, 1), "total": round(total_minutes * 0.015, 2)},
        ],
        "total_estimated": round((total_call_cost or total_minutes * 0.07) + total_minutes * 0.015, 2),
    }
