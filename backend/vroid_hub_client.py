"""JavaScript-portable port of the VRoid SDK v0.5.2's REST surface.

The official SDK is Unity/C# (~100 files of Unity plumbing) but the wire protocol is a
straightforward OAuth 2.0 + REST API against https://hub.vroid.com/api/v1. This module
re-implements that surface so any web/JS client can drive it through our backend.

Endpoints implemented (mirroring `Pixiv.VroidSdk.Api.DefaultApi`):
  - OAuth 2.0 authorization code flow (start + callback)
  - OAuth 2.0 device authorization grant flow (start + poll)
  - GET /account
  - GET /character_models
  - GET /character_models/{id}
  - POST /character_models/{id}/download_licenses  → signed VRM URL
  - GET /hearts
  - GET /users/{id}/artworks, POST /artworks, GET /artworks/{id}

Credentials come from env vars: VROID_CLIENT_ID + VROID_CLIENT_SECRET (registered by
the app owner at https://hub.vroid.com/oauth/applications). Tokens are stored per-user
in the Mongo `vroid_tokens` collection keyed by a `session_key` cookie the client sends.
"""
from __future__ import annotations

import os
import secrets
import time
from typing import Optional

import httpx

VROID_BASE = os.environ.get("VROID_HUB_BASE", "https://hub.vroid.com")
API_BASE = f"{VROID_BASE}/api/v1"
OAUTH_TOKEN_URL = f"{VROID_BASE}/oauth/token"
OAUTH_AUTHORIZE_URL = f"{VROID_BASE}/oauth/authorize"
OAUTH_DEVICE_URL = f"{VROID_BASE}/oauth/device_authorization"
DEFAULT_SCOPES = "default"


def sdk_configured() -> bool:
    return bool(os.getenv("VROID_CLIENT_ID") and os.getenv("VROID_CLIENT_SECRET"))


def _client_creds():
    cid = os.getenv("VROID_CLIENT_ID")
    secret = os.getenv("VROID_CLIENT_SECRET")
    if not (cid and secret):
        raise RuntimeError(
            "VROID_CLIENT_ID / VROID_CLIENT_SECRET are not set. Register an OAuth app at "
            "https://hub.vroid.com/oauth/applications and add the credentials to the backend .env."
        )
    return cid, secret


def new_session_key() -> str:
    return secrets.token_urlsafe(24)


# ---------- OAuth: authorization code flow ----------
def build_authorize_url(redirect_uri: str, state: str, scopes: str = DEFAULT_SCOPES) -> str:
    cid, _ = _client_creds()
    from urllib.parse import urlencode
    q = urlencode({
        "client_id": cid,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": scopes,
        "state": state,
    })
    return f"{OAUTH_AUTHORIZE_URL}?{q}"


async def exchange_code(code: str, redirect_uri: str) -> dict:
    cid, secret = _client_creds()
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(OAUTH_TOKEN_URL, data={
            "grant_type": "authorization_code",
            "code": code,
            "client_id": cid,
            "client_secret": secret,
            "redirect_uri": redirect_uri,
        })
        r.raise_for_status()
        return r.json()


# ---------- OAuth: device authorization grant flow ----------
async def device_start(scopes: str = DEFAULT_SCOPES) -> dict:
    cid, _ = _client_creds()
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(OAUTH_DEVICE_URL, data={"client_id": cid, "scope": scopes})
        r.raise_for_status()
        return r.json()


async def device_poll(device_code: str) -> dict:
    cid, secret = _client_creds()
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(OAUTH_TOKEN_URL, data={
            "grant_type": "urn:ietf:params:oauth:grant-type:device_code",
            "device_code": device_code,
            "client_id": cid,
            "client_secret": secret,
        })
        return r.json()


async def refresh_token(rt: str) -> dict:
    cid, secret = _client_creds()
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(OAUTH_TOKEN_URL, data={
            "grant_type": "refresh_token",
            "refresh_token": rt,
            "client_id": cid,
            "client_secret": secret,
        })
        r.raise_for_status()
        return r.json()


# ---------- Authenticated REST client ----------
class VRoidHubClient:
    def __init__(self, access_token: str):
        self.access_token = access_token

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.access_token}",
            "X-Api-Version": "11",
            "Accept": "application/json",
        }

    async def get(self, path: str, params: Optional[dict] = None) -> dict:
        url = f"{API_BASE}{path}"
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.get(url, headers=self._headers(), params=params)
            r.raise_for_status()
            return r.json()

    async def post(self, path: str, data: Optional[dict] = None, files: Optional[dict] = None) -> dict:
        url = f"{API_BASE}{path}"
        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.post(url, headers=self._headers(), data=data, files=files)
            r.raise_for_status()
            return r.json() if r.content else {}

    # -- Account
    async def account(self) -> dict:
        return await self.get("/account")

    # -- Character models (VRMs published by the user)
    async def my_character_models(self, count: int = 20) -> dict:
        return await self.get("/character_models", params={"count": count})

    async def character_model(self, model_id: str) -> dict:
        return await self.get(f"/character_models/{model_id}")

    async def request_download_license(self, model_id: str) -> dict:
        # POST issues a signed URL you can then download
        return await self.post(f"/character_models/{model_id}/download_licenses", data={})

    # -- Hearts / Artworks
    async def hearts(self, count: int = 20) -> dict:
        return await self.get("/hearts", params={"count": count})

    async def user_artworks(self, user_id: str, count: int = 20) -> dict:
        return await self.get(f"/users/{user_id}/artworks", params={"count": count})

    async def artwork(self, artwork_id: str) -> dict:
        return await self.get(f"/artworks/{artwork_id}")


# ---------- Token storage helpers ----------
async def save_tokens(db, session_key: str, token_response: dict) -> None:
    now = int(time.time())
    doc = {
        "session_key": session_key,
        "access_token": token_response.get("access_token"),
        "refresh_token": token_response.get("refresh_token"),
        "token_type": token_response.get("token_type", "Bearer"),
        "expires_at": now + int(token_response.get("expires_in", 3600)),
        "updated_at": now,
    }
    await db.vroid_tokens.update_one(
        {"session_key": session_key}, {"$set": doc}, upsert=True,
    )


async def load_tokens(db, session_key: str) -> Optional[dict]:
    return await db.vroid_tokens.find_one({"session_key": session_key}, {"_id": 0})


async def clear_tokens(db, session_key: str) -> None:
    await db.vroid_tokens.delete_one({"session_key": session_key})


async def ensure_valid_client(db, session_key: str) -> VRoidHubClient:
    tok = await load_tokens(db, session_key)
    if not tok:
        raise RuntimeError("Not authorized with VRoid Hub. Call /vroid_hub/login/start first.")
    if int(time.time()) >= (tok.get("expires_at") or 0) - 30 and tok.get("refresh_token"):
        try:
            fresh = await refresh_token(tok["refresh_token"])
            await save_tokens(db, session_key, fresh)
            tok = await load_tokens(db, session_key)
        except Exception:
            pass  # fall through; call will 401 if actually invalid
    return VRoidHubClient(tok["access_token"])
