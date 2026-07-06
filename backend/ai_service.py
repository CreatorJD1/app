"""AI generation service using Gemini Nano Banana for anime image workflows,
plus Gemini text for structured character analysis."""
import asyncio
import base64
import json
import logging
import os
import re
import uuid
from typing import List, Optional

# emergentintegrations is the Emergent platform's private package (installed in
# the Docker image / dev env, not on public PyPI). Import it lazily-guarded so
# the backend still boots without it — projects, VRM upload/download, and the
# VRoid Hub bridge all work; only the generation endpoints need this, and they
# raise the same clear RuntimeError a missing EMERGENT_LLM_KEY does.
try:
    from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
except ImportError:  # pragma: no cover - exercised only where the pkg is absent
    LlmChat = UserMessage = ImageContent = None

logger = logging.getLogger(__name__)

IMAGE_MODEL = "gemini-3.1-flash-image-preview"
TEXT_MODEL = "gemini-2.5-flash"  # for structured JSON extraction

STYLE_SYSTEM = (
    "You generate high quality anime style illustrations for a VRoid Studio companion app. "
    "Everything must look like modern Japanese anime / VTuber illustration: clean lineart, "
    "cel shading, expressive eyes, vibrant flat colors, soft rim light."
)

ANALYZE_SYSTEM = (
    "You are an expert VRoid Studio character analyst. Given reference art of an anime character, "
    "extract every parameter needed to recreate them in VRoid Studio. Respond ONLY with valid JSON."
)

STYLE_TAIL = (
    "Style: modern Japanese anime, cel-shaded, clean lineart, expressive VTuber character art, "
    "high quality VRoid aesthetic, vibrant flat colors, soft rim light."
)


def _get_key() -> str:
    if LlmChat is None:
        raise RuntimeError("emergentintegrations package not installed")
    key = os.getenv("EMERGENT_LLM_KEY")
    if not key:
        raise RuntimeError("EMERGENT_LLM_KEY missing")
    return key


def _new_image_chat() -> LlmChat:
    chat = LlmChat(api_key=_get_key(), session_id=f"vcs-img-{uuid.uuid4()}", system_message=STYLE_SYSTEM)
    chat.with_model("gemini", IMAGE_MODEL).with_params(modalities=["image", "text"])
    return chat


def _new_text_chat(system: str) -> LlmChat:
    chat = LlmChat(api_key=_get_key(), session_id=f"vcs-txt-{uuid.uuid4()}", system_message=system)
    chat.with_model("gemini", TEXT_MODEL)
    return chat


def _detect_mime(data: bytes) -> str:
    if data[:3] == b"\xff\xd8\xff":
        return "image/jpeg"
    if data[:8].startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    return "image/jpeg"


async def _image_call(prompt: str, ref_b64: Optional[str] = None) -> List[dict]:
    chat = _new_image_chat()
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
            out.append({"data_b64": data_b64, "mime_type": _detect_mime(raw), "size_bytes": len(raw)})
    if not out:
        raise RuntimeError(f"Model returned no image. Text response: {(text or '')[:200]}")
    return out


async def generate_texture(prompt: str, kind: str = "texture") -> dict:
    kind_map = {
        "texture": "a seamless tileable anime clothing / material texture, square format",
        "skin": "a soft anime skin material sheet, subtle gradients, no faces",
        "hair": "an anime hair strand texture with highlights, tileable",
        "eye": "a single detailed anime iris texture, centered on white background",
        "pattern": "a seamless anime decorative pattern, square tileable",
    }
    style_hint = kind_map.get(kind, kind_map["texture"])
    full = f"{style_hint}. Description: {prompt}. {STYLE_TAIL}"
    images = await _image_call(full)
    return {"prompt": full, "images": images, "kind": kind}


async def generate_variant(prompt: str, ref_image_b64: str) -> dict:
    """Reference-conditioned generation. Behaviour is driven by the user's prompt:
    - Character re-illustration: prompt naturally mentions the character
    - UV template repaint: prompt mentions "UV", "layout", "seams", "boundaries"
    We stay prompt-following and let the user drive intent."""
    lower = (prompt or "").lower()
    is_uv_repaint = any(t in lower for t in ("uv", "seams", "layout", "boundaries", "wireframe"))
    if is_uv_repaint:
        full = (
            f"Follow the reference image STRICTLY as a UV / layout template. "
            f"Repaint every region inside the seams shown in the reference, keeping the exact "
            f"boundaries, aspect ratio and framing. User instructions: {prompt}. "
            f"No text, no watermarks, no borders added. {STYLE_TAIL}"
        )
    else:
        full = (
            f"Using the character in the provided reference image, redraw with this change: {prompt}. "
            f"Preserve face, hair color, eye color and outfit identity. Clean neutral background. {STYLE_TAIL}"
        )
    images = await _image_call(full, ref_b64=ref_image_b64)
    return {"prompt": full, "images": images}


async def generate_concept(prompt: str) -> dict:
    full = (
        f"An anime character concept illustration: {prompt}. "
        f"Full body front-facing pose, clean white background, isolated character. {STYLE_TAIL}"
    )
    images = await _image_call(full)
    return {"prompt": full, "images": images}


async def generate_turnaround(character_desc: str, ref_image_b64: Optional[str] = None) -> dict:
    angles = [
        ("front", "front view, facing the camera directly, arms slightly out"),
        ("three_quarter", "3/4 view turned about 30 degrees to the left"),
        ("side", "full side profile view facing right"),
        ("back", "back view showing hair and outfit details"),
    ]

    async def one(label: str, angle: str):
        prompt = (
            f"A character reference model sheet illustration of {character_desc}, {angle}, "
            f"plain neutral gray background, no ground shadow, isolated character. {STYLE_TAIL}"
        )
        try:
            imgs = await _image_call(prompt, ref_b64=ref_image_b64)
            return {"label": label, "prompt": prompt, "image": imgs[0]}
        except Exception as e:
            logger.exception("Turnaround angle %s failed", label)
            return {"label": label, "error": str(e)}

    results = await asyncio.gather(*[one(l, a) for l, a in angles])
    return {"character_desc": character_desc, "panels": results}


# ---------- Wardrobe: coordinated outfit generation ----------
async def generate_wardrobe(theme: str, palette: str = "pastel pink and lavender", pieces: List[str] = None) -> dict:
    if not pieces:
        pieces = ["tops", "bottoms", "shoes", "outerwear"]

    piece_prompts = {
        "tops": "anime top clothing texture (blouse/shirt/hoodie), seamless tileable, cel-shaded",
        "bottoms": "anime bottoms texture (skirt/pants/shorts), seamless tileable, cel-shaded",
        "shoes": "anime shoes / boots material, tileable, cel-shaded",
        "outerwear": "anime outerwear (coat/cardigan) fabric, tileable, cel-shaded",
        "onepiece": "anime one-piece dress fabric, tileable, cel-shaded",
        "accessory": "anime accessory decorative pattern, glossy, tileable",
    }

    async def one(piece: str):
        base = piece_prompts.get(piece, piece_prompts["tops"])
        prompt = f"{base}. Coordinated outfit theme: {theme}. Color palette: {palette}. {STYLE_TAIL}"
        try:
            imgs = await _image_call(prompt)
            return {"piece": piece, "prompt": prompt, "image": imgs[0]}
        except Exception as e:
            return {"piece": piece, "error": str(e)}

    results = await asyncio.gather(*[one(p) for p in pieces])
    return {"theme": theme, "palette": palette, "items": results}


# ---------- Accessories bundle ----------
async def generate_accessories(theme: str, kinds: List[str] = None) -> dict:
    if not kinds:
        kinds = ["hair_accessory", "earring", "necklace", "glasses"]

    prompts = {
        "hair_accessory": "anime hair accessory (ribbon / clip / hairpin) design on transparent, cel-shaded",
        "earring": "anime earring design isolated, cel-shaded, glossy",
        "necklace": "anime necklace pendant design isolated, cel-shaded",
        "glasses": "anime glasses design isolated, thin frame, cel-shaded",
        "tail": "anime creature tail decorative, cel-shaded, tileable",
        "wings": "anime wings design isolated, feathered or fantasy",
    }

    async def one(k: str):
        prompt = f"{prompts.get(k, prompts['hair_accessory'])}. Style theme: {theme}. {STYLE_TAIL}"
        try:
            imgs = await _image_call(prompt)
            return {"kind": k, "prompt": prompt, "image": imgs[0]}
        except Exception as e:
            return {"kind": k, "error": str(e)}

    results = await asyncio.gather(*[one(k) for k in kinds])
    return {"theme": theme, "items": results}


# ---------- Character analyzer: image → structured VRoid recipe ----------
CHARACTER_SCHEMA = {
    "identity": {
        "name_suggestion": "string",
        "vibe_tags": ["3-6 short tags e.g. cyberpunk, kawaii, gothic"],
        "gender_expression": "feminine|masculine|androgynous|other",
        "age_appearance": "child|teen|young_adult|adult",
    },
    "face": {
        "face_shape": "round|oval|heart|square",
        "skin_tone_hex": "#RRGGBB",
        "skin_finish": "matte|soft|glossy",
        "blush": "none|subtle|strong",
    },
    "eyes": {
        "shape": "round|almond|upturned|downturned|sharp",
        "size": "small|medium|large|very_large",
        "iris_color_hex": "#RRGGBB",
        "iris_secondary_hex": "#RRGGBB | null",
        "highlight": "single|multiple|starburst",
        "eyelash_style": "minimal|standard|dramatic",
    },
    "hair": {
        "length": "short|medium|long|very_long",
        "style": "straight|wavy|curly|twintails|ponytail|bob|braid|space_buns|hime",
        "bangs": "none|blunt|side_swept|curtain|wispy",
        "base_color_hex": "#RRGGBB",
        "streaks_color_hex": "#RRGGBB | null",
        "highlights": "none|subtle|strong",
        "accessories": ["list of hair accessories seen"]
    },
    "body": {
        "height_class": "petite|average|tall",
        "build": "slim|athletic|curvy|thick",
    },
    "outfit": {
        "top": {"description": "...", "colors_hex": ["#RRGGBB"], "material": "cotton|silk|leather|denim|knit|latex|other"},
        "bottom": {"description": "...", "colors_hex": ["#RRGGBB"], "material": "..."},
        "shoes": {"description": "...", "colors_hex": ["#RRGGBB"]},
        "outerwear": {"description": "or null", "colors_hex": ["#RRGGBB"]},
        "is_onepiece": True,
    },
    "accessories": [
        {"kind": "earring|necklace|glasses|hat|badge|weapon|tail|wings|ears|other", "description": "...", "colors_hex": ["#RRGGBB"]}
    ],
    "vroid_recipe": {
        "suggested_steps": ["copy-paste recipe steps for VRoid Studio, each 1 line"],
        "clothing_categories_to_use": ["Tops>T-shirt", "Bottoms>Skirt", "..."],
        "notes": "any important nuances",
    },
    "turnaround_prompt": "one paragraph description ideal for regenerating a 4-angle model sheet of this character",
    "texture_pack_prompts": {
        "hair": "...",
        "tops": "...",
        "bottoms": "...",
        "shoes": "...",
        "skin": "...",
    },
}


def _extract_json(text: str) -> Optional[dict]:
    if not text:
        return None
    m = re.search(r"\{[\s\S]*\}", text)
    if not m:
        return None
    try:
        return json.loads(m.group(0))
    except Exception:
        return None


async def analyze_character(ref_image_b64: str, extra_notes: str = "") -> dict:
    schema = json.dumps(CHARACTER_SCHEMA, indent=2)
    prompt = (
        "Analyze the anime character in this reference image. Extract every attribute needed to "
        "recreate them in VRoid Studio. Respond with a SINGLE valid JSON object matching this schema "
        "(fill every field; use best guess when unclear; use hex color codes like #A1B2C3):\n\n"
        + schema
        + (f"\n\nExtra notes from user: {extra_notes}" if extra_notes else "")
        + "\n\nReply ONLY with the JSON object. No explanations, no markdown fences."
    )
    chat = _new_text_chat(ANALYZE_SYSTEM)
    msg = UserMessage(text=prompt, file_contents=[ImageContent(ref_image_b64)])
    text = await chat.send_message(msg)
    data = _extract_json(text if isinstance(text, str) else str(text))
    if not data:
        raise RuntimeError(f"Model did not return parseable JSON. Raw: {(text or '')[:300]}")

    # Try to produce a preview concept image using the reconstructed prompt
    preview_img = None
    try:
        cprompt = data.get("turnaround_prompt") or ""
        if cprompt:
            concept = await generate_concept(cprompt)
            preview_img = concept["images"][0]
    except Exception:
        preview_img = None

    return {"analysis": data, "preview_image": preview_img}
