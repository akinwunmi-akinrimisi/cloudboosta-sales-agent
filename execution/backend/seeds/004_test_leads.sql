-- ============================================================================
-- 004_test_leads.sql
-- Seed data: 10 Wave 0 test leads.
-- Realistic test data with clearly identifiable test names and US test phones.
--
-- Mix: UK (3), US (3), Nigeria (2), Germany (1), Canada (1)
-- All status='new', varied priorities (0-5), source='wave_0_test'
--
-- Run after 001_tables.sql (requires leads table).
-- Uses ON CONFLICT for idempotency.
-- ============================================================================

INSERT INTO leads (name, phone, email, location, country, currency, status, priority, source, notes)
VALUES (
    'Test Lead 01', '+15551000101', 'test01@example.com', 'London', 'UK', 'GBP',
    'new', 5, 'wave_0_test', 'Senior DevOps engineer looking to upskill to platform engineering'
)
ON CONFLICT (phone) DO NOTHING;

INSERT INTO leads (name, phone, email, location, country, currency, status, priority, source, notes)
VALUES (
    'Test Lead 02', '+15551000102', 'test02@example.com', 'Manchester', 'UK', 'GBP',
    'new', 4, 'wave_0_test', 'Junior developer interested in cloud computing career switch'
)
ON CONFLICT (phone) DO NOTHING;

INSERT INTO leads (name, phone, email, location, country, currency, status, priority, source, notes)
VALUES (
    'Test Lead 03', '+15551000103', 'test03@example.com', 'Birmingham', 'UK', 'GBP',
    'new', 3, 'wave_0_test', 'IT support specialist wanting cloud certification'
)
ON CONFLICT (phone) DO NOTHING;

INSERT INTO leads (name, phone, email, location, country, currency, status, priority, source, notes)
VALUES (
    'Test Lead 04', '+15551000104', 'test04@example.com', 'New York', 'US', 'USD',
    'new', 5, 'wave_0_test', 'Cloud architect looking for SRE training'
)
ON CONFLICT (phone) DO NOTHING;

INSERT INTO leads (name, phone, email, location, country, currency, status, priority, source, notes)
VALUES (
    'Test Lead 05', '+15551000105', 'test05@example.com', 'San Francisco', 'US', 'USD',
    'new', 2, 'wave_0_test', 'Backend developer curious about DevOps transition'
)
ON CONFLICT (phone) DO NOTHING;

INSERT INTO leads (name, phone, email, location, country, currency, status, priority, source, notes)
VALUES (
    'Test Lead 06', '+15551000106', 'test06@example.com', 'Austin', 'US', 'USD',
    'new', 1, 'wave_0_test', 'Recent bootcamp graduate exploring cloud careers'
)
ON CONFLICT (phone) DO NOTHING;

INSERT INTO leads (name, phone, email, location, country, currency, status, priority, source, notes)
VALUES (
    'Test Lead 07', '+15551000107', 'test07@example.com', 'Lagos', 'Nigeria', 'NGN',
    'new', 4, 'wave_0_test', 'Systems administrator with 3 years experience'
)
ON CONFLICT (phone) DO NOTHING;

INSERT INTO leads (name, phone, email, location, country, currency, status, priority, source, notes)
VALUES (
    'Test Lead 08', '+15551000108', 'test08@example.com', 'Abuja', 'Nigeria', 'NGN',
    'new', 3, 'wave_0_test', 'Network engineer looking to move into cloud'
)
ON CONFLICT (phone) DO NOTHING;

INSERT INTO leads (name, phone, email, location, country, currency, status, priority, source, notes)
VALUES (
    'Test Lead 09', '+15551000109', 'test09@example.com', 'Berlin', 'Germany', 'EUR',
    'new', 2, 'wave_0_test', 'Full-stack developer interested in platform engineering'
)
ON CONFLICT (phone) DO NOTHING;

INSERT INTO leads (name, phone, email, location, country, currency, status, priority, source, notes)
VALUES (
    'Test Lead 10', '+15551000110', 'test10@example.com', 'Toronto', 'Canada', 'USD',
    'new', 0, 'wave_0_test', 'Project manager exploring technical career paths'
)
ON CONFLICT (phone) DO NOTHING;
