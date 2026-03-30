# MERGE: security.md
## Type: Add new subsections to existing security sections
## Priority: High — new attack surfaces from WhatsApp + Cal.com + email

### Claude Code Prompt
```
Read security.md in full. Add the following items into the EXISTING sections.
Do not restructure or rewrite existing content.

1. In THREAT MODEL table, ADD these rows:
   | OpenClaw API | Unauthenticated message sending | Spam from your WhatsApp, account ban | HIGH |
   | Cal.com webhooks | Fake booking injection | False leads, wasted call slots | MEDIUM |
   | Email content | PII in outreach emails | Data exposure if email forwarded | MEDIUM |
   | WhatsApp message replies | Injection via reply text | Malicious content parsed by AI | LOW |

2. In SECRETS MANAGEMENT → 1.1 Pre-commit hook, ADD these patterns to PATTERNS array:
   'OPENCLAW_API_KEY\s*='
   'CAL_COM_API_KEY\s*='
   'CAL_COM_WEBHOOK_SECRET\s*='

3. In SECRETS MANAGEMENT → 1.3 .env.example, ADD:
   OPENCLAW_API_URL=http://your-vps2-ip:8080
   OPENCLAW_API_KEY=your_openclaw_key_here
   OPENCLAW_INSTANCE=cloudboosta
   CAL_COM_URL=https://cal.yourdomain.com
   CAL_COM_API_KEY=your_cal_com_key_here
   CAL_COM_WEBHOOK_SECRET=generate_random_32_chars

4. In SECRETS MANAGEMENT → 1.4 Rotation Schedule, ADD:
   | OPENCLAW_API_KEY | Every 90 days | Regenerate in OpenClaw dashboard → update .env |
   | CAL_COM_API_KEY | Every 90 days | Regenerate in Cal.com admin → update .env |

5. In WEBHOOK SECURITY section, ADD new subsection:

   ### 2.4 Cal.com Webhook Verification
   Cal.com signs webhooks with a secret. Verify before processing:
   
   async def verify_calcom_webhook(request: Request) -> bytes:
       body = await request.body()
       signature = request.headers.get("x-cal-signature-256", "")
       expected = hmac.new(
           os.environ["CAL_COM_WEBHOOK_SECRET"].encode(),
           body, hashlib.sha256
       ).hexdigest()
       if not hmac.compare_digest(signature, expected):
           raise HTTPException(status_code=401, detail="Invalid Cal.com signature")
       return body

   ### 2.5 OpenClaw API Security
   - OpenClaw runs on VPS #2 with no public exposure. Access only via
     internal IP or VPN.
   - All API calls require the apikey header.
   - Never expose the OpenClaw API URL or key to frontend code.
   - Rate limit outbound WhatsApp: max 30 messages per hour to avoid
     WhatsApp account suspension.
   - Never send WhatsApp to numbers that have opted out or been marked
     do_not_contact.

6. In INPUT VALIDATION section, ADD new subsection:

   ### 6.4 WhatsApp Reply Sanitization
   Before passing WhatsApp reply text to the AI datetime parser:
   
   def sanitize_whatsapp_reply(text: str) -> str:
       text = text.strip()
       if len(text) > 500:
           text = text[:500]
       # Remove any URLs (prevent prompt injection via links)
       text = re.sub(r'https?://\S+', '[link removed]', text)
       # Remove any code-like patterns
       text = re.sub(r'[{}\[\]<>]', '', text)
       return text

   ### 6.5 Email Address Validation (captured on call)
   When John captures an email during a call via the save_email tool:
   
   EMAIL_PATTERN = re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')
   
   def validate_email(email: str) -> str:
       email = email.strip().lower()
       if not EMAIL_PATTERN.match(email):
           raise ValueError(f"Invalid email: {email}")
       if len(email) > 254:
           raise ValueError("Email too long")
       return email

7. In TELEPHONY SECURITY section, ADD:

   ### 8.3 WhatsApp Anti-Spam Compliance
   - Max 30 outreach messages per hour (WhatsApp rate limit)
   - Never send more than 1 message to the same number in 24 hours
   - If a lead replies "stop" or "unsubscribe", immediately set
     do_not_contact=true and never message again
   - Log every outbound WhatsApp in pipeline_logs for audit trail

8. In SECURITY CHECKLIST, ADD these items:
   [ ] OpenClaw API not exposed to public internet
   [ ] Cal.com webhook signature verification enabled
   [ ] WhatsApp outreach rate limited to 30/hour
   [ ] WhatsApp opt-out ("stop") handling implemented
   [ ] Email validation on save_email tool
   [ ] WhatsApp reply text sanitized before AI parsing
   [ ] OpenClaw and Cal.com API keys in .env (not hardcoded)

9. In INCIDENT RESPONSE, ADD:
   5. **WhatsApp Account Ban** — Stop all outbound messages immediately.
      Review message templates for spam triggers. Contact WhatsApp Business
      support. Reduce sending rate. Never resume until account is restored.

Commit message: "feat: security.md — OpenClaw, Cal.com, WhatsApp, email 
security controls"
```
