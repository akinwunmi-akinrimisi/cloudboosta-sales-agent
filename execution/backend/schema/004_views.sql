-- ============================================================================
-- 004_views.sql
-- 3 SQL views for the dashboard:
--   1. pipeline_snapshot  -- Lead counts by status (Pipeline tab)
--   2. strategy_performance -- Conversion rates by closing strategy (Strategy Analytics tab)
--   3. todays_calls -- Today's call log entries (Live View tab)
--
-- Run after 001_tables.sql (requires leads, call_logs tables).
-- Uses replace-if-exists pattern for idempotency.
-- ============================================================================

-- ============================================================================
-- VIEW 1: pipeline_snapshot (DATA-05)
-- Lead counts grouped by status, ordered by lifecycle progression.
-- Used by the dashboard Pipeline tab for kanban column counts.
-- ============================================================================

CREATE OR REPLACE VIEW pipeline_snapshot AS
SELECT
    status,
    COUNT(*) AS count,
    MIN(created_at) AS oldest,
    MAX(updated_at) AS latest
FROM leads
GROUP BY status
ORDER BY CASE status
    WHEN 'new'            THEN 1
    WHEN 'queued'         THEN 2
    WHEN 'calling'        THEN 3
    WHEN 'in_call'        THEN 4
    WHEN 'committed'      THEN 5
    WHEN 'follow_up'      THEN 6
    WHEN 'payment_sent'   THEN 7
    WHEN 'declined'       THEN 8
    WHEN 'not_qualified'  THEN 9
    WHEN 'no_answer'      THEN 10
    WHEN 'voicemail'      THEN 11
    WHEN 'busy'           THEN 12
    WHEN 'do_not_contact' THEN 13
    WHEN 'failed'         THEN 14
END;


-- ============================================================================
-- VIEW 2: strategy_performance (DATA-05)
-- Conversion rates by closing strategy, for Strategy Analytics tab.
-- Shows total calls, committed count, conversion rate, and persona diversity.
-- ============================================================================

CREATE OR REPLACE VIEW strategy_performance AS
SELECT
    closing_strategy_used AS strategy,
    COUNT(*) AS total_calls,
    COUNT(*) FILTER (WHERE outcome = 'committed') AS committed_count,
    ROUND(
        COUNT(*) FILTER (WHERE outcome = 'committed') * 100.0 / NULLIF(COUNT(*), 0),
        1
    ) AS conversion_rate,
    COUNT(DISTINCT detected_persona) AS personas_seen
FROM call_logs
WHERE closing_strategy_used IS NOT NULL
GROUP BY closing_strategy_used
ORDER BY conversion_rate DESC NULLS LAST;


-- ============================================================================
-- VIEW 3: todays_calls (DATA-05)
-- All calls from the current UTC day, for Live View tab.
-- Joins call_logs with leads to include lead name and phone.
-- ============================================================================

CREATE OR REPLACE VIEW todays_calls AS
SELECT
    cl.id,
    cl.lead_id,
    cl.retell_call_id,
    cl.started_at,
    cl.ended_at,
    cl.duration_seconds,
    cl.outcome,
    cl.closing_strategy_used,
    cl.detected_persona,
    cl.summary,
    cl.recording_url,
    l.name AS lead_name,
    l.phone AS lead_phone
FROM call_logs cl
LEFT JOIN leads l ON cl.lead_id = l.id
WHERE cl.started_at >= CURRENT_DATE
ORDER BY cl.started_at DESC;
