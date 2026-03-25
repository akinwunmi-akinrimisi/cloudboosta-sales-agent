-- ============================================================================
-- 003_rls.sql
-- Enables Row Level Security on all 7 tables and creates anon read-only
-- policies for dashboard access. (DATA-07)
--
-- Run after 001_tables.sql.
--
-- Security model:
--   - service_role: Full access (Supabase auto-bypasses RLS for service key)
--   - anon: SELECT-only on all tables (dashboard reads via anon/public key)
--   - No INSERT/UPDATE/DELETE policies for anon = dashboard cannot modify data
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Enable RLS on all 7 tables
-- ---------------------------------------------------------------------------
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE dial_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE programmes ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE objection_responses ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Anon read-only policies (one per table)
-- ---------------------------------------------------------------------------

-- Core tables
DROP POLICY IF EXISTS "anon_read_leads" ON leads;
CREATE POLICY "anon_read_leads" ON leads
    FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "anon_read_call_logs" ON call_logs;
CREATE POLICY "anon_read_call_logs" ON call_logs
    FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "anon_read_pipeline_logs" ON pipeline_logs;
CREATE POLICY "anon_read_pipeline_logs" ON pipeline_logs
    FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "anon_read_dial_schedules" ON dial_schedules;
CREATE POLICY "anon_read_dial_schedules" ON dial_schedules
    FOR SELECT TO anon USING (true);

-- Reference tables
DROP POLICY IF EXISTS "anon_read_programmes" ON programmes;
CREATE POLICY "anon_read_programmes" ON programmes
    FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "anon_read_pricing" ON pricing;
CREATE POLICY "anon_read_pricing" ON pricing
    FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "anon_read_objection_responses" ON objection_responses;
CREATE POLICY "anon_read_objection_responses" ON objection_responses
    FOR SELECT TO anon USING (true);
