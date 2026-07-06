from datetime import datetime, timezone
from typing import List, Optional
import uuid

from pydantic import BaseModel, Field, ConfigDict


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id() -> str:
    return str(uuid.uuid4())


# -------------------- Assets --------------------
class Asset(BaseModel):
    """Any generated image asset saved in the DB."""
    model_config = ConfigDict(extra="ignore")

    id: str = Field(default_factory=new_id)
    project_id: Optional[str] = None
    kind: str  # texture | concept | turnaround | variant | reference
    subkind: Optional[str] = None  # e.g. skin/hair/eye/pattern or turnaround angle label
    prompt: str = ""
    mime_type: str = "image/jpeg"
    data_url: str = ""  # data:<mime>;base64,....
    thumb_url: Optional[str] = None
    created_at: str = Field(default_factory=now_iso)


# -------------------- Projects --------------------
class MaterialAssignment(BaseModel):
    material_name: str
    asset_id: str


class Project(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: str = Field(default_factory=new_id)
    name: str = "Untitled Project"
    description: str = ""
    vrm_filename: Optional[str] = None
    vrm_path: Optional[str] = None  # server-relative filesystem path
    vrm_size_bytes: Optional[int] = None
    thumbnail_data_url: Optional[str] = None  # small anime thumb
    expressions: dict = Field(default_factory=dict)  # {name: value}
    material_assignments: List[MaterialAssignment] = Field(default_factory=list)
    created_at: str = Field(default_factory=now_iso)
    updated_at: str = Field(default_factory=now_iso)


class ProjectCreate(BaseModel):
    name: str = "Untitled Project"
    description: str = ""


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    thumbnail_data_url: Optional[str] = None
    expressions: Optional[dict] = None
    material_assignments: Optional[List[MaterialAssignment]] = None


# -------------------- Generation requests --------------------
class TextureRequest(BaseModel):
    prompt: str
    kind: str = "texture"  # texture | skin | hair | eye | pattern
    project_id: Optional[str] = None


class ConceptRequest(BaseModel):
    prompt: str
    project_id: Optional[str] = None


class VariantRequest(BaseModel):
    prompt: str
    reference_asset_id: Optional[str] = None
    reference_data_url: Optional[str] = None  # base64 data url alternative
    project_id: Optional[str] = None


class TurnaroundRequest(BaseModel):
    character_desc: str
    reference_asset_id: Optional[str] = None
    reference_data_url: Optional[str] = None
    project_id: Optional[str] = None
