-- ============================================================================
-- Migration 009: Allow call_scheduled from any pre-call state
-- ============================================================================
-- Cal.com bookings can arrive for leads in any pre-call status.
-- Previously only outreach_sent -> call_scheduled was allowed.
-- Now: new, enriched, queued, outreach_sent, outreach_no_response,
--       follow_up, follow_up_scheduled, no_answer, voicemail, busy
--       can all transition to call_scheduled.
-- ============================================================================

CREATE OR REPLACE FUNCTION enforce_lead_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    valid_transitions JSONB := '{
        "new":                  ["enriched", "queued", "call_scheduled", "failed"],
        "enriched":             ["outreach_sent", "queued", "call_scheduled"],
        "outreach_sent":        ["outreach_no_response", "call_scheduled", "queued"],
        "outreach_no_response": ["queued", "call_scheduled"],
        "call_scheduled":       ["queued"],
        "queued":               ["calling", "call_scheduled"],
        "calling":              ["in_call", "no_answer", "voicemail", "busy", "failed", "invalid_number"],
        "in_call":              ["committed", "follow_up", "follow_up_scheduled", "declined", "not_qualified"],
        "committed":            ["payment_pending", "payment_sent"],
        "payment_pending":      ["enrolled"],
        "follow_up":            ["queued", "follow_up_scheduled", "call_scheduled"],
        "follow_up_scheduled":  ["queued", "call_scheduled"],
        "no_answer":            ["queued", "declined", "exhausted", "call_scheduled"],
        "voicemail":            ["queued", "declined", "exhausted", "call_scheduled"],
        "busy":                 ["queued", "declined", "exhausted", "call_scheduled"]
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
