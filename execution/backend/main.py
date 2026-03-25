"""FastAPI webhook server for Sarah — Retell AI voice sales agent.

Endpoints:
  POST /retell/tool      — Tool calls from Retell during live conversations
  POST /retell/webhook   — Call lifecycle events (started, ended, analyzed)
  POST /retell/initiate-call — Trigger an outbound call to a lead
  POST /dialer/start     — Start the auto-dialer for a schedule
  POST /dialer/stop      — Stop the auto-dialer
  GET  /api/dashboard/*  — Dashboard data endpoints
"""

import hashlib
import hmac
import json
import logging
import os
import re
import time as time_mod

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, validator
from typing import Optional

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

WEBHOOK_SECRET = os.environ.get("WEBHOOK_SECRET", "")
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
    """Verify Retell webhook HMAC-SHA256 signature."""
    body = await request.body()
    signature = request.headers.get("x-retell-signature", "")

    if not WEBHOOK_SECRET:
        logger.warning("WEBHOOK_SECRET not set — skipping signature verification")
        return body

    expected = hmac.new(WEBHOOK_SECRET.encode(), body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(signature, expected):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    return body


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------
class ToolCallPayload(BaseModel):
    call_id: str
    name: str
    args: dict

    @validator("name")
    def valid_function_name(cls, v):
        allowed = {"lookup_programme", "get_objection_response", "log_call_outcome"}
        if v not in allowed:
            raise ValueError(f"Unknown function: {v}")
        return v


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
    result = await execute_tool(payload.name, payload.args, payload.call_id)
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
        # TODO: Update lead status to in_call
        pass

    elif event == "call_ended":
        # TODO: Extract transcript, duration, recording; update lead + call_logs
        pass

    elif event == "call_analyzed":
        # TODO: Store call analysis data
        pass

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
    # The phone number +17404943597 must have outbound_agents configured
    # (done by migrate_phone_number.py).
    call = retell_client.call.create_phone_call(
        from_number="+17404943597",
        to_number=lead_data["phone"],
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
