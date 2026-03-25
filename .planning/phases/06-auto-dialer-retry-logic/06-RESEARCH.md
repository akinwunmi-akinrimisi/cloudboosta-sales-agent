# Phase 6: Auto-Dialer + Retry Logic - Research

**Researched:** 2026-03-25
**Domain:** n8n workflow automation, Supabase RPC, retry queue logic, PostgreSQL schema migration
**Confidence:** HIGH

## Summary

Phase 6 builds the autonomous calling pipeline: an n8n workflow that polls the lead queue every 2 minutes, picks the next lead via Supabase RPC, and initiates calls through the FastAPI backend. Retry logic is added to the existing call_ended webhook handler to requeue leads that were not reached. DNC enforcement relies on the existing database + backend chain with no n8n-side checks.

The primary technical challenge is that **the n8n Supabase node does not reliably support RPC function calls**. Community reports confirm parameter parsing failures with custom RPC functions. The recommended pattern is to use n8n's HTTP Request node to call Supabase's REST API directly at `/rest/v1/rpc/pick_next_lead`. This applies to the RPC call only; standard Supabase node operations (getAll, update) work reliably for table queries and updates.

A critical schema gap was identified: the `leads` table is missing the `next_retry_at` column required for retry backoff scheduling. Additionally, the `pick_next_lead()` RPC function needs updating to filter by `next_retry_at`, and the partial index on queued leads needs expanding to include this column. A state machine gap was also found: `calling -> failed` is not in the allowed transitions map, but `main.py` already sets leads to `failed` on dial errors -- this must be fixed.

**Primary recommendation:** Use HTTP Request node for the RPC call to pick_next_lead(), standard Supabase node for table queries/updates, and handle all error branching with IF nodes checking the HTTP response status code. Add a schema migration for next_retry_at and fix the state machine transition gap.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- n8n Schedule Trigger, cron every 2 minutes (*/2 * * * *)
- Flow: Check dial window (Supabase query) -> Check active call (Supabase query) -> pick_next_lead() RPC -> POST /retell/initiate-call
- Error handling on initiate-call: 409/429 -> revert to 'queued', 500 -> set to 'failed'
- Retry requeue in call_ended handler (NOT separate n8n workflow): retry_count < max_retries -> requeue with 60min backoff, exhausted -> 'declined'
- Fixed 60-minute backoff (no escalation)
- DNC: backend only (database + initiate-call 403), n8n does NOT check
- n8n workflow exported as JSON in execution/n8n/auto-dialer.json
- n8n credentials: Supabase service key + DASHBOARD_SECRET_KEY for bearer auth

### Claude's Discretion
- n8n workflow JSON structure and node configuration details
- n8n Supabase node configuration for RPC calls (vs HTTP Request workaround)
- How to store n8n credentials securely (external secrets vs inline)
- Whether to update pick_next_lead() RPC for next_retry_at filtering or handle in n8n query
- Exact error handling node chain in n8n (IF nodes, error outputs)

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| AUTO-01 | Auto-dialer n8n workflow polling queue every 2 minutes, checking dial window + no active call + queue not empty | n8n Schedule Trigger + Supabase node for queries + HTTP Request for RPC + HTTP Request for POST initiate-call. Full node chain documented. |
| AUTO-05 | Retry logic: max 2 retries per lead with 60-minute backoff delay, requeue to 'queued' status | call_ended handler modification in main.py. Requires schema migration (next_retry_at column) and pick_next_lead() RPC update. State machine already allows retry transitions. |
| AUTO-06 | Do-not-contact enforcement: hard block in dialer for leads with status 'do_not_contact' or 'declined' | Already implemented: pick_next_lead() only selects status='queued', initiate-call returns 403 for DNC/declined. No n8n changes needed -- verify only. |
</phase_requirements>

## Standard Stack

### Core
| Library/Tool | Version | Purpose | Why Standard |
|-------------|---------|---------|--------------|
| n8n | 2.11.x | Workflow automation platform | Already deployed at n8n.srv1297445.hstgr.cloud. Visual builder with cron, HTTP, Supabase nodes. |
| Supabase REST API | PostgREST | RPC function calls via HTTP | n8n Supabase node has unreliable RPC support; HTTP Request to /rest/v1/rpc/ is the proven workaround |
| n8n Supabase Node | Built-in | Table queries (getAll, update) | Works reliably for standard CRUD on tables. Used for dial_schedules query, leads status checks, and error recovery updates. |
| n8n HTTP Request Node | Built-in | POST to backend + RPC calls | Handles bearer auth, JSON body, and response status codes. Core node for API interactions. |
| n8n Schedule Trigger | Built-in | Cron-based polling | Every 2 minutes (*/2 * * * *). Timezone-aware via n8n instance settings. |
| n8n IF Node | Built-in | Conditional branching | Checks empty results, time windows, response codes. |

### Supporting
| Tool | Purpose | When to Use |
|------|---------|-------------|
| PostgreSQL ALTER TABLE | Schema migration | Adding next_retry_at column to leads table |
| n8n Code Node | Date/time comparison | Evaluating dial window (current time vs start_time/end_time with timezone) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| HTTP Request for RPC | n8n Supabase node RPC operation | Supabase node RPC is unreliable (parameter parsing bugs). HTTP Request is explicit and predictable. |
| n8n Code node for time check | IF node with expressions | Code node gives full JavaScript for timezone-aware time comparison; IF node expressions are limited for time math. |
| Separate retry n8n workflow | call_ended handler in main.py | Centralizing retry in Python keeps logic together, avoids n8n webhook complexity. User decision: locked. |

## Architecture Patterns

### n8n Workflow Node Chain (AUTO-01)

```
Schedule Trigger (*/2 * * * *)
    |
    v
[Supabase: getAll dial_schedules WHERE is_active=true]
    |
    v
[Code: Check dial window (timezone-aware time comparison)]
    | (outside window -> stop)
    v
[Supabase: getAll leads WHERE status IN ('calling','in_call') LIMIT 1]
    |
    v
[IF: Has active call? -> stop]
    |
    v
[HTTP Request: POST /rest/v1/rpc/pick_next_lead (Supabase REST API)]
    |
    v
[IF: Empty result? -> stop]
    |
    v
[HTTP Request: POST /retell/initiate-call with bearer auth + lead_id]
    |
    v
[IF: HTTP status != 2xx?]
    |-- 409/429 -> [Supabase: UPDATE leads SET status='queued']
    |-- 500     -> [Supabase: UPDATE leads SET status='failed']
    v
Done (next cycle in 2 min)
```

### Retry Requeue Pattern (AUTO-05, in main.py call_ended handler)

```python
# In call_ended handler, after status mapping:
if mapped_status in ("no_answer", "voicemail", "busy"):
    lead_row = supabase.table("leads").select("retry_count, max_retries").eq("id", lead_id).single().execute()
    if lead_row.data:
        current = lead_row.data
        if current["retry_count"] < current["max_retries"]:
            # Requeue with 60-minute backoff
            next_retry = datetime.now(timezone.utc) + timedelta(hours=1)
            supabase.table("leads").update({
                "status": mapped_status,  # Set intermediate status first (calling -> no_answer)
            }).eq("id", lead_id).execute()
            supabase.table("leads").update({
                "retry_count": current["retry_count"] + 1,
                "next_retry_at": next_retry.isoformat(),
                "status": "queued",  # Then requeue (no_answer -> queued)
            }).eq("id", lead_id).execute()
        else:
            # Retries exhausted
            supabase.table("leads").update({
                "status": mapped_status,  # calling -> no_answer first
            }).eq("id", lead_id).execute()
            supabase.table("leads").update({
                "status": "declined",  # no_answer -> declined
            }).eq("id", lead_id).execute()
```

**Important**: The state machine requires two-step transitions. You cannot go `calling -> queued` directly. The path is `calling -> no_answer -> queued` (or voicemail/busy). The DISCONNECT_TO_STATUS map already handles `calling -> no_answer/voicemail/busy`. The retry logic then transitions from that intermediate state to either `queued` (retry) or `declined` (exhausted).

### n8n Workflow JSON Structure

```
execution/n8n/auto-dialer.json
```

Top-level keys:
- `name`: "Sarah Auto-Dialer"
- `nodes`: Array of node objects
- `connections`: Object mapping source node names to outputs
- `active`: false (activated manually after import)
- `settings`: Global workflow settings
- `tags`: ["sarah", "auto-dialer"]

Each node object:
```json
{
  "parameters": { ... },
  "name": "Human-Readable Name",
  "type": "n8n-nodes-base.nodeType",
  "typeVersion": 1,
  "position": [x, y],
  "credentials": { "credentialType": { "id": "...", "name": "..." } }
}
```

Connections format:
```json
{
  "Source Node Name": {
    "main": [
      [
        { "node": "Target Node Name", "type": "main", "index": 0 }
      ]
    ]
  }
}
```

For IF node with true/false branches, the `main` array has two sub-arrays:
```json
{
  "IF Node": {
    "main": [
      [{ "node": "True Branch", "type": "main", "index": 0 }],
      [{ "node": "False Branch", "type": "main", "index": 0 }]
    ]
  }
}
```

### Anti-Patterns to Avoid
- **Using n8n Supabase node for RPC calls**: Unreliable parameter parsing for custom functions. Use HTTP Request to Supabase REST API instead.
- **Checking DNC in n8n**: Adds redundant logic. The database + backend already enforce DNC. User decision: locked.
- **Complex n8n error handling with Error Trigger workflows**: Overkill for this use case. Simple IF node checks on HTTP status codes are sufficient.
- **Directly transitioning calling -> queued or calling -> declined**: Invalid per state machine. Must go through intermediate status (no_answer/voicemail/busy) first.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Cron scheduling | Custom Python scheduler | n8n Schedule Trigger | n8n handles timezone, persistence, UI monitoring |
| Race-condition-safe queue pick | Manual SELECT + UPDATE | pick_next_lead() RPC with FOR UPDATE SKIP LOCKED | Atomic operation prevents duplicate calls |
| Workflow state visualization | Custom monitoring | n8n execution history UI | Built-in execution logs, error highlighting |
| Time window checking | Raw SQL time comparison | Code node with Luxon/moment | JavaScript timezone libraries handle DST correctly |

**Key insight:** n8n provides the scheduling, monitoring, and error visibility infrastructure. The backend provides the safety guarantees (rate limiting, DNC, active call guard). Each layer does what it does best.

## Common Pitfalls

### Pitfall 1: Missing next_retry_at Column
**What goes wrong:** Retry logic sets next_retry_at on leads, but the column does not exist in the schema.
**Why it happens:** The original schema (001_tables.sql) did not anticipate retry backoff scheduling. It has `retry_count` and `max_retries` but no `next_retry_at`.
**How to avoid:** Add ALTER TABLE migration: `ALTER TABLE leads ADD COLUMN next_retry_at TIMESTAMPTZ;`
**Warning signs:** Supabase returns error on UPDATE that includes next_retry_at field.

### Pitfall 2: State Machine Rejects calling -> failed Transition
**What goes wrong:** When the initiate-call endpoint fails (500) or dial errors occur (dial_failed, invalid_destination), the code tries to set lead status from `calling` to `failed`. The `enforce_lead_status_transition` trigger rejects this because `failed` is not in the allowed transitions from `calling`.
**Why it happens:** The original state machine in 005_functions.sql only allows `calling -> [in_call, no_answer, voicemail, busy]`. The DISCONNECT_TO_STATUS map in main.py maps several disconnect reasons to `failed` from `calling` state.
**How to avoid:** Update the valid_transitions in 005_functions.sql: `"calling": ["in_call", "no_answer", "voicemail", "busy", "failed"]`.
**Warning signs:** Database errors on status update after failed calls; leads stuck in `calling` status.

### Pitfall 3: n8n Supabase Node RPC Failure
**What goes wrong:** The n8n Supabase node's RPC operation fails with "Cannot read properties of undefined (reading 'properties')" when calling pick_next_lead().
**Why it happens:** n8n Supabase node has known bugs with parameter parsing for custom RPC functions, especially those returning SETOF or with no parameters.
**How to avoid:** Use HTTP Request node to POST to `https://<supabase-host>/rest/v1/rpc/pick_next_lead` with apikey and Authorization headers.
**Warning signs:** n8n execution fails at the RPC step; error loading parameter dropdowns in n8n UI.

### Pitfall 4: Empty RPC Result Crashes Downstream Nodes
**What goes wrong:** When pick_next_lead() returns an empty set (no queued leads), downstream nodes receive empty items and either fail or process empty data.
**Why it happens:** n8n passes empty arrays as "no items" which stops downstream execution. But the HTTP Request node wraps the response, so checking for empty data requires examining the response body.
**How to avoid:** After the RPC HTTP Request, use an IF node to check if the response body is an empty array `[]` or has length 0. Branch to a No-Op (stop) node on empty.
**Warning signs:** HTTP Request node to initiate-call fires with no lead_id; error in backend logs.

### Pitfall 5: Timezone Mismatch in Dial Window Check
**What goes wrong:** n8n compares current time against dial_schedules start_time/end_time but uses the wrong timezone.
**Why it happens:** The dial_schedules table stores times with a timezone field (e.g., "Europe/London"). n8n's instance timezone may differ. Simple time comparisons without timezone conversion give wrong results.
**How to avoid:** Use a Code node with Luxon (built into n8n) to get the current time in the schedule's timezone: `DateTime.now().setZone('Europe/London')`. Compare against start_time and end_time, and check day_of_week.
**Warning signs:** Calls happening outside intended hours; dialer silent during intended hours.

### Pitfall 6: pick_next_lead() Ignores Backoff Period
**What goes wrong:** A lead requeued with next_retry_at = NOW() + 60 minutes gets picked up immediately by the next poll cycle.
**Why it happens:** The current pick_next_lead() RPC only filters `WHERE status = 'queued'` without checking next_retry_at.
**How to avoid:** Update pick_next_lead() to add: `AND (next_retry_at IS NULL OR next_retry_at <= NOW())`.
**Warning signs:** Leads called again immediately after no_answer instead of waiting 60 minutes.

## Code Examples

### n8n Schedule Trigger Node (Cron Every 2 Minutes)
```json
{
  "parameters": {
    "rule": {
      "interval": [
        {
          "field": "cronExpression",
          "expression": "*/2 * * * *"
        }
      ]
    }
  },
  "name": "Every 2 Minutes",
  "type": "n8n-nodes-base.scheduleTrigger",
  "typeVersion": 1.2,
  "position": [0, 0]
}
```
Source: n8n Schedule Trigger docs + community examples

### n8n Supabase Node (getAll with Filter)
```json
{
  "parameters": {
    "operation": "getAll",
    "tableId": "dial_schedules",
    "returnAll": false,
    "limit": 10,
    "filters": {
      "conditions": [
        {
          "keyName": "is_active",
          "condition": "eq",
          "keyValue": "true"
        }
      ]
    }
  },
  "name": "Get Active Schedules",
  "type": "n8n-nodes-base.supabase",
  "typeVersion": 1,
  "position": [250, 0],
  "credentials": {
    "supabaseApi": {
      "id": "CREDENTIAL_ID",
      "name": "Supabase Service Key"
    }
  }
}
```
Source: n8n Supabase node docs + GitHub issue #13881

### n8n Supabase Node (getAll leads with IN filter)
```json
{
  "parameters": {
    "operation": "getAll",
    "tableId": "leads",
    "returnAll": false,
    "limit": 1,
    "filters": {
      "conditions": [
        {
          "keyName": "status",
          "condition": "in",
          "keyValue": "calling,in_call"
        }
      ]
    }
  },
  "name": "Check Active Call",
  "type": "n8n-nodes-base.supabase",
  "typeVersion": 1,
  "position": [750, 0],
  "credentials": {
    "supabaseApi": {
      "id": "CREDENTIAL_ID",
      "name": "Supabase Service Key"
    }
  }
}
```

### HTTP Request Node: Supabase RPC (pick_next_lead)
```json
{
  "parameters": {
    "method": "POST",
    "url": "={{ $env.SUPABASE_URL }}/rest/v1/rpc/pick_next_lead",
    "authentication": "genericCredentialType",
    "genericAuthType": "httpHeaderAuth",
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        {
          "name": "apikey",
          "value": "={{ $env.SUPABASE_SERVICE_KEY }}"
        },
        {
          "name": "Content-Type",
          "value": "application/json"
        }
      ]
    },
    "sendBody": true,
    "bodyParameters": {
      "parameters": []
    },
    "options": {
      "response": {
        "response": {
          "fullResponse": true
        }
      }
    }
  },
  "name": "Pick Next Lead (RPC)",
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.2,
  "position": [1000, 0]
}
```
Source: Supabase REST API docs + n8n community RPC workaround pattern

### HTTP Request Node: POST initiate-call
```json
{
  "parameters": {
    "method": "POST",
    "url": "={{ $env.WEBHOOK_BASE_URL }}/retell/initiate-call",
    "authentication": "genericCredentialType",
    "genericAuthType": "httpHeaderAuth",
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        {
          "name": "Authorization",
          "value": "Bearer {{ $env.DASHBOARD_SECRET_KEY }}"
        },
        {
          "name": "Content-Type",
          "value": "application/json"
        }
      ]
    },
    "sendBody": true,
    "specifyBody": "json",
    "jsonBody": "={{ JSON.stringify({ lead_id: $json.body[0].id }) }}",
    "options": {
      "response": {
        "response": {
          "fullResponse": true
        }
      }
    }
  },
  "name": "Initiate Call",
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.2,
  "position": [1250, 0]
}
```

### n8n IF Node (Check Empty RPC Result)
```json
{
  "parameters": {
    "conditions": {
      "options": {
        "caseSensitive": true,
        "leftValue": "",
        "typeValidation": "strict"
      },
      "conditions": [
        {
          "id": "check-empty",
          "leftValue": "={{ $json.body.length }}",
          "rightValue": 0,
          "operator": {
            "type": "number",
            "operation": "gt"
          }
        }
      ],
      "combinator": "and"
    },
    "options": {}
  },
  "name": "Has Lead?",
  "type": "n8n-nodes-base.if",
  "typeVersion": 2,
  "position": [1100, 0]
}
```

### n8n Code Node: Dial Window Check (Luxon)
```json
{
  "parameters": {
    "jsCode": "// Get schedule data from previous node\nconst schedules = $input.all();\nconst { DateTime } = require('luxon');\n\nfor (const item of schedules) {\n  const s = item.json;\n  const tz = s.timezone || 'Europe/London';\n  const now = DateTime.now().setZone(tz);\n  const currentTime = now.toFormat('HH:mm');\n  const currentDow = now.weekday; // 1=Mon, 7=Sun (matches PostgreSQL)\n  \n  const startTime = s.start_time; // '10:00'\n  const endTime = s.end_time;     // '19:00'\n  const daysOfWeek = s.days_of_week; // [1,2,3,4,5,6,7]\n  \n  if (currentTime >= startTime && currentTime <= endTime && daysOfWeek.includes(currentDow)) {\n    return [{ json: { inWindow: true, timezone: tz, currentTime } }];\n  }\n}\n\n// Outside all dial windows\nreturn [];"
  },
  "name": "Check Dial Window",
  "type": "n8n-nodes-base.code",
  "typeVersion": 2,
  "position": [500, 0]
}
```
Source: Luxon is bundled with n8n and available in Code nodes.

### Schema Migration: Add next_retry_at Column
```sql
-- 006_add_next_retry_at.sql
-- Adds next_retry_at column to leads table for retry backoff scheduling.
-- Required by Phase 6 (AUTO-05) retry logic.

ALTER TABLE leads ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ;

-- Update partial index on queued leads to include next_retry_at
DROP INDEX IF EXISTS idx_leads_queued;
CREATE INDEX idx_leads_queued
    ON leads(priority DESC, created_at ASC)
    WHERE status = 'queued';
-- Note: next_retry_at filtering is done in the RPC function, not the index.
-- The index already covers the status='queued' filter which is the primary selectivity.
```

### Updated pick_next_lead() RPC
```sql
CREATE OR REPLACE FUNCTION pick_next_lead()
RETURNS SETOF leads
LANGUAGE plpgsql
AS $$
DECLARE
    selected_lead leads%ROWTYPE;
BEGIN
    SELECT * INTO selected_lead
    FROM leads
    WHERE status = 'queued'
      AND (next_retry_at IS NULL OR next_retry_at <= NOW())
    ORDER BY priority DESC, created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    IF selected_lead.id IS NULL THEN
        RETURN;
    END IF;

    UPDATE leads
    SET status = 'calling', updated_at = NOW()
    WHERE id = selected_lead.id;

    selected_lead.status := 'calling';
    selected_lead.updated_at := NOW();
    RETURN NEXT selected_lead;
END;
$$;
```

### Updated State Machine (calling -> failed added)
```sql
-- In enforce_lead_status_transition(), update valid_transitions:
valid_transitions JSONB := '{
    "new": ["queued", "failed"],
    "queued": ["calling"],
    "calling": ["in_call", "no_answer", "voicemail", "busy", "failed"],
    "in_call": ["committed", "follow_up", "declined", "not_qualified"],
    "committed": ["payment_sent"],
    "follow_up": ["queued"],
    "no_answer": ["queued", "declined"],
    "voicemail": ["queued", "declined"],
    "busy": ["queued", "declined"]
}'::JSONB;
```

### Retry Logic in call_ended Handler
```python
# Disconnect reasons that should trigger retry evaluation
RETRY_ELIGIBLE_STATUSES = {"no_answer", "voicemail", "busy"}

async def handle_retry_requeue(lead_id: str, mapped_status: str):
    """Requeue lead with backoff if retries remain, else decline."""
    lead_row = (
        supabase.table("leads")
        .select("retry_count, max_retries")
        .eq("id", lead_id)
        .single()
        .execute()
    )
    if not lead_row.data:
        return

    retry_count = lead_row.data["retry_count"]
    max_retries = lead_row.data["max_retries"]

    if retry_count < max_retries:
        # Requeue with 60-minute backoff
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
        # Retries exhausted
        supabase.table("leads").update({
            "status": "declined",
        }).eq("id", lead_id).eq("status", mapped_status).execute()
        logger.info(
            "Retries exhausted: lead %s -> declined (%d/%d used)",
            lead_id, retry_count, max_retries,
        )
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| n8n Supabase node for RPC | HTTP Request to /rest/v1/rpc/ | Ongoing (bug) | Must use HTTP Request for pick_next_lead() |
| n8n-nodes-base.cron (deprecated) | n8n-nodes-base.scheduleTrigger | n8n 1.x | Use scheduleTrigger, not cron |
| n8n IF node typeVersion 1 | IF node typeVersion 2 | n8n 1.x | New condition format with options and typed operators |
| n8n-nodes-base.http | n8n-nodes-base.httpRequest typeVersion 4.2 | n8n 2.x | Updated node type identifier; v4 supports full response, auth presets |

**Deprecated/outdated:**
- `n8n-nodes-base.cron`: Replaced by `n8n-nodes-base.scheduleTrigger`. Do not use.
- `n8n-nodes-base.http`: Replaced by `n8n-nodes-base.httpRequest`. Do not use.
- IF node typeVersion 1: Use typeVersion 2 with the new conditions format.

## Open Questions

1. **n8n Credential IDs**
   - What we know: Credentials must be referenced by `id` and `name` in the workflow JSON. The n8n instance at n8n.srv1297445.hstgr.cloud likely has Supabase credentials already configured.
   - What's unclear: The exact credential IDs. These are assigned by n8n when credentials are created.
   - Recommendation: Use placeholder IDs in the exported JSON (e.g., `"id": "SUPABASE_CRED_ID"`, `"id": "BEARER_CRED_ID"`). After import, re-link credentials in the n8n UI. Document which credentials need creation.

2. **n8n Environment Variables ($env) Availability**
   - What we know: n8n supports environment variables in expressions via `$env.VARIABLE_NAME`. Self-hosted n8n instances can set env vars.
   - What's unclear: Whether the self-hosted instance already has SUPABASE_URL, SUPABASE_SERVICE_KEY, DASHBOARD_SECRET_KEY, and WEBHOOK_BASE_URL configured.
   - Recommendation: Use `$env` references in the workflow JSON. Document required env vars. If not available, fall back to n8n credential references.

3. **n8n httpRequest Node Exact typeVersion on Self-Hosted Instance**
   - What we know: n8n 2.11.x ships with httpRequest typeVersion 4.x. The exact minor version (4.1, 4.2) depends on the n8n version.
   - What's unclear: Exact n8n version running on the self-hosted instance.
   - Recommendation: Use typeVersion 4.2 (current stable). If import fails, downgrade to 4.1 or 4.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest (backend unit tests) + n8n manual execution (workflow tests) |
| Config file | None yet -- Wave 0 task |
| Quick run command | `cd execution/backend && python -m pytest tests/ -x -q` |
| Full suite command | `cd execution/backend && python -m pytest tests/ -v` |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTO-01 | n8n workflow polls queue, checks window, picks lead, initiates call | manual + smoke | n8n manual execution + `curl -X POST .../retell/initiate-call` | No -- Wave 0 |
| AUTO-05 | call_ended handler requeues on no_answer/voicemail/busy with 60min backoff | unit | `python -m pytest tests/test_retry.py -x` | No -- Wave 0 |
| AUTO-05 | Retries exhausted leads set to declined | unit | `python -m pytest tests/test_retry.py -x` | No -- Wave 0 |
| AUTO-06 | DNC leads never picked by pick_next_lead() | unit (SQL) | Verify RPC excludes status != 'queued' | No -- verified by design |

### Sampling Rate
- **Per task commit:** n8n workflow dry-run (manual trigger) + backend endpoint curl test
- **Per wave merge:** Full n8n execution chain test with a test lead
- **Phase gate:** n8n workflow imported, activated, and confirmed to poll without errors

### Wave 0 Gaps
- [ ] `execution/backend/schema/006_retry_migration.sql` -- add next_retry_at column + update RPC
- [ ] `execution/n8n/auto-dialer.json` -- complete workflow replacing placeholder
- [ ] n8n credential creation on self-hosted instance (Supabase + HTTP header auth)
- [ ] n8n environment variables configured (SUPABASE_URL, SUPABASE_SERVICE_KEY, WEBHOOK_BASE_URL, DASHBOARD_SECRET_KEY)

## Sources

### Primary (HIGH confidence)
- [n8n Schedule Trigger Documentation](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.scheduletrigger/) -- Cron expression format, trigger configuration
- [n8n Supabase Node Documentation](https://docs.n8n.io/integrations/builtin/app-nodes/n8n-nodes-base.supabase/) -- Operations: getAll, create, update, delete. Filter syntax.
- [n8n HTTP Request Node Documentation](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.httprequest/) -- POST method, JSON body, bearer auth, full response option
- [n8n IF Node Documentation](https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.if/) -- Conditional branching, typeVersion 2 conditions format
- [n8n Error Handling Documentation](https://docs.n8n.io/flow-logic/error-handling/) -- Error Trigger, On Error: Continue options
- [Supabase REST API: Creating Routes (RPC)](https://supabase.com/docs/guides/api/creating-routes) -- POST /rest/v1/rpc/function_name with apikey and Authorization headers
- [n8n Workflow JSON Guide](https://github.com/nordeim/n8n-Workflow/blob/main/authoritative_n8n_workflow_json_guide.md) -- Complete JSON structure: nodes, connections, settings

### Secondary (MEDIUM confidence)
- [n8n Community: Supabase Node RPC Error](https://community.n8n.io/t/supabase-node-error-loading-parameter/83077) -- Confirms RPC parameter parsing bug, recommends HTTP Request workaround
- [n8n Community: HTTP Request Error Branching](https://community.n8n.io/t/how-to-branch-if-http-request-failed/11971) -- Full Response + IF node pattern for status code checking
- [n8n GitHub: Supabase getAll Issue #13881](https://github.com/n8n-io/n8n/issues/13881) -- Confirms Supabase node JSON structure with filters
- [n8n Export/Import Workflows](https://docs.n8n.io/workflows/export-import/) -- JSON export format, credential exclusion

### Tertiary (LOW confidence)
- Exact n8n httpRequest typeVersion on self-hosted instance -- assumed 4.2, may need adjustment
- n8n Code node Luxon availability -- documented as built-in, not verified on this specific instance

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- n8n node types, Supabase REST API, and workflow JSON structure all well-documented
- Architecture: HIGH -- node chain follows established patterns; RPC workaround confirmed by community
- Pitfalls: HIGH -- state machine gap and missing column verified by reading actual code; RPC bug confirmed by community reports
- Code examples: MEDIUM -- JSON node structures derived from documentation and real examples, but exact typeVersion and credential format may need minor adjustments on import

**Research date:** 2026-03-25
**Valid until:** 2026-04-25 (n8n node APIs are stable; Supabase REST API is stable)
