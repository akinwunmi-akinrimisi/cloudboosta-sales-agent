-- ============================================================================
-- 002_pricing.sql
-- Seed data: 16 pricing rows (4 bundles x 4 currencies).
-- Source: PROJECT.md authoritative pricing and CONTEXT.md bundle tracks.
--
-- Bundles:
--   1. Zero to Cloud DevOps (Cloud Computing + Advanced DevOps, 2 pathways, 16 wks)
--   2. DevOps Pro (Platform Engineer + SRE, 2 pathways, 16 wks)
--   3. 3 Pathways (any 3 pathways, 3 pathways, 24 wks)
--   4. Zero to DevOps Pro (all 4 pathways, 4 pathways, 32 wks)
--
-- GBP prices from PROJECT.md (authoritative):
--   2 pathways: 3000 standard / 2400 early bird
--   3 pathways: 4500 standard / 3450 early bird
--   All 4:      6000 standard / 4500 early bird
--
-- Conversion rates (approximate, rounded):
--   USD: GBP x 1.27 (rounded to nearest 50)
--   EUR: GBP x 1.17 (rounded to nearest 50)
--   NGN: GBP x 2000 (rounded to nearest 10000)
--
-- Instalment surcharges (per CONTEXT.md):
--   2 instalments: +100 over standard (GBP equivalent per currency)
--   3 instalments: +200 over standard (GBP equivalent per currency)
--
-- Run after 001_tables.sql (requires pricing table).
-- Uses ON CONFLICT for idempotency.
-- ============================================================================

-- ============================================================================
-- BUNDLE 1: Zero to Cloud DevOps (2 pathways, 16 weeks)
-- GBP: 3000/2400 | USD: 3800/3050 | EUR: 3500/2800 | NGN: 6000000/4800000
-- ============================================================================

INSERT INTO pricing (bundle_name, bundle_slug, bundle_size, pathway_ids, currency, standard_price, early_bird_price, early_bird_deadline, cohort_start_date, instalment_2_total, instalment_3_total, instalment_dates)
VALUES (
    'Zero to Cloud DevOps', 'zero-to-cloud-devops', 2,
    ARRAY['cloud-computing', 'advanced-devops'],
    'GBP', 3000.00, 2400.00, '2026-03-18', '2026-04-25',
    3100.00, 3200.00, ARRAY['2026-03-30'::DATE, '2026-04-30'::DATE, '2026-05-30'::DATE]
)
ON CONFLICT (bundle_slug, currency) DO NOTHING;

INSERT INTO pricing (bundle_name, bundle_slug, bundle_size, pathway_ids, currency, standard_price, early_bird_price, early_bird_deadline, cohort_start_date, instalment_2_total, instalment_3_total, instalment_dates)
VALUES (
    'Zero to Cloud DevOps', 'zero-to-cloud-devops', 2,
    ARRAY['cloud-computing', 'advanced-devops'],
    'USD', 3800.00, 3050.00, '2026-03-18', '2026-04-25',
    3900.00, 4050.00, ARRAY['2026-03-30'::DATE, '2026-04-30'::DATE, '2026-05-30'::DATE]
)
ON CONFLICT (bundle_slug, currency) DO NOTHING;

INSERT INTO pricing (bundle_name, bundle_slug, bundle_size, pathway_ids, currency, standard_price, early_bird_price, early_bird_deadline, cohort_start_date, instalment_2_total, instalment_3_total, instalment_dates)
VALUES (
    'Zero to Cloud DevOps', 'zero-to-cloud-devops', 2,
    ARRAY['cloud-computing', 'advanced-devops'],
    'EUR', 3500.00, 2800.00, '2026-03-18', '2026-04-25',
    3600.00, 3750.00, ARRAY['2026-03-30'::DATE, '2026-04-30'::DATE, '2026-05-30'::DATE]
)
ON CONFLICT (bundle_slug, currency) DO NOTHING;

INSERT INTO pricing (bundle_name, bundle_slug, bundle_size, pathway_ids, currency, standard_price, early_bird_price, early_bird_deadline, cohort_start_date, instalment_2_total, instalment_3_total, instalment_dates)
VALUES (
    'Zero to Cloud DevOps', 'zero-to-cloud-devops', 2,
    ARRAY['cloud-computing', 'advanced-devops'],
    'NGN', 6000000.00, 4800000.00, '2026-03-18', '2026-04-25',
    6200000.00, 6400000.00, ARRAY['2026-03-30'::DATE, '2026-04-30'::DATE, '2026-05-30'::DATE]
)
ON CONFLICT (bundle_slug, currency) DO NOTHING;


-- ============================================================================
-- BUNDLE 2: DevOps Pro (2 pathways, 16 weeks)
-- GBP: 3000/2400 | USD: 3800/3050 | EUR: 3500/2800 | NGN: 6000000/4800000
-- ============================================================================

INSERT INTO pricing (bundle_name, bundle_slug, bundle_size, pathway_ids, currency, standard_price, early_bird_price, early_bird_deadline, cohort_start_date, instalment_2_total, instalment_3_total, instalment_dates)
VALUES (
    'DevOps Pro', 'devops-pro', 2,
    ARRAY['platform-engineer', 'sre'],
    'GBP', 3000.00, 2400.00, '2026-03-18', '2026-04-25',
    3100.00, 3200.00, ARRAY['2026-03-30'::DATE, '2026-04-30'::DATE, '2026-05-30'::DATE]
)
ON CONFLICT (bundle_slug, currency) DO NOTHING;

INSERT INTO pricing (bundle_name, bundle_slug, bundle_size, pathway_ids, currency, standard_price, early_bird_price, early_bird_deadline, cohort_start_date, instalment_2_total, instalment_3_total, instalment_dates)
VALUES (
    'DevOps Pro', 'devops-pro', 2,
    ARRAY['platform-engineer', 'sre'],
    'USD', 3800.00, 3050.00, '2026-03-18', '2026-04-25',
    3900.00, 4050.00, ARRAY['2026-03-30'::DATE, '2026-04-30'::DATE, '2026-05-30'::DATE]
)
ON CONFLICT (bundle_slug, currency) DO NOTHING;

INSERT INTO pricing (bundle_name, bundle_slug, bundle_size, pathway_ids, currency, standard_price, early_bird_price, early_bird_deadline, cohort_start_date, instalment_2_total, instalment_3_total, instalment_dates)
VALUES (
    'DevOps Pro', 'devops-pro', 2,
    ARRAY['platform-engineer', 'sre'],
    'EUR', 3500.00, 2800.00, '2026-03-18', '2026-04-25',
    3600.00, 3750.00, ARRAY['2026-03-30'::DATE, '2026-04-30'::DATE, '2026-05-30'::DATE]
)
ON CONFLICT (bundle_slug, currency) DO NOTHING;

INSERT INTO pricing (bundle_name, bundle_slug, bundle_size, pathway_ids, currency, standard_price, early_bird_price, early_bird_deadline, cohort_start_date, instalment_2_total, instalment_3_total, instalment_dates)
VALUES (
    'DevOps Pro', 'devops-pro', 2,
    ARRAY['platform-engineer', 'sre'],
    'NGN', 6000000.00, 4800000.00, '2026-03-18', '2026-04-25',
    6200000.00, 6400000.00, ARRAY['2026-03-30'::DATE, '2026-04-30'::DATE, '2026-05-30'::DATE]
)
ON CONFLICT (bundle_slug, currency) DO NOTHING;


-- ============================================================================
-- BUNDLE 3: 3 Pathways (3 pathways, 24 weeks)
-- GBP: 4500/3450 | USD: 5700/4400 | EUR: 5250/4050 | NGN: 9000000/6900000
-- ============================================================================

INSERT INTO pricing (bundle_name, bundle_slug, bundle_size, pathway_ids, currency, standard_price, early_bird_price, early_bird_deadline, cohort_start_date, instalment_2_total, instalment_3_total, instalment_dates)
VALUES (
    '3 Pathways', 'three-pathways', 3,
    ARRAY['cloud-computing', 'advanced-devops', 'platform-engineer'],
    'GBP', 4500.00, 3450.00, '2026-03-18', '2026-04-25',
    4600.00, 4700.00, ARRAY['2026-03-30'::DATE, '2026-04-30'::DATE, '2026-05-30'::DATE]
)
ON CONFLICT (bundle_slug, currency) DO NOTHING;

INSERT INTO pricing (bundle_name, bundle_slug, bundle_size, pathway_ids, currency, standard_price, early_bird_price, early_bird_deadline, cohort_start_date, instalment_2_total, instalment_3_total, instalment_dates)
VALUES (
    '3 Pathways', 'three-pathways', 3,
    ARRAY['cloud-computing', 'advanced-devops', 'platform-engineer'],
    'USD', 5700.00, 4400.00, '2026-03-18', '2026-04-25',
    5850.00, 5950.00, ARRAY['2026-03-30'::DATE, '2026-04-30'::DATE, '2026-05-30'::DATE]
)
ON CONFLICT (bundle_slug, currency) DO NOTHING;

INSERT INTO pricing (bundle_name, bundle_slug, bundle_size, pathway_ids, currency, standard_price, early_bird_price, early_bird_deadline, cohort_start_date, instalment_2_total, instalment_3_total, instalment_dates)
VALUES (
    '3 Pathways', 'three-pathways', 3,
    ARRAY['cloud-computing', 'advanced-devops', 'platform-engineer'],
    'EUR', 5250.00, 4050.00, '2026-03-18', '2026-04-25',
    5400.00, 5500.00, ARRAY['2026-03-30'::DATE, '2026-04-30'::DATE, '2026-05-30'::DATE]
)
ON CONFLICT (bundle_slug, currency) DO NOTHING;

INSERT INTO pricing (bundle_name, bundle_slug, bundle_size, pathway_ids, currency, standard_price, early_bird_price, early_bird_deadline, cohort_start_date, instalment_2_total, instalment_3_total, instalment_dates)
VALUES (
    '3 Pathways', 'three-pathways', 3,
    ARRAY['cloud-computing', 'advanced-devops', 'platform-engineer'],
    'NGN', 9000000.00, 6900000.00, '2026-03-18', '2026-04-25',
    9200000.00, 9400000.00, ARRAY['2026-03-30'::DATE, '2026-04-30'::DATE, '2026-05-30'::DATE]
)
ON CONFLICT (bundle_slug, currency) DO NOTHING;


-- ============================================================================
-- BUNDLE 4: Zero to DevOps Pro (all 4 pathways, 32 weeks)
-- GBP: 6000/4500 | USD: 7600/5700 | EUR: 7000/5250 | NGN: 12000000/9000000
-- ============================================================================

INSERT INTO pricing (bundle_name, bundle_slug, bundle_size, pathway_ids, currency, standard_price, early_bird_price, early_bird_deadline, cohort_start_date, instalment_2_total, instalment_3_total, instalment_dates)
VALUES (
    'Zero to DevOps Pro', 'zero-to-devops-pro', 4,
    ARRAY['cloud-computing', 'advanced-devops', 'platform-engineer', 'sre'],
    'GBP', 6000.00, 4500.00, '2026-03-18', '2026-04-25',
    6100.00, 6200.00, ARRAY['2026-03-30'::DATE, '2026-04-30'::DATE, '2026-05-30'::DATE]
)
ON CONFLICT (bundle_slug, currency) DO NOTHING;

INSERT INTO pricing (bundle_name, bundle_slug, bundle_size, pathway_ids, currency, standard_price, early_bird_price, early_bird_deadline, cohort_start_date, instalment_2_total, instalment_3_total, instalment_dates)
VALUES (
    'Zero to DevOps Pro', 'zero-to-devops-pro', 4,
    ARRAY['cloud-computing', 'advanced-devops', 'platform-engineer', 'sre'],
    'USD', 7600.00, 5700.00, '2026-03-18', '2026-04-25',
    7750.00, 7850.00, ARRAY['2026-03-30'::DATE, '2026-04-30'::DATE, '2026-05-30'::DATE]
)
ON CONFLICT (bundle_slug, currency) DO NOTHING;

INSERT INTO pricing (bundle_name, bundle_slug, bundle_size, pathway_ids, currency, standard_price, early_bird_price, early_bird_deadline, cohort_start_date, instalment_2_total, instalment_3_total, instalment_dates)
VALUES (
    'Zero to DevOps Pro', 'zero-to-devops-pro', 4,
    ARRAY['cloud-computing', 'advanced-devops', 'platform-engineer', 'sre'],
    'EUR', 7000.00, 5250.00, '2026-03-18', '2026-04-25',
    7150.00, 7250.00, ARRAY['2026-03-30'::DATE, '2026-04-30'::DATE, '2026-05-30'::DATE]
)
ON CONFLICT (bundle_slug, currency) DO NOTHING;

INSERT INTO pricing (bundle_name, bundle_slug, bundle_size, pathway_ids, currency, standard_price, early_bird_price, early_bird_deadline, cohort_start_date, instalment_2_total, instalment_3_total, instalment_dates)
VALUES (
    'Zero to DevOps Pro', 'zero-to-devops-pro', 4,
    ARRAY['cloud-computing', 'advanced-devops', 'platform-engineer', 'sre'],
    'NGN', 12000000.00, 9000000.00, '2026-03-18', '2026-04-25',
    12200000.00, 12400000.00, ARRAY['2026-03-30'::DATE, '2026-04-30'::DATE, '2026-05-30'::DATE]
)
ON CONFLICT (bundle_slug, currency) DO NOTHING;
