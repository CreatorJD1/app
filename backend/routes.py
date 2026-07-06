"""API routes for VRoid Companion Studio."""
from __future__ import annotations

import base64
import logging
import os
import re
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse, JSONResponse

from ai_service import generate_texture, generate_concept, generate_variant, generate_turnaround
from models import (
    Asset,
    Project,
    ProjectCreate,
    ProjectUpdate,
    TextureRequest,
    ConceptRequest,
    VariantRequest,
    TurnaroundRequest,
    now_iso,
)

logger = logging.getLogger(__name__)

STORAGE_DIR = Path(__file__).parent / "storage"
VRM_DIR = STORAGE_DIR / "vrm"
STORAGE_DIR.mkdir(exist_ok=True)
VRM_DIR.mkdir(exist_ok=True)

router = APIRouter(prefix="/api")

# Dependencies injected from server.py
_db = None


def init(db):
    global _db
    _db = db


def _image_to_data_url(img: dict) -> str:
    return f"data:{img['mime_type']};base64,{img['data_b64']}"


async def _save_asset(project_id: Optional[str], kind: str, subkind: Optional[str], prompt: str, img: dict) -> Asset:
    asset = Asset(
        project_id=project_id,
        kind=kind,
        subkind=subkind,
        prompt=prompt,
        mime_type=img["mime_type"],
        data_url=_image_to_data_url(img),
    )
    doc = asset.model_dump()
    await _db.assets.insert_one(doc)
    return asset


async def _get_asset(asset_id: str) -> Optional[Asset]:
    doc = await _db.assets.find_one({"id": asset_id}, {"_id": 0})
    return Asset(**doc) if doc else None


# -------------------- Health --------------------
@router.get("/")
async def root():
    return {"app": "VRoid Companion Studio", "status": "ok"}


# -------------------- Generation --------------------
@router.post("/generate/texture")
async def api_generate_texture(req: TextureRequest):
    try:
        result = await generate_texture(req.prompt, kind=req.kind)
    except Exception as e:
        logger.exception("generate_texture failed")
        raise HTTPException(status_code=502, detail=f"Generation failed: {e}")
    asset = await _save_asset(req.project_id, "texture", req.kind, result["prompt"], result["images"][0])
    return {"asset": asset.model_dump()}


@router.post("/generate/concept")
async def api_generate_concept(req: ConceptRequest):
    try:
        result = await generate_concept(req.prompt)
    except Exception as e:
        logger.exception("generate_concept failed")
        raise HTTPException(status_code=502, detail=f"Generation failed: {e}")
    asset = await _save_asset(req.project_id, "concept", None, result["prompt"], result["images"][0])
    return {"asset": asset.model_dump()}


def _extract_b64(data_url: str) -> str:
    if not data_url:
        return ""
    if "," in data_url:
        return data_url.split(",", 1)[1]
    return data_url


@router.post("/generate/variant")
async def api_generate_variant(req: VariantRequest):
    ref_b64 = None
    if req.reference_asset_id:
        ref = await _get_asset(req.reference_asset_id)
        if not ref:
            raise HTTPException(status_code=404, detail="reference_asset_id not found")
        ref_b64 = _extract_b64(ref.data_url)
    elif req.reference_data_url:
        ref_b64 = _extract_b64(req.reference_data_url)
    else:
        raise HTTPException(status_code=400, detail="reference_asset_id or reference_data_url required")
    try:
        result = await generate_variant(req.prompt, ref_b64)
    except Exception as e:
        logger.exception("generate_variant failed")
        raise HTTPException(status_code=502, detail=f"Generation failed: {e}")
    asset = await _save_asset(req.project_id, "variant", None, result["prompt"], result["images"][0])
    return {"asset": asset.model_dump()}


@router.post("/generate/turnaround")
async def api_generate_turnaround(req: TurnaroundRequest):
    ref_b64 = None
    if req.reference_asset_id:
        ref = await _get_asset(req.reference_asset_id)
        if ref:
            ref_b64 = _extract_b64(ref.data_url)
    elif req.reference_data_url:
        ref_b64 = _extract_b64(req.reference_data_url)

    try:
        result = await generate_turnaround(req.character_desc, ref_image_b64=ref_b64)
    except Exception as e:
        logger.exception("generate_turnaround failed")
        raise HTTPException(status_code=502, detail=f"Generation failed: {e}")

    saved_panels = []
    for panel in result["panels"]:
        if "image" in panel:
            asset = await _save_asset(req.project_id, "turnaround", panel["label"], panel["prompt"], panel["image"])
            saved_panels.append({"label": panel["label"], "asset": asset.model_dump()})
        else:
            saved_panels.append({"label": panel["label"], "error": panel.get("error")})
    return {"character_desc": req.character_desc, "panels": saved_panels}


# -------------------- Assets --------------------
@router.get("/assets")
async def list_assets(project_id: Optional[str] = None, kind: Optional[str] = None, limit: int = 200):
    query = {}
    if project_id:
        query["project_id"] = project_id
    if kind:
        query["kind"] = kind
    cursor = _db.assets.find(query, {"_id": 0}).sort("created_at", -1).limit(limit)
    docs = await cursor.to_list(length=limit)
    return {"assets": docs}


@router.get("/assets/{asset_id}")
async def get_asset(asset_id: str):
    doc = await _db.assets.find_one({"id": asset_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Asset not found")
    return doc


@router.delete("/assets/{asset_id}")
async def delete_asset(asset_id: str):
    res = await _db.assets.delete_one({"id": asset_id})
    return {"deleted": res.deleted_count}


# -------------------- Projects --------------------
@router.get("/projects")
async def list_projects():
    cursor = _db.projects.find({}, {"_id": 0}).sort("updated_at", -1)
    docs = await cursor.to_list(length=500)
    return {"projects": docs}


@router.post("/projects")
async def create_project(req: ProjectCreate):
    project = Project(name=req.name, description=req.description)
    await _db.projects.insert_one(project.model_dump())
    return project.model_dump()


@router.get("/projects/{project_id}")
async def get_project(project_id: str):
    doc = await _db.projects.find_one({"id": project_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Project not found")
    return doc


@router.patch("/projects/{project_id}")
async def update_project(project_id: str, req: ProjectUpdate):
    updates = {k: v for k, v in req.model_dump(exclude_unset=True).items() if v is not None}
    updates["updated_at"] = now_iso()
    res = await _db.projects.update_one({"id": project_id}, {"$set": updates})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Project not found")
    doc = await _db.projects.find_one({"id": project_id}, {"_id": 0})
    return doc


@router.delete("/projects/{project_id}")
async def delete_project(project_id: str):
    proj = await _db.projects.find_one({"id": project_id}, {"_id": 0})
    if proj and proj.get("vrm_path"):
        try:
            Path(proj["vrm_path"]).unlink(missing_ok=True)
        except Exception:
            pass
    await _db.projects.delete_one({"id": project_id})
    await _db.assets.delete_many({"project_id": project_id})
    return {"deleted": True}


# -------------------- VRM upload / serve --------------------
_SAFE_NAME = re.compile(r"[^A-Za-z0-9._-]")


@router.post("/projects/{project_id}/vrm")
async def upload_vrm(project_id: str, file: UploadFile = File(...)):
    proj = await _db.projects.find_one({"id": project_id}, {"_id": 0})
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
    filename = file.filename or "model.vrm"
    if not filename.lower().endswith(".vrm"):
        raise HTTPException(status_code=400, detail="File must be a .vrm")
    safe = _SAFE_NAME.sub("_", filename)
    dest = VRM_DIR / f"{project_id}_{safe}"
    data = await file.read()
    dest.write_bytes(data)
    await _db.projects.update_one(
        {"id": project_id},
        {"$set": {
            "vrm_filename": safe,
            "vrm_path": str(dest),
            "vrm_size_bytes": len(data),
            "updated_at": now_iso(),
        }},
    )
    return {"ok": True, "vrm_filename": safe, "size": len(data)}


@router.get("/projects/{project_id}/vrm")
async def download_vrm(project_id: str):
    proj = await _db.projects.find_one({"id": project_id}, {"_id": 0})
    if not proj or not proj.get("vrm_path"):
        raise HTTPException(status_code=404, detail="No VRM for this project")
    path = proj["vrm_path"]
    if not Path(path).exists():
        raise HTTPException(status_code=404, detail="VRM file missing")
    return FileResponse(path, media_type="model/gltf-binary", filename=proj.get("vrm_filename") or "model.vrm")
