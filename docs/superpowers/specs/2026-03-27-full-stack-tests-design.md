# Full Stack Test Suite — Design Spec

## Overview

Three test suites verifying the Sarah Dashboard + Backend deployment end-to-end: backend API tests (pytest), frontend build tests, and live deployment smoke tests. Goal: confirm every component works after the Dark Glass redesign and deployment.

## Suite 1: Backend API Tests

**File:** `execution/tests/test_api.py`
**Runner:** pytest + httpx TestClient
**Deps:** pytest, pytest-asyncio, httpx (already installed)

Tests use FastAPI's `TestClient` — no live server needed. Supabase calls are tested against the real DB (these are read-only dashboard queries, safe to run).

### Auth Tests
- `test_dashboard_live_no_token` — GET `/api/dashboard/live` without Authorization header returns 403
- `test_dashboard_live_bad_token` — GET with `Authorization: Bearer wrong` returns 401
- `test_dashboard_live_valid_token` — GET with valid DASHBOARD_SECRET_KEY returns 200

### Dashboard Endpoint Tests
- `test_dashboard_live_shape` — Response has keys: `active_call`, `recent_calls` (list), `today_stats` (dict with `total_calls`, `connected`, `committed`, `conversion_rate`)
- `test_dashboard_pipeline_shape` — Response has `leads` (list), each lead has `id`, `name`, `status`
- `test_dashboard_strategy_shape` — Response has `strategies` (list)
- `test_dashboard_lead_detail_not_found` — GET `/api/dashboard/lead/nonexistent-uuid` returns 404
- `test_dashboard_lead_detail_valid` — If any lead exists in pipeline, fetch its detail and verify `lead` + `calls` keys

### Webhook Tests
- `test_webhook_invalid_event` — POST `/retell/webhook` with `{"event": "invalid"}` returns 422
- `test_webhook_valid_events` — POST with `call_started`, `call_ended`, `call_analyzed` events return 200 (using mock call data, signature verification skipped in test)

### Tool Endpoint Tests
- `test_tool_invalid_function` — POST `/retell/tool` with unknown function name returns 422
- `test_tool_lookup_programme` — POST with `lookup_programme` and valid args returns result

### Static File Serving Tests
- `test_root_serves_html` — GET `/` returns 200 with `text/html` content type containing `Sarah Dashboard`
- `test_assets_serve` — GET `/assets/index-*.css` returns 200 with CSS content type
- `test_spa_fallback` — GET `/some/random/path` returns 200 with HTML (SPA catch-all)

### Security Tests
- `test_security_headers` — Response includes `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection`
- `test_cors_headers` — Request with `Origin: http://localhost:5173` gets `Access-Control-Allow-Origin` header
- `test_health_no_auth` — GET `/health` returns 200 without any auth (public endpoint)

### Edge Case Tests
- `test_malformed_json_webhook` — POST `/retell/webhook` with invalid JSON returns 422
- `test_initiate_call_no_auth` — POST `/retell/initiate-call` without token returns 403

## Suite 2: Frontend Build Tests

**File:** `execution/tests/test_frontend_build.py`
**Runner:** pytest (uses subprocess to run npm build, then inspects output files)

- `test_build_succeeds` — `npm run build` exits with code 0
- `test_index_html_exists` — `dist/index.html` exists
- `test_index_html_dark_class` — HTML contains `class="dark"`
- `test_index_html_title` — HTML contains `<title>Sarah Dashboard — Cloudboosta</title>`
- `test_index_html_google_fonts` — HTML contains `fonts.googleapis.com` and `Space+Grotesk` and `IBM+Plex+Mono`
- `test_assets_js_exists` — `dist/assets/` contains exactly 1 `.js` file
- `test_assets_css_exists` — `dist/assets/` contains exactly 1 `.css` file
- `test_css_contains_glass` — CSS file contains Dark Glass tokens (backdrop-filter, zinc color references)

## Suite 3: Live Deployment Smoke Tests

**File:** `execution/tests/test_live_smoke.py`
**Runner:** pytest + httpx (real HTTP requests to production URL)
**Target:** `https://sarah-api.srv1297445.hstgr.cloud`

These tests hit the actual deployed server. They're marked with `@pytest.mark.live` so they can be run separately.

- `test_health` — GET `/health` returns `{"status":"ok","agent":"Sarah"}`
- `test_dashboard_html` — GET `/` returns HTML with `Sarah Dashboard` in body, content-type `text/html`
- `test_assets_css` — GET first CSS asset URL (parsed from HTML) returns 200 with `text/css`
- `test_assets_js` — GET first JS asset URL (parsed from HTML) returns 200 with `application/javascript`
- `test_auth_required` — GET `/api/dashboard/live` without token returns 403
- `test_auth_valid` — GET `/api/dashboard/live` with valid token returns 200 with correct shape
- `test_security_headers_live` — Response includes security headers
- `test_tls_valid` — HTTPS connection succeeds without certificate errors (httpx default behavior — fails on bad certs)
- `test_spa_fallback_live` — GET `/nonexistent-page` returns 200 with HTML (not 404)
- `test_cors_live` — Request with Origin header gets CORS response

## Test Configuration

**`execution/tests/conftest.py`:**
- Fixture `client` — FastAPI TestClient with valid auth token
- Fixture `unauthed_client` — TestClient without auth
- Fixture `base_url` — Production URL from env or default
- Fixture `auth_token` — DASHBOARD_SECRET_KEY from env

**`execution/tests/pytest.ini` (or section in pyproject.toml):**
- Markers: `live` for deployment smoke tests
- Default: run all except `live` (use `-m live` to include)

## Dependencies

Add to `execution/backend/requirements.txt`:
- `pytest==8.3.0`
- `pytest-asyncio==0.24.0`

No new frontend dependencies needed.

## Running

```bash
# All local tests (backend API + frontend build)
cd execution && pytest tests/ -v -m "not live"

# Live deployment smoke tests only
cd execution && pytest tests/ -v -m live

# Everything
cd execution && pytest tests/ -v
```

## Out of Scope

- Component-level React testing (would need vitest/jsdom setup — not worth it for 12 presentational components)
- Load testing
- Visual regression testing
- Auto-dialer integration tests (blocked by KYC)
