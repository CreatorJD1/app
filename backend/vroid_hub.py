"""VRoid Hub / VRoid SDK REST bridge routes.

Mirrors the surface of the Unity SDK (v0.5.2) so a browser can drive the same
workflows. See vroid_hub_client.py for the porting notes.

Exposed routes:
  GET  /api/vroid_hub/help              status + setup instructions
  GET  /api/vroid_hub/status            configured? authorized?
  POST /api/vroid_hub/import_url        proxy-download a public .vrm URL
  POST /api/vroid_hub/login/start       returns authorize URL (auth-code flow)
  GET  /api/vroid_hub/login/callback    OAuth 2.0 callback (auth-code flow)
  POST /api/vroid_hub/login/device      start device flow (returns user_code + verification_uri)
  POST /api/vroid_hub/login/device/poll poll for device authorization
  POST /api/vroid_hub/logout            drop token
  GET  /api/vroid_hub/account           GET /account
  GET  /api/vroid_hub/character_models  list current user's models
  GET  /api/vroid_hub/character_models/{id}
  POST /api/vroid_hub/character_models/{id}/import  download & attach to a project
"""
from __future__ import annotations

import logging
import re
import secrets
import urllib.parse
from pathlib import Path
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

from vroid_hub_client import (
    ensure_valid_client,
    build_authorize_url,
    exchange_code,
    device_start,
    device_poll,
    save_tokens,
    clear_tokens,
    new_session_key,
    sdk_configured,
    load_tokens,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/vroid_hub")
_db = None


def init(db):
    global _db
    _db = db


ALLOWED_HOSTS = (
    "hub.vroid.com",
    "assets.vroid.com",
    "cdn.vroid.com",
    "vroid-hub.imgix.net",
    "customer-assets.emergentagent.com",
)

_SAFE_NAME = re.compile(r"[^A-Za-z0-9._-]")


# ---------- meta ----------
@router.get("/help")
async def hub_help():
    return {
        "sdk_unity_only": (
            "The official VRoid SDK ships as a Unity C# package. This backend ports the SDK's"
            " REST surface (OAuth + VRoid Hub API) so any browser client can drive the same flows."
        ),
        "public_url_import": (
            "Paste any publicly-downloadable .vrm URL. We proxy the download server-side."
        ),
        "oauth_setup_steps": [
            "1. Log in to VRoid Hub and register an OAuth application at https://hub.vroid.com/oauth/applications",
            "2. Set the redirect URL to <this backend>/api/vroid_hub/login/callback",
            "3. Set env vars VROID_CLIENT_ID + VROID_CLIENT_SECRET on the backend and restart.",
            "4. Then /vroid_hub/status will return configured=true and login endpoints will work.",
        ],
        "allowed_hosts": list(ALLOWED_HOSTS),
    }


@router.get("/status")
async def status(request: Request):
    session_key = request.cookies.get("vcs_hub_session")
    authorized = False
    if sdk_configured() and session_key:
        tok = await load_tokens(_db, session_key)
        authorized = bool(tok and tok.get("access_token"))
    return {"configured": sdk_configured(), "authorized": authorized}


# ---------- URL proxy import (works without OAuth) ----------
class ImportUrlRequest(BaseModel):
    project_id: str
    url: str


@router.post("/import_url")
async def import_from_url(req: ImportUrlRequest):
    parsed = urllib.parse.urlparse(req.url)
    host = (parsed.hostname or "").lower()
    if host not in ALLOWED_HOSTS and not host.endswith(".vroid.com"):
        raise HTTPException(status_code=400, detail=(
            f"URL host not allowed. Allowed: {', '.join(ALLOWED_HOSTS)} or any *.vroid.com."
        ))
    proj = await _db.projects.find_one({"id": req.project_id}, {"_id": 0})
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")

    async with httpx.AsyncClient(follow_redirects=True, timeout=120) as client:
        r = await client.get(req.url)
        if r.status_code != 200:
            raise HTTPException(status_code=502, detail=f"Fetch failed: HTTP {r.status_code}")
        data = r.content

    if len(data) < 1024 or not data.startswith(b"glTF"):
        raise HTTPException(status_code=400, detail="Downloaded file is not a valid VRM.")

    from routes import VRM_DIR
    from models import now_iso
    fname = Path(parsed.path).name or "model.vrm"
    if not fname.lower().endswith(".vrm"):
        fname += ".vrm"
    safe = _SAFE_NAME.sub("_", fname)
    dest = VRM_DIR / f"{req.project_id}_{safe}"
    dest.write_bytes(data)
    await _db.projects.update_one(
        {"id": req.project_id},
        {"$set": {"vrm_filename": safe, "vrm_path": str(dest), "vrm_size_bytes": len(data), "updated_at": now_iso()}},
    )
    return {"ok": True, "vrm_filename": safe, "size": len(data)}


# ---------- OAuth: auth-code flow ----------
class LoginStartRequest(BaseModel):
    redirect_uri: str


@router.post("/login/start")
async def login_start(req: LoginStartRequest, request: Request):
    if not sdk_configured():
        raise HTTPException(status_code=400, detail="VROID_CLIENT_ID/SECRET not configured on backend.")
    session_key = request.cookies.get("vcs_hub_session") or new_session_key()
    state = secrets.token_urlsafe(16)
    await _db.vroid_tokens.update_one(
        {"session_key": session_key},
        {"$set": {"pending_state": state, "redirect_uri": req.redirect_uri}},
        upsert=True,
    )
    url = build_authorize_url(req.redirect_uri, state)
    resp = {"authorize_url": url, "session_key": session_key}
    return resp


@router.get("/login/callback")
async def login_callback(code: str, state: str, request: Request):
    session_key = request.cookies.get("vcs_hub_session")
    if not session_key:
        # try find state
        rec = await _db.vroid_tokens.find_one({"pending_state": state}, {"_id": 0, "session_key": 1, "redirect_uri": 1})
        if not rec:
            raise HTTPException(status_code=400, detail="No matching session for state")
        session_key = rec["session_key"]
        redirect_uri = rec.get("redirect_uri", "")
    else:
        rec = await _db.vroid_tokens.find_one({"session_key": session_key}, {"_id": 0})
        if not rec or rec.get("pending_state") != state:
            raise HTTPException(status_code=400, detail="State mismatch")
        redirect_uri = rec.get("redirect_uri", "")
    tok = await exchange_code(code, redirect_uri)
    await save_tokens(_db, session_key, tok)
    return {"ok": True, "session_key": session_key}


# ---------- OAuth: device flow ----------
@router.post("/login/device")
async def login_device(request: Request):
    if not sdk_configured():
        raise HTTPException(status_code=400, detail="VROID_CLIENT_ID/SECRET not configured on backend.")
    session_key = request.cookies.get("vcs_hub_session") or new_session_key()
    info = await device_start()
    await _db.vroid_tokens.update_one(
        {"session_key": session_key},
        {"$set": {"device_code": info.get("device_code")}},
        upsert=True,
    )
    info["session_key"] = session_key
    return info


class DevicePollRequest(BaseModel):
    session_key: str


@router.post("/login/device/poll")
async def login_device_poll(req: DevicePollRequest):
    rec = await _db.vroid_tokens.find_one({"session_key": req.session_key}, {"_id": 0})
    if not rec or not rec.get("device_code"):
        raise HTTPException(status_code=400, detail="No pending device authorization")
    resp = await device_poll(rec["device_code"])
    if resp.get("access_token"):
        await save_tokens(_db, req.session_key, resp)
        return {"status": "authorized"}
    return {"status": "pending", "raw": resp}


@router.post("/logout")
async def logout(request: Request):
    session_key = request.cookies.get("vcs_hub_session")
    if session_key:
        await clear_tokens(_db, session_key)
    return {"ok": True}


# ---------- REST wrapper (mirrors SDK's DefaultApi) ----------
def _session_key(request: Request) -> str:
    key = request.cookies.get("vcs_hub_session")
    if not key:
        raise HTTPException(status_code=401, detail="Missing vcs_hub_session cookie")
    return key


@router.get("/account")
async def account(request: Request):
    client = await ensure_valid_client(_db, _session_key(request))
    return await client.account()


@router.get("/character_models")
async def list_models(request: Request, count: int = 20):
    client = await ensure_valid_client(_db, _session_key(request))
    return await client.my_character_models(count=count)


@router.get("/character_models/{model_id}")
async def get_model(model_id: str, request: Request):
    client = await ensure_valid_client(_db, _session_key(request))
    return await client.character_model(model_id)


class HubImportRequest(BaseModel):
    project_id: str


@router.post("/character_models/{model_id}/import")
async def import_model_to_project(model_id: str, req: HubImportRequest, request: Request):
    client = await ensure_valid_client(_db, _session_key(request))
    lic = await client.request_download_license(model_id)
    dl_url = (
        lic.get("character_model_download_license", {})
           .get("url") or lic.get("url")
    )
    if not dl_url:
        raise HTTPException(status_code=502, detail="No download URL returned by VRoid Hub")
    async with httpx.AsyncClient(follow_redirects=True, timeout=180) as httpc:
        r = await httpc.get(dl_url)
        if r.status_code != 200:
            raise HTTPException(status_code=502, detail=f"VRM download failed: {r.status_code}")
        data = r.content
    if not data.startswith(b"glTF"):
        raise HTTPException(status_code=400, detail="Downloaded VRM file is invalid")

    from routes import VRM_DIR
    from models import now_iso
    safe = _SAFE_NAME.sub("_", f"hub_{model_id}.vrm")
    dest = VRM_DIR / f"{req.project_id}_{safe}"
    dest.write_bytes(data)
    await _db.projects.update_one(
        {"id": req.project_id},
        {"$set": {"vrm_filename": safe, "vrm_path": str(dest), "vrm_size_bytes": len(data), "updated_at": now_iso()}},
    )
    return {"ok": True, "vrm_filename": safe, "size": len(data)}
