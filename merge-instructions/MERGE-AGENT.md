# MERGE: AGENT.md
## Type: Add new sections + update existing sections
## Priority: Core — this is the master DOE update

### Summary of Changes
The current AGENT.md covers cold calling from a Supabase queue. v3.0 adds:
- Multi-channel pre-contact outreach (WhatsApp + email before calling)
- Cal.com self-hosted booking integration
- OpenClaw/Evolution API for WhatsApp messaging
- Context-aware calling (call memory across sessions)
- Smart email handling (don't ask for what you already have)
- WhatsApp number detection
- Smart timezone-based call timing
- Warm transfer to Akinwunmi during live calls

### Claude Code Prompt
```
Read AGENT.md in full. Then apply the following changes. Do NOT rewrite the 
entire file — preserve the existing DOE structure (3-layer architecture, 
immutable rules, self-annealing loop, directory structure, summary block).

CHANGES TO EXISTING SECTIONS:

1. In the header block, update:
   - Version: 3.0
   - Stack line: add "OpenClaw/Evolution API (WhatsApp, VPS #2) + Cal.com 
     (booking, self-hosted) + Resend (email)"

2. In IMMUTABLE rules, add these new rules after the existing ones:
   - "John MUST reference previous call context on all follow-up calls. 
     Never treat a returning lead as a first-time contact."
   - "For leads with email already in Supabase, John NEVER asks for their 
     email on a call."
   - "John NEVER uses NATO alphabet (Bravo, Echo, etc.) when asking leads 
     to spell their email. Use natural language: 'Could you spell that out 
     for me?'"

3. In the System Architecture section, REPLACE the existing ASCII diagram 
   with this expanded flow:

```
                    ┌──────────────────────────────────────────┐
                    │           LEAD IMPORT (CSV)              │
                    │    first_name, last_name, phone, email   │
                    └──────────────┬───────────────────────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────────────────┐
                    │         SUPABASE (leads table)           │
                    │  Tags: has_email, has_whatsapp, timezone │
                    └──────────────┬───────────────────────────┘
                                   │
                          ┌────────┴────────┐
                          ▼                 ▼
               ┌─────────────────┐  ┌─────────────────┐
               │ WhatsApp Check  │  │  Has Email?      │
               │ (OpenClaw API)  │  │                  │
               └────────┬────────┘  └────────┬─────────┘
                        │                    │
          ┌─────────────┴─────────────┐      │
          ▼                           ▼      ▼
 ┌─────────────────┐      ┌──────────────────────────┐
 │ Send WhatsApp   │      │    Send Email            │
 │ (OpenClaw)      │      │    (Resend)              │
 │ + Cal.com link  │      │    + Cal.com link        │
 └────────┬────────┘      └──────────┬───────────────┘
          └──────────┬───────────────┘
                     ▼
          ┌─────────────────────────────────┐
          │  MONITOR FOR RESPONSE           │
          │  • Cal.com webhook (booking)    │
          │  • OpenClaw webhook (WA reply)  │
          │  • AI parses reply → datetime   │
          └──────────────┬──────────────────┘
                         ▼
             ┌─────────────────────────────┐
             │  JOHN CALLS AT LEAD'S       │
             │  PREFERRED TIME (Retell)    │
             └──────────────┬──────────────┘
                            ▼
             ┌──────────────────────────────┐
             │  POST-CALL AUTOMATION        │
             │  • Log transcript + outcome  │
             │  • COMMITTED → payment email │
             │  • FOLLOW_UP → schedule next │
             └──────────────────────────────┘
```

4. In the Infrastructure/Component table, ADD these rows:
   | OpenClaw/Evolution API | VPS #2 (Hostinger) | WhatsApp: messages, replies, number detection |
   | Cal.com | VPS (self-hosted) | Booking: leads schedule call times |
   | Resend | Cloud API | Email: intro outreach + payment details |

NEW SECTIONS TO ADD (insert after the existing Cold Calling section):

5. Add "## Lead Contact Flow" section with these subsections:

   ### CSV Import
   Upload CSV: first_name, last_name, phone, email (any field except phone 
   may be empty). System validates phone (E.164), deduplicates by phone, 
   checks WhatsApp registration via OpenClaw API, derives timezone from 
   country code, tags: has_email (bool), has_whatsapp (bool), timezone (string).

   ### Multi-Channel Pre-Contact Outreach
   Table showing 4 lead profiles:
   | Has email + on WhatsApp | Email + WhatsApp | Both with Cal.com link |
   | Has email, NOT on WhatsApp | Email only | Email with Cal.com link |
   | No email, on WhatsApp | WhatsApp only | WhatsApp with Cal.com link |
   | No email, NOT on WhatsApp | None | Direct cold call |

   Message content: Brief intro as John from Cloudboosta advisory team, 
   value prop, Cal.com booking link, alternative to reply with preferred time.

   ### Booking + Reply Monitoring
   Path A: Cal.com webhook → lead booked → status call_scheduled
   Path B: OpenClaw webhook + AI parse reply → extract datetime → call_scheduled
   Path C: No response after 48h → queue for direct cold call

   ### Smart Call Timing
   Derive timezone from phone country code (+44→London, +234→Lagos, +1→NY).
   Call during lead's local business hours: 9am-6pm. Never before 9am or 
   after 7pm local time.

6. Add "## Context-Aware Calling (Call Memory)" section:

   ### First Call
   Dynamic variables injected: lead_name, lead_email, has_email, 
   contact_method (whatsapp_booking/email_reply/cold_call), previous_calls=[].
   
   Opening adapts: booked → grateful reference. Reply → reference their message.
   Cold call → intro + ask for 2 minutes.

   ### Subsequent Calls
   System retrieves all previous call_logs for this lead. Injects summary,
   programme discussed, objections raised, strategy used. John opens with:
   "Last time we spoke, you mentioned..."
   
   ### Follow-Up Scheduling
   Every FOLLOW_UP: John asks "When would be a good time for me to follow up?"
   If vague, pins it down: "Tuesday or Wednesday? Morning or afternoon?"
   Exact datetime logged to leads.follow_up_at.

7. Add "## Smart Email Handling" section:

   | Email in Supabase | Never asks. Says "I'll send details to your email." |
   | No email, via WhatsApp | "Drop your email in our WhatsApp chat" |
   | No email, cold call | "What's your email?" If unclear: "Could you spell that?" NO NATO alphabet. |
   | Email captured on call | Stored immediately via save_email tool |

8. Add "## Warm Transfer" section:
   
   Trigger: lead highly interested + complex question OR requests human OR 
   ready to commit + wants reassurance.
   John says: "Let me connect you with someone from our team right now."
   Retell warm transfer to +44 7592 233052.
   John stays for handoff: "I've got [Name] on the line — they're asking about [topic]."

9. In Custom Functions (Tools) table, ADD these new functions:
   | get_lead_context | Retrieve previous call history | Start of subsequent calls |
   | save_email | Store email captured during call | When lead provides email |

10. UPDATE Pipeline Stages table — expand from current stages to include:
    | Enriched (WhatsApp check) | enriched |
    | Outreach sent | outreach_sent |
    | Lead books via Cal.com | call_scheduled |
    | Lead replies with time | call_scheduled |
    | No response 48h | outreach_no_response → queued for cold call |

After all changes, verify the document still follows DOE structure:
header → immutable → 3-layer → architecture → sections → self-anneal → 
summary → immutable footer.

Commit message: "feat: AGENT.md v3.0 — multi-channel outreach, Cal.com booking, 
context-aware calling, smart email, warm transfer"
```
