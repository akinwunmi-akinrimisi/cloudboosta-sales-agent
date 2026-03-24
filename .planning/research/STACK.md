# Technology Stack

**Project:** Sarah -- Cloudboosta AI Cold-Calling Sales Agent
**Researched:** 2026-03-24
**Overall Confidence:** HIGH

---

## Recommended Stack

### Voice Platform: Retell AI

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Retell AI Platform | Current (March 2026) | Voice agent orchestration -- STT, TTS, turn-taking, call management | Handles all audio/telephony complexity. Project requirement. Already has 3 agents configured. | HIGH |
| `retell-sdk` (Python) | **5.8.0** | Python SDK for Retell REST API | Latest stable on PyPI (Jan 7, 2026). Major version bump from 4.x to 5.x -- the `4.12.0` pinned in requirements.txt is outdated by a full major version. | HIGH |
| GPT-4o-mini on Retell | Current | LLM backbone for Sarah's conversation | Fast (low time-to-first-token), cheap, proven on Retell. Project constraint: keep system prompt under 8K tokens. GPT-5 Nano is now available on Retell but GPT-4o-mini remains the cost-performance sweet spot for voice agents where latency matters more than raw reasoning. | MEDIUM |

**CRITICAL: Retell API Deprecation (March 31, 2026)**

The `inbound_agent_id` and `outbound_agent_id` fields on phone numbers are being deprecated in favour of weighted agent lists (`inbound_agents`, `outbound_agents`). This is happening **7 days from now**. The codebase in `skills.md` uses the old fields. All phone number configuration code must use the new weighted agent format from day one.

Old pattern (deprecated):
```python
client.phone_number.update(
    phone_number_id=number_id,
    inbound_agent_id=agent_id,   # DEPRECATED
    outbound_agent_id=agent_id,  # DEPRECATED
)
```

New pattern (required):
```python
client.phone_number.update(
    phone_number_id=number_id,
    inbound_agents=[{"agent_id": agent_id, "weight": 100}],
    outbound_agents=[{"agent_id": agent_id, "weight": 100}],
)
```

**Retell create_phone_call API:**
- `from_number` and `to_number` are the only required parameters
- `agent_id` is resolved from the phone number's `outbound_agents` config
- Use `override_agent_id` to override per-call if needed
- Use `retell_llm_dynamic_variables` for `lead_name`, `lead_location` injection
- Webhook timeout: **10 seconds** with up to 3 retries -- tool execution must complete within 10s

**Retell Webhook Signature:**
- HMAC-SHA256 verification using `x-retell-signature` header
- Dedupe key available to prevent duplicate processing on retries

---

### Backend Framework: FastAPI + Uvicorn

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| FastAPI | **0.115.6** | Web framework for webhook endpoints + dashboard API | Async-native, Pydantic validation built-in, OpenAPI docs auto-generated. Industry standard for Python webhook servers. Pin to 0.115.x -- the 0.135.x series introduces strict Content-Type checking that may break Retell webhook payloads. | HIGH |
| Uvicorn | **0.34.0** | ASGI server | Production-grade, fast. The latest 0.42.0 is available but 0.34.x is battle-tested. For production, pair with Gunicorn: `gunicorn main:app -w 2 -k uvicorn.workers.UvicornWorker`. | HIGH |
| Pydantic | **2.12.5** | Request/response validation | Latest stable. Integral to FastAPI. Used for webhook payload validation, tool call schemas, and config models. | HIGH |
| python-dotenv | **1.2.2** | Environment variable loading | Latest stable (March 2026). Now requires Python >=3.10. Simple, reliable, universally used. | HIGH |
| httpx | **0.28.1** | HTTP client for outbound API calls | Async-capable, modern, used by retell-sdk internally. Needed for Resend API calls and n8n webhook triggers. | HIGH |

**Version Rationale for FastAPI 0.115.x vs 0.135.x:**
FastAPI 0.135.x introduces strict Content-Type checking for JSON requests by default. Retell webhooks may not consistently send `application/json` headers. Using 0.115.x avoids this breaking change. If 0.135.x is desired, set `strict_content_type=False` on relevant routes.

**Production deployment pattern:**
```bash
# Development
uvicorn main:app --reload --port 8000

# Production (behind Caddy/nginx HTTPS reverse proxy)
gunicorn main:app -w 2 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

---

### Database: Supabase (Self-Hosted)

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Supabase (self-hosted) | Current | PostgreSQL database + auth + REST API | Already running at supabase.operscale.cloud. Provides RLS, real-time subscriptions, and REST API out of the box. | HIGH |
| `supabase` (Python) | **2.12.0** | Python client for backend | Pin to 2.12.x for stability. Latest is 2.28.3 but the jump from 2.10.0 (in requirements.txt) to 2.28.x is large. Test before upgrading beyond 2.12.x. | MEDIUM |
| `@supabase/supabase-js` | **2.49.0** | JavaScript client for dashboard | Pin to 2.49.x. Latest is 2.99.3 but the 2.45.0 in package.json is fine -- upgrade to 2.49.x for bug fixes. The 2.99.x range is a large jump; verify compatibility first. | MEDIUM |

**Why self-hosted Supabase over managed:**
Already deployed at supabase.operscale.cloud. No additional cost. Full control over data (PII in leads, transcripts). RLS provides row-level security without custom middleware.

**Key Supabase patterns:**
- Backend uses `SUPABASE_SERVICE_KEY` (bypasses RLS) -- NEVER expose to frontend
- Dashboard uses `SUPABASE_ANON_KEY` + Supabase Auth for authenticated read-only access
- Use `.select("*").eq("status", "queued").order("priority", desc=True).limit(1)` for queue polling
- Real-time subscriptions available for dashboard live view but polling every 5s is simpler and sufficient for single-user dashboard

---

### Workflow Automation: n8n (Self-Hosted)

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| n8n | **2.11.x** | Auto-dialer scheduler, post-call handler, lead import | Already self-hosted at n8n.srv1297445.hstgr.cloud. Visual workflow builder with cron triggers, Supabase node, HTTP request node, and webhook triggers. | HIGH |

**n8n workflow patterns for this project:**

1. **Auto-Dialer** (Cron trigger every 2 min): Check dial window -> Check no active call -> Pick next lead -> POST /retell/initiate-call
2. **Post-Call Handler** (Webhook trigger): Parse Retell call_ended event -> Update Supabase -> Route by outcome (COMMITTED -> Resend email, FOLLOW_UP -> schedule, DECLINED -> log)
3. **Lead Import** (Webhook trigger): Parse CSV/JSON -> Validate phones (E.164) -> Deduplicate -> Insert into Supabase

**n8n 2.x improvements relevant to this project:**
- Autosave with versioned publishing (no more lost workflow changes)
- External secrets management (1Password, HashiCorp Vault, AWS SM) -- use for Supabase and Retell keys
- Visual diff for workflow version comparison
- Supabase node has built-in support for CRUD operations

**Security:** All n8n webhook triggers must use Header Auth (`X-Webhook-Secret`).

---

### Email: Resend

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| `resend` (Python) | **2.26.0** | Transactional email for payment details | Latest stable (March 2026). Simple API, project requirement (explicitly not OpenClaw). Used only for post-call payment emails. | HIGH |

**Usage pattern:**
```python
import resend
resend.api_key = os.environ["RESEND_API_KEY"]

resend.Emails.send({
    "from": "Sarah <sarah@cloudboosta.co.uk>",
    "to": lead_email,
    "subject": f"Cloudboosta - Payment Details for {programme}",
    "html": payment_email_template(lead_name, programme, pricing),
})
```

---

### Dashboard: React + Vite + Tailwind CSS

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| React | **19.2.x** | Dashboard UI framework | Latest stable (19.2.4, Jan 2026). The package.json pins ^18.3.1 -- upgrade to 19.x for improved performance and concurrent features. | HIGH |
| React DOM | **19.2.x** | DOM rendering | Must match React version. | HIGH |
| Vite | **6.2.x** | Build tool + dev server | The package.json pins ^5.4.0. Vite 6 is stable. **Do NOT jump to Vite 8** (released days ago) -- it requires Rolldown and is too new for production. Vite 6 is the safe choice. | HIGH |
| Tailwind CSS | **3.4.x** | Utility-first CSS | Keep Tailwind 3.4.x for this project. Tailwind v4 (now at 4.2.2) has significant breaking changes: CSS-first config replaces tailwind.config.js, PostCSS plugin changes, class renames. The migration effort is not worth it for a greenfield dashboard of this size, but Tailwind 3 is still fully supported. If starting fresh, v4 is fine -- but v3 has far more community examples and component libraries. | MEDIUM |
| `@tailwindcss/postcss` | N/A (v3 uses standard PostCSS) | PostCSS integration | Only needed if using Tailwind v4. With v3, use standard `tailwindcss` and `autoprefixer` PostCSS plugins. | HIGH |
| Recharts | **3.8.0** | Data visualization | Latest stable. Declarative, React-native, SVG-based charting. Perfect for bar charts (strategy conversion), line charts (daily trends), and heatmaps (strategy x persona). The package.json pins ^2.12.0 -- upgrade to 3.x for performance improvements. | HIGH |
| `@vitejs/plugin-react` | **4.5.x** | Vite React plugin | Keep aligned with Vite 6. The ^4.3.0 pin is fine. | HIGH |

**Dashboard architecture decision: Polling vs Real-time**

Use polling (not Supabase real-time subscriptions). Rationale:
- Single operator user -- no need for multi-user real-time sync
- Live View polls every 5 seconds (active call status + recent calls)
- Pipeline and Strategy tabs poll every 30 seconds
- Simpler to implement, debug, and maintain
- No persistent WebSocket connections to manage

**Dashboard auth:**
Use bearer token auth (single admin user). Supabase Auth is overkill for a single-operator dashboard. The `DASHBOARD_SECRET_KEY` env var provides the token. The dashboard stores the token in localStorage after initial entry.

---

### Rate Limiting

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| `slowapi` | **0.1.9** | API rate limiting for dashboard endpoints | Still the most widely used FastAPI rate limiter despite being classified as "inactive". Works, is simple, and the in-memory backend is fine for a single-server deployment. Alternative `fastapi-limiter` requires Redis -- unnecessary here. | MEDIUM |

**If slowapi causes issues:** Replace with a custom token-bucket implementation (already shown in security.md). The project only needs rate limiting on 3 dashboard endpoints and webhook endpoints, which a 20-line custom implementation handles fine.

---

### Security Libraries

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| `pip-audit` | Latest | Dependency vulnerability scanning | Run before every deployment. Part of security checklist. | HIGH |
| `hmac` (stdlib) | N/A | Webhook signature verification | Python standard library. Used for Retell HMAC-SHA256 webhook verification. | HIGH |

---

### Python Runtime

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Python | **3.12.x** | Runtime | Stable, fast, full async support. python-dotenv 1.2.2 requires >=3.10. Docker base image: `python:3.12-slim`. | HIGH |

---

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Voice Platform | Retell AI | Bland AI, Vapi, VAPI.ai | Project requirement is Retell. Retell handles STT/TTS/VAD, has Python SDK, supports custom tools via webhooks. |
| Backend Framework | FastAPI | Django, Flask | FastAPI is async-native (critical for webhook handlers), has Pydantic validation built-in, and auto-generates OpenAPI docs. Django is overkill. Flask lacks native async. |
| Database | Supabase (self-hosted) | Raw PostgreSQL, Firebase | Supabase is already deployed. Provides REST API, auth, RLS, and real-time out of the box. Firebase doesn't support complex SQL queries needed for strategy analytics. |
| Workflow Automation | n8n (self-hosted) | Temporal, custom Python scheduler | n8n is already deployed, visual builder makes workflow iteration fast, has built-in Supabase and HTTP nodes. Temporal is overkill for 3 simple workflows. |
| Email | Resend | SendGrid, AWS SES, OpenClaw | Project explicitly requires Resend (not OpenClaw). Resend has the simplest Python API. Only sending ~10-50 emails/day. |
| Dashboard Charts | Recharts | Chart.js (react-chartjs-2), Nivo, Victory | Recharts is declarative React-native, SVG-based, lightweight. Perfect for the 3 chart types needed (bar, line, heatmap). Nivo is heavier. Victory has a larger API surface for no benefit here. |
| Dashboard CSS | Tailwind CSS 3.4 | Tailwind v4, CSS Modules, Chakra UI | Tailwind 3 is stable with massive ecosystem. v4 has breaking changes not worth the migration effort. CSS Modules require more boilerplate. Chakra adds runtime overhead. |
| Build Tool | Vite 6 | Vite 8, Webpack, Parcel | Vite 6 is stable and fast. Vite 8 uses Rolldown (too new, released days ago). Webpack is slow. Parcel lacks ecosystem. |
| Rate Limiting | slowapi | fastapi-limiter | fastapi-limiter requires Redis, which is unnecessary for a single-server deployment. slowapi works in-memory and is sufficient. |
| LLM on Retell | GPT-4o-mini | GPT-5 Nano, GPT-4o, Claude 4.5 Haiku | GPT-4o-mini has the best latency-to-cost ratio for voice agents. GPT-5 Nano is cheaper but newer and less proven on Retell. GPT-4o is 3-4x more expensive with marginal quality improvement for sales conversations. Claude models have higher per-minute costs on Retell. |

---

## Updated requirements.txt (Backend)

```
# Core
retell-sdk>=5.8.0,<6.0.0
fastapi>=0.115.0,<0.116.0
uvicorn>=0.34.0,<0.35.0
pydantic>=2.12.0,<3.0.0

# Database
supabase>=2.12.0,<3.0.0

# HTTP client
httpx>=0.28.0,<0.29.0

# Email
resend>=2.26.0,<3.0.0

# Environment
python-dotenv>=1.2.0,<2.0.0

# Rate limiting
slowapi>=0.1.9,<0.2.0

# Utilities
pytz>=2024.1
python-dateutil>=2.9.0
```

## Updated package.json Dependencies (Dashboard)

```json
{
  "dependencies": {
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "@supabase/supabase-js": "^2.49.0",
    "recharts": "^3.8.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.5.0",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.38",
    "tailwindcss": "^3.4.4",
    "vite": "^6.2.0"
  }
}
```

---

## Version Drift from Existing requirements.txt

The existing `execution/backend/requirements.txt` has several outdated pins:

| Package | Pinned Version | Current Stable | Action |
|---------|---------------|----------------|--------|
| retell-sdk | 4.12.0 | **5.8.0** | **MUST upgrade** -- major version, likely breaking API changes |
| fastapi | 0.115.0 | 0.135.1 | Keep 0.115.x -- avoids strict Content-Type breaking change |
| uvicorn | 0.32.0 | 0.42.0 | Upgrade to 0.34.x for stability |
| supabase | 2.10.0 | 2.28.3 | Upgrade to 2.12.x cautiously |
| httpx | 0.27.0 | 0.28.1 | Upgrade -- minor version |
| python-dotenv | 1.0.1 | 1.2.2 | Upgrade -- note: now requires Python >=3.10 |
| resend | 2.5.0 | 2.26.0 | Upgrade -- minor version |
| slowapi | 0.1.9 | 0.1.9 | Current |
| pydantic | 2.9.0 | 2.12.5 | Upgrade -- bug fixes and performance |

**The retell-sdk upgrade from 4.x to 5.x is the most critical.** The 4.x SDK likely does not support the new weighted agent phone number fields that become required on March 31, 2026.

---

## Installation Commands

### Backend
```bash
cd execution/backend

# Create virtual environment
python -m venv .venv
source .venv/bin/activate  # Linux/macOS
# .venv\Scripts\activate   # Windows

# Install dependencies
pip install -r requirements.txt

# Verify
python -c "from retell import Retell; print('retell-sdk OK')"
python -c "import fastapi; print(f'FastAPI {fastapi.__version__}')"
python -c "import supabase; print('supabase OK')"
```

### Dashboard
```bash
cd execution/dashboard

# Install dependencies
npm install

# Start dev server
npm run dev
# -> http://localhost:5173
```

### Validate Environment
```bash
bash skills.sh
```

---

## Sources

- [retell-sdk on PyPI](https://pypi.org/project/retell-sdk/) -- Version 5.8.0 confirmed
- [Retell AI SDKs Docs](https://docs.retellai.com/get-started/sdk) -- Python SDK requirements
- [Retell AI Changelog](https://www.retellai.com/changelog) -- Weighted agent deprecation, GPT-5 support, QA features
- [Retell AI Custom LLM Best Practices](https://docs.retellai.com/integrate-llm/llm-best-practice) -- Latency, prompt, temperature guidance
- [Retell AI Create Phone Call API](https://docs.retellai.com/api-references/create-phone-call) -- Current API reference
- [FastAPI on PyPI](https://pypi.org/project/fastapi/) -- Version 0.135.1
- [FastAPI Release Notes](https://fastapi.tiangolo.com/release-notes/) -- Strict Content-Type change
- [supabase on PyPI](https://pypi.org/project/supabase/) -- Version 2.28.3
- [@supabase/supabase-js on npm](https://www.npmjs.com/package/@supabase/supabase-js) -- Version 2.99.3
- [n8n Release Notes](https://docs.n8n.io/release-notes/) -- Version 2.11.x
- [n8n Supabase Node Docs](https://docs.n8n.io/integrations/builtin/app-nodes/n8n-nodes-base.supabase/) -- Integration patterns
- [React on npm](https://www.npmjs.com/package/react) -- Version 19.2.4
- [Vite Releases](https://vite.dev/releases) -- Version 8.0.2 (latest), 6.x recommended
- [Tailwind CSS on npm](https://www.npmjs.com/package/tailwindcss) -- Version 4.2.2
- [Recharts on npm](https://www.npmjs.com/package/recharts) -- Version 3.8.0
- [Resend on PyPI](https://pypi.org/project/resend/) -- Version 2.26.0
- [python-dotenv on PyPI](https://pypi.org/project/python-dotenv/) -- Version 1.2.2
- [uvicorn on PyPI](https://pypi.org/project/uvicorn/) -- Version 0.42.0
- [slowapi on PyPI](https://pypi.org/project/slowapi/) -- Version 0.1.9
- [Retell AI Community: Phone Number Deprecation](https://community.retellai.com/t/clarification-on-phone-number-agent-field-deprecation/1917) -- Migration details
