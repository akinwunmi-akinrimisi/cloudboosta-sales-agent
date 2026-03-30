# MERGE: CLAUDE.md
## Type: Add new sections + update existing
## Priority: High — Claude Code reads this first

### Claude Code Prompt
```
Read CLAUDE.md in full. Apply these targeted changes without rewriting 
unrelated sections.

1. In PROJECT CONTEXT, add after the existing description:
   
   "v3.0 adds multi-channel pre-contact outreach. Before cold calling, John 
   sends intro messages via WhatsApp (OpenClaw) and email (Resend) with a 
   Cal.com booking link. Leads who book or reply are called at their preferred 
   time. Leads who don't respond within 48h are cold-called directly."

2. In the FILE STRUCTURE section, add these new directories/files:
   
   execution/
   ├── backend/               ← FastAPI webhook server
   ├── dashboard/             ← React app
   ├── n8n/                   ← Workflow JSON exports
   ├── cal-com/               ← Cal.com Docker config + setup scripts
   └── outreach/              ← Email templates + WhatsApp message templates

3. In CRITICAL RULES section, ADD these rules:

   ### Multi-Channel Outreach
   - OpenClaw/Evolution API is on VPS #2 (Hostinger). Already running.
   - Cal.com will be self-hosted on VPS. Docker deployment.
   - Email outreach uses Resend API — not OpenClaw.
   - WhatsApp outreach uses OpenClaw — not Twilio WhatsApp.
   - Before sending WhatsApp, ALWAYS check if number is registered on 
     WhatsApp via OpenClaw's number check API.

   ### Call Memory
   - Before EVERY call to an existing lead, retrieve previous call_logs 
     from Supabase and inject summaries into Retell dynamic variables.
   - John must NEVER treat a returning lead as a first-time contact.
   
   ### Email Handling
   - If lead's email exists in Supabase, John NEVER asks for it on the call.
   - When asking a lead to spell their email on a call, NEVER use NATO 
     alphabet. Use natural language only.

4. In ENVIRONMENT VARIABLES section (or .env.example references), ADD:
   
   OPENCLAW_API_URL=http://vps2-ip:8080
   OPENCLAW_API_KEY=your_openclaw_key_here
   CAL_COM_URL=https://cal.yourdomain.com
   CAL_COM_API_KEY=your_cal_com_api_key_here
   CAL_COM_WEBHOOK_SECRET=generate_a_random_32_char_string

5. In TESTING COMMANDS section, ADD:
   
   # Test OpenClaw WhatsApp connection
   curl -X POST $OPENCLAW_API_URL/message/sendText \
     -H "apikey: $OPENCLAW_API_KEY" \
     -d '{"number": "YOUR_NUMBER", "text": "Test from John agent"}'

   # Test Cal.com API
   curl -H "Authorization: Bearer $CAL_COM_API_KEY" \
     "$CAL_COM_URL/api/v1/availability"

   # Test context retrieval for a lead
   curl http://localhost:8000/api/lead-context/TEST_LEAD_UUID

Commit message: "feat: CLAUDE.md — add OpenClaw, Cal.com, outreach, call memory instructions"
```
