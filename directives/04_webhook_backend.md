# Directive 04 — Webhook Backend
## FastAPI Server: Tool Execution + Dashboard API

---

## Goal
Build the FastAPI webhook server that handles Retell tool calls during live conversations, processes call lifecycle events, and serves dashboard data.

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/retell/tool` | Tool calls from Retell during live conversations |
| POST | `/retell/webhook` | Call lifecycle events (started, ended, analyzed) |
| POST | `/retell/initiate-call` | Trigger an outbound call to a lead |
| POST | `/dialer/start` | Start the auto-dialer |
| POST | `/dialer/stop` | Stop the auto-dialer |
| GET | `/api/dashboard/live` | Active call + recent calls for live view |
| GET | `/api/dashboard/pipeline` | Lead counts by status |
| GET | `/api/dashboard/strategy` | Strategy performance data |
| GET | `/health` | Health check |

## Security Requirements (from security.md)
- Verify Retell webhook signature (HMAC-SHA256) on every incoming webhook
- Rate limit all endpoints
- CORS restricted to known dashboard origins
- Never expose stack traces or internal errors
- Validate all incoming payloads with Pydantic models

## Tool Handlers
- `lookup_programme` → query programmes data in Supabase
- `get_objection_response` → query objections data in Supabase
- `log_call_outcome` → insert into call_logs, update lead status

## Webhook Events
- `call_started` → update lead status to `in_call`
- `call_ended` → extract transcript, duration, recording; update lead + call_logs
- `call_analyzed` → store analysis data (sentiment, summary)

## Edge Cases
- Tool execution must complete within 20 seconds (Retell timeout)
- If Supabase is unreachable during a tool call, return graceful fallback message
- If webhook signature verification fails, return 401 immediately

## Lessons Learned
<!-- Update this section after completing the phase -->
