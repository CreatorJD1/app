"""VRoid Hub / remote VRM fetch endpoints.
Honest scope:
  - We cannot use the Unity SDK from a browser (it is C# for Unity).
  - We CAN download publicly-downloadable VRMs from a URL (VRoid Hub, GitHub, etc.).
  - Full OAuth to a user's private VRoid Hub library would require the user to
    register an OAuth app at https://hub.vroid.com/oauth/applications and supply
    client_id + client_secret. We expose a stub endpoint that documents this path.
"""
from __future__ import annotations

import logging
import re
import urllib.parse
from pathlib import Path

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

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
    "customer-assets.emergentagent.com",  # allow the platform's asset host too
)

_SAFE_NAME = re.compile(r"[^A-Za-z0-9._-]")


class ImportUrlRequest(BaseModel):
    project_id: str
    url: str


@router.post("/import_url")
async def import_from_url(req: ImportUrlRequest):
    """Download a publicly accessible .vrm URL directly into a project."""
    parsed = urllib.parse.urlparse(req.url)
    host = (parsed.hostname or "").lower()
    if host not in ALLOWED_HOSTS and not host.endswith(".vroid.com"):
        raise HTTPException(
            status_code=400,
            detail=(
                f"URL host not allowed. Allowed hosts: {', '.join(ALLOWED_HOSTS)} "
                "or any *.vroid.com. Paste a direct .vrm download URL."
            ),
        )

    proj = await _db.projects.find_one({"id": req.project_id}, {"_id": 0})
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")

    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=120) as client:
            r = await client.get(req.url)
            if r.status_code != 200:
                raise HTTPException(status_code=502, detail=f"Fetch failed: HTTP {r.status_code}")
            data = r.content
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Fetch failed: {e}")

    if len(data) < 1024:
        raise HTTPException(status_code=400, detail="Downloaded file is too small to be a VRM.")
    if not data.startswith(b"glTF"):
        raise HTTPException(status_code=400, detail="Downloaded file is not a glTF/VRM binary.")

    # Derive filename
    fname = Path(parsed.path).name or "model.vrm"
    if not fname.lower().endswith(".vrm"):
        fname = fname + ".vrm"
    safe = _SAFE_NAME.sub("_", fname)

    from routes import VRM_DIR  # reuse VRM storage dir
    from models import now_iso
    dest = VRM_DIR / f"{req.project_id}_{safe}"
    dest.write_bytes(data)

    await _db.projects.update_one(
        {"id": req.project_id},
        {"$set": {
            "vrm_filename": safe,
            "vrm_path": str(dest),
            "vrm_size_bytes": len(data),
            "updated_at": now_iso(),
        }},
    )
    return {"ok": True, "vrm_filename": safe, "size": len(data)}


@router.get("/help")
async def hub_help():
    return {
        "sdk_unity_only": (
            "The official VRoid SDK is a Unity C# package \u2014 it cannot run inside a browser. "
            "Web apps can still use VRoid Hub via its public REST API (with OAuth) or by "
            "downloading directly from public VRM URLs."
        ),
        "public_url_import": (
            "Paste any publicly-downloadable .vrm URL (VRoid Hub, GitHub Releases, IPFS, etc.). "
            "We proxy the download server-side and store it in your project."
        ),
        "oauth_setup_steps": [
            "1. Log in to VRoid Hub and register an OAuth application at https://hub.vroid.com/oauth/applications",
            "2. Set the redirect URL to the callback endpoint of this deployment (contact developer).",
            "3. Provide client_id + client_secret via env vars VROID_CLIENT_ID / VROID_CLIENT_SECRET.",
            "4. After the developer wires those, this endpoint will expose /oauth/start and /oauth/callback.",
        ],
        "allowed_hosts": list(ALLOWED_HOSTS),
    }
