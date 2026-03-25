-- ============================================================================
-- 005_functions.sql
-- Two trigger functions for the leads table:
--   1. enforce_lead_status_transition() — BEFORE UPDATE: validates transitions
--   2. log_status_transition() — AFTER UPDATE: auto-inserts pipeline_logs
--
-- Run after 001_tables.sql (requires leads and pipeline_logs tables).
-- Uses DROP FUNCTION/TRIGGER IF EXISTS for idempotency.
-- ============================================================================

-- ============================================================================
-- FUNCTION 1: enforce_lead_status_transition()
-- Validates that leads.status transitions follow the allowed state machine
-- from CONTEXT.md. Rejects invalid transitions with a descriptive error.
-- Special case: any state -> do_not_contact is always allowed (regulatory).
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
-- FUNCTION 2: log_status_transition()
-- Automatically inserts a row into pipeline_logs whenever leads.status
-- changes, providing a full audit trail of the lead lifecycle.
-- ============================================================================

DROP TRIGGER IF EXISTS trg_log_status_transition ON leads;
DROP FUNCTION IF EXISTS log_status_transition();

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
