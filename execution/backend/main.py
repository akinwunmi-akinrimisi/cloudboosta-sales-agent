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
from datetime import datetime, timezone

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, field_validator, validator
from typing import Any, Optional

load_dotenv()

from retell_config import retell_client
from supabase_client import supabase
from tools import execute_tool
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

DASHBOARD_SECRET_KEY = os.environ.get("DASHBOARD_SECRET_KEY", "")
WEBHOOK_BASE_URL = os.environ.get("WEBHOOK_BASE_URL", "")

# CORS — restrict in production
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        # TODO: Add production dashboard domain
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
    """Verify Retell webhook signature using the Retell SDK."""
    body = await request.body()

    if not os.environ.get("RETELL_API_KEY"):
        logger.warning("RETELL_API_KEY not set -- skipping signature verification")
        return body

    post_data = json.loads(body)
    valid = retell_client.verify(
        json.dumps(post_data, separators=(",", ":"), ensure_ascii=False),
        api_key=str(os.environ["RETELL_API_KEY"]),
        signature=str(request.headers.get("X-Retell-Signature", "")),
    )
    if not valid:
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


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/health")
async def health():
    return {"status": "ok", "agent": "Sarah"}


# ---- Tool calls from Retell ----
@app.post("/retell/tool")
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
async def retell_webhook(request: Request):
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
                else:
                    # Connected call -- check if tool already set outcome
                    call_row = (
                        supabase.table("call_logs")
                        .select("outcome")
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
        except Exception as exc:
            logger.error("call_ended DB error for call %s: %s", call_id, exc, exc_info=True)

    elif event == "call_analyzed":
        try:
            call_analysis = call_data.get("call_analysis", {})
            if call_analysis:
                call_summary = call_analysis.get("call_summary")
                user_sentiment = call_analysis.get("user_sentiment")

                supabase.table("call_logs").update({
                    "call_summary": call_summary,
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
async def initiate_call(req: InitiateCallRequest):
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
async def dialer_start(req: DialerRequest):
    # TODO: Implement dialer start logic (Phase 5)
    logger.info("Dialer start requested")
    return {"status": "dialer_start_acknowledged", "message": "Auto-dialer not yet implemented"}


@app.post("/dialer/stop")
async def dialer_stop():
    # TODO: Implement dialer stop logic (Phase 5)
    logger.info("Dialer stop requested")
    return {"status": "dialer_stop_acknowledged", "message": "Auto-dialer not yet implemented"}


# ---- Dashboard API ----
@app.get("/api/dashboard/live")
async def dashboard_live():
    """Current active call + recent calls for the live view."""
    # TODO: Implement with real Supabase queries (Phase 6)
    return {"active_call": None, "recent_calls": [], "today_stats": {}}


@app.get("/api/dashboard/pipeline")
async def dashboard_pipeline():
    """Lead counts by status for the pipeline view."""
    result = supabase.table("leads").select("status").execute()
    counts: dict[str, int] = {}
    for row in result.data:
        s = row["status"]
        counts[s] = counts.get(s, 0) + 1
    return {"pipeline": counts}


@app.get("/api/dashboard/strategy")
async def dashboard_strategy():
    """Strategy performance data for the analytics view."""
    # TODO: Query strategy_performance view (Phase 6)
    return {"strategies": []}
