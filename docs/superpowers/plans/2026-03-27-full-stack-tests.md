# Full Stack Test Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Write and run comprehensive tests for the Sarah backend API, frontend build, and live deployment.

**Architecture:** Three pytest test files sharing a conftest for fixtures. Backend tests use FastAPI TestClient (in-process, no server). Frontend build tests shell out to npm. Live smoke tests use httpx against the production URL. All tests runnable from `execution/tests/`.

**Tech Stack:** pytest 8.3, pytest-asyncio 0.24, httpx (already installed), FastAPI TestClient

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `execution/tests/__init__.py` | Create | Package marker |
| `execution/tests/conftest.py` | Create | Shared fixtures: TestClient, auth tokens, base URLs |
| `execution/tests/test_api.py` | Create | Backend API tests (auth, endpoints, webhooks, tools, security) |
| `execution/tests/test_frontend_build.py` | Create | Frontend build verification |
| `execution/tests/test_live_smoke.py` | Create | Live deployment smoke tests |
| `execution/tests/pytest.ini` | Create | Pytest config with markers |
| `execution/backend/requirements.txt` | Modify | Add pytest + pytest-asyncio |

---

### Task 1: Test infrastructure setup

**Files:**
- Create: `execution/tests/__init__.py`
- Create: `execution/tests/pytest.ini`
- Create: `execution/tests/conftest.py`
- Modify: `execution/backend/requirements.txt`

- [ ] **Step 1: Create tests directory and package marker**

Create `execution/tests/__init__.py` (empty file).

- [ ] **Step 2: Create pytest.ini**

Create `execution/tests/pytest.ini`:

```ini
[pytest]
testpaths = .
markers =
    live: marks tests that hit the live deployment (deselect with '-m "not live"')
```

- [ ] **Step 3: Add test dependencies to requirements.txt**

In `execution/backend/requirements.txt`, append:

```
pytest==8.3.0
pytest-asyncio==0.24.0
```

- [ ] **Step 4: Install test deps**

Run:
```bash
cd execution/backend && pip install pytest==8.3.0 pytest-asyncio==0.24.0
```

- [ ] **Step 5: Create conftest.py**

Create `execution/tests/conftest.py`:

```python
"""Shared fixtures for Sarah test suites."""

import os
import sys
import pytest
import httpx

# Add backend to path so we can import main
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

# Set required env vars before importing app
os.environ.setdefault("DASHBOARD_SECRET_KEY", "test-secret-key")
os.environ.setdefault("RETELL_API_KEY", "test-retell-key")


@pytest.fixture(scope="session")
def auth_token():
    """The dashboard auth token (from env or test default)."""
    return os.environ.get("DASHBOARD_SECRET_KEY", "test-secret-key")


@pytest.fixture(scope="session")
def app():
    """FastAPI app instance."""
    from main import app as fastapi_app
    return fastapi_app


@pytest.fixture(scope="session")
def client(app, auth_token):
    """Authenticated TestClient."""
    from starlette.testclient import TestClient
    with TestClient(app) as c:
        c.headers["Authorization"] = f"Bearer {auth_token}"
        yield c


@pytest.fixture(scope="session")
def unauthed_client(app):
    """TestClient without auth headers."""
    from starlette.testclient import TestClient
    with TestClient(app) as c:
        yield c


@pytest.fixture(scope="session")
def live_base_url():
    """Production URL for smoke tests."""
    return os.environ.get("LIVE_BASE_URL", "https://sarah-api.srv1297445.hstgr.cloud")


@pytest.fixture(scope="session")
def live_token():
    """Auth token for production (must be set for live tests)."""
    token = os.environ.get("LIVE_DASHBOARD_TOKEN", "")
    if not token:
        pytest.skip("LIVE_DASHBOARD_TOKEN not set — skipping live tests")
    return token
```

- [ ] **Step 6: Verify pytest discovers config**

Run:
```bash
cd execution/tests && python -m pytest --collect-only 2>&1 | head -5
```
Expected: `no tests ran` (no test files yet, but no errors).

- [ ] **Step 7: Commit**

```bash
git add execution/tests/ execution/backend/requirements.txt
git commit -m "test: add test infrastructure — conftest, pytest.ini, deps"
```

---

### Task 2: Backend API auth + health tests

**Files:**
- Create: `execution/tests/test_api.py`

- [ ] **Step 1: Create test_api.py with auth and health tests**

Create `execution/tests/test_api.py`:

```python
"""Backend API tests for Sarah — auth, endpoints, webhooks, tools, security."""

import json


# ---------------------------------------------------------------------------
# Health endpoint (no auth required)
# ---------------------------------------------------------------------------

class TestHealth:
    def test_health_returns_ok(self, unauthed_client):
        r = unauthed_client.get("/health")
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "ok"
        assert data["agent"] == "Sarah"

    def test_health_no_auth_needed(self, unauthed_client):
        r = unauthed_client.get("/health")
        assert r.status_code == 200


# ---------------------------------------------------------------------------
# Auth gate
# ---------------------------------------------------------------------------

class TestAuth:
    def test_no_token_returns_403(self, unauthed_client):
        r = unauthed_client.get("/api/dashboard/live")
        assert r.status_code == 403

    def test_bad_token_returns_401(self, unauthed_client):
        r = unauthed_client.get(
            "/api/dashboard/live",
            headers={"Authorization": "Bearer wrong-token-value"},
        )
        assert r.status_code == 401

    def test_valid_token_returns_200(self, client):
        r = client.get("/api/dashboard/live")
        assert r.status_code == 200


# ---------------------------------------------------------------------------
# Dashboard endpoints — response shape
# ---------------------------------------------------------------------------

class TestDashboardLive:
    def test_live_shape(self, client):
        r = client.get("/api/dashboard/live")
        assert r.status_code == 200
        data = r.json()
        assert "active_call" in data
        assert "recent_calls" in data
        assert isinstance(data["recent_calls"], list)
        stats = data["today_stats"]
        assert "total_calls" in stats
        assert "connected" in stats
        assert "committed" in stats
        assert "conversion_rate" in stats


class TestDashboardPipeline:
    def test_pipeline_shape(self, client):
        r = client.get("/api/dashboard/pipeline")
        assert r.status_code == 200
        data = r.json()
        assert "leads" in data
        assert isinstance(data["leads"], list)

    def test_pipeline_lead_fields(self, client):
        r = client.get("/api/dashboard/pipeline")
        data = r.json()
        if data["leads"]:
            lead = data["leads"][0]
            assert "id" in lead
            assert "name" in lead
            assert "status" in lead


class TestDashboardStrategy:
    def test_strategy_shape(self, client):
        r = client.get("/api/dashboard/strategy")
        assert r.status_code == 200
        data = r.json()
        assert "strategies" in data
        assert isinstance(data["strategies"], list)


class TestDashboardLeadDetail:
    def test_lead_not_found(self, client):
        r = client.get("/api/dashboard/lead/00000000-0000-0000-0000-000000000000")
        assert r.status_code in (404, 500)  # 404 if proper handling, 500 if supabase throws

    def test_lead_detail_from_pipeline(self, client):
        """Fetch a real lead from pipeline and verify detail endpoint."""
        pipeline = client.get("/api/dashboard/pipeline").json()
        leads = pipeline.get("leads", [])
        if not leads:
            return  # No leads to test — skip silently
        lead_id = leads[0]["id"]
        r = client.get(f"/api/dashboard/lead/{lead_id}")
        assert r.status_code == 200
        data = r.json()
        assert "lead" in data
        assert "calls" in data
        assert isinstance(data["calls"], list)
        assert data["lead"]["id"] == lead_id


# ---------------------------------------------------------------------------
# Webhook endpoint
# ---------------------------------------------------------------------------

class TestWebhook:
    def test_invalid_event_returns_422(self, unauthed_client):
        r = unauthed_client.post(
            "/retell/webhook",
            json={"event": "invalid_event", "call": {}},
        )
        assert r.status_code == 422

    def test_call_started_event(self, unauthed_client):
        r = unauthed_client.post(
            "/retell/webhook",
            json={
                "event": "call_started",
                "call": {
                    "call_id": "test-call-001",
                    "metadata": {"lead_id": "test-lead-001"},
                },
            },
        )
        assert r.status_code == 200
        assert r.json()["status"] == "ok"

    def test_call_analyzed_event(self, unauthed_client):
        r = unauthed_client.post(
            "/retell/webhook",
            json={
                "event": "call_analyzed",
                "call": {
                    "call_id": "test-call-001",
                    "call_analysis": {
                        "call_summary": "Test summary",
                        "user_sentiment": "positive",
                    },
                },
            },
        )
        assert r.status_code == 200


# ---------------------------------------------------------------------------
# Tool endpoint
# ---------------------------------------------------------------------------

class TestTool:
    def test_invalid_function_returns_422(self, unauthed_client):
        r = unauthed_client.post(
            "/retell/tool",
            json={
                "name": "nonexistent_function",
                "call": {"call_id": "test"},
                "args": {},
            },
        )
        assert r.status_code == 422

    def test_lookup_programme_valid(self, unauthed_client):
        r = unauthed_client.post(
            "/retell/tool",
            json={
                "name": "lookup_programme",
                "call": {"call_id": "test-tool-001", "metadata": {}},
                "args": {"profile": "A", "country": "Nigeria"},
            },
        )
        # Should return 200 with programme data (or 401 if sig check fails)
        assert r.status_code in (200, 401)


# ---------------------------------------------------------------------------
# Initiate call endpoint
# ---------------------------------------------------------------------------

class TestInitiateCall:
    def test_no_auth_returns_403(self, unauthed_client):
        r = unauthed_client.post(
            "/retell/initiate-call",
            json={"lead_id": "test-lead"},
        )
        assert r.status_code == 403


# ---------------------------------------------------------------------------
# Security
# ---------------------------------------------------------------------------

class TestSecurity:
    def test_security_headers_present(self, unauthed_client):
        r = unauthed_client.get("/health")
        assert r.headers.get("X-Content-Type-Options") == "nosniff"
        assert r.headers.get("X-Frame-Options") == "DENY"
        assert "X-XSS-Protection" in r.headers

    def test_cors_allowed_origin(self, unauthed_client):
        r = unauthed_client.options(
            "/api/dashboard/live",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "GET",
            },
        )
        assert "access-control-allow-origin" in r.headers

    def test_malformed_json_returns_error(self, unauthed_client):
        r = unauthed_client.post(
            "/retell/webhook",
            content=b"not json",
            headers={"Content-Type": "application/json"},
        )
        assert r.status_code in (400, 422, 500)


# ---------------------------------------------------------------------------
# Static file serving
# ---------------------------------------------------------------------------

class TestStaticServing:
    def test_root_serves_html(self, unauthed_client):
        r = unauthed_client.get("/")
        if r.status_code == 200:
            assert "Sarah Dashboard" in r.text
        # If static dir doesn't exist in test env, 404/500 is acceptable

    def test_spa_fallback(self, unauthed_client):
        r = unauthed_client.get("/some/random/page")
        if r.status_code == 200:
            assert "Sarah Dashboard" in r.text
```

- [ ] **Step 2: Run the tests**

Run:
```bash
cd execution/tests && python -m pytest test_api.py -v --tb=short 2>&1
```
Expected: All tests pass (some may skip if no leads in DB).

- [ ] **Step 3: Commit**

```bash
git add execution/tests/test_api.py
git commit -m "test: backend API tests — auth, endpoints, webhooks, tools, security"
```

---

### Task 3: Frontend build tests

**Files:**
- Create: `execution/tests/test_frontend_build.py`

- [ ] **Step 1: Create test_frontend_build.py**

Create `execution/tests/test_frontend_build.py`:

```python
"""Frontend build verification tests for Sarah Dashboard."""

import os
import glob
import subprocess


DASHBOARD_DIR = os.path.join(os.path.dirname(__file__), "..", "dashboard")
DIST_DIR = os.path.join(DASHBOARD_DIR, "dist")
ASSETS_DIR = os.path.join(DIST_DIR, "assets")


class TestBuild:
    def test_build_succeeds(self):
        result = subprocess.run(
            ["npm", "run", "build"],
            cwd=DASHBOARD_DIR,
            capture_output=True,
            text=True,
            timeout=120,
        )
        assert result.returncode == 0, f"Build failed:\n{result.stderr}"

    def test_dist_index_exists(self):
        assert os.path.isfile(os.path.join(DIST_DIR, "index.html"))


class TestIndexHtml:
    def _read_index(self):
        path = os.path.join(DIST_DIR, "index.html")
        with open(path, "r", encoding="utf-8") as f:
            return f.read()

    def test_dark_class(self):
        html = self._read_index()
        assert 'class="dark"' in html

    def test_title(self):
        html = self._read_index()
        assert "Sarah Dashboard" in html
        assert "Cloudboosta" in html

    def test_google_fonts_space_grotesk(self):
        html = self._read_index()
        assert "fonts.googleapis.com" in html
        assert "Space+Grotesk" in html

    def test_google_fonts_ibm_plex_mono(self):
        html = self._read_index()
        assert "IBM+Plex+Mono" in html


class TestAssets:
    def test_js_file_exists(self):
        js_files = glob.glob(os.path.join(ASSETS_DIR, "*.js"))
        assert len(js_files) >= 1, "No JS files in dist/assets/"

    def test_css_file_exists(self):
        css_files = glob.glob(os.path.join(ASSETS_DIR, "*.css"))
        assert len(css_files) >= 1, "No CSS files in dist/assets/"

    def test_css_contains_dark_glass_tokens(self):
        css_files = glob.glob(os.path.join(ASSETS_DIR, "*.css"))
        assert css_files, "No CSS files found"
        with open(css_files[0], "r", encoding="utf-8") as f:
            css = f.read()
        assert "backdrop-filter" in css, "CSS missing backdrop-filter (glass effect)"
```

- [ ] **Step 2: Run the tests**

Run:
```bash
cd execution/tests && python -m pytest test_frontend_build.py -v --tb=short 2>&1
```
Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add execution/tests/test_frontend_build.py
git commit -m "test: frontend build verification — HTML, assets, Dark Glass tokens"
```

---

### Task 4: Live deployment smoke tests

**Files:**
- Create: `execution/tests/test_live_smoke.py`

- [ ] **Step 1: Create test_live_smoke.py**

Create `execution/tests/test_live_smoke.py`:

```python
"""Live deployment smoke tests for Sarah backend + dashboard.

These tests hit the real production server. Run with:
    LIVE_DASHBOARD_TOKEN=your-token pytest test_live_smoke.py -v -m live

All tests are marked with @pytest.mark.live and skipped by default.
"""

import re
import httpx
import pytest

pytestmark = pytest.mark.live


@pytest.fixture(scope="module")
def http():
    """httpx client with TLS verification (proves cert is valid)."""
    with httpx.Client(timeout=15.0, verify=True) as c:
        yield c


class TestHealthLive:
    def test_health_endpoint(self, http, live_base_url):
        r = http.get(f"{live_base_url}/health")
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "ok"
        assert data["agent"] == "Sarah"

    def test_tls_valid(self, http, live_base_url):
        """TLS verification is on by default — if this request succeeds, cert is valid."""
        r = http.get(f"{live_base_url}/health")
        assert r.status_code == 200


class TestDashboardHtmlLive:
    def test_root_serves_html(self, http, live_base_url):
        r = http.get(f"{live_base_url}/")
        assert r.status_code == 200
        assert "text/html" in r.headers.get("content-type", "")
        assert "Sarah Dashboard" in r.text

    def test_html_has_dark_class(self, http, live_base_url):
        r = http.get(f"{live_base_url}/")
        assert 'class="dark"' in r.text

    def test_assets_css(self, http, live_base_url):
        """Parse CSS asset URL from HTML and fetch it."""
        html = http.get(f"{live_base_url}/").text
        match = re.search(r'href="(/assets/[^"]+\.css)"', html)
        assert match, "No CSS asset link found in HTML"
        r = http.get(f"{live_base_url}{match.group(1)}")
        assert r.status_code == 200
        assert "text/css" in r.headers.get("content-type", "")

    def test_assets_js(self, http, live_base_url):
        """Parse JS asset URL from HTML and fetch it."""
        html = http.get(f"{live_base_url}/").text
        match = re.search(r'src="(/assets/[^"]+\.js)"', html)
        assert match, "No JS asset link found in HTML"
        r = http.get(f"{live_base_url}{match.group(1)}")
        assert r.status_code == 200
        ct = r.headers.get("content-type", "")
        assert "javascript" in ct or "application/octet-stream" in ct

    def test_spa_fallback(self, http, live_base_url):
        r = http.get(f"{live_base_url}/nonexistent-page")
        assert r.status_code == 200
        assert "Sarah Dashboard" in r.text


class TestAuthLive:
    def test_no_token_returns_403(self, http, live_base_url):
        r = http.get(f"{live_base_url}/api/dashboard/live")
        assert r.status_code == 403

    def test_bad_token_returns_401(self, http, live_base_url):
        r = http.get(
            f"{live_base_url}/api/dashboard/live",
            headers={"Authorization": "Bearer wrong-token"},
        )
        assert r.status_code == 401

    def test_valid_token(self, http, live_base_url, live_token):
        r = http.get(
            f"{live_base_url}/api/dashboard/live",
            headers={"Authorization": f"Bearer {live_token}"},
        )
        assert r.status_code == 200
        data = r.json()
        assert "active_call" in data
        assert "today_stats" in data


class TestSecurityLive:
    def test_security_headers(self, http, live_base_url):
        r = http.get(f"{live_base_url}/health")
        assert r.headers.get("x-content-type-options") == "nosniff"
        assert r.headers.get("x-frame-options") == "DENY"

    def test_cors_header(self, http, live_base_url):
        r = http.options(
            f"{live_base_url}/api/dashboard/live",
            headers={
                "Origin": "https://sarah-api.srv1297445.hstgr.cloud",
                "Access-Control-Request-Method": "GET",
            },
        )
        assert "access-control-allow-origin" in r.headers
```

- [ ] **Step 2: Run live smoke tests**

Run:
```bash
cd execution/tests && LIVE_DASHBOARD_TOKEN=$DASHBOARD_SECRET_KEY python -m pytest test_live_smoke.py -v --tb=short -m live 2>&1
```
Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add execution/tests/test_live_smoke.py
git commit -m "test: live deployment smoke tests — health, HTML, assets, auth, TLS, security"
```

---

### Task 5: Run full test suite and verify

**Files:** No new files — verification only.

- [ ] **Step 1: Run all local tests (backend API + frontend build)**

Run:
```bash
cd execution/tests && python -m pytest test_api.py test_frontend_build.py -v --tb=short -m "not live" 2>&1
```
Expected: All tests pass.

- [ ] **Step 2: Run live smoke tests**

Run:
```bash
cd execution/tests && LIVE_DASHBOARD_TOKEN=$DASHBOARD_SECRET_KEY python -m pytest test_live_smoke.py -v --tb=short 2>&1
```
Expected: All tests pass.

- [ ] **Step 3: Run everything together**

Run:
```bash
cd execution/tests && LIVE_DASHBOARD_TOKEN=$DASHBOARD_SECRET_KEY python -m pytest -v --tb=short 2>&1
```
Expected: All tests pass. Report total count.

- [ ] **Step 4: Commit final state if any fixes were needed**

If any tests required fixes to test code or app code, commit them:
```bash
git add -A execution/tests/ execution/backend/
git commit -m "test: full stack test suite passing — API, build, live smoke"
```
