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

# slowapi reads `.env` from the cwd at import time via starlette.Config.
# The repo-root .env contains UTF-8 box-drawing characters that Windows'
# default cp1252 codec can't decode.  Temporarily switch cwd to the tests
# directory (no .env there) before the app module is loaded, then restore.
_orig_cwd = os.getcwd()
os.chdir(os.path.dirname(__file__))


@pytest.fixture(scope="session")
def auth_token():
    """The dashboard auth token (from env or test default)."""
    return os.environ.get("DASHBOARD_SECRET_KEY", "test-secret-key")


@pytest.fixture(scope="session")
def app():
    """FastAPI app instance."""
    from main import app as fastapi_app
    # Restore original cwd now that the app module has been imported
    os.chdir(_orig_cwd)
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
