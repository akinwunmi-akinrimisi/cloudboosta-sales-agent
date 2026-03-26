"""FastAPI webhook server for Sarah — Retell AI voice sales agent.

Endpoints:
  POST /retell/tool      — Tool calls from Retell during live conversations
  POST /retell/webhook   — Call lifecycle events (started, ended, analyzed)
  POST /retell/initiate-call — Trigger an outbound call to a lead
  POST /dialer/start     — Start the auto-dialer for a schedule
  POST /dialer/stop      — Stop the auto-dialer
  GET  /api/dashboard/*  — Dashboard data endpoints
"""

import json
import logging
import os
import re
import time as time_mod
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv
import httpx
from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, field_validator, validator
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from typing import Any, Optional

load_dotenv()

from retell_config import retell_client
from supabase_client import supabase
from tools import execute_tool, COUNTRY_CURRENCY_MAP, DEFAULT_CURRENCY
from dialer import (
    should_dial_now,
    get_next_lead,
    is_call_active,
    can_dial_next,
    check_daily_limit,
)

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
logger = logging.getLogger("sarah")

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(title="Sarah — Cloudboosta Sales Agent", version="0.1.0")

# ---------------------------------------------------------------------------
# Rate limiting (slowapi)
# ---------------------------------------------------------------------------
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

DASHBOARD_SECRET_KEY = os.environ.get("DASHBOARD_SECRET_KEY", "")
WEBHOOK_BASE_URL = os.environ.get("WEBHOOK_BASE_URL", "")
DASHBOARD_ORIGIN = os.environ.get("DASHBOARD_ORIGIN", "http://localhost:5173")
N8N_WEBHOOK_BASE = os.environ.get("N8N_WEBHOOK_BASE", "")

# ---------------------------------------------------------------------------
# Bearer token authentication
# ---------------------------------------------------------------------------
bearer_scheme = HTTPBearer(auto_error=True)


async def verify_bearer_token(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> str:
    """Validate bearer token matches DASHBOARD_SECRET_KEY."""
    if not DASHBOARD_SECRET_KEY:
        raise HTTPException(status_code=500, detail="Server misconfigured: no dashboard secret key")
    if credentials.credentials != DASHBOARD_SECRET_KEY:
        raise HTTPException(status_code=401, detail="Invalid token")
    return credentials.credentials


# ---------------------------------------------------------------------------
# CORS — restricted to dashboard origin
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        DASHBOARD_ORIGIN,
        "http://localhost:3000",
        "http://localhost:5173",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Authorization", "Content-Type"],
)

# ---------------------------------------------------------------------------
# Security headers middleware
# ---------------------------------------------------------------------------
@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    return response


# ---------------------------------------------------------------------------
# Global exception handler — never expose internals
# ---------------------------------------------------------------------------
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled error: %s", exc, exc_info=True)
    return JSONResponse(status_code=500, content={"error": "Internal server error"})


# ---------------------------------------------------------------------------
# Webhook signature verification
# ---------------------------------------------------------------------------
async def verify_retell_signature(request: Request) -> bytes:
    """Verify Retell webhook signature using HMAC-SHA256.

    Retell signs webhooks with the API key using HMAC-SHA256.
    The body must be serialized with compact JSON (no spaces).
    """
    body = await request.body()

    api_key = os.environ.get("RETELL_API_KEY", "")
    if not api_key:
        logger.warning("RETELL_API_KEY not set -- skipping signature verification")
        return body

    signature = request.headers.get("x-retell-signature", "")
    if not signature:
        logger.warning("No x-retell-signature header -- skipping verification")
        return body

    import hashlib
    import hmac
    post_data = json.loads(body)
    expected = hmac.new(
        api_key.encode("utf-8"),
        json.dumps(post_data, separators=(",", ":"), ensure_ascii=False).encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(signature, expected):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    return body


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------
class ToolCallPayload(BaseModel):
    """Retell custom function webhook payload (args_at_root=false)."""
    name: str
    call: dict[str, Any]  # Full call object from Retell
    args: dict[str, Any]  # Tool arguments matching parameter schema

    @field_validator("name")
    @classmethod
    def valid_function_name(cls, v):
        allowed = {"lookup_programme", "get_objection_response", "log_call_outcome"}
        if v not in allowed:
            raise ValueError(f"Unknown function: {v}")
        return v

    @property
    def call_id(self) -> str:
        return self.call.get("call_id", "unknown")

    @property
    def lead_id(self) -> str | None:
        return self.call.get("metadata", {}).get("lead_id")


class WebhookPayload(BaseModel):
    event: str
    call: Optional[dict] = None

    @validator("event")
    def valid_event(cls, v):
        allowed = {"call_started", "call_ended", "call_analyzed"}
        if v not in allowed:
            raise ValueError(f"Unknown event: {v}")
        return v


class InitiateCallRequest(BaseModel):
    lead_id: str


class DialerRequest(BaseModel):
    schedule_id: Optional[str] = None


# ---------------------------------------------------------------------------
# Phone validation
# ---------------------------------------------------------------------------
E164_PATTERN = re.compile(r"^\+[1-9]\d{6,14}$")

BLOCKED_PREFIXES = ["+900", "+906", "+118", "+1900", "+979"]


def is_safe_destination(phone: str) -> bool:
    for prefix in BLOCKED_PREFIXES:
        if phone.startswith(prefix):
            return False
    return True


# ---------------------------------------------------------------------------
# Disconnect reason to lead status mapping
# ---------------------------------------------------------------------------
# Maps Retell's 31 disconnect_reason values to lead status strings.
# None means "check if tool already set status" (connected calls where
# log_call_outcome may have already updated the lead).
DISCONNECT_TO_STATUS: dict[str, str | None] = {
    # Never connected -- dial failures
    "dial_no_answer": "no_answer",
    "dial_busy": "busy",
    "dial_failed": "failed",
    "invalid_destination": "failed",

    # Connected but reached automation
    "voicemail_reached": "voicemail",
    "ivr_reached": "voicemail",  # Treat IVR same as voicemail for retry

    # Connected -- human interaction (status set by tool, not webhook)
    "user_hangup": None,         # Check if tool already set status
    "agent_hangup": None,        # Check if tool already set status
    "inactivity": None,          # Lead went silent

    # Errors
    "error_retell": "failed",
    "error_unknown": "failed",
    "error_llm_websocket_open": "failed",
    "error_llm_websocket_lost_connection": "failed",
    "error_llm_websocket_runtime": "failed",
    "error_no_audio_received": "failed",

    # System limits
    "max_duration_reached": None,  # Check if tool set status
    "concurrency_limit_reached": "failed",
    "no_valid_payment": "failed",
    "scam_detected": "failed",
    "marked_as_spam": "failed",
    "telephony_provider_permission_denied": "failed",
    "telephony_provider_unavailable": "failed",
    "sip_routing_error": "failed",
    "user_declined": "failed",   # User rejected the call

    # Shouldn't happen for outbound
    "call_transfer": None,
    "transfer_bridged": None,
    "transfer_cancelled": None,
    "registered_call_timeout": "failed",
    "error_user_not_joined": "failed",
    "error_asr": "failed",
    "error_llm_websocket_corrupt_payload": "failed",
}

# Statuses eligible for automatic retry requeue (Phase 6 AUTO-05)
RETRY_ELIGIBLE_STATUSES = {"no_answer", "voicemail", "busy"}

# Outcomes that trigger the n8n post-call workflow (Phase 7 AUTO-02/AUTO-04)
# Only connected calls where Sarah had a conversation and logged an outcome.
OUTCOMES_REQUIRING_WORKFLOW = {"committed", "follow_up", "declined"}


# ---------------------------------------------------------------------------
# Post-call n8n trigger (fire-and-forget)
# ---------------------------------------------------------------------------
async def trigger_post_call_workflow(payload: dict):
    """Fire-and-forget POST to n8n post-call webhook.

    Runs as a BackgroundTasks callback AFTER the 200 response is sent to Retell.
    Failure is non-critical -- logged as warning, never raised.
    """
    if not N8N_WEBHOOK_BASE:
        logger.warning("trigger_post_call_workflow: N8N_WEBHOOK_BASE not set -- skipping")
        return
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(
                f"{N8N_WEBHOOK_BASE}/post-call",
                json=payload,
            )
            logger.info(
                "Post-call workflow triggered: outcome=%s lead=%s status=%d",
                payload.get("outcome"), payload.get("lead_id"), resp.status_code,
            )
    except Exception as exc:
        logger.warning("n8n post-call trigger failed (non-critical): %s", exc)


@app.on_event("startup")
async def startup_warnings():
    if not N8N_WEBHOOK_BASE:
        logger.warning("N8N_WEBHOOK_BASE not set -- post-call workflows will not trigger")


# ---------------------------------------------------------------------------
# Retry requeue helper
# ---------------------------------------------------------------------------
async def handle_retry_requeue(lead_id: str, mapped_status: str):
    """Requeue lead with 60-min backoff if retries remain, else set declined.

    State machine requires two-step transitions:
      calling -> no_answer (already done by caller)
      no_answer -> queued (this function, if retries remain)
      no_answer -> declined (this function, if retries exhausted)
    """
    lead_row = (
        supabase.table("leads")
        .select("retry_count, max_retries")
        .eq("id", lead_id)
        .single()
        .execute()
    )
    if not lead_row.data:
        logger.warning("handle_retry_requeue: lead %s not found", lead_id)
        return

    retry_count = lead_row.data["retry_count"]
    max_retries = lead_row.data["max_retries"]

    if retry_count < max_retries:
        next_retry = (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()
        supabase.table("leads").update({
            "retry_count": retry_count + 1,
            "next_retry_at": next_retry,
            "status": "queued",
        }).eq("id", lead_id).eq("status", mapped_status).execute()
        logger.info(
            "Retry requeue: lead %s -> queued (retry %d/%d, next at %s)",
            lead_id, retry_count + 1, max_retries, next_retry,
        )
    else:
        supabase.table("leads").update({
            "status": "declined",
        }).eq("id", lead_id).eq("status", mapped_status).execute()
        logger.info(
            "Retries exhausted: lead %s -> declined (%d/%d used)",
            lead_id, retry_count, max_retries,
        )


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/health")
async def health():
    return {"status": "ok", "agent": "Sarah"}


# ---- Tool calls from Retell ----
@app.post("/retell/tool")
@limiter.limit("100/minute")
async def retell_tool(request: Request):
    body = await verify_retell_signature(request)
    payload = ToolCallPayload(**json.loads(body))
    result = await execute_tool(
        name=payload.name,
        args=payload.args,
        call_id=payload.call_id,
        lead_id=payload.lead_id,
    )
    return json.loads(result)


# ---- Webhook lifecycle events ----
@app.post("/retell/webhook")
@limiter.limit("100/minute")
async def retell_webhook(request: Request, background_tasks: BackgroundTasks):
    body = await verify_retell_signature(request)
    payload = WebhookPayload(**json.loads(body))

    event = payload.event
    call_data = payload.call or {}
    call_id = call_data.get("call_id", "unknown")

    logger.info("Webhook event: %s for call %s", event, call_id)

    if event == "call_started":
        try:
            lead_id = call_data.get("metadata", {}).get("lead_id")
            if lead_id:
                supabase.table("leads").update({
                    "status": "in_call",
                    "last_call_at": datetime.now(timezone.utc).isoformat(),
                    "last_call_id": call_id,
                }).eq("id", lead_id).eq("status", "calling").execute()
                logger.info("call_started: lead %s -> in_call", lead_id)
            else:
                logger.warning("call_started: no lead_id in metadata for call %s", call_id)
        except Exception as exc:
            logger.error("call_started DB error for call %s: %s", call_id, exc, exc_info=True)

    elif event == "call_ended":
        try:
            lead_id = call_data.get("metadata", {}).get("lead_id")
            duration_ms = call_data.get("duration_ms")
            duration_seconds = (duration_ms or 0) / 1000
            recording_url = call_data.get("recording_url")
            transcript = call_data.get("transcript")
            from_number = call_data.get("from_number")
            to_number = call_data.get("to_number")
            disconnection_reason = call_data.get("disconnection_reason")
            ended_at = datetime.now(timezone.utc).isoformat()

            # UPSERT call_logs -- update if log_call_outcome tool already created the row,
            # insert if not (e.g. call dropped before tool fired)
            upsert_data = {
                "retell_call_id": call_id,
                "lead_id": lead_id,
                "duration_seconds": duration_seconds,
                "recording_url": recording_url,
                "transcript": transcript,
                "ended_at": ended_at,
                "from_number": from_number,
                "to_number": to_number,
                "disconnection_reason": disconnection_reason,
            }
            supabase.table("call_logs").upsert(
                upsert_data, on_conflict="retell_call_id"
            ).execute()
            logger.info(
                "call_ended: upserted call_logs for call %s (reason=%s)",
                call_id, disconnection_reason,
            )

            # Resolve lead status from disconnect reason
            if lead_id and disconnection_reason:
                mapped_status = DISCONNECT_TO_STATUS.get(disconnection_reason)
                if mapped_status is not None:
                    # Dial failure or error -- set lead status directly
                    supabase.table("leads").update({
                        "status": mapped_status,
                    }).eq("id", lead_id).execute()
                    logger.info(
                        "call_ended: lead %s -> %s (reason=%s)",
                        lead_id, mapped_status, disconnection_reason,
                    )
                    # Retry requeue for eligible disconnect statuses
                    if mapped_status in RETRY_ELIGIBLE_STATUSES:
                        await handle_retry_requeue(lead_id, mapped_status)
                else:
                    # Connected call -- check if tool already set outcome
                    call_row = (
                        supabase.table("call_logs")
                        .select("outcome, programme_recommended, follow_up_date")
                        .eq("retell_call_id", call_id)
                        .limit(1)
                        .execute()
                    )
                    has_outcome = (
                        call_row.data
                        and call_row.data[0].get("outcome")
                    )
                    if not has_outcome:
                        # No tool outcome -- check if lead is still in_call
                        lead_row = (
                            supabase.table("leads")
                            .select("status")
                            .eq("id", lead_id)
                            .limit(1)
                            .execute()
                        )
                        if lead_row.data and lead_row.data[0].get("status") == "in_call":
                            supabase.table("leads").update({
                                "status": "declined",
                            }).eq("id", lead_id).eq("status", "in_call").execute()
                            logger.info(
                                "call_ended: lead %s -> declined (no tool outcome, reason=%s)",
                                lead_id, disconnection_reason,
                            )

                    # --- Post-call workflow trigger (Phase 7) ---
                    # Determine the outcome for connected calls.
                    # If tool set an outcome, use it (uppercase from tools.py).
                    # If no tool outcome, the lead was set to "declined" above.
                    tool_outcome = (
                        call_row.data[0].get("outcome") if call_row.data else None
                    )
                    # Map tool outcomes (uppercase) to lead statuses (lowercase)
                    # COMMITTED -> committed, FOLLOW_UP -> follow_up, DECLINED -> declined
                    resolved_status = (
                        tool_outcome.lower().replace(" ", "_") if tool_outcome
                        else "declined"
                    )

                    if resolved_status in OUTCOMES_REQUIRING_WORKFLOW:
                        # Query lead details for the email payload
                        lead_info = (
                            supabase.table("leads")
                            .select("email, name, country")
                            .eq("id", lead_id)
                            .single()
                            .execute()
                        )
                        lead_email = lead_info.data.get("email") if lead_info.data else None
                        lead_name = lead_info.data.get("name", "") if lead_info.data else ""
                        lead_country = lead_info.data.get("country", "") if lead_info.data else ""

                        # Resolve currency from lead's country
                        currency = COUNTRY_CURRENCY_MAP.get(lead_country, DEFAULT_CURRENCY)

                        # Get programme and follow_up_date from call_logs (set by tool)
                        programme_recommended = (
                            call_row.data[0].get("programme_recommended", "")
                            if call_row.data else ""
                        )
                        follow_up_date = (
                            call_row.data[0].get("follow_up_date")
                            if call_row.data else None
                        )

                        # Use the uppercase outcome for n8n Switch node matching
                        n8n_outcome = tool_outcome if tool_outcome else "DECLINED"

                        workflow_payload = {
                            "outcome": n8n_outcome,
                            "lead_id": lead_id,
                            "programme_recommended": programme_recommended,
                            "currency": currency,
                            "lead_email": lead_email,
                            "lead_name": lead_name,
                            "follow_up_date": follow_up_date,
                        }
                        background_tasks.add_task(
                            trigger_post_call_workflow, workflow_payload
                        )
                        logger.info(
                            "call_ended: queued post-call workflow for lead %s (outcome=%s)",
                            lead_id, n8n_outcome,
                        )

        except Exception as exc:
            logger.error("call_ended DB error for call %s: %s", call_id, exc, exc_info=True)

    elif event == "call_analyzed":
        try:
            call_analysis = call_data.get("call_analysis", {})
            if call_analysis:
                call_summary = call_analysis.get("call_summary")
                user_sentiment = call_analysis.get("user_sentiment")

                supabase.table("call_logs").update({
                    "summary": call_summary,
                    "sentiment": user_sentiment,
                }).eq("retell_call_id", call_id).execute()
                logger.info("call_analyzed: updated analysis for call %s", call_id)
            else:
                logger.warning("call_analyzed: empty call_analysis for call %s", call_id)
        except Exception as exc:
            logger.error("call_analyzed DB error for call %s: %s", call_id, exc, exc_info=True)

    return {"status": "ok"}


# ---- Initiate outbound call ----
@app.post("/retell/initiate-call")
@limiter.limit("1/2minutes")
@limiter.limit("200/day")
async def initiate_call(request: Request, req: InitiateCallRequest, _token: str = Depends(verify_bearer_token)):
    lead = (
        supabase.table("leads")
        .select("*")
        .eq("id", req.lead_id)
        .single()
        .execute()
    )
    if not lead.data:
        raise HTTPException(status_code=404, detail="Lead not found")

    lead_data = lead.data

    # Active call guard -- prevent concurrent calls
    if await is_call_active():
        raise HTTPException(status_code=409, detail="Another call is already active")

    # Safety checks
    if lead_data["status"] in ("do_not_contact", "declined"):
        raise HTTPException(status_code=403, detail="Lead is do-not-contact or declined")

    if not is_safe_destination(lead_data["phone"]):
        raise HTTPException(status_code=403, detail="Blocked destination")

    if not await check_daily_limit():
        raise HTTPException(status_code=429, detail="Daily call limit reached")

    # SDK 5.x: Phone number's outbound_agents binding determines the agent.
    # No agent_id parameter -- removed in SDK 5.x.
    # The phone number +17405085360 must have outbound_agents configured
    # (done by migrate_phone_number.py).
    call = retell_client.call.create_phone_call(
        from_number="+17405085360",
        to_number=lead_data["phone"],
        metadata={"lead_id": str(req.lead_id)},
        retell_llm_dynamic_variables={
            "lead_name": lead_data["name"],
            "lead_location": lead_data.get("location", "unknown"),
        },
    )

    # Update lead status
    supabase.table("leads").update({"status": "calling"}).eq("id", req.lead_id).execute()

    logger.info("Call initiated: %s -> %s", call.call_id, lead_data["phone"][:4] + "****")
    return {"call_id": call.call_id, "status": "calling"}


# ---- Auto-dialer controls ----
@app.post("/dialer/start")
@limiter.limit("10/minute")
async def dialer_start(request: Request, req: DialerRequest):
    # TODO: Implement dialer start logic (Phase 5)
    logger.info("Dialer start requested")
    return {"status": "dialer_start_acknowledged", "message": "Auto-dialer not yet implemented"}


@app.post("/dialer/stop")
@limiter.limit("10/minute")
async def dialer_stop(request: Request):
    # TODO: Implement dialer stop logic (Phase 5)
    logger.info("Dialer stop requested")
    return {"status": "dialer_stop_acknowledged", "message": "Auto-dialer not yet implemented"}


# ---- Dashboard API ----
@app.get("/api/dashboard/live")
@limiter.limit("60/minute")
async def dashboard_live(request: Request, _token: str = Depends(verify_bearer_token)):
    """Current active call + recent calls + today's stats for the live view."""
    # Active call: lead currently being called or in a call
    active_result = (
        supabase.table("leads")
        .select("id, name, phone, status, programme_recommended, last_strategy_used, last_call_at")
        .in_("status", ["calling", "in_call"])
        .limit(1)
        .execute()
    )
    active_call = active_result.data[0] if active_result.data else None

    # Recent calls from today's view (last 10)
    recent_result = (
        supabase.table("todays_calls")
        .select("*")
        .order("started_at", desc=True)
        .limit(10)
        .execute()
    )
    recent_calls = recent_result.data or []

    # Today's stats: compute from all today's calls
    stats_result = (
        supabase.table("todays_calls")
        .select("outcome")
        .execute()
    )
    all_today = stats_result.data or []
    total = len(all_today)
    connected = sum(1 for r in all_today if r.get("outcome") is not None)
    committed = sum(1 for r in all_today if r.get("outcome") == "committed")
    conversion_rate = round(committed / connected * 100, 1) if connected > 0 else 0

    today_stats = {
        "total_calls": total,
        "connected": connected,
        "committed": committed,
        "conversion_rate": conversion_rate,
    }

    return {"active_call": active_call, "recent_calls": recent_calls, "today_stats": today_stats}


@app.get("/api/dashboard/pipeline")
@limiter.limit("60/minute")
async def dashboard_pipeline(request: Request, _token: str = Depends(verify_bearer_token)):
    """All leads with summary fields for the pipeline kanban view."""
    result = (
        supabase.table("leads")
        .select("id, name, phone, status, updated_at, retry_count, programme_recommended, last_call_at, outcome, priority")
        .order("updated_at", desc=True)
        .execute()
    )
    return {"leads": result.data or []}


@app.get("/api/dashboard/strategy")
@limiter.limit("60/minute")
async def dashboard_strategy(request: Request, _token: str = Depends(verify_bearer_token)):
    """Strategy performance data from the strategy_performance view."""
    result = (
        supabase.table("strategy_performance")
        .select("*")
        .execute()
    )
    return {"strategies": result.data or []}


@app.get("/api/dashboard/lead/{lead_id}")
@limiter.limit("60/minute")
async def dashboard_lead_detail(request: Request, lead_id: str, _token: str = Depends(verify_bearer_token)):
    """Full lead details and call history for the lead detail panel."""
    # Fetch lead
    lead_result = (
        supabase.table("leads")
        .select("*")
        .eq("id", lead_id)
        .single()
        .execute()
    )
    if not lead_result.data:
        raise HTTPException(status_code=404, detail="Lead not found")

    # Fetch call history for this lead
    calls_result = (
        supabase.table("call_logs")
        .select("*")
        .eq("lead_id", lead_id)
        .order("started_at", desc=True)
        .execute()
    )

    return {"lead": lead_result.data, "calls": calls_result.data or []}
