-- ============================================================================
-- 006_retry_migration.sql
-- Phase 6 AUTO-05: Retry backoff infrastructure for the auto-dialer.
--
-- Three changes:
--   1. Add next_retry_at column to leads table (60-min backoff timestamp)
--   2. Fix state machine: add calling -> failed transition
--   3. Update pick_next_lead() RPC to respect next_retry_at backoff period
--
-- Run after 005_functions.sql. Uses DROP + CREATE for idempotency.
-- ============================================================================


-- ============================================================================
-- 1. ADD next_retry_at COLUMN TO leads TABLE
--    Stores the earliest time a retried lead can be picked again.
--    NULL means no backoff -- lead is immediately eligible.
--    Set to NOW() + 60 minutes when a failed call is requeued.
-- ============================================================================

ALTER TABLE leads ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ;


-- ============================================================================
-- 2. FIX STATE MACHINE: Add calling -> failed transition
--    Previously calling only allowed: in_call, no_answer, voicemail, busy.
--    Retell can return dial_failed, invalid_destination, error_retell, etc.
--    which map to 'failed' status. Without this transition the state machine
--    trigger rejects the update with an exception.
--
--    All other transitions are unchanged. The do_not_contact override and
--    the log_status_transition trigger are NOT touched.
-- ============================================================================

DROP TRIGGER IF EXISTS trg_enforce_lead_status ON leads;
DROP FUNCTION IF EXISTS enforce_lead_status_transition();

CREATE OR REPLACE FUNCTION enforce_lead_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
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
    allowed JSONB;
BEGIN
    -- Skip if status unchanged
    IF OLD.status = NEW.status THEN
        RETURN NEW;
    END IF;

    -- Allow any state -> do_not_contact (regulatory override per CONTEXT.md)
    IF NEW.status = 'do_not_contact' THEN
        NEW.updated_at := NOW();
        RETURN NEW;
    END IF;

    -- Look up allowed transitions for the current (old) status
    allowed := valid_transitions -> OLD.status;

    -- Reject if no transitions defined for old status, or new status not in allowed list
    IF allowed IS NULL OR NOT allowed ? NEW.status THEN
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


-- ============================================================================
-- 3. UPDATE pick_next_lead() RPC: Respect next_retry_at backoff
--    Adds WHERE condition so leads with next_retry_at in the future are
--    skipped. Leads with next_retry_at IS NULL (never retried) or
--    next_retry_at <= NOW() (backoff expired) are eligible.
--
--    DNC and declined leads are already excluded by status='queued' filter.
-- ============================================================================

DROP FUNCTION IF EXISTS pick_next_lead();

CREATE OR REPLACE FUNCTION pick_next_lead()
RETURNS SETOF leads
LANGUAGE plpgsql
AS $$
DECLARE
    selected_lead leads%ROWTYPE;
BEGIN
    -- Select highest-priority queued lead with row-level lock
    -- SKIP LOCKED ensures concurrent callers don't block each other
    -- next_retry_at filter ensures backoff period is respected
    SELECT * INTO selected_lead
    FROM leads
    WHERE status = 'queued'
      AND (next_retry_at IS NULL OR next_retry_at <= NOW())
    ORDER BY priority DESC, created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED;

    -- If no queued leads found, return empty set
    IF selected_lead.id IS NULL THEN
        RETURN;
    END IF;

    -- Atomically update status to 'calling'
    -- This fires the enforce_lead_status_transition trigger (queued->calling is valid)
    UPDATE leads
    SET status = 'calling', updated_at = NOW()
    WHERE id = selected_lead.id;

    -- Return the lead with updated status
    selected_lead.status := 'calling';
    selected_lead.updated_at := NOW();
    RETURN NEXT selected_lead;
END;
$$;
