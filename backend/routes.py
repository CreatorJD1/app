"""API routes for VRoid Companion Studio."""
from __future__ import annotations

import logging
import os
import re
from pathlib import Path
from typing import List, Optional

import httpx
from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from pydantic import BaseModel

from ai_service import (
    generate_texture, generate_concept, generate_variant, generate_turnaround,
    generate_wardrobe, generate_accessories, analyze_character, extract_outfit,
    generate_material_texture,
)
from models import (
    Asset, Project, ProjectCreate, ProjectUpdate,
    TextureRequest, ConceptRequest, VariantRequest, TurnaroundRequest, OutfitRequest,
    now_iso,
)

logger = logging.getLogger(__name__)

STORAGE_DIR = Path(__file__).parent / "storage"
VRM_DIR = STORAGE_DIR / "vrm"
STORAGE_DIR.mkdir(exist_ok=True)
VRM_DIR.mkdir(exist_ok=True)

router = APIRouter(prefix="/api")
_db = None


def init(db):
    global _db
    _db = db


def _image_to_data_url(img: dict) -> str:
    return f"data:{img['mime_type']};base64,{img['data_b64']}"


async def _save_asset(project_id, kind, subkind, prompt, img) -> Asset:
    asset = Asset(
        project_id=project_id, kind=kind, subkind=subkind, prompt=prompt,
        mime_type=img["mime_type"], data_url=_image_to_data_url(img),
    )
    await _db.assets.insert_one(asset.model_dump())
    return asset


async def _get_asset(asset_id: str) -> Optional[Asset]:
    doc = await _db.assets.find_one({"id": asset_id}, {"_id": 0})
    return Asset(**doc) if doc else None


def _extract_b64(data_url: str) -> str:
    if not data_url:
        return ""
    if "," in data_url:
        return data_url.split(",", 1)[1]
    return data_url


@router.get("/")
async def root():
    return {"app": "VRoid Companion Studio", "status": "ok"}


# ---------- Generation ----------
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
        raise HTTPException(status_code=502, detail=f"Generation failed: {e}")
    asset = await _save_asset(req.project_id, "concept", None, result["prompt"], result["images"][0])
    return {"asset": asset.model_dump()}


@router.post("/generate/variant")
async def api_generate_variant(req: VariantRequest):
    refs = []
    if req.reference_asset_id:
        ref = await _get_asset(req.reference_asset_id)
        if not ref:
            raise HTTPException(status_code=404, detail="reference_asset_id not found")
        refs.append(_extract_b64(ref.data_url))
    for du in (req.reference_data_urls or []):
        b = _extract_b64(du)
        if b:
            refs.append(b)
    if not refs and req.reference_data_url:
        refs.append(_extract_b64(req.reference_data_url))
    refs = [b for b in refs if b]
    if not refs:
        raise HTTPException(status_code=400, detail="reference_asset_id, reference_data_url or reference_data_urls required")
    try:
        result = await generate_variant(req.prompt, refs)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Generation failed: {e}")
    asset = await _save_asset(req.project_id, "variant", None, result["prompt"], result["images"][0])
    return {"asset": asset.model_dump()}


class MaterialTextureRequest(BaseModel):
    uv_template_data_url: Optional[str] = None   # the material's UV/seam layout (wireframe)
    garment_data_url: Optional[str] = None        # the target garment/design reference
    original_atlas_data_url: Optional[str] = None # the material's ORIGINAL diffuse atlas (restyle init)
    region: str = "garment"                       # top | bottom | hair | shoes | ...
    description: str = ""
    palette: Optional[str] = None
    guard: bool = True
    provider: Optional[str] = None                # zerogpu | local | cloud | hybrid | auto
    strength: Optional[float] = None              # img2img denoise (restyle ~0.32, bold ~0.75)
    mode: str = "restyle"                         # restyle (subtle, low denoise) | bold (ControlNet UV-lock)
    project_id: Optional[str] = None


@router.post("/generate/material_texture")
async def api_generate_material_texture(req: MaterialTextureRequest):
    """Goal 2: paint a UV-fitted anime texture for one model material. Preferred
    path restyles the material's ORIGINAL atlas (UV-safe); falls back to the UV
    template + garment reference. Guarded against off-goal/deviant output."""
    uv = _extract_b64(req.uv_template_data_url) if req.uv_template_data_url else None
    garment = _extract_b64(req.garment_data_url) if req.garment_data_url else None
    atlas = _extract_b64(req.original_atlas_data_url) if req.original_atlas_data_url else None
    if not uv and not garment and not atlas:
        raise HTTPException(status_code=400, detail="original_atlas_data_url, uv_template_data_url or garment_data_url required")
    try:
        result = await generate_material_texture(
            uv, garment, region=req.region, description=req.description,
            palette=req.palette, guard=req.guard, provider=req.provider,
            original_atlas_b64=atlas, strength=req.strength, mode=req.mode,
        )
    except Exception as e:
        logger.exception("material_texture failed")
        raise HTTPException(status_code=502, detail=f"Generation failed: {e}")
    asset = await _save_asset(req.project_id, "texture", req.region, result["prompt"], result["images"][0])
    return {"asset": asset.model_dump(), "guard": result.get("guard"), "mode": result.get("mode")}


@router.post("/extract/outfit")
async def api_extract_outfit(req: OutfitRequest):
    refs = [_extract_b64(du) for du in (req.reference_data_urls or []) if du]
    if not refs and req.reference_data_url:
        refs = [_extract_b64(req.reference_data_url)]
    refs = [b for b in refs if b]
    if not refs:
        raise HTTPException(status_code=400, detail="reference_data_url or reference_data_urls required")
    try:
        outfit = await extract_outfit(refs, notes=req.notes, provider=req.provider)
    except Exception as e:
        logger.exception("extract_outfit failed")
        raise HTTPException(status_code=502, detail=f"Outfit extraction failed: {e}")
    return {"outfit": outfit}


# ---------- Live driver: proxy Alpecca's real mood/voice state ----------
@router.get("/alpecca/pose")
async def api_alpecca_pose(speaking: bool = False):
    """Server-side proxy to the running Alpecca app's /vrm/pose endpoint, which
    returns the clip + talk_emotion + expressions derived from her live emotional
    state (the same state that drives her voice). Proxying avoids browser CORS and
    keeps the Alpecca token server-side. Set ALPECCA_URL / ALPECCA_TOKEN in the
    VCS backend env. Returns {ok, pose} or {ok:false, error} — never raises, so the
    driver degrades quietly when Alpecca isn't running."""
    base = os.getenv("ALPECCA_URL", "http://127.0.0.1:8765").rstrip("/")
    token = os.getenv("ALPECCA_TOKEN", "")
    params = {"speaking": "true" if speaking else "false"}
    headers = {}
    if token:
        params["token"] = token
        headers["X-Alpecca-Token"] = token
    try:
        async with httpx.AsyncClient(timeout=4.0) as client:
            r = await client.get(f"{base}/vrm/pose", params=params, headers=headers)
            r.raise_for_status()
            return {"ok": True, "pose": r.json()}
    except Exception as e:
        return {"ok": False, "error": str(e)}


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
        raise HTTPException(status_code=502, detail=f"Generation failed: {e}")
    saved_panels = []
    for panel in result["panels"]:
        if "image" in panel:
            asset = await _save_asset(req.project_id, "turnaround", panel["label"], panel["prompt"], panel["image"])
            saved_panels.append({"label": panel["label"], "asset": asset.model_dump()})
        else:
            saved_panels.append({"label": panel["label"], "error": panel.get("error")})
    return {"character_desc": req.character_desc, "panels": saved_panels}


# ---------- Wardrobe (coordinated outfit) ----------
class WardrobeRequest(BaseModel):
    theme: str
    palette: str = "pastel pink and lavender"
    pieces: Optional[List[str]] = None
    project_id: Optional[str] = None


@router.post("/generate/wardrobe")
async def api_generate_wardrobe(req: WardrobeRequest):
    try:
        result = await generate_wardrobe(req.theme, req.palette, req.pieces)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Generation failed: {e}")
    saved = []
    for item in result["items"]:
        if "image" in item:
            asset = await _save_asset(req.project_id, "texture", item["piece"], item["prompt"], item["image"])
            saved.append({"piece": item["piece"], "asset": asset.model_dump()})
        else:
            saved.append({"piece": item["piece"], "error": item.get("error")})
    return {"theme": req.theme, "palette": req.palette, "items": saved}


# ---------- Accessories bundle ----------
class AccessoriesRequest(BaseModel):
    theme: str
    kinds: Optional[List[str]] = None
    project_id: Optional[str] = None


@router.post("/generate/accessories")
async def api_generate_accessories(req: AccessoriesRequest):
    try:
        result = await generate_accessories(req.theme, req.kinds)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Generation failed: {e}")
    saved = []
    for item in result["items"]:
        if "image" in item:
            asset = await _save_asset(req.project_id, "texture", item["kind"], item["prompt"], item["image"])
            saved.append({"kind": item["kind"], "asset": asset.model_dump()})
        else:
            saved.append({"kind": item["kind"], "error": item.get("error")})
    return {"theme": req.theme, "items": saved}


# ---------- Character analyzer (reference art → VRoid recipe) ----------
class AnalyzeRequest(BaseModel):
    reference_data_url: str
    notes: str = ""
    project_id: Optional[str] = None
    generate_turnaround: bool = False


@router.post("/analyze/character")
async def api_analyze_character(req: AnalyzeRequest):
    ref_b64 = _extract_b64(req.reference_data_url)
    if not ref_b64:
        raise HTTPException(status_code=400, detail="reference_data_url required")
    try:
        result = await analyze_character(ref_b64, req.notes)
    except Exception as e:
        logger.exception("analyze_character failed")
        raise HTTPException(status_code=502, detail=f"Analysis failed: {e}")

    preview_asset = None
    if result.get("preview_image"):
        preview_asset = await _save_asset(
            req.project_id, "concept", "preview", result["analysis"].get("turnaround_prompt", ""), result["preview_image"]
        )

    # Optionally launch a turnaround gen using the analyzed prompt (extra latency)
    turnaround_panels = []
    if req.generate_turnaround and result["analysis"].get("turnaround_prompt"):
        try:
            tr = await generate_turnaround(result["analysis"]["turnaround_prompt"], ref_image_b64=ref_b64)
            for panel in tr["panels"]:
                if "image" in panel:
                    asset = await _save_asset(req.project_id, "turnaround", panel["label"], panel["prompt"], panel["image"])
                    turnaround_panels.append({"label": panel["label"], "asset": asset.model_dump()})
                else:
                    turnaround_panels.append({"label": panel["label"], "error": panel.get("error")})
        except Exception as e:
            logger.warning("turnaround gen inside analyze failed: %s", e)

    return {
        "analysis": result["analysis"],
        "preview_asset": preview_asset.model_dump() if preview_asset else None,
        "turnaround_panels": turnaround_panels,
    }


# ---------- Assets ----------
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


# ---------- Save upscaled asset (from client) ----------
class SaveUpscaleRequest(BaseModel):
    source_asset_id: Optional[str] = None
    data_url: str
    width: int
    height: int
    label: str = "upscale"
    project_id: Optional[str] = None


@router.post("/assets/save_upscale")
async def save_upscale(req: SaveUpscaleRequest):
    if not req.data_url or not req.data_url.startswith("data:"):
        raise HTTPException(status_code=400, detail="data_url required")
    mime = req.data_url.split(";")[0].split(":", 1)[-1] or "image/jpeg"
    asset = Asset(
        project_id=req.project_id,
        kind="upscale",
        subkind=req.label,
        prompt=f"Upscaled to {req.width}x{req.height}" + (f" (from {req.source_asset_id})" if req.source_asset_id else ""),
        mime_type=mime,
        data_url=req.data_url,
    )
    await _db.assets.insert_one(asset.model_dump())
    return {"asset": asset.model_dump()}


# ---------- Projects ----------
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


# ---------- VRM upload/download ----------
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
            "vrm_filename": safe, "vrm_path": str(dest), "vrm_size_bytes": len(data),
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
