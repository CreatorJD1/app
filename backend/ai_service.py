"""AI generation service using Gemini Nano Banana for anime-only image workflows.

Proven in POC:
  * text-to-image anime textures
  * image-to-image variants preserving character identity
  * multi-angle turnaround sheets
"""
import asyncio
import base64
import logging
import os
import uuid
from typing import List, Optional, Tuple

from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

logger = logging.getLogger(__name__)

MODEL_ID = "gemini-3.1-flash-image-preview"

STYLE_SYSTEM = (
    "You generate high quality anime style illustrations for a VRoid Studio companion app. "
    "Everything you output must look like modern Japanese anime / VTuber illustration: "
    "clean lineart, cel shading, expressive eyes, vibrant flat colors, soft rim light."
)

STYLE_TAIL = (
    "Style: modern Japanese anime, cel-shaded, clean lineart, expressive VTuber character art, "
    "high quality VRoid aesthetic, vibrant flat colors, soft rim light."
)


def _get_key() -> str:
    key = os.getenv("EMERGENT_LLM_KEY")
    if not key:
        raise RuntimeError("EMERGENT_LLM_KEY missing")
    return key


def _new_chat() -> LlmChat:
    chat = LlmChat(
        api_key=_get_key(),
        session_id=f"vcs-{uuid.uuid4()}",
        system_message=STYLE_SYSTEM,
    )
    chat.with_model("gemini", MODEL_ID).with_params(modalities=["image", "text"])
    return chat


def _detect_mime(data: bytes) -> str:
    if data[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if data[:8].startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    return "image/jpeg"


async def _call(prompt: str, ref_b64: Optional[str] = None) -> List[dict]:
    chat = _new_chat()
    contents = [ImageContent(ref_b64)] if ref_b64 else None
    msg = UserMessage(text=prompt, file_contents=contents)
    text, images = await chat.send_message_multimodal_response(msg)
    out = []
    if images:
        for img in images:
            data_b64 = img.get("data") or ""
            if not data_b64:
                continue
            raw = base64.b64decode(data_b64)
            out.append({
                "data_b64": data_b64,
                "mime_type": _detect_mime(raw),
                "size_bytes": len(raw),
            })
    if not out:
        raise RuntimeError(f"Model returned no image. Text response: {(text or '')[:200]}")
    return out


async def generate_texture(prompt: str, kind: str = "texture") -> dict:
    kind_map = {
        "texture": "a seamless tileable anime clothing / material texture, square format",
        "skin": "a soft anime skin material sheet, subtle gradients, no faces, no seams",
        "hair": "an anime hair texture strand pattern with highlights, tileable",
        "eye": "a single detailed anime eye iris texture, high detail centered on white background",
        "pattern": "a seamless anime decorative pattern, square tileable",
    }
    style_hint = kind_map.get(kind, kind_map["texture"])
    full = f"{style_hint}. Motif / description: {prompt}. {STYLE_TAIL}"
    images = await _call(full)
    return {"prompt": full, "images": images, "kind": kind}


async def generate_variant(prompt: str, ref_image_b64: str) -> dict:
    full = (
        f"Using the character in the provided reference image, redraw them with this change: {prompt}. "
        "Preserve the character's face, hair color, eye color and outfit identity. "
        f"Clean neutral background. {STYLE_TAIL}"
    )
    images = await _call(full, ref_b64=ref_image_b64)
    return {"prompt": full, "images": images}


async def generate_concept(prompt: str) -> dict:
    full = (
        f"An anime character concept illustration: {prompt}. "
        "Full body front-facing pose, clean white background, isolated character. "
        f"{STYLE_TAIL}"
    )
    images = await _call(full)
    return {"prompt": full, "images": images}


async def generate_turnaround(character_desc: str, ref_image_b64: Optional[str] = None) -> dict:
    """Generate 4-angle character reference sheet. Runs 4 calls concurrently."""
    angles = [
        ("front", "front view, facing the camera directly, arms slightly out"),
        ("three_quarter", "3/4 view turned about 30 degrees to the left"),
        ("side", "full side profile view facing right"),
        ("back", "back view showing hair and outfit details"),
    ]

    async def one(label: str, angle: str):
        prompt = (
            f"A character reference model sheet illustration of {character_desc}, "
            f"{angle}, plain neutral gray background, no ground shadow, isolated character. "
            f"{STYLE_TAIL}"
        )
        try:
            imgs = await _call(prompt, ref_b64=ref_image_b64)
            return {"label": label, "prompt": prompt, "image": imgs[0]}
        except Exception as e:
            logger.exception("Turnaround angle %s failed", label)
            return {"label": label, "error": str(e)}

    results = await asyncio.gather(*[one(l, a) for l, a in angles])
    return {"character_desc": character_desc, "panels": results}
