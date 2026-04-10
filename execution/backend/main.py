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
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, ValidationError, field_validator, validator
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from typing import Any, Optional

load_dotenv()

from retell_config import retell_client
from supabase_client import supabase
from tools import execute_tool, COUNTRY_CURRENCY_MAP, DEFAULT_CURRENCY
from timezone_util import derive_timezone
from dialer import (
    should_dial_now,
    get_next_lead,
    count_active_calls,
    can_start_more_calls,
    get_batch_leads,
    MAX_CONCURRENT_CALLS,
    can_dial_next,
)
from webinar_schedule import determine_call_type

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
logger = logging.getLogger("sarah")

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------
app = FastAPI(title="Sarah — Cloudboosta Sales Agent", version="0.1.0")
from dashboard_routes import router as dashboard_v2_router

# ---------------------------------------------------------------------------
# Rate limiting (slowapi)
# ---------------------------------------------------------------------------
limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.include_router(dashboard_v2_router)

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
        "https://sarah-api.srv1297445.hstgr.cloud",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
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
        logger.warning(
            "Webhook signature mismatch (expected=%s got=%s) — processing anyway",
            expected[:12] + "...", signature[:12] + "...",
        )

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
        allowed = {"lookup_programme", "get_objection_response", "log_call_outcome", "save_email", "get_lead_context", "transfer_call"}
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
    try:
        data = json.loads(body)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid JSON: {exc}")
    try:
        payload = ToolCallPayload(**data)
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
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
    try:
        data = json.loads(body)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=400, detail=f"Invalid JSON: {exc}")
    try:
        payload = WebhookPayload(**data)
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

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
    if not await can_start_more_calls():
        raise HTTPException(status_code=409, detail="Maximum concurrent calls reached")

    # Safety checks
    if lead_data["status"] == "do_not_contact":
        raise HTTPException(status_code=403, detail="Lead is do-not-contact")

    if not is_safe_destination(lead_data["phone"]):
        raise HTTPException(status_code=403, detail="Blocked destination")

    # SDK 5.x: Phone number's outbound_agents binding determines the agent.
    # No agent_id parameter -- removed in SDK 5.x.
    # The phone number +17405085360 must have outbound_agents configured
    # (done by migrate_phone_number.py).

    # Determine call type and webinar context
    call_context = determine_call_type(lead_data)
    call_type = call_context["call_type"]
    webinar = call_context["webinar"]
    is_returning = call_context["is_returning"]

    # Pull previous call context for returning leads
    previous_notes = ""
    if is_returning:
        prev_calls = (
            supabase.table("call_logs")
            .select("summary, outcome, detected_persona, closing_strategy_used")
            .eq("lead_id", str(req.lead_id))
            .order("ended_at", desc=True)
            .limit(3)
            .execute()
        )
        if prev_calls.data:
            notes_parts = []
            for pc in prev_calls.data:
                if pc.get("summary"):
                    notes_parts.append(pc["summary"])
            previous_notes = " | ".join(notes_parts)

    dynamic_vars = {
        "lead_name": lead_data["name"],
        "lead_location": lead_data.get("location", "unknown"),
        "lead_email": lead_data.get("email", ""),
        "call_type": call_type,
        "is_returning_lead": "yes" if is_returning else "no",
        "webinar_date": webinar["date_iso"] if webinar else "",
        "webinar_topic": webinar["topic"] if webinar else "",
        "webinar_summary": webinar["summary"] if webinar else "",
        "webinars_invited": ",".join(lead_data.get("webinars_invited") or []),
        "previous_call_notes": previous_notes,
        "detected_persona": lead_data.get("detected_persona", ""),
        "programme_recommended": lead_data.get("programme_recommended", ""),
    }

    call = retell_client.call.create_phone_call(
        from_number=os.environ.get("TWILIO_PHONE_NUMBER", "+17404943597"),
        to_number=lead_data["phone"],
        metadata={"lead_id": str(req.lead_id)},
        retell_llm_dynamic_variables=dynamic_vars,
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
    from datetime import date as date_cls

    result = (
        supabase.table("strategy_performance")
        .select("*")
        .execute()
    )

    # --- daily_outcomes: last 14 days ---
    fourteen_days_ago = (date_cls.today() - timedelta(days=14)).isoformat()
    daily_result = (
        supabase.table("call_logs")
        .select("created_at, outcome")
        .gte("created_at", fourteen_days_ago)
        .execute()
    )
    daily_rows = daily_result.data or []

    # Group by date string (YYYY-MM-DD), count each outcome bucket
    daily_map: dict[str, dict] = {}
    for row in daily_rows:
        raw_ts = row.get("created_at") or ""
        day = raw_ts[:10]  # YYYY-MM-DD
        if not day:
            continue
        if day not in daily_map:
            daily_map[day] = {
                "date": day,
                "committed": 0,
                "follow_up": 0,
                "declined": 0,
                "no_answer": 0,
                "other": 0,
            }
        outcome = (row.get("outcome") or "").lower()
        if outcome in ("committed",):
            daily_map[day]["committed"] += 1
        elif outcome in ("follow_up", "follow up"):
            daily_map[day]["follow_up"] += 1
        elif outcome in ("declined",):
            daily_map[day]["declined"] += 1
        elif outcome in ("no_answer", "no answer"):
            daily_map[day]["no_answer"] += 1
        elif outcome:
            daily_map[day]["other"] += 1

    daily_outcomes = sorted(daily_map.values(), key=lambda x: x["date"])

    # --- persona_performance: conversion rate by persona ---
    persona_result = (
        supabase.table("call_logs")
        .select("detected_persona, outcome")
        .not_.is_("detected_persona", "null")
        .execute()
    )
    persona_rows = persona_result.data or []

    persona_map: dict[str, dict] = {}
    for row in persona_rows:
        persona = row.get("detected_persona") or ""
        if not persona:
            continue
        if persona not in persona_map:
            persona_map[persona] = {"persona": persona, "total_calls": 0, "committed_count": 0}
        persona_map[persona]["total_calls"] += 1
        if (row.get("outcome") or "").lower() == "committed":
            persona_map[persona]["committed_count"] += 1

    persona_performance = []
    for p in persona_map.values():
        total = p["total_calls"]
        committed = p["committed_count"]
        p["conversion_rate"] = round(committed / total * 100, 1) if total > 0 else 0.0
        persona_performance.append(p)

    persona_performance.sort(key=lambda x: x["conversion_rate"], reverse=True)

    return {
        "strategies": result.data or [],
        "daily_outcomes": daily_outcomes,
        "persona_performance": persona_performance,
    }


@app.get("/api/dashboard/command-centre")
@limiter.limit("60/minute")
async def dashboard_command_centre(request: Request, _token: str = Depends(verify_bearer_token)):
    """Single endpoint returning all data needed for the command centre home view."""

    # ------------------------------------------------------------------ stats
    try:
        total_leads_result = supabase.table("leads").select("id", count="exact").execute()
        total_leads = total_leads_result.count or 0

        queued_result = supabase.table("leads").select("id", count="exact").eq("status", "queued").execute()
        queued_count = queued_result.count or 0

        todays_calls_result = supabase.table("todays_calls").select("outcome").execute()
        todays_calls_data = todays_calls_result.data or []
        todays_calls_count = len(todays_calls_data)
        connected_count = sum(1 for r in todays_calls_data if r.get("outcome") is not None)
        committed_count = sum(1 for r in todays_calls_data if r.get("outcome") == "committed")
        conversion_rate = round(committed_count / connected_count * 100, 1) if connected_count > 0 else 0.0

        stats = {
            "total_leads": total_leads,
            "queued": queued_count,
            "todays_calls": todays_calls_count,
            "connected": connected_count,
            "committed": committed_count,
            "conversion_rate": conversion_rate,
        }
    except Exception as exc:
        logger.error("command_centre: stats query error: %s", exc, exc_info=True)
        stats = {
            "total_leads": 0,
            "queued": 0,
            "todays_calls": 0,
            "connected": 0,
            "committed": 0,
            "conversion_rate": 0.0,
        }

    # --------------------------------------------------------------- active_call
    try:
        active_result = (
            supabase.table("leads")
            .select("id, name, phone, status, programme_recommended, last_strategy_used, last_call_at, detected_persona")
            .in_("status", ["calling", "in_call"])
            .limit(1)
            .execute()
        )
        active_call = active_result.data[0] if active_result.data else None
    except Exception as exc:
        logger.error("command_centre: active_call query error: %s", exc, exc_info=True)
        active_call = None

    # ------------------------------------------------------------------- queue
    try:
        queue_result = (
            supabase.table("leads")
            .select("id, name, phone, priority, retry_count, next_call_type, next_call_at, status")
            .in_("status", ["queued", "new"])
            .order("priority", desc=True)
            .order("created_at", desc=False)
            .limit(10)
            .execute()
        )
        queue = queue_result.data or []
    except Exception as exc:
        logger.error("command_centre: queue query error: %s", exc, exc_info=True)
        queue = []

    # ------------------------------------------------------------------ funnel
    try:
        all_statuses_result = supabase.table("leads").select("status").execute()
        all_statuses = all_statuses_result.data or []

        funnel = {
            "new": sum(1 for r in all_statuses if r.get("status") == "new"),
            "queued": sum(1 for r in all_statuses if r.get("status") == "queued"),
            "in_progress": sum(1 for r in all_statuses if r.get("status") in ("calling", "in_call")),
            "follow_up": sum(1 for r in all_statuses if r.get("status") == "follow_up"),
            "committed": sum(1 for r in all_statuses if r.get("status") in ("committed", "payment_sent")),
            "closed": sum(1 for r in all_statuses if r.get("status") in ("declined", "not_qualified", "do_not_contact", "failed")),
        }
    except Exception as exc:
        logger.error("command_centre: funnel query error: %s", exc, exc_info=True)
        funnel = {"new": 0, "queued": 0, "in_progress": 0, "follow_up": 0, "committed": 0, "closed": 0}

    # ---------------------------------------------------------------- activity
    try:
        pipeline_logs_result = (
            supabase.table("pipeline_logs")
            .select("lead_id, event, details, created_at")
            .order("created_at", desc=True)
            .limit(15)
            .execute()
        )
        pipeline_logs = pipeline_logs_result.data or []

        call_logs_result = (
            supabase.table("call_logs")
            .select("lead_id, duration_seconds, outcome, started_at")
            .order("started_at", desc=True)
            .limit(15)
            .execute()
        )
        call_logs = call_logs_result.data or []

        # Collect all lead_ids needed for name lookup
        lead_ids_needed = set()
        for row in pipeline_logs:
            if row.get("lead_id"):
                lead_ids_needed.add(row["lead_id"])
        for row in call_logs:
            if row.get("lead_id"):
                lead_ids_needed.add(row["lead_id"])

        # Bulk lookup lead names
        lead_name_map: dict[str, str] = {}
        if lead_ids_needed:
            names_result = (
                supabase.table("leads")
                .select("id, name")
                .in_("id", list(lead_ids_needed))
                .execute()
            )
            for row in (names_result.data or []):
                lead_name_map[row["id"]] = row.get("name", "Unknown")

        # Build activity items
        activity_items = []
        for row in pipeline_logs:
            details_obj = row.get("details") or {}
            new_status = details_obj.get("new_status", "") if isinstance(details_obj, dict) else ""
            old_status = details_obj.get("old_status", "") if isinstance(details_obj, dict) else ""
            if new_status and old_status:
                detail = f"moved from {old_status.replace('_', ' ')} to {new_status.replace('_', ' ')}"
            elif new_status:
                detail = f"moved to {new_status.replace('_', ' ')}"
            else:
                detail = row.get("event", "status changed")
            activity_items.append({
                "type": "status_change",
                "lead_name": lead_name_map.get(row.get("lead_id", ""), "Unknown"),
                "detail": detail,
                "timestamp": row.get("created_at"),
            })
        for row in call_logs:
            duration = row.get("duration_seconds")
            outcome = row.get("outcome", "")
            dur_str = f"{int(duration)}s" if duration is not None else "unknown duration"
            detail = f"{dur_str} — {outcome}" if outcome else dur_str
            activity_items.append({
                "type": "call",
                "lead_name": lead_name_map.get(row.get("lead_id", ""), "Unknown"),
                "detail": detail,
                "timestamp": row.get("started_at"),
            })

        # Sort merged list by timestamp DESC, take top 20
        activity_items.sort(
            key=lambda x: x["timestamp"] or "",
            reverse=True,
        )
        activity = activity_items[:20]
    except Exception as exc:
        logger.error("command_centre: activity query error: %s", exc, exc_info=True)
        activity = []

    # ------------------------------------------------------------- recent_calls
    try:
        recent_calls_result = (
            supabase.table("todays_calls")
            .select("*")
            .order("started_at", desc=True)
            .limit(15)
            .execute()
        )
        recent_calls = recent_calls_result.data or []
    except Exception as exc:
        logger.error("command_centre: recent_calls query error: %s", exc, exc_info=True)
        recent_calls = []

    return {
        "stats": stats,
        "active_call": active_call,
        "queue": queue,
        "funnel": funnel,
        "activity": activity,
        "recent_calls": recent_calls,
    }


@app.get("/api/dashboard/lead/{lead_id}")
@limiter.limit("60/minute")
async def dashboard_lead_detail(request: Request, lead_id: str, _token: str = Depends(verify_bearer_token)):
    """Full lead details and call history for the lead detail panel."""
    # Fetch lead — use limit(1) instead of .single() to avoid a raised exception
    # when no rows match (postgrest returns 406 for .single() with 0 rows).
    try:
        lead_result = (
            supabase.table("leads")
            .select("*")
            .eq("id", lead_id)
            .limit(1)
            .execute()
        )
    except Exception as exc:
        logger.warning("dashboard_lead_detail: DB error for lead %s: %s", lead_id, exc)
        raise HTTPException(status_code=404, detail="Lead not found")
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
    calls = calls_result.data or []

    # Compute call stats
    total_calls = len(calls)
    total_duration = sum(c.get("duration_seconds") or 0 for c in calls)
    objections_seen = list(set(
        c.get("closing_strategy_used")
        for c in calls
        if c.get("closing_strategy_used")
    ))

    return {
        "lead": lead_result.data[0],
        "calls": calls,
        "call_stats": {
            "total_calls": total_calls,
            "total_duration_seconds": total_duration,
            "objections_seen": objections_seen,
        },
    }


@app.post("/api/dashboard/call-now/{lead_id}")
@limiter.limit("5/minute")
async def call_now(request: Request, lead_id: str, _token: str = Depends(verify_bearer_token)):
    """Trigger an outbound call to a lead directly from the dashboard."""
    lead = (
        supabase.table("leads")
        .select("*")
        .eq("id", lead_id)
        .single()
        .execute()
    )
    if not lead.data:
        raise HTTPException(status_code=404, detail="Lead not found")
    lead_data = lead.data

    # Active call guard
    if not await can_start_more_calls():
        raise HTTPException(status_code=409, detail="Maximum concurrent calls reached")

    # Do-not-contact / declined guard
    if lead_data["status"] == "do_not_contact":
        raise HTTPException(status_code=403, detail="Lead is do-not-contact")

    # Phone safety check
    if not is_safe_destination(lead_data["phone"]):
        raise HTTPException(status_code=403, detail="Blocked destination")

    # Determine call type and webinar context
    call_context = determine_call_type(lead_data)
    call_type = call_context["call_type"]
    webinar = call_context["webinar"]
    is_returning = call_context["is_returning"]

    # Pull previous call context for returning leads
    previous_notes = ""
    if is_returning:
        prev_calls = (
            supabase.table("call_logs")
            .select("summary, outcome, detected_persona, closing_strategy_used")
            .eq("lead_id", lead_id)
            .order("ended_at", desc=True)
            .limit(3)
            .execute()
        )
        if prev_calls.data:
            notes_parts = []
            for pc in prev_calls.data:
                if pc.get("summary"):
                    notes_parts.append(pc["summary"])
            previous_notes = " | ".join(notes_parts)

    dynamic_vars = {
        "lead_name": lead_data["name"],
        "lead_location": lead_data.get("location", "unknown"),
        "lead_email": lead_data.get("email", ""),
        "call_type": call_type,
        "is_returning_lead": "yes" if is_returning else "no",
        "webinar_date": webinar["date_iso"] if webinar else "",
        "webinar_topic": webinar["topic"] if webinar else "",
        "webinar_summary": webinar["summary"] if webinar else "",
        "webinars_invited": ",".join(lead_data.get("webinars_invited") or []),
        "previous_call_notes": previous_notes,
        "detected_persona": lead_data.get("detected_persona", ""),
        "programme_recommended": lead_data.get("programme_recommended", ""),
    }

    from_number = os.environ.get("TWILIO_PHONE_NUMBER", "+17404943597")

    call = retell_client.call.create_phone_call(
        from_number=from_number,
        to_number=lead_data["phone"],
        metadata={"lead_id": lead_id},
        retell_llm_dynamic_variables=dynamic_vars,
    )

    # Update lead status — handle state machine transitions
    current_status = lead_data.get("status", "")
    needs_queued_first = current_status in ("declined", "not_qualified", "failed", "no_answer", "voicemail", "busy")
    if needs_queued_first:
        supabase.table("leads").update({"status": "queued"}).eq("id", lead_id).execute()
    supabase.table("leads").update({"status": "calling"}).eq("id", lead_id).execute()

    logger.info("call-now: call initiated %s -> %s", call.call_id, lead_data["phone"][:4] + "****")
    return {"call_id": call.call_id, "status": "calling"}


@app.post("/api/dashboard/end-call/{lead_id}")
@limiter.limit("10/minute")
async def end_call(request: Request, lead_id: str, _token: str = Depends(verify_bearer_token)):
    """End an active call by finding the Retell call and requesting termination."""
    lead = supabase.table("leads").select("last_call_id, status").eq("id", lead_id).limit(1).execute()
    if not lead.data:
        raise HTTPException(status_code=404, detail="Lead not found")

    lead_data = lead.data[0]
    call_id = lead_data.get("last_call_id")

    if call_id:
        try:
            retell_client.call.end(call_id)
            logger.info("end-call: ended Retell call %s for lead %s", call_id, lead_id)
        except Exception as exc:
            logger.warning("end-call: Retell end failed for %s: %s", call_id, exc)

    # Reset lead status if stuck in calling/in_call
    if lead_data.get("status") in ("calling", "in_call"):
        try:
            supabase.table("leads").update({"status": "no_answer"}).eq("id", lead_id).execute()
            supabase.table("leads").update({"status": "queued"}).eq("id", lead_id).execute()
        except Exception:
            pass

    return {"status": "ended"}


@app.post("/api/dashboard/reset-call/{lead_id}")
@limiter.limit("10/minute")
async def reset_call(request: Request, lead_id: str, _token: str = Depends(verify_bearer_token)):
    """Force-reset a lead stuck in calling/in_call back to queued."""
    try:
        supabase.table("leads").update({"status": "no_answer"}).eq("id", lead_id).execute()
        supabase.table("leads").update({"status": "queued"}).eq("id", lead_id).execute()
        logger.info("reset-call: lead %s reset to queued", lead_id)
    except Exception as exc:
        logger.error("reset-call: failed for %s: %s", lead_id, exc)
        raise HTTPException(status_code=500, detail="Reset failed")
    return {"status": "reset"}


# ---------------------------------------------------------------------------
# Dashboard SPA — serve built React app (must be LAST)
# ---------------------------------------------------------------------------
_static_dir = os.path.join(os.path.dirname(__file__), "static")

if os.path.isdir(_static_dir):
    _assets_dir = os.path.join(_static_dir, "assets")
    if os.path.isdir(_assets_dir):
        app.mount("/assets", StaticFiles(directory=_assets_dir), name="static-assets")

    @app.get("/{path:path}")
    async def serve_spa(path: str):
        """Serve the React SPA — fall back to index.html for client-side routing."""
        file_path = os.path.join(_static_dir, path)
        if path and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(_static_dir, "index.html"))
