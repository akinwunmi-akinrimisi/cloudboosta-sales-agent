# Phase 7: Post-Call Workflows - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Create n8n post-call workflow (outcome routing: COMMITTED → payment email, FOLLOW_UP → reminder email, DECLINED → graceful close email) and CSV lead import workflow. Add webhook trigger in call_ended handler to notify n8n. Switch email provider from Resend to MailerLite.

</domain>

<decisions>
## Implementation Decisions

### Email Provider Change
- **MailerLite** replaces Resend for all transactional emails
- From address: akinwunmi.akinrimisi@cloudboosta.co.uk
- API key: MAILERLITE_API_KEY in .env
- All 3 email types (payment, follow-up reminder, graceful close) use MailerLite
- NOTE: requirements.txt has resend==2.5.1 — may need mailerlite package or use n8n's MailerLite node directly

### Payment Email (COMMITTED)
- Currency-specific: only show bank details for lead's currency (from country→currency mapping)
- Content:
  - Personalized greeting with lead name
  - Programme name + price in their currency
  - Bank details for their currency ONLY:
    - GBP: Revolut (Account: 89383123, Sort: 23-01-20, IBAN: GB63 REVO 2301 2089 3831 23, BIC: REVOGB21, Intermediary: CHASGB2L)
    - EUR: Revolut (same IBAN, Intermediary: CHASDEFX)
    - USD: Revolut (same IBAN, Intermediary: CHASGB2L)
    - NGN: GTBank (Account: 0631796979, Bank: Guaranty Trust Bank)
  - Payment reference format: CB-[FullName]-[PathwayName]
  - Next steps: send proof to support@cloudboosta.co.uk, credentials in 24h, WhatsApp group, starts April 25 2026
  - Contact: WhatsApp +44 7592 233052 / +44 7565 707254
- After email sent: update lead status from 'committed' to 'payment_sent'

### Follow-Up Reminder Email (FOLLOW_UP)
- Send a brief reminder email: "We'll call you back on [date]. Looking forward to it."
- Keeps lead warm between calls
- Does NOT replace the retry requeue logic from Phase 6 (that still happens)
- Only sent if lead has email address

### Graceful Close Email (DECLINED)
- Send a respectful close email: "Thanks for your time, door is always open, future cohorts available"
- Matches Playbook Section 10 Day 10+ graceful close tone
- Only sent if lead has email address
- Lead remains 'declined' — no status change

### Post-Call Trigger
- main.py call_ended handler POSTs to n8n webhook URL after updating call_logs
- Payload: {outcome, lead_id, programme_recommended, currency, lead_email, lead_name, follow_up_date}
- Only fires for COMMITTED, FOLLOW_UP, DECLINED outcomes (not NO_ANSWER/voicemail/busy — those are handled by retry logic)
- N8N_WEBHOOK_BASE env var + '/post-call' path
- httpx.post with timeout=5s, fire-and-forget (don't block webhook response)

### n8n Post-Call Workflow
- Webhook Trigger receives post-call payload
- IF node routes by outcome:
  - COMMITTED → build currency-specific email → send via MailerLite → update lead to payment_sent
  - FOLLOW_UP → build reminder email → send via MailerLite
  - DECLINED → build graceful close email → send via MailerLite
- Workflow exported as execution/n8n/post-call-handler.json

### CSV Lead Import Workflow (AUTO-03)
- n8n webhook receives multipart POST with CSV file
- Flow:
  1. Webhook Trigger (receives file)
  2. Spreadsheet node (parse CSV)
  3. Code node (validate each row): E.164 phone required, name required, email/location/country optional
  4. Supabase node (check duplicates by phone)
  5. Supabase node (insert valid rows with status='new', source='csv_import')
  6. Return summary: {imported: N, skipped: N, errors: [{row, reason}]}
- Invalid rows skipped but collected in error report
- Workflow exported as execution/n8n/lead-import.json

### Claude's Discretion
- n8n MailerLite node configuration vs HTTP Request to MailerLite API
- Email HTML template design
- Exact n8n workflow JSON structure and node wiring
- How to handle leads without email (skip email, log warning)
- Whether to use n8n MailerLite node or HTTP Request node for email sending

</decisions>

<specifics>
## Specific Ideas

- Payment email must look professional — this is the moment the lead commits money. Clean formatting, clear bank details, no ambiguity.
- The graceful close email tone should match the Playbook: "Door's always open. Future cohorts, you'll be first to know."
- The follow-up reminder is brief: "Hi [Name], just confirming we'll call you back on [date]. Looking forward to chatting again."
- CSV import is primarily for Wave 0 (10 test leads already in Supabase, but operator will import real leads via CSV for production)
- The post-call webhook from main.py should be non-blocking (fire-and-forget with timeout=5s) so it doesn't delay the webhook response to Retell

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `execution/backend/main.py` — call_ended handler needs extending with POST to n8n webhook
- `execution/n8n/auto-dialer.json` — Pattern for n8n workflow JSON structure (15 nodes, just exported)
- `execution/backend/tools.py` — COUNTRY_CURRENCY_MAP for determining lead's currency
- `execution/backend/seeds/002_pricing.sql` — Pricing data shape for email content
- `.env` — MAILERLITE_API_KEY, N8N_WEBHOOK_BASE already set

### Established Patterns
- n8n workflows exported as JSON in execution/n8n/
- n8n webhook triggers at N8N_WEBHOOK_BASE + '/path'
- httpx.post for non-blocking webhook calls from main.py
- Supabase queries via n8n Supabase node or HTTP Request

### Integration Points
- call_ended (main.py) → POST N8N_WEBHOOK_BASE/post-call → n8n post-call workflow
- n8n post-call workflow → MailerLite API → lead email
- n8n post-call workflow → Supabase UPDATE leads (committed → payment_sent)
- CSV import → POST N8N_WEBHOOK_BASE/lead-import → n8n import workflow → Supabase INSERT leads

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 07-post-call-workflows*
*Context gathered: 2026-03-25*
