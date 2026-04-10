-- ============================================================================
-- 008_dashboard_views.sql
-- 10 dashboard views + 5 supporting indexes for the CRM dashboard API.
--
-- Depends on:
--   001_tables.sql          — core tables (leads, call_logs, pipeline_logs)
--   006_retry_migration.sql — retry_count, max_retries, next_retry_at
--   007_dashboard_migration.sql — first_name, last_name, has_whatsapp, has_email,
--                                  timezone, call_scheduled_at, objections_raised,
--                                  sentiment, pipeline_logs.status, 23-status lifecycle
--
-- All views use CREATE OR REPLACE VIEW — safe to re-run at any time.
-- Run order: must execute AFTER 007_dashboard_migration.sql.
-- ============================================================================


-- ============================================================================
-- INDEXES (create before views so query plans can use them immediately)
-- ============================================================================

-- Fast date-bucketing for daily/hourly trend queries
CREATE INDEX IF NOT EXISTS idx_call_logs_date
    ON call_logs (started_at);

-- Fast outcome filtering (committed, follow_up, declined, no_answer, etc.)
CREATE INDEX IF NOT EXISTS idx_call_logs_outcome
    ON call_logs (outcome);

-- Fast event-type + time ordering for pipeline / outreach log queries
CREATE INDEX IF NOT EXISTS idx_pipeline_logs_event
    ON pipeline_logs (event, created_at);

-- Partial index: only leads actively awaiting a follow-up callback
CREATE INDEX IF NOT EXISTS idx_leads_follow_up
    ON leads (follow_up_at)
    WHERE status IN ('follow_up', 'follow_up_scheduled');

-- Partial index: only leads that may be redialled
CREATE INDEX IF NOT EXISTS idx_leads_retry
    ON leads (last_call_at)
    WHERE status IN ('no_answer', 'voicemail', 'busy');


-- ============================================================================
-- VIEW 1: dashboard_today
-- Single-row summary of today's calling activity.
-- All timestamps compared against the current calendar date in UTC.
-- ============================================================================

CREATE OR REPLACE VIEW dashboard_today AS
WITH today_calls AS (
    SELECT
        cl.outcome,
        cl.duration_seconds,
        cl.started_at
    FROM call_logs cl
    WHERE cl.started_at::DATE = CURRENT_DATE
),
today_pipeline AS (
    SELECT pl.event
    FROM pipeline_logs pl
    WHERE pl.created_at::DATE = CURRENT_DATE
)
SELECT
    -- Volume
    COUNT(*)                                                        AS calls_today,
    COUNT(*) FILTER (WHERE outcome = 'committed')                   AS commitments_today,
    COUNT(*) FILTER (WHERE outcome IN ('follow_up','follow_up_scheduled'))
                                                                    AS follow_ups_today,
    COUNT(*) FILTER (WHERE outcome = 'declined')                    AS declines_today,
    COUNT(*) FILTER (WHERE outcome IN ('no_answer','voicemail','busy'))
                                                                    AS no_answers_today,

    -- Duration / answer rate
    ROUND(AVG(duration_seconds) FILTER (WHERE duration_seconds IS NOT NULL), 1)
                                                                    AS avg_duration_sec,
    CASE
        WHEN COUNT(*) = 0 THEN 0
        ELSE ROUND(
            100.0 * COUNT(*) FILTER (WHERE duration_seconds > 0)
            / NULLIF(COUNT(*), 0), 1
        )
    END                                                             AS pickup_rate_pct,

    -- Outreach + bookings (from pipeline_logs)
    (SELECT COUNT(*) FROM today_pipeline
     WHERE event ILIKE '%outreach%')                                AS outreach_sent_today,
    (SELECT COUNT(*) FROM today_pipeline
     WHERE event ILIKE '%booking%' OR event ILIKE '%scheduled%')   AS bookings_today

FROM today_calls;


-- ============================================================================
-- VIEW 2: leads_by_status
-- Count of leads grouped by status, ordered by the 23-state lifecycle sequence.
-- Excludes do_not_contact (regulatory — not surfaced in the main dashboard).
-- ============================================================================

CREATE OR REPLACE VIEW leads_by_status AS
SELECT
    status,
    COUNT(*) AS count,
    CASE status
        WHEN 'new'                  THEN  1
        WHEN 'enriched'             THEN  2
        WHEN 'outreach_sent'        THEN  3
        WHEN 'outreach_no_response' THEN  4
        WHEN 'call_scheduled'       THEN  5
        WHEN 'queued'               THEN  6
        WHEN 'calling'              THEN  7
        WHEN 'in_call'              THEN  8
        WHEN 'committed'            THEN  9
        WHEN 'follow_up'            THEN 10
        WHEN 'follow_up_scheduled'  THEN 11
        WHEN 'payment_pending'      THEN 12
        WHEN 'enrolled'             THEN 13
        WHEN 'declined'             THEN 14
        WHEN 'not_qualified'        THEN 15
        WHEN 'no_answer'            THEN 16
        WHEN 'voicemail'            THEN 17
        WHEN 'busy'                 THEN 18
        WHEN 'exhausted'            THEN 19
        WHEN 'invalid_number'       THEN 20
        WHEN 'payment_sent'         THEN 21
        WHEN 'failed'               THEN 22
        ELSE                             99
    END AS lifecycle_order
FROM leads
WHERE status != 'do_not_contact'
GROUP BY status
ORDER BY lifecycle_order;


-- ============================================================================
-- VIEW 3: strategy_performance
-- Aggregate stats per (closing_strategy_used, detected_persona) pair.
-- Gives a clear read on which strategy works best for each persona type.
-- ============================================================================

DROP VIEW IF EXISTS strategy_performance CASCADE;
CREATE OR REPLACE VIEW strategy_performance AS
SELECT
    closing_strategy_used                                           AS strategy,
    detected_persona                                                AS persona,
    COUNT(*)                                                        AS total_calls,
    COUNT(*) FILTER (WHERE outcome = 'committed')                   AS commitments,
    COUNT(*) FILTER (WHERE outcome IN ('follow_up','follow_up_scheduled'))
                                                                    AS follow_ups,
    COUNT(*) FILTER (WHERE outcome = 'declined')                    AS declines,
    ROUND(
        100.0 * COUNT(*) FILTER (WHERE outcome = 'committed')
        / NULLIF(COUNT(*), 0), 1
    )                                                               AS conversion_pct,
    ROUND(AVG(duration_seconds) FILTER (WHERE duration_seconds IS NOT NULL), 1)
                                                                    AS avg_duration_sec
FROM call_logs
WHERE closing_strategy_used IS NOT NULL
GROUP BY closing_strategy_used, detected_persona
ORDER BY conversion_pct DESC NULLS LAST, total_calls DESC;


-- ============================================================================
-- VIEW 4: strategy_persona_heatmap
-- Compact grid for a heatmap visualisation: one row per (strategy, persona).
-- ============================================================================

CREATE OR REPLACE VIEW strategy_persona_heatmap AS
SELECT
    COALESCE(closing_strategy_used, 'none')                         AS strategy,
    COALESCE(detected_persona,      'unknown')                      AS persona,
    COUNT(*)                                                        AS calls,
    ROUND(
        100.0 * COUNT(*) FILTER (WHERE outcome = 'committed')
        / NULLIF(COUNT(*), 0), 1
    )                                                               AS conversion_pct
FROM call_logs
GROUP BY closing_strategy_used, detected_persona
ORDER BY strategy, persona;


-- ============================================================================
-- VIEW 5: daily_trends
-- Last 30 calendar days. Uses generate_series so days with zero calls still
-- appear (essential for a continuous line chart).
-- ============================================================================

CREATE OR REPLACE VIEW daily_trends AS
WITH date_series AS (
    SELECT generate_series(
        CURRENT_DATE - INTERVAL '29 days',
        CURRENT_DATE,
        INTERVAL '1 day'
    )::DATE AS date
),
daily_stats AS (
    SELECT
        started_at::DATE                                            AS date,
        COUNT(*)                                                    AS calls,
        COUNT(*) FILTER (WHERE outcome = 'committed')               AS commitments,
        COUNT(*) FILTER (WHERE outcome IN ('follow_up','follow_up_scheduled'))
                                                                    AS follow_ups,
        ROUND(AVG(duration_seconds) FILTER (WHERE duration_seconds IS NOT NULL), 1)
                                                                    AS avg_duration_sec,
        CASE
            WHEN COUNT(*) = 0 THEN 0
            ELSE ROUND(
                100.0 * COUNT(*) FILTER (WHERE duration_seconds > 0)
                / NULLIF(COUNT(*), 0), 1
            )
        END                                                         AS pickup_rate
    FROM call_logs
    WHERE started_at >= CURRENT_DATE - INTERVAL '29 days'
    GROUP BY started_at::DATE
)
SELECT
    d.date,
    COALESCE(s.calls,           0)                                  AS calls,
    COALESCE(s.commitments,     0)                                  AS commitments,
    COALESCE(s.follow_ups,      0)                                  AS follow_ups,
    COALESCE(s.avg_duration_sec, 0)                                 AS avg_duration_sec,
    COALESCE(s.pickup_rate,     0)                                  AS pickup_rate
FROM date_series d
LEFT JOIN daily_stats s ON s.date = d.date
ORDER BY d.date;


-- ============================================================================
-- VIEW 6: follow_up_queue
-- Leads currently in follow_up / follow_up_scheduled status, enriched with
-- the most recent call's summary and closing strategy via a LATERAL join.
-- ============================================================================

CREATE OR REPLACE VIEW follow_up_queue AS
SELECT
    l.id,
    l.first_name,
    l.last_name,
    l.name,
    l.phone,
    l.email,
    l.follow_up_at,
    l.detected_persona,
    l.programme_recommended,
    l.timezone,

    -- Human-readable time until callback
    CASE
        WHEN l.follow_up_at IS NULL     THEN 'not scheduled'
        WHEN l.follow_up_at < NOW()     THEN 'overdue'
        WHEN l.follow_up_at < NOW() + INTERVAL '1 hour'
                                        THEN 'within 1 hour'
        WHEN l.follow_up_at < NOW() + INTERVAL '24 hours'
                                        THEN 'today'
        ELSE (
            EXTRACT(DAY FROM (l.follow_up_at - NOW()))::TEXT || ' days'
        )
    END                                                             AS time_until_follow_up,

    -- Latest call data (LATERAL — one row per lead, no duplicates)
    latest.summary                                                  AS last_call_summary,
    latest.closing_strategy_used                                    AS last_strategy,
    latest.objections_raised                                        AS last_objections

FROM leads l
LEFT JOIN LATERAL (
    SELECT
        cl.summary,
        cl.closing_strategy_used,
        cl.objections_raised
    FROM call_logs cl
    WHERE cl.lead_id = l.id
    ORDER BY cl.started_at DESC
    LIMIT 1
) latest ON TRUE
WHERE l.status IN ('follow_up', 'follow_up_scheduled')
ORDER BY l.follow_up_at ASC NULLS LAST;


-- ============================================================================
-- VIEW 7: retry_queue
-- Leads that have not exceeded max_retries and are waiting to be redialled.
-- next_retry_at: busy → 60 min after last call; no_answer/voicemail → 1 day.
-- ============================================================================

CREATE OR REPLACE VIEW retry_queue AS
SELECT
    l.id,
    l.first_name,
    l.last_name,
    l.name,
    l.phone,
    l.status,
    l.retry_count,
    l.max_retries,
    l.last_call_at,
    l.detected_persona,
    l.programme_recommended,

    -- Calculated next retry time
    CASE l.status
        WHEN 'busy'     THEN l.last_call_at + INTERVAL '60 minutes'
        ELSE                 l.last_call_at + INTERVAL '1 day'
    END                                                             AS next_retry_at,

    -- Time remaining until retry window opens
    GREATEST(
        0,
        EXTRACT(EPOCH FROM (
            CASE l.status
                WHEN 'busy' THEN l.last_call_at + INTERVAL '60 minutes'
                ELSE             l.last_call_at + INTERVAL '1 day'
            END - NOW()
        ))
    )::INTEGER                                                      AS seconds_until_retry

FROM leads l
WHERE l.status IN ('no_answer', 'voicemail', 'busy')
  AND l.retry_count < l.max_retries
ORDER BY
    CASE l.status
        WHEN 'busy' THEN l.last_call_at + INTERVAL '60 minutes'
        ELSE             l.last_call_at + INTERVAL '1 day'
    END ASC NULLS LAST;


-- ============================================================================
-- VIEW 8: outreach_log
-- Joins pipeline_logs with leads to surface multi-channel outreach events.
-- Extracts channel, message_id, and delivery_status from the details JSONB.
-- ============================================================================

CREATE OR REPLACE VIEW outreach_log AS
SELECT
    pl.id                                                           AS log_id,
    pl.created_at,
    pl.event,
    pl.component,
    pl.status                                                       AS pipeline_status,

    -- Lead context
    l.id                                                            AS lead_id,
    l.first_name,
    l.last_name,
    l.name,
    l.phone,
    l.email,

    -- Outreach detail fields (extracted from JSONB)
    pl.details ->> 'channel'                                        AS channel,
    pl.details ->> 'message_id'                                     AS message_id,
    pl.details ->> 'delivery_status'                                AS delivery_status,
    pl.details ->> 'template'                                       AS template_used,
    pl.details                                                      AS raw_details

FROM pipeline_logs pl
JOIN leads l ON l.id = pl.lead_id
WHERE
    pl.event ILIKE '%outreach%'
    OR pl.event ILIKE '%whatsapp%'
    OR pl.event ILIKE '%email_sent%'
    OR pl.event ILIKE '%booking%'
    OR pl.event ILIKE '%cal_com%'
ORDER BY pl.created_at DESC;


-- ============================================================================
-- VIEW 9: funnel_conversion
-- Single-row funnel showing lead counts at every conversion stage.
-- Stages are cumulative/status-based — not time-windowed.
-- ============================================================================

CREATE OR REPLACE VIEW funnel_conversion AS
SELECT
    -- Stage 1: all leads ever imported
    COUNT(*)                                                                        AS total_imported,

    -- Stage 2: leads that were enriched (WhatsApp / email check completed)
    COUNT(*) FILTER (WHERE status NOT IN ('new') OR has_whatsapp OR has_email)      AS enriched,

    -- Stage 3: outreach sent (WhatsApp or email dispatched)
    COUNT(*) FILTER (WHERE status IN (
        'outreach_sent','outreach_no_response','call_scheduled',
        'queued','calling','in_call','committed','follow_up','follow_up_scheduled',
        'payment_pending','enrolled','declined','not_qualified',
        'no_answer','voicemail','busy','exhausted','invalid_number',
        'payment_sent','do_not_contact','failed'
    ))                                                                              AS outreach_sent,

    -- Stage 4: responded to outreach OR booked a call slot
    COUNT(*) FILTER (WHERE status IN (
        'call_scheduled',
        'queued','calling','in_call','committed','follow_up','follow_up_scheduled',
        'payment_pending','enrolled','declined','not_qualified',
        'no_answer','voicemail','busy','exhausted','invalid_number',
        'payment_sent'
    ))                                                                              AS responded,

    -- Stage 5: booked or entered the call pipeline
    COUNT(*) FILTER (WHERE status IN (
        'call_scheduled',
        'queued','calling','in_call','committed','follow_up','follow_up_scheduled',
        'payment_pending','enrolled','declined','not_qualified',
        'no_answer','voicemail','busy','exhausted','invalid_number',
        'payment_sent'
    ))                                                                              AS booked_or_called,

    -- Stage 6: calls that lasted more than 60 seconds (meaningful conversation)
    (SELECT COUNT(DISTINCT lead_id) FROM call_logs WHERE duration_seconds > 60)    AS calls_completed,

    -- Stage 7: leads that committed to buying
    COUNT(*) FILTER (WHERE status IN (
        'committed','payment_pending','payment_sent','enrolled'
    ))                                                                              AS committed,

    -- Stage 8: fully enrolled (payment confirmed)
    COUNT(*) FILTER (WHERE status = 'enrolled')                                     AS enrolled

FROM leads;


-- ============================================================================
-- VIEW 10: objection_frequency
-- Unnests the objections_raised TEXT[] from call_logs to count how often each
-- objection appears and whether it resolved positively or not.
-- ============================================================================

CREATE OR REPLACE VIEW objection_frequency AS
SELECT
    objection,
    COUNT(*)                                                        AS frequency,
    COUNT(*) FILTER (WHERE cl.outcome = 'committed')                AS resolved_to_commit,
    COUNT(*) FILTER (WHERE cl.outcome IN ('follow_up','follow_up_scheduled'))
                                                                    AS resolved_to_follow_up,
    ROUND(
        100.0 * COUNT(*) FILTER (WHERE cl.outcome = 'committed')
        / NULLIF(COUNT(*), 0), 1
    )                                                               AS commit_resolution_pct
FROM call_logs cl
-- Unnest the array: one row per objection per call
CROSS JOIN LATERAL UNNEST(cl.objections_raised) AS objection
WHERE cl.objections_raised IS NOT NULL
  AND array_length(cl.objections_raised, 1) > 0
GROUP BY objection
ORDER BY frequency DESC;
