-- ============================================================================
-- 005_dial_schedules.sql
-- Seed data: Default dial window for Wave 0.
-- Source: CONTEXT.md -- Europe/London, 10am-7pm, 7 days/week.
--
-- Run after 001_tables.sql (requires dial_schedules table).
-- Uses ON CONFLICT for idempotency.
-- ============================================================================

INSERT INTO dial_schedules (name, start_time, end_time, days_of_week, timezone, is_active)
VALUES (
    'Default Wave 0',
    '10:00',
    '19:00',
    ARRAY[1, 2, 3, 4, 5, 6, 7],
    'Europe/London',
    TRUE
)
ON CONFLICT DO NOTHING;
