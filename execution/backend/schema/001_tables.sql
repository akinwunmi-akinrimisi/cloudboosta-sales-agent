-- ============================================================================
-- 001_tables.sql
-- Creates all 7 tables for the Sarah sales agent system:
--   4 core tables: leads, call_logs, pipeline_logs, dial_schedules
--   3 reference tables: programmes, pricing, objection_responses
--
-- Run against Supabase PostgreSQL. Tables are created in dependency order.
-- Uses DROP IF EXISTS + CREATE for idempotent initial setup.
-- ============================================================================

-- ============================================================================
-- 1. LEADS (core) — DATA-01
--    Central table: every lead Sarah will call. 14-state lifecycle enforced
--    via CHECK constraint (trigger enforcement in 005_functions.sql).
-- ============================================================================
DROP TABLE IF EXISTS pipeline_logs CASCADE;
DROP TABLE IF EXISTS call_logs CASCADE;
DROP TABLE IF EXISTS leads CASCADE;

CREATE TABLE leads (
    -- Identity
    id                    UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at            TIMESTAMPTZ   DEFAULT NOW(),
    updated_at            TIMESTAMPTZ   DEFAULT NOW(),

    -- Contact info
    name                  TEXT          NOT NULL,
    phone                 TEXT          NOT NULL UNIQUE
                                        CHECK (phone ~ '^\+[1-9]\d{6,14}$'),
    email                 TEXT,
    location              TEXT,
    country               TEXT,
    currency              TEXT          DEFAULT 'GBP',

    -- Status (14-state lifecycle per CONTEXT.md)
    status                TEXT          DEFAULT 'new'
                                        CHECK (status IN (
                                            'new', 'queued', 'calling', 'in_call',
                                            'committed', 'follow_up', 'declined', 'not_qualified',
                                            'no_answer', 'voicemail', 'busy',
                                            'payment_sent', 'do_not_contact', 'failed'
                                        )),

    -- Qualification fields
    experience_level      TEXT,
    has_aws_sa_cert       BOOLEAN       DEFAULT FALSE,
    has_hands_on_projects BOOLEAN       DEFAULT FALSE,
    "current_role"        TEXT,
    motivation            TEXT,

    -- Call tracking
    programme_recommended TEXT,
    last_call_id          TEXT,
    last_call_at          TIMESTAMPTZ,
    call_count            INTEGER       DEFAULT 0,
    retry_count           INTEGER       DEFAULT 0,
    max_retries           INTEGER       DEFAULT 2,

    -- Strategy tracking
    last_strategy_used    TEXT,
    detected_persona      TEXT,

    -- Scheduling
    follow_up_at          TIMESTAMPTZ,

    -- Outcome
    outcome               TEXT,
    decline_reason        TEXT,

    -- Metadata
    source                TEXT          DEFAULT 'csv_import',
    priority              INTEGER       DEFAULT 0,
    notes                 TEXT
);

-- ============================================================================
-- 2. CALL_LOGS (core) — DATA-02
--    One row per Retell call. UNIQUE on retell_call_id for webhook dedup.
-- ============================================================================
CREATE TABLE call_logs (
    id                    UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
    lead_id               UUID          REFERENCES leads(id) ON DELETE SET NULL,
    retell_call_id        TEXT          UNIQUE NOT NULL,
    started_at            TIMESTAMPTZ,
    ended_at              TIMESTAMPTZ,
    duration_seconds      INTEGER,
    outcome               TEXT,
    closing_strategy_used TEXT,
    detected_persona      TEXT,
    transcript            TEXT,
    recording_url         TEXT,
    summary               TEXT,
    call_cost             DECIMAL(8,4),
    from_number           TEXT,
    to_number             TEXT,
    created_at            TIMESTAMPTZ   DEFAULT NOW()
);

-- ============================================================================
-- 3. PIPELINE_LOGS (core) — DATA-03
--    Audit trail for every lead status transition. Auto-populated by trigger
--    in 005_functions.sql.
-- ============================================================================
CREATE TABLE pipeline_logs (
    id                    UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
    lead_id               UUID          REFERENCES leads(id) ON DELETE CASCADE,
    component             TEXT          NOT NULL DEFAULT 'status_transition',
    event                 TEXT          NOT NULL,
    details               JSONB         DEFAULT '{}',
    created_at            TIMESTAMPTZ   DEFAULT NOW()
);

-- ============================================================================
-- 4. DIAL_SCHEDULES (core) — DATA-04
--    Time window configuration for the auto-dialer.
-- ============================================================================
DROP TABLE IF EXISTS dial_schedules CASCADE;

CREATE TABLE dial_schedules (
    id                    UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
    name                  TEXT          NOT NULL,
    start_time            TIME          NOT NULL,
    end_time              TIME          NOT NULL,
    timezone              TEXT          NOT NULL DEFAULT 'Europe/London',
    days_of_week          INTEGER[]     NOT NULL DEFAULT '{1,2,3,4,5,6,7}',
    is_active             BOOLEAN       DEFAULT TRUE,
    created_at            TIMESTAMPTZ   DEFAULT NOW(),
    updated_at            TIMESTAMPTZ   DEFAULT NOW()
);

-- ============================================================================
-- 5. PROGRAMMES (reference)
--    4 Cloudboosta training pathways.
-- ============================================================================
DROP TABLE IF EXISTS programmes CASCADE;

CREATE TABLE programmes (
    id                    UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
    name                  TEXT          NOT NULL UNIQUE,
    slug                  TEXT          NOT NULL UNIQUE,
    duration_weeks        INTEGER       NOT NULL,
    description           TEXT,
    topics                TEXT[]        DEFAULT '{}',
    prerequisites         TEXT,
    tools                 TEXT[]        DEFAULT '{}',
    roles_after           TEXT[]        DEFAULT '{}',
    display_order         INTEGER       DEFAULT 0,
    is_active             BOOLEAN       DEFAULT TRUE,
    created_at            TIMESTAMPTZ   DEFAULT NOW()
);

-- ============================================================================
-- 6. PRICING (reference)
--    16 rows: 4 bundle tracks x 4 currencies.
-- ============================================================================
DROP TABLE IF EXISTS pricing CASCADE;

CREATE TABLE pricing (
    id                    UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
    bundle_name           TEXT          NOT NULL,
    bundle_slug           TEXT          NOT NULL,
    bundle_size           INTEGER       NOT NULL,
    pathway_ids           TEXT[]        DEFAULT '{}',
    currency              TEXT          NOT NULL
                                        CHECK (currency IN ('GBP', 'USD', 'EUR', 'NGN')),
    standard_price        DECIMAL(10,2) NOT NULL,
    early_bird_price      DECIMAL(10,2) NOT NULL,
    early_bird_deadline   DATE,
    cohort_start_date     DATE,
    instalment_2_total    DECIMAL(10,2),
    instalment_3_total    DECIMAL(10,2),
    instalment_dates      DATE[]        DEFAULT '{}',
    created_at            TIMESTAMPTZ   DEFAULT NOW(),
    UNIQUE(bundle_slug, currency)
);

-- ============================================================================
-- 7. OBJECTION_RESPONSES (reference)
--    30+ rows covering 10 objection categories from objection-handling.pdf.
-- ============================================================================
DROP TABLE IF EXISTS objection_responses CASCADE;

CREATE TABLE objection_responses (
    id                    UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
    category              TEXT          NOT NULL,
    objection_key         TEXT          NOT NULL UNIQUE,
    trigger_phrases       TEXT[]        DEFAULT '{}',
    what_theyre_saying    TEXT,
    responses             JSONB         NOT NULL DEFAULT '[]',
    cultural_nuances      JSONB         DEFAULT '{}',
    recovery_script       TEXT,
    escalation_trigger    TEXT,
    display_order         INTEGER       DEFAULT 0,
    created_at            TIMESTAMPTZ   DEFAULT NOW()
);
