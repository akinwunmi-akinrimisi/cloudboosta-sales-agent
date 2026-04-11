-- ============================================================================
-- Migration 010: Advisory call booking + post-call email support
-- ============================================================================
-- 1. Add preferred_call_time to call_logs for advisory call scheduling
-- 2. Add post_call_email_sent to call_logs to track email delivery
-- ============================================================================

ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS preferred_call_time TIMESTAMPTZ;
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS post_call_email_sent BOOLEAN DEFAULT FALSE;
ALTER TABLE call_logs ADD COLUMN IF NOT EXISTS post_call_email_type TEXT;
