# Phase 1: Foundation + SDK Migration - Research

**Researched:** 2026-03-25
**Domain:** Supabase PostgreSQL schema design, retell-sdk 4.x-to-5.x migration, Retell phone number weighted agents API
**Confidence:** HIGH

## Summary

Phase 1 has three distinct workstreams: (1) Supabase database schema with 4 core tables, 3 reference data tables, SQL views, an atomic RPC function, and RLS policies; (2) retell-sdk upgrade from 4.12.0 to 5.8.0 with breaking changes in the phone call creation API; (3) phone number migration from deprecated `inbound_agent_id`/`outbound_agent_id` fields to weighted agents arrays before the **March 31, 2026 hard deadline** (6 days from research date).

The database work is standard PostgreSQL -- no novel patterns required. The `pick_next_lead()` RPC function uses the well-established `FOR UPDATE SKIP LOCKED` pattern for atomic queue operations. RLS policies follow Supabase's standard service_role/anon split. The 14-state lead lifecycle is enforced via a BEFORE UPDATE trigger function with a valid transitions map.

The SDK migration is the highest-risk workstream. The `create_phone_call()` method signature changed between SDK 4.x and 5.x: the `agent_id` parameter was replaced by `override_agent_id` (optional), with the phone number's bound `outbound_agents` array serving as the default agent selection. The existing `main.py` code passes `agent_id=agent_id` which will fail on SDK 5.x. The phone number must have `outbound_agents` configured with the correct agent for outbound calls to work without specifying `override_agent_id` on every call.

**Primary recommendation:** Execute the phone number weighted agents migration FIRST (highest risk, hard deadline), then SDK upgrade (breaks existing code patterns), then database schema (no deadline pressure, mechanical work).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Full 14-state lead lifecycle: new, queued, calling, in_call, committed, follow_up, declined, not_qualified, no_answer, voicemail, busy, payment_sent, do_not_contact, failed
- DB-level enforcement via trigger function with valid transitions map (not app-level only)
- Valid transitions map as specified in CONTEXT.md (new->queued|failed, queued->calling, calling->in_call|no_answer|voicemail|busy, etc.)
- payment_sent is a lead status (not tracked separately) -- visible in pipeline kanban
- Max-retried leads (2 retries exhausted) move to 'declined', not 'failed'
- do_not_contact triggered by: lead verbal opt-out, manual operator action, regulatory DNC list import
- 3 separate reference tables (not JSON blobs, not hardcoded): programmes (4 rows), pricing (16 rows), objection_responses (30+ rows)
- 4 pathways: Cloud Computing, Advanced DevOps, Platform Engineer, SRE
- 4 bundle tracks: Zero to Cloud DevOps (1+2), DevOps Pro (3+4), 3 Pathways (any 3), Zero to DevOps Pro (all 4)
- 4 currencies: GBP, USD, EUR, NGN
- 10 objection categories
- SQL seed files in execution/backend/seeds/ (001_programmes.sql, 002_pricing.sql, 003_objection_responses.sql, 004_test_leads.sql)
- Dial window defaults: Europe/London, 10am-7pm, 7 days/week
- retell-sdk upgrade from 4.12.0 to 5.8.0
- Phone number must use weighted agents array (not deprecated fields)
- HARD DEADLINE: March 31, 2026

### Claude's Discretion
- Exact column types and indexes for each table
- RLS policy specifics (which roles get which access)
- SQL view query logic
- retell-sdk 5.x migration approach (method signature changes)
- pick_next_lead() RPC implementation details
- Phone number weighted agents API call format

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| DATA-01 | leads table with 14 status states, priority ordering, phone in E.164 format | Schema pattern from skills.md validated; 14-state CHECK constraint + trigger-enforced transitions; partial index on queued status for priority ordering |
| DATA-02 | call_logs table storing retell_call_id, outcome, strategy, persona, transcript, recording URL, duration, cost | Schema from skills.md; UNIQUE constraint on retell_call_id for webhook dedup; composite index on strategy+persona for analytics |
| DATA-03 | pipeline_logs table tracking every lead status transition with timestamp and trigger | Trigger function auto-inserts on leads.status change; component + event + details JSONB pattern |
| DATA-04 | dial_schedules table for time window configuration | Schema from skills.md; Europe/London timezone default per user decision; 7-day default per user decision |
| DATA-05 | SQL views: pipeline_snapshot, strategy_performance, todays_calls | Standard aggregation views; verified patterns in Supabase PostgreSQL |
| DATA-06 | Atomic pick_next_lead() RPC using FOR UPDATE SKIP LOCKED | Verified pattern from Supabase/PostgreSQL docs; PL/pgSQL function with atomic UPDATE+RETURNING |
| DATA-07 | Row Level Security policies on all tables with service key for backend, anon key for dashboard reads | Standard Supabase RLS pattern: service_role bypasses RLS, anon gets SELECT-only on specific tables |
| VOICE-04 | Phone number +1 (740) 494-3597 assigned to agent using weighted agents format | Retell Update Phone Number API with outbound_agents array; AgentWeight schema {agent_id, weight} verified from official docs |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| retell-sdk | 5.8.0 | Retell AI API client (calls, agents, phone numbers) | MUST upgrade from 4.12.0; weighted agents API requires 5.x |
| supabase | 2.12.0 | Supabase Python client for DB operations | Existing dependency, minor version bump from 2.10.0 |
| python-dotenv | 1.0.1 | Environment variable loading | Already in use, no change needed |
| pytz | 2024.1 | Timezone handling for dial windows | Already in use for Europe/London dial window logic |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| fastapi | 0.115.0 | Web framework (no change in Phase 1) | Already installed; no upgrade needed for Phase 1 |
| pydantic | 2.9.0 | Data validation (no change in Phase 1) | Already installed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| FOR UPDATE SKIP LOCKED | Supabase pgmq extension | pgmq adds dependency; SKIP LOCKED is native PostgreSQL, simpler for single-worker queue |
| PL/pgSQL trigger for state transitions | App-level validation in Python | User decision locked: DB-level enforcement. Trigger prevents invalid transitions regardless of client. |

**Installation:**
```bash
pip install retell-sdk==5.8.0 supabase==2.12.0
```

**requirements.txt changes:**
```
retell-sdk==5.8.0   # was 4.12.0
supabase==2.12.0    # was 2.10.0
```

## Architecture Patterns

### Recommended File Structure (Phase 1 additions)
```
execution/backend/
  seeds/
    001_programmes.sql          # 4 pathway rows
    002_pricing.sql             # 16 pricing rows (4 bundles x 4 currencies)
    003_objection_responses.sql # 30+ objection rows from knowledge-base PDF
    004_test_leads.sql          # 10 Wave 0 test leads
  schema/
    001_tables.sql              # 4 core + 3 reference tables
    002_indexes.sql             # All indexes
    003_rls.sql                 # RLS policies
    004_views.sql               # 3 SQL views
    005_functions.sql           # pick_next_lead() RPC + status transition trigger
  requirements.txt              # Updated versions
  retell_config.py              # Unchanged (Retell client init)
  supabase_client.py            # Unchanged (Supabase client init)
  migrate_phone_number.py       # One-time script to update phone number to weighted agents
```

### Pattern 1: Atomic Queue with FOR UPDATE SKIP LOCKED
**What:** PL/pgSQL function that atomically selects the highest-priority queued lead, locks it, updates status to 'calling', and returns the lead row -- all in a single transaction.
**When to use:** Every time the auto-dialer picks the next lead to call.
**Example:**
```sql
-- Source: Supabase/PostgreSQL SKIP LOCKED best practices
-- https://supaexplorer.com/best-practices/supabase-postgres/lock-skip-locked/
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

**Calling from Python:**
```python
# Source: https://supabase.com/docs/reference/python/rpc
result = supabase.rpc("pick_next_lead").execute()
lead = result.data[0] if result.data else None
```

### Pattern 2: State Transition Trigger (DB-Level Enforcement)
**What:** A BEFORE UPDATE trigger on the leads table that checks if the old_status -> new_status transition is in the valid transitions map. Raises an exception if invalid. Also auto-inserts into pipeline_logs.
**When to use:** On every leads.status update -- enforced at DB level regardless of which client makes the change.
**Example:**
```sql
CREATE OR REPLACE FUNCTION enforce_lead_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  valid_transitions JSONB := '{
    "new": ["queued", "failed"],
    "queued": ["calling"],
    "calling": ["in_call", "no_answer", "voicemail", "busy"],
    "in_call": ["committed", "follow_up", "declined", "not_qualified"],
    "committed": ["payment_sent"],
    "follow_up": ["queued"],
    "no_answer": ["queued", "declined"],
    "voicemail": ["queued", "declined"],
    "busy": ["queued", "declined"]
  }'::JSONB;
  allowed JSONB;
BEGIN
  -- Allow any state -> do_not_contact (regulatory override)
  IF NEW.status = 'do_not_contact' THEN
    RETURN NEW;
  END IF;

  -- Skip if status unchanged
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  allowed := valid_transitions -> OLD.status;
  IF allowed IS NULL OR NOT allowed ? NEW.status THEN
    RAISE EXCEPTION 'Invalid status transition: % -> %', OLD.status, NEW.status;
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_lead_status
  BEFORE UPDATE OF status ON leads
  FOR EACH ROW
  EXECUTE FUNCTION enforce_lead_status_transition();
```

### Pattern 3: Pipeline Log Auto-Insert on Status Change
**What:** An AFTER UPDATE trigger that inserts into pipeline_logs whenever leads.status changes. Provides full audit trail.
**Example:**
```sql
CREATE OR REPLACE FUNCTION log_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO pipeline_logs (lead_id, component, event, details)
    VALUES (
      NEW.id,
      'status_transition',
      OLD.status || ' -> ' || NEW.status,
      jsonb_build_object(
        'old_status', OLD.status,
        'new_status', NEW.status,
        'triggered_by', current_setting('app.triggered_by', true)
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_status_transition
  AFTER UPDATE OF status ON leads
  FOR EACH ROW
  EXECUTE FUNCTION log_status_transition();
```

### Pattern 4: Weighted Agents Phone Number Update
**What:** One-time migration script to update the phone number from deprecated fields to weighted agents array.
**Example:**
```python
# Source: https://docs.retellai.com/api-references/update-phone-number
from retell import Retell
import os

client = Retell(api_key=os.environ["RETELL_API_KEY"])
agent_id = os.environ["RETELL_AGENT_ID"]

# Update phone number to use weighted agents
phone = client.phone_number.update(
    phone_number="+17404943597",
    outbound_agents=[{
        "agent_id": agent_id,
        "weight": 1.0,
    }],
    inbound_agents=[{
        "agent_id": agent_id,
        "weight": 1.0,
    }],
)
print(f"Updated: {phone.phone_number}")
print(f"Outbound agents: {phone.outbound_agents}")
print(f"Inbound agents: {phone.inbound_agents}")
```

### Pattern 5: Retell SDK 5.x create_phone_call (Changed Signature)
**What:** The `create_phone_call()` method no longer accepts `agent_id` as a parameter. In SDK 5.x, outbound calls use the agent bound to the phone number's `outbound_agents` array by default. Use `override_agent_id` only to use a DIFFERENT agent than the bound one.
**Example:**
```python
# SDK 5.x: No agent_id parameter
# The phone number's outbound_agents binding determines the agent
call = retell_client.call.create_phone_call(
    from_number="+17404943597",
    to_number=lead_data["phone"],
    retell_llm_dynamic_variables={
        "lead_name": lead_data["name"],
        "lead_location": lead_data.get("location", "unknown"),
    },
)

# If you need a DIFFERENT agent than the phone number's bound agent:
call = retell_client.call.create_phone_call(
    from_number="+17404943597",
    to_number=lead_data["phone"],
    override_agent_id="some_other_agent_id",
    retell_llm_dynamic_variables={...},
)
```

### Anti-Patterns to Avoid
- **Using agent_id in create_phone_call():** Removed in SDK 5.x. Will cause TypeError. Use phone number binding + optional `override_agent_id`.
- **Using inbound_agent_id/outbound_agent_id on phone numbers:** Deprecated, stops working March 31, 2026. Use `inbound_agents`/`outbound_agents` weighted arrays.
- **App-level-only status validation:** User decided DB-level trigger enforcement. Do NOT rely solely on Python code to validate transitions.
- **Simple SELECT for queue picking:** Race condition risk. MUST use `FOR UPDATE SKIP LOCKED` in an RPC function.
- **Hardcoding transition rules in multiple places:** Define transitions ONCE in the trigger function. App code can have a copy for UI purposes but the DB is the authority.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Atomic queue picking | Custom locking logic in Python | PostgreSQL `FOR UPDATE SKIP LOCKED` in RPC | Race conditions between n8n polling and API calls; DB-level locking is the only safe approach |
| State machine validation | Python if/elif chains checking transitions | PostgreSQL BEFORE UPDATE trigger with JSONB transitions map | User decision: DB-level enforcement. Trigger catches ALL clients (Python, n8n, SQL Editor) |
| Audit logging | Manual INSERT statements after each status change | PostgreSQL AFTER UPDATE trigger auto-inserting to pipeline_logs | Guarantees no transition is missed; reduces code duplication |
| Phone number E.164 validation | Custom regex per table | CHECK constraint `phone ~ '^\+[1-9]\d{6,14}$'` on leads.phone | Enforced at DB level; cannot be bypassed by any client |

**Key insight:** The database is the single source of truth. Triggers and constraints ensure data integrity regardless of which client (FastAPI, n8n, Supabase dashboard, direct SQL) modifies data.

## Common Pitfalls

### Pitfall 1: SDK 5.x create_phone_call() Breaking Change
**What goes wrong:** Passing `agent_id=...` to `create_phone_call()` raises TypeError in retell-sdk 5.x because the parameter was removed.
**Why it happens:** SDK 4.x had an `agent_id` parameter. SDK 5.x replaced it with reliance on phone number `outbound_agents` binding + optional `override_agent_id`.
**How to avoid:** After upgrading to SDK 5.x, update `main.py:initiate_call()` to remove the `agent_id` parameter. Ensure the phone number has `outbound_agents` configured with the correct agent. Only use `override_agent_id` if you need a different agent per call.
**Warning signs:** TypeError on `create_phone_call()`, "unexpected keyword argument 'agent_id'" error.

### Pitfall 2: Weighted Agents Weights Must Sum to 1.0
**What goes wrong:** Phone number update fails if weights don't sum to exactly 1.0.
**Why it happens:** Retell enforces `sum(weights) == 1.0` on inbound_agents and outbound_agents arrays.
**How to avoid:** For single-agent setup, use `weight: 1.0`. For multiple agents, ensure weights sum precisely.
**Warning signs:** 400 error from Retell API on phone number update.

### Pitfall 3: Status Transition Trigger Blocking pick_next_lead()
**What goes wrong:** `pick_next_lead()` updates status from 'queued' to 'calling'. If the transition trigger is too restrictive or has a bug, the RPC function fails.
**Why it happens:** The trigger fires on ALL status updates, including those from RPC functions.
**How to avoid:** Test `pick_next_lead()` after creating the trigger. Ensure 'queued' -> 'calling' is in the valid transitions map. Test the full cycle.
**Warning signs:** RPC call returns error about invalid transition.

### Pitfall 4: Missing Partial Index on Queued Leads
**What goes wrong:** `pick_next_lead()` becomes slow as leads table grows, because `FOR UPDATE SKIP LOCKED` still needs to scan rows.
**Why it happens:** Without a partial index on `status = 'queued'`, PostgreSQL does a sequential scan.
**How to avoid:** Create `CREATE INDEX idx_leads_queued ON leads(priority DESC, created_at ASC) WHERE status = 'queued';`
**Warning signs:** Slow RPC response times as lead count increases.

### Pitfall 5: Self-Hosted Supabase RLS with Service Role
**What goes wrong:** Service role key client gets RLS errors or empty data on self-hosted Supabase.
**Why it happens:** Self-hosted Supabase may have different RLS configuration for service_role depending on the version and configuration.
**How to avoid:** Verify that the service_role key bypasses RLS by testing: `supabase.table("leads").select("*").execute()` after enabling RLS. If it fails, check the Supabase configuration for the `service_role` role permissions.
**Warning signs:** Empty results from backend queries after enabling RLS.

### Pitfall 6: Seed Data Referencing Non-Existent Tables
**What goes wrong:** Seed SQL files fail because reference tables (programmes, pricing, objection_responses) don't exist yet.
**Why it happens:** Schema creation and seed data are separate files; running seeds before schema causes FK errors.
**How to avoid:** Schema files (001_tables.sql) must be run before seed files (001_programmes.sql). Number the files to enforce order.
**Warning signs:** "relation does not exist" SQL errors.

### Pitfall 7: CONTEXT.md Lead States vs skills.md Lead States
**What goes wrong:** The leads table CHECK constraint has wrong status values, causing insert/update failures.
**Why it happens:** CONTEXT.md defines 14 states (new, queued, calling, in_call, committed, follow_up, declined, not_qualified, no_answer, voicemail, busy, payment_sent, do_not_contact, failed) which differs from skills.md's original states (invalid_number, exhausted, payment_pending, enrolled instead of not_qualified, payment_sent, failed).
**How to avoid:** Use the CONTEXT.md 14-state list as the authoritative source (user decision). The CHECK constraint and trigger must use exactly these 14 values.
**Warning signs:** Status update failures due to CHECK constraint violation.

## Code Examples

### Example 1: RLS Policies for Core Tables
```sql
-- Source: https://supabase.com/docs/guides/auth/oauth-server/token-security
-- and security.md section 4

-- Enable RLS on all tables
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE dial_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE programmes ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE objection_responses ENABLE ROW LEVEL SECURITY;

-- Service role: full access (backend uses service key, bypasses RLS)
-- Note: service_role ALWAYS bypasses RLS in Supabase, so explicit
-- policies are not needed for service_role. These policies are for
-- the anon key used by the dashboard.

-- Anon/authenticated: read-only on select tables
CREATE POLICY "anon_read_leads" ON leads
    FOR SELECT TO anon USING (true);

CREATE POLICY "anon_read_call_logs" ON call_logs
    FOR SELECT TO anon USING (true);

CREATE POLICY "anon_read_pipeline_logs" ON pipeline_logs
    FOR SELECT TO anon USING (true);

CREATE POLICY "anon_read_dial_schedules" ON dial_schedules
    FOR SELECT TO anon USING (true);

-- Reference tables: read-only for everyone
CREATE POLICY "anon_read_programmes" ON programmes
    FOR SELECT TO anon USING (true);

CREATE POLICY "anon_read_pricing" ON pricing
    FOR SELECT TO anon USING (true);

CREATE POLICY "anon_read_objections" ON objection_responses
    FOR SELECT TO anon USING (true);

-- No INSERT/UPDATE/DELETE policies for anon = dashboard cannot modify data
```

### Example 2: Reference Table Schemas
```sql
-- programmes: 4 pathways
CREATE TABLE programmes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    duration_weeks INTEGER NOT NULL,
    description TEXT,
    topics TEXT[] DEFAULT '{}',
    prerequisites TEXT,
    tools TEXT[] DEFAULT '{}',
    roles_after TEXT[] DEFAULT '{}',
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- pricing: 16 rows (4 bundles x 4 currencies)
CREATE TABLE pricing (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    bundle_name TEXT NOT NULL,
    bundle_slug TEXT NOT NULL,
    bundle_size INTEGER NOT NULL,
    pathway_ids TEXT[] DEFAULT '{}',
    currency TEXT NOT NULL CHECK (currency IN ('GBP', 'USD', 'EUR', 'NGN')),
    standard_price DECIMAL(10,2) NOT NULL,
    early_bird_price DECIMAL(10,2) NOT NULL,
    early_bird_deadline DATE,
    instalment_2_total DECIMAL(10,2),
    instalment_3_total DECIMAL(10,2),
    instalment_dates DATE[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(bundle_slug, currency)
);

-- objection_responses: 30+ rows
CREATE TABLE objection_responses (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    category TEXT NOT NULL,
    objection_key TEXT NOT NULL UNIQUE,
    trigger_phrases TEXT[] DEFAULT '{}',
    what_theyre_saying TEXT,
    responses JSONB NOT NULL DEFAULT '[]',
    cultural_nuances JSONB DEFAULT '{}',
    recovery_script TEXT,
    escalation_trigger TEXT,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Example 3: Updated leads Table (14 States from CONTEXT.md)
```sql
CREATE TABLE leads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE CHECK (phone ~ '^\+[1-9]\d{6,14}$'),
    email TEXT,
    location TEXT,
    country TEXT,
    currency TEXT DEFAULT 'GBP',
    status TEXT DEFAULT 'new' CHECK (status IN (
        'new', 'queued', 'calling', 'in_call',
        'committed', 'follow_up', 'declined', 'not_qualified',
        'no_answer', 'voicemail', 'busy',
        'payment_sent', 'do_not_contact', 'failed'
    )),
    experience_level TEXT,
    has_aws_sa_cert BOOLEAN DEFAULT FALSE,
    has_hands_on_projects BOOLEAN DEFAULT FALSE,
    current_role TEXT,
    motivation TEXT,
    programme_recommended TEXT,
    last_call_id TEXT,
    last_call_at TIMESTAMPTZ,
    call_count INTEGER DEFAULT 0,
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 2,
    last_strategy_used TEXT,
    detected_persona TEXT,
    follow_up_at TIMESTAMPTZ,
    outcome TEXT,
    decline_reason TEXT,
    source TEXT DEFAULT 'csv_import',
    priority INTEGER DEFAULT 0,
    notes TEXT
);

-- Indexes
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_queued ON leads(priority DESC, created_at ASC)
    WHERE status = 'queued';
CREATE INDEX idx_leads_phone ON leads(phone);
```

### Example 4: Updated main.py initiate_call (SDK 5.x)
```python
# BEFORE (SDK 4.x) -- WILL BREAK
call = retell_client.call.create_phone_call(
    from_number=from_number,
    to_number=lead_data["phone"],
    agent_id=agent_id,                    # REMOVED in SDK 5.x
    retell_llm_dynamic_variables={...},
)

# AFTER (SDK 5.x) -- CORRECT
# Phone number's outbound_agents binding determines the agent
call = retell_client.call.create_phone_call(
    from_number="+17404943597",
    to_number=lead_data["phone"],
    retell_llm_dynamic_variables={
        "lead_name": lead_data["name"],
        "lead_location": lead_data.get("location", "unknown"),
    },
)
```

### Example 5: Dial Schedule Seed (Europe/London, 10am-7pm, 7 days)
```sql
INSERT INTO dial_schedules (name, start_time, end_time, timezone, days_of_week, is_active)
VALUES (
    'Default - UK Business Hours',
    '10:00:00',
    '19:00:00',
    'Europe/London',
    ARRAY[1,2,3,4,5,6,7],  -- Monday through Sunday
    TRUE
);
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `inbound_agent_id` / `outbound_agent_id` on phone numbers | `inbound_agents` / `outbound_agents` weighted arrays | March 19, 2026 (deprecated); March 31, 2026 (removed) | Phone number config breaks after deadline; must migrate |
| `agent_id` param in `create_phone_call()` | Phone number binding + optional `override_agent_id` | retell-sdk 5.0.0 (December 5, 2025) | Existing main.py code breaks on SDK upgrade |
| `client.llm.create()` with `general_prompt` | `response_engine` object on agent create | 2025 | Agent creation pattern changed; affects Phase 2-3 not Phase 1 |
| `retell-sdk==4.12.0` | `retell-sdk==5.8.0` | December 5, 2025 (5.0.0 released) | Major version bump; check all SDK method calls |

**Deprecated/outdated:**
- `inbound_agent_id` / `outbound_agent_id` on phone numbers: replaced by weighted arrays. Stops working March 31, 2026.
- `agent_id` parameter on `create_phone_call()`: removed in SDK 5.x. Use phone number binding.
- `from_number` env var `TWILIO_NUMBER`: Phone number is now +17404943597 (the Retell number), not the old Twilio number +11615700419.

## Open Questions

1. **Exact retell-sdk 5.0.0 breaking changes beyond create_phone_call**
   - What we know: `agent_id` parameter removed from `create_phone_call()`, weighted agents arrays added to phone number API, `response_engine` object on agent create
   - What's unclear: Full list of ALL method signature changes between 4.12.0 and 5.8.0. GitHub CHANGELOG.md is truncated.
   - Recommendation: After upgrading pip package, run `python -c "from retell import Retell; help(Retell)"` and test each SDK call used in the codebase. The only Phase 1 calls are: `phone_number.update()` and `call.create_phone_call()` (for verification). Agent/LLM calls are Phase 2-3.

2. **Self-hosted Supabase feature parity with managed Supabase**
   - What we know: Self-hosted at supabase.operscale.cloud. RPC functions, RLS, views all work on standard PostgreSQL.
   - What's unclear: Whether the self-hosted version supports all PostgREST features, particularly the `.rpc()` call returning table rows.
   - Recommendation: Test `pick_next_lead()` RPC immediately after creation. Fall back to raw SQL via `supabase.rpc("raw_sql", {"query": "SELECT pick_next_lead()"})` if needed.

3. **Knowledge base PDF data extraction for seed files**
   - What we know: programmes.pdf, objection-handling.pdf, payment-details.pdf contain the source data for seed files. PDFs cannot be read programmatically in the current environment.
   - What's unclear: Exact pricing figures, objection category names, and programme details needed for seed SQL.
   - Recommendation: The implementer will need to read the PDFs manually or use a PDF extraction tool. Key data points from CONTEXT.md: 4 pathways, 4 bundles, 4 currencies, GBP1500/GBP1350 early bird, 10 objection categories, early bird expires March 18 2026, Cohort 2 starts April 25 2026.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Manual SQL verification + Python smoke tests |
| Config file | None -- Phase 1 is primarily SQL schema + API calls |
| Quick run command | `python -c "from supabase_client import supabase; print(supabase.table('leads').select('count', count='exact').execute())"` |
| Full suite command | `python execution/backend/test_phase1.py` (to be created in Wave 0) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DATA-01 | leads table exists with 14 status CHECK constraint | smoke | `supabase.rpc('pick_next_lead').execute()` after inserting test lead | No - Wave 0 |
| DATA-02 | call_logs table with UNIQUE retell_call_id | smoke | Insert duplicate retell_call_id, verify constraint violation | No - Wave 0 |
| DATA-03 | pipeline_logs auto-populated on status change | integration | Update lead status, verify pipeline_logs row created | No - Wave 0 |
| DATA-04 | dial_schedules table with correct defaults | smoke | Query dial_schedules, verify Europe/London + 7 days | No - Wave 0 |
| DATA-05 | SQL views return correct data | smoke | `SELECT * FROM pipeline_snapshot` after seeding test data | No - Wave 0 |
| DATA-06 | pick_next_lead() atomically picks and locks | integration | Call RPC, verify lead status changed to 'calling' | No - Wave 0 |
| DATA-07 | RLS blocks anon writes, allows anon reads | integration | Test with anon key: SELECT succeeds, INSERT fails | No - Wave 0 |
| VOICE-04 | Phone number uses weighted agents | smoke | `client.phone_number.get("+17404943597")` -- verify outbound_agents populated | No - Wave 0 |

### Sampling Rate
- **Per task commit:** Quick SQL verification after each schema change
- **Per wave merge:** Full schema + RPC + RLS verification
- **Phase gate:** All 8 requirements verified before proceeding to Phase 2

### Wave 0 Gaps
- [ ] `execution/backend/test_phase1.py` -- smoke test script covering DATA-01 through DATA-07 + VOICE-04
- [ ] `execution/backend/seeds/` directory -- does not exist yet, must be created
- [ ] `execution/backend/schema/` directory -- does not exist yet, must be created

## Sources

### Primary (HIGH confidence)
- [Retell AI Create Phone Call API](https://docs.retellai.com/api-references/create-phone-call) - Verified: `agent_id` parameter NOT present; only `override_agent_id` exists. `from_number` and `to_number` are required.
- [Retell AI Update Phone Number API](https://docs.retellai.com/api-references/update-phone-number) - Verified: `outbound_agents` and `inbound_agents` weighted arrays with AgentWeight schema {agent_id, weight}.
- [Retell AI Import Phone Number API](https://docs.retellai.com/api-references/import-phone-number) - Verified: supports weighted agents fields; deprecated fields documented.
- [Retell AI Outbound Call Deployment Guide](https://docs.retellai.com/deploy/outbound-call) - Verified: outbound calls use phone number's outbound agent binding; `override_agent_id` for per-call overrides.
- [Retell AI Changelog](https://www.retellai.com/changelog) - March 19, 2026 entry confirms March 31 deadline for weighted agents migration.
- [Retell Community: Phone Number Agent Field Deprecation](https://community.retellai.com/t/clarification-on-phone-number-agent-field-deprecation/1917) - Confirmed: `create_call` with explicit agent_id is NOT affected by deprecation; only phone number binding fields are deprecated.
- [Supabase Python RPC Reference](https://supabase.com/docs/reference/python/rpc) - Verified: `.rpc("function_name").execute()` pattern with parameter passing.
- [Supabase RLS Documentation](https://supabase.com/docs/guides/api/securing-your-api) - Verified: service_role key ALWAYS bypasses RLS; anon key subject to policies.

### Secondary (MEDIUM confidence)
- [SupaExplorer: SKIP LOCKED Best Practices](https://supaexplorer.com/best-practices/supabase-postgres/lock-skip-locked/) - PL/pgSQL pattern for queue processing with partial index recommendation.
- [retell-sdk on PyPI](https://pypi.org/project/retell-sdk/) - Version 5.8.0 confirmed available; 5.0.0 released December 5, 2025 with breaking changes.
- [retell-python-sdk CHANGELOG.md](https://github.com/RetellAI/retell-python-sdk/blob/main/CHANGELOG.md) - 5.0.0 has "BREAKING CHANGES" flag but details truncated in web view.
- [retell-python-sdk README.md](https://github.com/RetellAI/retell-python-sdk/blob/main/README.md) - SDK 5.x client init unchanged: `Retell(api_key=...)`, agent create uses `response_engine` object.
- [Retell SDK Docs Page](https://docs.retellai.com/get-started/sdk) - Python 3.7+, `pip install retell-sdk`, `create_phone_call` example without `agent_id`.

### Tertiary (LOW confidence)
- [retell-sdk SafetyCLI Changelog](https://data.safetycli.com/packages/pypi/retell-sdk/changelog) - Only shows recent versions (5.17+); 5.0.0 details not visible. NEEDS VALIDATION: Full breaking change list for 5.0.0 not confirmed beyond `create_phone_call` signature change.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - versions confirmed from PyPI and official docs
- Architecture (database): HIGH - standard PostgreSQL patterns, no novel approaches
- Architecture (SDK migration): MEDIUM - `create_phone_call` signature change verified, but full 5.0.0 breaking changes list is truncated in CHANGELOG.md; other method signatures may also have changed
- Pitfalls: HIGH - each pitfall verified from official docs or existing code analysis
- Seed data: MEDIUM - PDF content not directly readable; data structure confirmed from CONTEXT.md but exact values need PDF extraction

**Research date:** 2026-03-25
**Valid until:** 2026-03-31 (hard deadline for weighted agents migration; SDK patterns stable after migration)
