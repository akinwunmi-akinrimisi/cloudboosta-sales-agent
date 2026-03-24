# Directive 00 — Foundation
## Accounts, SDK, Twilio Migration, Supabase Schema

---

## Goal
Stand up all external accounts and the Supabase database schema so every subsequent phase has infrastructure to build on.

## Inputs
- Retell AI account + API key
- Twilio account with number +1 161 570 0419
- Self-hosted Supabase at supabase.operscale.cloud
- Environment variables in `.env`

## Tools
- Retell Python SDK (`retell-sdk`)
- Supabase client (`supabase-py`)
- Twilio Console (manual for SIP trunk fallback)

## Tasks
1. Install Python dependencies (`pip install -r execution/backend/requirements.txt`)
2. Migrate Twilio number to Retell via `client.phone_number.import_twilio()`
3. Create Supabase tables: `leads`, `call_logs`, `pipeline_logs`, `dial_schedules`
4. Create Supabase views: `pipeline_snapshot`, `strategy_performance`, `todays_calls`, `leads_ready_to_call`
5. Enable RLS on all tables (see `security.md` section 4)
6. Run `bash skills.sh` to validate environment

## Outputs
- All 4 tables created with indexes
- All 4 views created
- Twilio number imported into Retell (or SIP trunk configured)
- `RETELL_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` verified working

## Edge Cases
- Twilio import may fail if number is on a trial account — fall back to SIP trunk method
- Supabase self-hosted may not support all PostgREST features — test each view after creation

## Lessons Learned
<!-- Update this section after completing the phase -->
