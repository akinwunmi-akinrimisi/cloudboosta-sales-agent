# Sarah 3-Call Webinar Flow — Design Spec

## Overview

Replace the single-call direct-sell strategy with a 3-call webinar-first flow. Sarah builds rapport over multiple touchpoints (invite → reminder → follow-up + sell) before attempting a close. Direct-sell becomes the fallback only when no upcoming webinars remain before the next cohort.

## Call Types

### Call 1 — Invite

**Trigger:** New lead picked up by auto-dialer, OR returning lead 1 day before next webinar.

**Flow for new leads:**
1. Warm intro
2. Find the next upcoming webinar (compare today vs webinar schedule)
3. Invite to webinar — tailor the pitch to the webinar topic ("We're running a free session this Thursday on how people with no tech background are breaking into cloud careers...")
4. Discovery — gather lead details (name, location, country, background, motivation, experience level). Same discovery questions as current flow.
5. Collect/confirm email — needed to send webinar link
6. Offer reminder call: "I can give you a quick call 2 hours before to remind you — would that be helpful?"
7. Log outcome as `WEBINAR_INVITED`
8. **NO selling, NO programme recommendation, NO pricing on this call**

**Flow for returning leads (already have details):**
1. Reference previous conversation: "Hi [name], last time we spoke you mentioned you were interested in cloud..."
2. Invite to next webinar (must be one they haven't been invited to yet — check `webinars_invited`)
3. Skip discovery — do NOT re-ask details already on file
4. Confirm email still correct
5. Offer reminder call
6. Log outcome as `WEBINAR_INVITED`

### Call 2 — Reminder

**Trigger:** 4pm GMT on webinar day (2 hours before 6pm start).

**Flow:**
1. Short, conversational, warm — not a voicemail drop
2. "Hi [name], just calling to say the webinar on [topic] starts at 6pm today. Will you be joining?"
3. Wait for response, react naturally
4. If they say they can't make it: "No worries! I'll send you the recording afterwards so you don't miss out."
5. Log outcome as `REMINDER_COMPLETED`
6. Call duration target: under 2 minutes

### Call 3 — Follow-up + Sell

**Trigger:** Day after the webinar.

**Flow:**
1. Ask if they attended: "Did you get a chance to join the webinar yesterday?"
2. Log their answer in `last_webinar_attended` (true/false)
3. **If attended:** Summarize key points from the webinar (read from webinar schedule file). "Great! So [speaker] covered some really interesting points about [topic]... What stood out to you?"
4. **If didn't attend:** Share key points anyway. "No worries — here's what was covered... [summary]. The key takeaway was..."
5. Transition to selling: Use all discovery intel gathered on Call 1. Recommend programme, quote pricing (use lookup_programme tool), handle objections (use get_objection_response tool), execute closing strategy.
6. All 6 closing strategies apply. All existing objection handling applies.
7. Log outcome: `COMMITTED`, `FOLLOW_UP`, `DECLINED`, or `NOT_QUALIFIED`

### Lead Doesn't Convert After Call 3

- Lead goes back into the webinar invite cycle
- Next invite call happens 1 day before the next upcoming webinar
- Sarah references the ongoing relationship: "I know the last webinar was really insightful — we've got another one coming up on [topic]..."
- Repeat until no more webinars remain before cohort start

### No Webinars Remaining (Fallback)

- Switch to direct-sell mode
- This is the current flow: discover → qualify → recommend → close
- All existing prompt logic, closing strategies, tools apply unchanged
- For returning leads with details already collected, skip discovery

## Webinar Schedule File

Expand `knowledge-base/webinar-schedule.md` to include summaries per webinar. Format:

```markdown
## [Date] — [Topic Title]
**Summary for Sarah (use on follow-up call):**
- Key point 1 from the webinar
- Key point 2
- Key point 3
- Key takeaway / call-to-action tie-in
```

Current upcoming webinars:
- April 3rd — Cloud DevOps: The Career Powering Modern Businesses
- April 10th — Fast-Track Your Cloud Transition in 16 Weeks
- April 17th — Why Cloud Skills Will Remain in Demand (Panel Discussion)
- April 24th — Stuck in Low-paying Roles? Advance with Cloud DevOps (AMA)

Past webinars (March 13, 20, 27) are ignored — Sarah only picks upcoming ones.

More webinars will be added for Cohort 3 and 4 sales cycles.

## Data Model Changes

### leads table — new columns

| Column | Type | Default | Purpose |
|---|---|---|---|
| `webinars_invited` | `text[]` | `'{}'` | Array of webinar dates (ISO) the lead has been invited to |
| `last_webinar_attended` | `boolean` | `null` | Did they attend the most recent webinar they were invited to? |

### call_logs table — new column

| Column | Type | Default | Purpose |
|---|---|---|---|
| `call_type` | `text` | `null` | One of: `invite`, `reminder`, `follow_up`, `direct_sell` |

### New outcome values

- `WEBINAR_INVITED` — Lead accepted webinar invite, details sent to email
- `REMINDER_COMPLETED` — Reminder call done
- Existing outcomes unchanged: `COMMITTED`, `FOLLOW_UP`, `DECLINED`, `NOT_QUALIFIED`, `NO_ANSWER`

### Lead status transitions

```
new → queued → calling → in_call → webinar_invited → (wait for webinar)
                                  → reminder_sent → (wait for post-webinar)
                                  → follow_up → (after sell attempt)
                                  → committed / declined / not_qualified
```

New status values needed: `webinar_invited`, `reminder_sent`

## System Prompt Changes

### New section: Webinar Flow

Sarah needs instructions for:
1. How to determine call type (check `call_type` context or infer from lead state)
2. Webinar invite script (Call 1) — new lead vs returning lead
3. Reminder script (Call 2)
4. Follow-up + sell script (Call 3)
5. Rules: NO selling on Call 1 or 2. Only sell on Call 3 or direct-sell.
6. How to read the webinar schedule and pick the next upcoming one

### Dynamic variables update

Add to Retell call initiation:
- `call_type` — `invite`, `reminder`, `follow_up`, `direct_sell`
- `next_webinar_date` — The date of the webinar being referenced
- `next_webinar_topic` — The topic title
- `next_webinar_summary` — Key points (for follow-up calls)
- `webinars_invited` — List of dates already invited to (so Sarah doesn't repeat)
- `lead_email` — Already added

### Tool changes

**log_call_outcome** — add parameters:
- `call_type` — `invite`, `reminder`, `follow_up`, `direct_sell`
- `webinar_date` — Which webinar was referenced (ISO date)
- `webinar_attended` — `true`/`false` (only on follow-up calls)
- `reminder_accepted` — `true`/`false` (only on invite calls — did they want a reminder?)

**Backend log_call_outcome handler** — update to:
- Save `call_type` to call_logs
- Append webinar date to `webinars_invited` array on leads table
- Update `last_webinar_attended` on leads table
- New status transitions: `webinar_invited`, `reminder_sent`

## Backend Changes

### main.py — initiate_call

When initiating a call, determine the call type and pass appropriate dynamic variables:
- Read lead's `webinars_invited`, `call_count`, and discovery fields
- Read `webinar-schedule.md` to find next upcoming webinar
- Determine call_type based on lead state and timing
- Pass all context as `retell_llm_dynamic_variables`

### Webinar schedule parser

New utility function that:
1. Reads `webinar-schedule.md`
2. Parses dates and topics
3. Compares with today's date
4. Returns next upcoming webinar (date, topic, summary)
5. Used by both initiate_call and the auto-dialer scheduling

### Auto-dialer scheduling changes

The n8n auto-dialer workflow needs to be aware of call types:
- Regular queue: pick up new leads for invite calls
- 1-day-before queue: pick up returning leads who need a re-invite
- 4pm GMT queue: pick up leads who need a reminder call
- Day-after queue: pick up leads who need a follow-up call

This may require a new `next_call_type` and `next_call_at` field on leads to schedule the right call at the right time.

### leads table — additional scheduling columns

| Column | Type | Default | Purpose |
|---|---|---|---|
| `next_call_type` | `text` | `null` | What type of call is next: `reminder`, `follow_up`, `re_invite`, `direct_sell` |
| `next_call_at` | `timestamptz` | `null` | When to make the next call (used by auto-dialer) |

## What Stays the Same

- All 3 tools (lookup_programme, get_objection_response, log_call_outcome) — extended, not replaced
- All 6 closing strategies (used on Call 3 and direct-sell only)
- Knowledge base (5 PDFs on Retell)
- Dashboard (all 3 tabs — call data still flows the same way)
- Email collection flow
- Retry/requeue logic for failed calls
- Security (auth, CORS, rate limiting)
- Pricing table and currency mapping

## Files Changed

| File | Change |
|---|---|
| `knowledge-base/webinar-schedule.md` | Add summaries per webinar, structured format |
| `execution/backend/prompts/sarah_system_prompt.txt` | Major rewrite — webinar flow instructions, call type awareness |
| `execution/backend/tools.py` | Add call_type, webinar_date, webinar_attended, reminder_accepted params |
| `execution/backend/scripts/tool_definitions.py` | Add new params to log_call_outcome schema |
| `execution/backend/main.py` | Webinar schedule parser, call type routing in initiate_call, new dynamic vars |
| `execution/backend/scripts/update_llm.py` | Add new dynamic variable defaults |
| Supabase migration | Add columns: webinars_invited, last_webinar_attended, call_type, next_call_type, next_call_at |
