# Phase 1: Foundation + SDK Migration - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Supabase schema (4 core tables + 3 reference data tables), 3 SQL views, 1 atomic RPC function, RLS policies, retell-sdk 4.x to 5.x upgrade, and phone number migration to weighted agents format. HARD DEADLINE: March 31, 2026 for weighted agents migration.

</domain>

<decisions>
## Implementation Decisions

### Lead Status Lifecycle
- Full 14-state model: new, queued, calling, in_call, committed, follow_up, declined, not_qualified, no_answer, voicemail, busy, payment_sent, do_not_contact, failed
- DB-level enforcement via trigger function with valid transitions map (not app-level only)
- Valid transitions:
  - new -> queued (after phone validation) | failed (bad phone)
  - queued -> calling (dialer picks)
  - calling -> in_call (connected) | no_answer | voicemail | busy (not connected)
  - in_call -> committed | follow_up | declined | not_qualified
  - committed -> payment_sent (after email sent)
  - follow_up -> queued (rescheduled by n8n)
  - no_answer/voicemail/busy -> queued (retry, if retries < 2) | declined (max retries exhausted)
  - Any state -> do_not_contact (manual, lead request, or regulatory import)
- payment_sent is a lead status (not tracked separately) -- visible in pipeline kanban
- Max-retried leads (2 retries exhausted) move to 'declined', not 'failed'
- do_not_contact triggered by: lead verbal opt-out during call, manual operator action from dashboard, regulatory DNC list import

### Reference Data Tables
- 3 separate reference tables (not JSON blobs, not hardcoded):
  - `programmes` (4 rows): name, duration_weeks, description, topics[], prerequisites, tools[], roles_after[]
  - `pricing` (16 rows = 4 bundles x 4 currencies): bundle_size, currency, standard_price, early_bird_price
  - `objection_responses` (30+ rows): category, objection_key, trigger_phrases[], what_theyre_saying, responses (JSONB array of {label, script}), cultural_nuances (JSONB {nigeria, uk, us}), recovery_script, escalation_trigger
- 4 pathways: Cloud Computing, Advanced DevOps, Platform Engineer, SRE
- 4 bundle tracks: Zero to Cloud DevOps (1+2), DevOps Pro (3+4), 3 Pathways (any 3), Zero to DevOps Pro (all 4)
- 4 currencies: GBP, USD, EUR, NGN
- 10 objection categories (corrected from research's "11"): Price & Money, Time & Commitment, Trust & Credibility, Personal & Family, Self-Doubt & Fear, Market & Career Doubts, Logistics & Format, Competitor & Alternative, Stalls & Deflections, Compound & Edge Cases
- Each objection has: multiple response scripts, cultural nuances for UK/Nigeria/US, recovery scripts, escalation triggers

### Seed Data Strategy
- SQL seed files in `execution/backend/seeds/`:
  - `001_programmes.sql` -- 4 pathways with full details from programmes.pdf
  - `002_pricing.sql` -- 16 rows (4 bundles x 4 currencies, standard + early bird)
  - `003_objection_responses.sql` -- 30+ objections from objection-handling.pdf
  - `004_test_leads.sql` -- 10 Wave 0 test leads
- Version controlled, repeatable, run once against Supabase

### Dial Window Defaults
- Timezone: Europe/London (GMT/BST)
- Call hours: 10:00 AM to 7:00 PM
- Call days: Every day (Monday through Sunday, 7 days)
- One default schedule seeded in dial_schedules table

### Claude's Discretion
- Exact column types and indexes for each table
- RLS policy specifics (which roles get which access)
- SQL view query logic
- retell-sdk 5.x migration approach (method signature changes)
- pick_next_lead() RPC implementation details
- Phone number weighted agents API call format

</decisions>

<specifics>
## Specific Ideas

- The objection handling data comes from `knowledge-base/objection-handling.pdf` (29 pages, "Maximum Depth Edition") -- extract ALL 30+ objections with their full response scripts, cultural nuances, and recovery scripts
- Programme data comes from `knowledge-base/programmes.pdf` -- exact pathway names, tools, roles, and pricing from Cohort 2 document
- Early bird pricing expires March 18, 2026. Cohort 2 starts Saturday April 25, 2026. These dates should be in the seed data.
- Instalment plans: 2 instalments adds 100 total, 3 instalments adds 200 total. Payment dates: March 30, April 30, May 30, 2026.

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `supabase_client.py`: Supabase client already initialized with SUPABASE_SERVICE_KEY -- reuse for all DB operations
- `retell_config.py`: Retell client already initialized -- reuse for SDK upgrade and phone number migration
- `dialer.py`: Already queries leads (status filtering), call_logs (daily count), dial_schedules (time windows) -- these inform the exact table schemas needed
- `main.py`: Already has initiate-call endpoint using `retell_client.call.create_phone_call()` with `from_number`, `to_number`, `agent_id`, `retell_llm_dynamic_variables` -- this is the code that needs SDK 5.x migration

### Established Patterns
- All env vars loaded via python-dotenv (`load_dotenv()`)
- Supabase queries use chained `.table().select().eq().execute()` pattern
- requirements.txt pins exact versions (update retell-sdk==5.8.0, supabase>=2.12.0)

### Integration Points
- `dialer.py:get_next_lead()` currently does a simple SELECT -- must be replaced with `pick_next_lead()` RPC call after Phase 1
- `tools.py` stubs reference `programmes` and `objections` tables that don't exist yet -- Phase 1 creates them
- `main.py:initiate_call()` uses `agent_id` param -- may need adjustment for weighted agents format in SDK 5.x
- `.env.example` already has RETELL_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY

</code_context>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation-sdk-migration*
*Context gathered: 2026-03-25*
