-- ============================================================================
-- 002_indexes.sql
-- Creates 9 performance indexes for the Sarah sales agent database.
-- Includes a partial index on queued leads for pick_next_lead() performance.
--
-- Run after 001_tables.sql. Uses IF NOT EXISTS for idempotency.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- LEADS indexes
-- ---------------------------------------------------------------------------

-- General status lookups (dashboard filtering, pipeline views)
CREATE INDEX IF NOT EXISTS idx_leads_status
    ON leads(status);

-- Partial index for pick_next_lead() RPC: only queued leads, ordered by
-- priority (highest first) then created_at (oldest first = FIFO within tier)
CREATE INDEX IF NOT EXISTS idx_leads_queued
    ON leads(priority DESC, created_at ASC)
    WHERE status = 'queued';

-- Phone lookup for dedup and E.164 searches
CREATE INDEX IF NOT EXISTS idx_leads_phone
    ON leads(phone);

-- ---------------------------------------------------------------------------
-- CALL_LOGS indexes
-- ---------------------------------------------------------------------------

-- Join from call_logs to leads
CREATE INDEX IF NOT EXISTS idx_call_logs_lead_id
    ON call_logs(lead_id);

-- Recent calls list on dashboard (ordered by most recent)
CREATE INDEX IF NOT EXISTS idx_call_logs_started_at
    ON call_logs(started_at DESC);

-- Strategy analytics tab: group by strategy + persona for conversion metrics
CREATE INDEX IF NOT EXISTS idx_call_logs_strategy_persona
    ON call_logs(closing_strategy_used, detected_persona);

-- ---------------------------------------------------------------------------
-- PIPELINE_LOGS indexes
-- ---------------------------------------------------------------------------

-- Audit trail per lead
CREATE INDEX IF NOT EXISTS idx_pipeline_logs_lead_id
    ON pipeline_logs(lead_id);

-- Timeline view (most recent first)
CREATE INDEX IF NOT EXISTS idx_pipeline_logs_created_at
    ON pipeline_logs(created_at DESC);

-- ---------------------------------------------------------------------------
-- OBJECTION_RESPONSES indexes
-- ---------------------------------------------------------------------------

-- Filter by objection category
CREATE INDEX IF NOT EXISTS idx_objection_responses_category
    ON objection_responses(category);
