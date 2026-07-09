"""Tests for the VCS_ACCESS_TOKEN gate in server.py.

The token env var is read at import time, so we set it (plus a dummy
MONGO_URL — motor builds its client lazily and never connects for these
routes) BEFORE importing the app. Every case below stays on /health, the
login page, and 401 paths, so no database is ever touched.
"""
import os

os.environ.setdefault("MONGO_URL", "mongodb://localhost:27017")
os.environ["VCS_ACCESS_TOKEN"] = "s3cret-test-token"

from fastapi.testclient import TestClient  # noqa: E402

import server  # noqa: E402

client = TestClient(server.app)


class TestAuthGate:
    def test_health_is_always_open(self):
        r = client.get("/health")
        assert r.status_code == 200 and r.json() == {"ok": True}

    def test_api_without_token_is_401_json(self):
        r = client.get("/api/projects")
        assert r.status_code == 401
        assert r.json() == {"detail": "access token required"}

    def test_browser_navigation_gets_login_page(self):
        r = client.get("/api/projects", headers={"Accept": "text/html"})
        assert r.status_code == 401
        assert "access token" in r.text.lower()
        assert "<form" in r.text

    def test_header_token_passes_the_gate(self):
        # 404 (no such route at API root wiring here) or 200 both mean the gate
        # opened; the point is it is not 401. Use /health-adjacent: pick a route
        # that exists but 404s on content: /api/projects/nope needs the db, so
        # instead prove the gate via the login-page path flipping to pass-through.
        r = client.get("/nonexistent", headers={"X-VCS-Token": "s3cret-test-token"})
        assert r.status_code == 404          # through the gate, into normal routing

    def test_wrong_token_still_401(self):
        r = client.get("/nonexistent", headers={"X-VCS-Token": "wrong"})
        assert r.status_code == 401

    def test_query_token_sets_the_cookie(self):
        r = client.get("/nonexistent?token=s3cret-test-token")
        assert r.status_code == 404          # authorized; route just doesn't exist
        cookie = r.headers.get("set-cookie", "")
        assert "vcs_token=s3cret-test-token" in cookie
        assert "Max-Age=2592000" in cookie   # 30 days
        assert "SameSite=lax" in cookie

    def test_cookie_then_carries_auth(self):
        c = TestClient(server.app)
        c.get("/nonexistent?token=s3cret-test-token")     # drops the cookie
        r = c.get("/nonexistent")                          # no token in URL/header
        assert r.status_code == 404                        # cookie carried it

    def test_options_preflight_skips_the_gate(self):
        r = client.options("/api/projects",
                           headers={"Origin": "https://example.com",
                                    "Access-Control-Request-Method": "GET"})
        assert r.status_code != 401


class TestGateOpenWhenBlank:
    def test_blank_token_means_no_gate(self):
        # Flip the module-level token off; the gate must become a no-op.
        old = server.ACCESS_TOKEN
        server.ACCESS_TOKEN = ""
        try:
            r = client.get("/nonexistent")
            assert r.status_code == 404      # straight through, no 401
        finally:
            server.ACCESS_TOKEN = old
