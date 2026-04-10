-- ============================================================================
-- 007_dashboard_migration.sql
-- CRM Dashboard migration: name split, enrichment columns, 23-status lifecycle,
-- and updated state machine transitions.
--
-- Builds on top of:
--   001_tables.sql    — core tables (leads, call_logs, pipeline_logs, …)
--   005_functions.sql — original state machine + log_status_transition trigger
--   006_retry_migration.sql — next_retry_at + calling->failed transition
--
-- All changes are idempotent (ADD COLUMN IF NOT EXISTS / DROP IF EXISTS).
-- Run order: this file must execute after 006_retry_migration.sql.
-- ============================================================================


-- ============================================================================
-- 1. SPLIT name INTO first_name + last_name ON leads
--    Preserves the original name column. first_name = first token, last_name =
--    everything after the first space (empty string if single-word name).
-- ============================================================================

ALTER TABLE leads ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS last_name  TEXT;

-- Backfill only rows that haven't been split yet (idempotent)
UPDATE leads
SET
    first_name = split_part(name, ' ', 1),
    last_name  = CASE
                     WHEN position(' ' IN name) > 0
                     THEN substring(name FROM position(' ' IN name) + 1)
                     ELSE ''
                 END
WHERE first_name IS NULL;


-- ============================================================================
-- 2. ADD ENRICHMENT + SCHEDULING COLUMNS TO leads
--    has_whatsapp  — confirmed WhatsApp registration (set by OpenClaw check)
--    has_email     — lead has a usable email address
--    timezone      — lead's detected/inferred timezone (IANA format)
--    call_scheduled_at — UTC timestamp for a pre-booked call slot (Cal.com)
-- ============================================================================

ALTER TABLE leads ADD COLUMN IF NOT EXISTS has_whatsapp      BOOLEAN     DEFAULT FALSE;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS has_email         BOOLEAN     DEFAULT FALSE;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS timezone          TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS call_scheduled_at TIMESTAMPTZ;

-- Backfill has_email for existing leads that already have an email stored
UPDATE leads
SET has_email = TRUE
WHERE email IS NOT NULL
  AND email != '';


-- ============================================================================
-- 3. ADD COLUMNS TO call_logs
--    objections_raised — array of objection keys detected during the call
--    sentiment         — overall call sentiment label (e.g. 'positive', 'neutral', 'negative')
-- ============================================================================

ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS objections_raised TEXT[] DEFAULT '{}';
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS sentiment         TEXT;


-- ============================================================================
-- 4. ADD status COLUMN TO pipeline_logs
--    Allows the log_status_transition trigger (and manual inserts) to record
--    whether the transition completed successfully or encountered an error.
-- ============================================================================

ALTER TABLE pipeline_logs ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'success';


-- ============================================================================
-- 5. EXPAND leads status CHECK CONSTRAINT FROM 14 TO 23 STATUSES
--    New statuses added for multi-channel outreach, scheduling, and
--    additional terminal/retry states:
--      enriched, outreach_sent, outreach_no_response, call_scheduled,
--      follow_up_scheduled, payment_pending, enrolled, exhausted,
--      invalid_number, payment_sent (already existed but moved position)
--
--    DROP + ADD pattern is required because PostgreSQL does not support
--    ALTER on existing CHECK constraints.
-- ============================================================================

ALTER TABLE leads DROP CONSTRAINT IF EXISTS leads_status_check;

ALTER TABLE leads ADD CONSTRAINT leads_status_check
    CHECK (status IN (
        'new',
        'enriched',
        'outreach_sent',
        'outreach_no_response',
        'call_scheduled',
        'queued',
        'calling',
        'in_call',
        'committed',
        'follow_up',
        'follow_up_scheduled',
        'payment_pending',
        'enrolled',
        'declined',
        'not_qualified',
        'no_answer',
        'voicemail',
        'busy',
        'exhausted',
        'invalid_number',
        'payment_sent',
        'do_not_contact',
        'failed'
    ));


-- ============================================================================
-- 6. UPDATE STATE MACHINE TRIGGER WITH NEW TRANSITIONS
--    Replaces the function introduced in 006_retry_migration.sql.
--    Extended transitions to cover:
--      — new multi-channel enrichment/outreach path
--      — call_scheduled -> queued
--      — follow_up_scheduled state
--      — payment_pending intermediate step before enrolled
--      — exhausted terminal state for no_answer/voicemail/busy
--      — invalid_number terminal state for bad phone numbers
--
--    do_not_contact override (any state -> do_not_contact) is preserved.
-- ============================================================================

DROP TRIGGER  IF EXISTS trg_enforce_lead_status ON leads;
DROP FUNCTION IF EXISTS enforce_lead_status_transition();

CREATE OR REPLACE FUNCTION enforce_lead_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    valid_transitions JSONB := '{
        "new":                  ["enriched", "queued", "failed"],
        "enriched":             ["outreach_sent", "queued"],
        "outreach_sent":        ["outreach_no_response", "call_scheduled", "queued"],
        "outreach_no_response": ["queued"],
        "call_scheduled":       ["queued"],
        "queued":               ["calling"],
        "calling":              ["in_call", "no_answer", "voicemail", "busy", "failed", "invalid_number"],
        "in_call":              ["committed", "follow_up", "follow_up_scheduled", "declined", "not_qualified"],
        "committed":            ["payment_pending", "payment_sent"],
        "payment_pending":      ["enrolled"],
        "follow_up":            ["queued", "follow_up_scheduled"],
        "follow_up_scheduled":  ["queued"],
        "no_answer":            ["queued", "declined", "exhausted"],
        "voicemail":            ["queued", "declined", "exhausted"],
        "busy":                 ["queued", "declined", "exhausted"]
    }'::JSONB;
    allowed JSONB;
BEGIN
    -- Skip if status unchanged
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;

    -- Allow any state -> do_not_contact (regulatory override)
    IF NEW.status = 'do_not_contact' THEN
        NEW.updated_at := NOW();
        RETURN NEW;
    END IF;

    -- Look up allowed transitions for the current (old) status
    allowed := valid_transitions -> OLD.status;

    -- Reject if no transitions defined for old status, or new status not in allowed list
    IF allowed IS NULL OR NOT (allowed ? NEW.status) THEN
        RAISE EXCEPTION 'Invalid status transition: % -> % (not permitted by state machine)',
            OLD.status, NEW.status;
    END IF;

    -- Valid transition: update timestamp
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_lead_status
    BEFORE UPDATE OF status ON leads
    FOR EACH ROW
    EXECUTE FUNCTION enforce_lead_status_transition();
