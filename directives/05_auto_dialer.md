# Directive 05 — Auto-Dialer + Lead Import
## n8n Scheduled Workflows: Dialer, Post-Call Trigger, CSV Import

---

## Goal
Build n8n workflows that automate the outbound calling pipeline: scheduled dialing within time windows, and lead import from CSV.

## Workflows

### 5.1 Scheduled Auto-Dialer
- **Trigger:** Cron — every 2 minutes during active dial window
- **Flow:**
  1. Check if current time is within any active `dial_schedules` window
  2. Check if there's already a call in progress (status='calling' or 'in_call')
  3. Pick next lead where status='queued', ordered by priority then created_at
  4. POST to webhook backend `/retell/initiate-call` with `lead_id`
  5. On error: log, reset lead to 'queued', continue next cycle

### 5.2 Lead Import
- **Trigger:** Webhook (receives CSV data or JSON array)
- **Flow:**
  1. Parse incoming data (name, phone, email, location, source)
  2. Validate phone format (E.164)
  3. Deduplicate against existing leads by phone
  4. Insert new leads with status='new'
  5. Batch update to status='queued'
  6. Return count: imported, duplicates, errors

## Security
- All n8n webhook triggers must use Header Auth (`X-Webhook-Secret`)
- See security.md section 2.3

## Rate Limits
- 1 call per 2 minutes minimum
- Max 200 calls per day
- Max 1 concurrent call

## Edge Cases
- If Retell API fails mid-dial: log error, mark lead back to 'queued'
- If all leads exhausted: dialer exits silently until new leads imported
- CSV with >10,000 rows: reject with error message

## Lessons Learned
<!-- Update this section after completing the phase -->
