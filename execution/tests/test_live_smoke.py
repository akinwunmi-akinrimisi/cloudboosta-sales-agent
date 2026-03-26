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
