# Directive 06 — Post-Call Handler
## n8n Workflow: Outcome Processing, Email, Follow-Up Scheduling

---

## Goal
Build the n8n workflow that processes call outcomes after Retell fires `call_ended` / `call_analyzed` webhooks.

## Trigger
Webhook — receives Retell call lifecycle events forwarded from the FastAPI backend.

## Flow

### Parse Call Data
Extract: `call_id`, `transcript`, `outcome`, `summary`, `duration_ms`, `recording_url`, `closing_strategy_used`, `lead_persona`

### Outcome Routing

| Outcome | Actions |
|---------|---------|
| **COMMITTED** | 1. Update lead → `payment_pending` 2. Send payment email via Resend (bank details from `payment-details.pdf`) 3. Send admin notification email 4. Log to `pipeline_logs` |
| **FOLLOW_UP** | 1. Update lead → `follow_up_scheduled` with `follow_up_at` date 2. Send admin summary email 3. Schedule follow-up call (requeue lead for that date) 4. Log to `pipeline_logs` |
| **DECLINED** | 1. Update lead → `declined` with `decline_reason` 2. Log to `pipeline_logs` 3. No further action |
| **NO_ANSWER** | 1. Check retry_count vs max_retries 2. If under limit → requeue with status='queued' 3. If at limit → status='exhausted' |
| **VOICEMAIL** | Same as NO_ANSWER |
| **BUSY** | Requeue with 60-minute delay |

### Email Templates
- Payment email: include programme name, pricing, bank transfer details (GBP/USD/EUR/NGN)
- Admin notification: lead name, phone (masked), outcome, strategy used, summary

## Security
- Payment emails use Resend API (never send raw bank details via unsecured channels)
- Mask phone numbers in admin emails (+234****1234)

## Edge Cases
- If Resend API fails: log error, still update lead status, retry email manually
- If follow_up_date is in the past: default to next business day
- If outcome is missing from webhook: classify as ERROR, log for manual review

## Lessons Learned
<!-- Update this section after completing the phase -->
