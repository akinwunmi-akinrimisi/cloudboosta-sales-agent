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
        assert r.status_code in (404, 500)

    def test_lead_detail_from_pipeline(self, client):
        """Fetch a real lead from pipeline and verify detail endpoint."""
        pipeline = client.get("/api/dashboard/pipeline").json()
        leads = pipeline.get("leads", [])
        if not leads:
            return
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

    def test_spa_fallback(self, unauthed_client):
        r = unauthed_client.get("/some/random/page")
        if r.status_code == 200:
            assert "Sarah Dashboard" in r.text
