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

# When OPENAI_API_KEY is set, use OpenAI instead of the Emergent/Gemini path:
# gpt-image-1 for textures (supports multi-image editing = UV + garment), and
# gpt-4o vision for the extraction and the deviation guard.
OPENAI_IMAGE_MODEL = "gpt-image-1"
OPENAI_VISION_MODEL = "gpt-4o"


def _use_openai() -> bool:
    return bool(os.getenv("OPENAI_API_KEY"))


def _oai():
    from openai import AsyncOpenAI
    return AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))


async def _oai_image(prompt: str, ref_b64s: List[str]) -> List[dict]:
    """Text→image (images.generate) or reference-conditioned edit (images.edit)."""
    import io
    client = _oai()
    if ref_b64s:
        imgs = []
        for i, b in enumerate(ref_b64s):
            bio = io.BytesIO(base64.b64decode(b))
            bio.name = f"ref{i}.png"
            imgs.append(bio)
        resp = await client.images.edit(model=OPENAI_IMAGE_MODEL, image=imgs, prompt=prompt, size="1024x1024")
    else:
        resp = await client.images.generate(model=OPENAI_IMAGE_MODEL, prompt=prompt, size="1024x1024")
    out = []
    for d in resp.data:
        b64 = getattr(d, "b64_json", None)
        if not b64:
            continue
        raw = base64.b64decode(b64)
        out.append({"data_b64": b64, "mime_type": "image/png", "size_bytes": len(raw)})
    if not out:
        raise RuntimeError("OpenAI returned no image")
    return out


COMFY_NEG = (
    "photorealistic, realistic, 3d render, photograph, dslr, western cartoon, pencil sketch, "
    "oil painting, text, letters, words, watermark, signature, logo, label, arrows, border, frame, "
    "person, face, head, full body, character, background, scene, extra objects, shadow, vignette, "
    "blurry, lowres, jpeg artifacts"
)


def _comfy_available() -> bool:
    return bool(os.getenv("COMFYUI_URL"))


async def _comfy_image(prompt: str, ref_b64s: List[str]) -> List[dict]:
    """Local generation via ComfyUI. If a reference (UV template) is given, run
    img2img off it so the texture follows the layout; otherwise txt2img."""
    import httpx
    base = os.environ["COMFYUI_URL"].rstrip("/")
    ckpt = os.getenv("COMFYUI_CKPT", "sd_xl_turbo_1.0_fp16.safetensors")
    seed = int.from_bytes(os.urandom(4), "big")
    async with httpx.AsyncClient(timeout=240.0) as client:
        input_name = None
        if ref_b64s:
            raw = base64.b64decode(ref_b64s[0])
            r = await client.post(f"{base}/upload/image",
                                  files={"image": ("uv.png", raw, "image/png")},
                                  data={"overwrite": "true"})
            r.raise_for_status()
            input_name = r.json()["name"]

        g = {
            "4": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": ckpt}},
            "6": {"class_type": "CLIPTextEncode", "inputs": {"text": prompt, "clip": ["4", 1]}},
            "7": {"class_type": "CLIPTextEncode", "inputs": {"text": COMFY_NEG, "clip": ["4", 1]}},
            "8": {"class_type": "VAEDecode", "inputs": {"samples": ["3", 0], "vae": ["4", 2]}},
            "9": {"class_type": "SaveImage", "inputs": {"filename_prefix": "vcs_tex", "images": ["8", 0]}},
        }
        if input_name:
            g["10"] = {"class_type": "LoadImage", "inputs": {"image": input_name}}
            g["12"] = {"class_type": "VAEEncode", "inputs": {"pixels": ["10", 0], "vae": ["4", 2]}}
            latent, denoise = ["12", 0], 0.72
        else:
            g["11"] = {"class_type": "EmptyLatentImage", "inputs": {"width": 1024, "height": 1024, "batch_size": 1}}
            latent, denoise = ["11", 0], 1.0
        g["3"] = {"class_type": "KSampler", "inputs": {
            "seed": seed, "steps": 8, "cfg": 2.0, "sampler_name": "euler_ancestral",
            "scheduler": "normal", "denoise": denoise, "model": ["4", 0],
            "positive": ["6", 0], "negative": ["7", 0], "latent_image": latent}}

        r = await client.post(f"{base}/prompt", json={"prompt": g})
        r.raise_for_status()
        pid = r.json()["prompt_id"]
        for _ in range(120):
            await asyncio.sleep(1.5)
            h = (await client.get(f"{base}/history/{pid}")).json()
            entry = h.get(pid)
            if entry and entry.get("outputs"):
                for node in entry["outputs"].values():
                    for img in node.get("images", []):
                        iv = await client.get(f"{base}/view", params={
                            "filename": img["filename"], "subfolder": img.get("subfolder", ""),
                            "type": img.get("type", "output")})
                        raw = iv.content
                        return [{"data_b64": base64.b64encode(raw).decode(), "mime_type": "image/png", "size_bytes": len(raw)}]
                raise RuntimeError("ComfyUI finished with no image output")
        raise RuntimeError("ComfyUI generation timed out")


async def _oai_vision_json(system: str, prompt: str, image_b64s: List[str]) -> dict:
    """gpt-4o vision → parsed JSON (extraction / guard)."""
    client = _oai()
    content = [{"type": "text", "text": prompt}]
    for b in image_b64s:
        content.append({"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b}"}})
    resp = await client.chat.completions.create(
        model=OPENAI_VISION_MODEL,
        messages=[{"role": "system", "content": system}, {"role": "user", "content": content}],
        response_format={"type": "json_object"},
        temperature=0.2,
    )
    return _parse_json_object(resp.choices[0].message.content)


# ---- HuggingFace Inference (cloud, via HF_TOKEN) ----
HF_IMAGE_MODEL = os.environ.get("HF_IMAGE_MODEL", "black-forest-labs/FLUX.1-schnell")
HF_IMG2IMG_MODEL = os.environ.get("HF_IMG2IMG_MODEL", "black-forest-labs/FLUX.1-dev")
HF_VISION_MODEL = os.environ.get("HF_VISION_MODEL", "Qwen/Qwen2.5-VL-7B-Instruct")


def _hf_available() -> bool:
    return bool(os.getenv("HF_TOKEN"))


async def _hf_image(prompt: str, ref_b64s: List[str]) -> List[dict]:
    import io
    from huggingface_hub import InferenceClient
    from PIL import Image
    tok = os.getenv("HF_TOKEN")

    def _run():
        client = InferenceClient(provider="auto", api_key=tok)
        img = None
        if ref_b64s:
            init = Image.open(io.BytesIO(base64.b64decode(ref_b64s[-1]))).convert("RGB")
            try:
                img = client.image_to_image(init, prompt=prompt, model=HF_IMG2IMG_MODEL)
            except Exception:
                img = None  # provider/model may not offer img2img — fall back to txt2img
        if img is None:
            img = client.text_to_image(prompt, model=HF_IMAGE_MODEL)
        b = io.BytesIO(); img.save(b, "PNG"); return b.getvalue()

    raw = await asyncio.to_thread(_run)
    return [{"data_b64": base64.b64encode(raw).decode(), "mime_type": "image/png", "size_bytes": len(raw)}]


async def _hf_vision_json(system: str, prompt: str, image_b64s: List[str]) -> dict:
    from huggingface_hub import InferenceClient
    tok = os.getenv("HF_TOKEN")
    content = [{"type": "text", "text": prompt}]
    for b in image_b64s:
        content.append({"type": "image_url", "image_url": {"url": f"data:image/png;base64,{b}"}})

    def _run():
        client = InferenceClient(provider="auto", api_key=tok)
        r = client.chat_completion(
            model=HF_VISION_MODEL,
            messages=[{"role": "system", "content": system}, {"role": "user", "content": content}],
            max_tokens=900, temperature=0.2,
        )
        return r.choices[0].message.content

    return _parse_json_object(await asyncio.to_thread(_run))


# ---- Local vision via Ollama (qwen3-vl) — the user's on-device model ----
OLLAMA_URL = os.environ.get("OLLAMA_URL", os.environ.get("OLLAMA_HOST", "http://127.0.0.1:11434"))
OLLAMA_VISION_MODEL = os.environ.get("OLLAMA_VISION_MODEL", "qwen3-vl")


def _ollama_vision_available() -> bool:
    return bool(OLLAMA_VISION_MODEL)


def _downscale_b64(b64: str, max_side: int = 1024) -> str:
    """Shrink an image so vision models (esp. CPU-offloaded local ones) stay fast.
    A ~1024px image reads garments/textures fine and cuts image-token count hugely."""
    import io
    from PIL import Image
    try:
        im = Image.open(io.BytesIO(base64.b64decode(b64)))
        if max(im.size) > max_side:
            im.thumbnail((max_side, max_side))
        out = io.BytesIO()
        im.convert("RGB").save(out, "JPEG", quality=88)
        return base64.b64encode(out.getvalue()).decode()
    except Exception:
        return b64


async def _ollama_vision_json(system: str, prompt: str, image_b64s: List[str]) -> dict:
    import httpx
    base = OLLAMA_URL.rstrip("/")
    imgs = [_downscale_b64(b, int(os.getenv("OLLAMA_VISION_MAXSIDE", "1024"))) for b in image_b64s]
    payload = {
        "model": OLLAMA_VISION_MODEL, "stream": False, "format": "json",
        # qwen3-vl advertises a 256K context; without a cap Ollama tries to
        # allocate a ~20 GB KV cache and OOMs. 8K is ample for image + JSON.
        "options": {"temperature": 0.2, "num_ctx": int(os.getenv("OLLAMA_NUM_CTX", "8192"))},
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": prompt, "images": imgs},
        ],
    }
    async with httpx.AsyncClient(timeout=float(os.getenv("OLLAMA_TIMEOUT", "900"))) as c:
        r = await c.post(f"{base}/api/chat", json=payload)
        r.raise_for_status()
        return _parse_json_object(r.json()["message"]["content"])


# ---- ZeroGPU Space (Pony V6 XL texture + Qwen2.5-VL vision) on Jason's H200 ----
# The real muscle: a Gradio Space on Jason's PRO ZeroGPU. Quality anime image
# generation (Pony V6) and structured vision run there, so the 4 GB local card
# (which times out) and paid HF Inference (402) are both out of the loop.
ZEROGPU_TEXTURE_SPACE = os.environ.get("ZEROGPU_TEXTURE_SPACE", "")
_zgpu_client = None


def _zerogpu_available() -> bool:
    return bool(ZEROGPU_TEXTURE_SPACE and os.getenv("HF_TOKEN"))


def _get_zerogpu_client():
    global _zgpu_client
    if _zgpu_client is None:
        from gradio_client import Client
        _zgpu_client = Client(ZEROGPU_TEXTURE_SPACE, token=os.getenv("HF_TOKEN"), verbose=False)
    return _zgpu_client


async def _zerogpu_texture(prompt: str, ref_b64s: List[str],
                           init_b64: Optional[str] = None,
                           strength: Optional[float] = None,
                           ref_image_b64: Optional[str] = None,
                           ip_scale: Optional[float] = None) -> List[dict]:
    """Generate one image on the ZeroGPU Space (Pony V6 XL). `init_b64` (if given)
    is the explicit img2img seed — for material restyle this is the material's
    ORIGINAL UV atlas so panel/seam placement is preserved. `ref_image_b64` (a
    garment/design reference) conditions the fabric look via IP-Adapter on the
    Space. First call is slow (model download); later calls are fast."""
    seed_img = init_b64 if init_b64 is not None else (ref_b64s[-1] if ref_b64s else "")
    denoise = strength if strength is not None else float(os.getenv("ZEROGPU_STRENGTH", "0.72"))
    ip_ref = _downscale_b64(ref_image_b64, 768) if ref_image_b64 else ""
    ip_s = float(ip_scale if ip_scale is not None else os.getenv("ZEROGPU_IP_SCALE", "0.6"))
    size = int(os.getenv("ZEROGPU_SIZE", "1024"))

    def _run():
        client = _get_zerogpu_client()
        job = client.submit(
            prompt,                                              # prompt
            "",                                                  # negative_prompt (Space default)
            seed_img,                                            # init_image_b64
            float(denoise),                                      # strength
            int(os.getenv("ZEROGPU_STEPS", "28")),               # steps
            float(os.getenv("ZEROGPU_GUIDANCE", "7.0")),         # guidance
            size,                                                # width
            size,                                                # height
            0,                                                   # seed (0 = fixed)
            ip_ref,                                              # ref_image_b64 (IP-Adapter)
            ip_s,                                                # ip_scale
            api_name="/texture",
        )
        return job.result(timeout=float(os.getenv("ZEROGPU_TIMEOUT", "900")))

    b64 = await asyncio.to_thread(_run)
    if b64 and b64.startswith("data:") and "," in b64:
        b64 = b64.split(",", 1)[1]
    raw = base64.b64decode(b64)
    return [{"data_b64": b64, "mime_type": _detect_mime(raw), "size_bytes": len(raw)}]


def _panel_edge_control(atlas_b64: str) -> str:
    """Build the ControlNet structure map from the atlas ALPHA channel: crisp
    white outlines of every UV island (plus faint interior seam detail), black
    everywhere else. This is the clean signal the canny ControlNet needs — the
    Space's own fallback (PIL FIND_EDGES on the RGB) reads texture noise as
    structure and produces a beaded-mesh artifact. Returns base64 PNG (RGB)."""
    import io
    from PIL import Image, ImageChops, ImageFilter, ImageOps
    try:
        atlas = Image.open(io.BytesIO(base64.b64decode(atlas_b64))).convert("RGBA")
        mask = atlas.getchannel("A").point(lambda a: 255 if a > 16 else 0)
        coverage = sum(mask.histogram()[128:]) / float(mask.size[0] * mask.size[1])
        # Structure from luminance: blur BEFORE edge detection + autocontrast +
        # threshold, so panel seams/trim survive but per-pixel fabric weave does
        # not (raw FIND_EDGES reads every weave pixel and rebuilds the
        # beaded-mesh artifact). Tuned on the outfit test atlas (blur 1.2/thr 24
        # keeps the sleeve/vest/skirt panel geometry at ~9% lit).
        lum = atlas.convert("L").filter(ImageFilter.GaussianBlur(1.2)).filter(ImageFilter.FIND_EDGES)
        lum = ImageOps.autocontrast(lum)
        detail = lum.point(lambda v: 255 if v > 24 else 0)
        if coverage < 0.98:
            # Real UV void present: island outlines are the primary structure
            # (dilate - erode of the alpha mask), luminance detail clipped inside.
            grow = mask.filter(ImageFilter.MaxFilter(5))
            shrink = mask.filter(ImageFilter.MinFilter(5))
            outline = ImageChops.subtract(grow, shrink)
            interior = ImageChops.multiply(detail, shrink).point(lambda v: 128 if v else 0)
            edges = ImageChops.lighter(outline, interior)
        else:
            # Fully-opaque atlas: the luminance structure IS the panel map.
            edges = detail
        ctrl = Image.merge("RGB", (edges, edges, edges))
        out = io.BytesIO(); ctrl.save(out, "PNG")
        return base64.b64encode(out.getvalue()).decode()
    except Exception:
        return ""  # Space derives its own canny from the init as the fallback


async def _zerogpu_texture_cn(prompt: str, init_b64: str, control_b64: str = "",
                              strength: Optional[float] = None,
                              cn_scale: Optional[float] = None) -> List[dict]:
    """Structure-locked generation on the Space's /texture_cn: img2img off the
    atlas + a canny ControlNet holding the panel edges, so HIGH denoise paints
    bold new fabric that still lands inside the UV islands (direct-tested:
    strength 0.75 held every panel where plain img2img scrambles)."""
    denoise = strength if strength is not None else float(os.getenv("TEXTURE_BOLD_STRENGTH", "0.75"))
    cn_s = cn_scale if cn_scale is not None else float(os.getenv("ZEROGPU_CN_SCALE", "0.6"))
    size = int(os.getenv("ZEROGPU_SIZE", "1024"))

    def _run():
        client = _get_zerogpu_client()
        job = client.submit(
            prompt,                                              # prompt
            "",                                                  # negative_prompt (Space default)
            init_b64,                                            # init_image_b64 (the atlas)
            control_b64,                                         # control_image_b64 (panel edges)
            float(denoise),                                      # strength
            float(cn_s),                                         # cn_scale
            int(os.getenv("ZEROGPU_CN_STEPS", "30")),            # steps
            float(os.getenv("ZEROGPU_GUIDANCE", "7.0")),         # guidance
            size,                                                # width
            size,                                                # height
            0,                                                   # seed (0 = fixed)
            api_name="/texture_cn",
        )
        return job.result(timeout=float(os.getenv("ZEROGPU_TIMEOUT", "900")))

    b64 = await asyncio.to_thread(_run)
    if b64 and b64.startswith("data:") and "," in b64:
        b64 = b64.split(",", 1)[1]
    raw = base64.b64decode(b64)
    return [{"data_b64": b64, "mime_type": _detect_mime(raw), "size_bytes": len(raw)}]


async def _zerogpu_vision_json(system: str, prompt: str, image_b64s: List[str]) -> dict:
    """Structured vision on the ZeroGPU Space (Qwen2.5-VL-7B on the H200)."""
    imgs = [_downscale_b64(b, int(os.getenv("ZEROGPU_VISION_MAXSIDE", "1280"))) for b in image_b64s]
    joined = "|||".join(imgs)

    def _run():
        client = _get_zerogpu_client()
        job = client.submit(joined, system, prompt, api_name="/vision_json")
        return job.result(timeout=float(os.getenv("ZEROGPU_TIMEOUT", "900")))

    return _parse_json_object(await asyncio.to_thread(_run))


# ---- Hybrid provider routing (ZeroGPU <-> local ComfyUI <-> cloud HF) ----
def _resolve_provider(pref: Optional[str] = None) -> str:
    """zerogpu | local | cloud | hybrid | auto (env AI_PROVIDER default)."""
    return (pref or os.getenv("AI_PROVIDER") or "auto").lower()


async def _vision_json(system: str, prompt: str, image_b64s: List[str], provider: Optional[str] = None) -> dict:
    """Vision → JSON. ZeroGPU (Qwen2.5-VL-7B on the H200) is preferred — fast and
    free on Jason's PRO — then local Ollama, then cloud HF, then OpenAI, Gemini."""
    p = _resolve_provider(provider)
    if p in ("zerogpu", "cloud", "hybrid", "auto", "") and _zerogpu_available():
        try:
            return await _zerogpu_vision_json(system, prompt, image_b64s)
        except Exception as e:
            logger.warning("ZeroGPU vision failed, falling back: %s", e)
    if p != "zerogpu" and _ollama_vision_available():
        try:
            return await _ollama_vision_json(system, prompt, image_b64s)
        except Exception as e:
            logger.warning("Ollama vision failed, falling back: %s", e)
    if _hf_available():
        return await _hf_vision_json(system, prompt, image_b64s)
    if _use_openai():
        return await _oai_vision_json(system, prompt, image_b64s)
    chat = _new_text_chat(system)
    msg = UserMessage(text=prompt, file_contents=[ImageContent(b) for b in image_b64s])
    return _parse_json_object(await chat.send_message(msg))

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

# ---- Hard guardrails: Texture Lab makes UV TEXTURE MAPS, not illustrations. ----
# Appended to every texture prompt AND enforced by a vision guard, so the model
# cannot drift to realism, a new character, text, a scene, or off-goal art.
TEXTURE_GUARD = (
    " STRICT OUTPUT RULES — the result is a flat UV TEXTURE MAP for ONE 3D-model material, "
    "not an illustration: "
    "(1) anime / VTuber cel-shaded style ONLY — flat vibrant colors, clean anime lineart; "
    "(2) do NOT draw a new character, a face, a head, a full body, a person, a pose, a scene, or a background; "
    "(3) NO photorealism, no 3D render, no western cartoon, no pencil sketch, no oil painting, no realistic style; "
    "(4) NO text, letters, numbers, watermark, signature, logo, arrows or labels, and no outer border; "
    "(5) FLAT even shadeless lighting — no cast shadows, no rim light, no vignette, no depth; "
    "(6) paint ONLY the target garment/region and fill the square edge to edge — invent no extra clothing or props; "
    "(7) if a UV / seam layout is provided, paint strictly inside those seams and keep the exact boundaries and aspect."
)

TEXTURE_SYSTEM = (
    "You generate UV texture maps that get wrapped onto anime VRM 3D-character materials. "
    "Your output is a flat texture atlas, never an illustration or a character render." + TEXTURE_GUARD
)

GUARD_SYSTEM = (
    "You are a strict QA gate for anime UV texture generation. Judge only the given image. "
    "Respond ONLY with valid JSON, no prose."
)


def _get_key() -> str:
    if LlmChat is None:
        raise RuntimeError("emergentintegrations package not installed")
    key = os.getenv("EMERGENT_LLM_KEY")
    if not key:
        raise RuntimeError("EMERGENT_LLM_KEY missing")
    return key


def _new_image_chat() -> LlmChat:
    # Texture Lab is texture-only: the image model is anchored to the UV-texture
    # guardrails so it can't drift to illustrations / new characters.
    chat = LlmChat(api_key=_get_key(), session_id=f"vcs-img-{uuid.uuid4()}", system_message=TEXTURE_SYSTEM)
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


async def _image_call(prompt: str, ref_b64: Optional[str] = None,
                      ref_b64s: Optional[List[str]] = None,
                      provider: Optional[str] = None,
                      init_b64: Optional[str] = None,
                      strength: Optional[float] = None,
                      ref_image_b64: Optional[str] = None,
                      ip_scale: Optional[float] = None) -> List[dict]:
    refs = [b for b in (ref_b64s or []) if b]
    if ref_b64 and ref_b64 not in refs:
        refs.insert(0, ref_b64)
    # An explicit init_b64 is the img2img seed (e.g. the material's original UV
    # atlas for a low-denoise restyle); make sure providers that seed off the
    # last ref pick it up too.
    if init_b64 and init_b64 not in refs:
        refs.append(init_b64)
    p = _resolve_provider(provider)
    # Explicit modes.
    if p == "zerogpu" and _zerogpu_available():
        return await _zerogpu_texture(prompt, refs, init_b64=init_b64, strength=strength,
                                      ref_image_b64=ref_image_b64, ip_scale=ip_scale)
    if p == "cloud" and _hf_available():
        return await _hf_image(prompt, refs)
    if p == "local" and _comfy_available():
        return await _comfy_image(prompt, refs)
    if p == "hybrid" and _comfy_available() and _hf_available():
        # Local ComfyUI drafts fast off the UV (grounds the layout); the cloud
        # HF pass then refines that draft to full quality (img2img on the draft).
        try:
            draft = await _comfy_image(prompt, refs)
            return await _hf_image(prompt, [draft[0]["data_b64"]])
        except Exception:
            return await _hf_image(prompt, refs)
    # auto / fallback chain: ZeroGPU (Pony V6, H200) > cloud HF > local ComfyUI > OpenAI > Gemini.
    if _zerogpu_available():
        return await _zerogpu_texture(prompt, refs, init_b64=init_b64, strength=strength,
                                      ref_image_b64=ref_image_b64, ip_scale=ip_scale)
    if _hf_available():
        return await _hf_image(prompt, refs)
    if _comfy_available():
        return await _comfy_image(prompt, refs)
    if _use_openai():
        return await _oai_image(prompt, refs)
    chat = _new_image_chat()
    contents = [ImageContent(b) for b in refs] if refs else None
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


async def generate_variant(prompt: str, ref_b64s: List[str]) -> dict:
    """Reference-conditioned generation from one OR MORE reference images.
    Behaviour is driven by the user's prompt:
    - Character re-illustration: prompt naturally mentions the character
    - UV template repaint: prompt mentions "UV", "layout", "seams", "boundaries"
    We stay prompt-following and let the user drive intent. With multiple refs,
    the model is told to fuse their outfit/design elements coherently."""
    refs = [b for b in (ref_b64s or []) if b]
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
        multi = ""
        if len(refs) > 1:
            multi = (
                f" You are given {len(refs)} reference images — treat the first as the base "
                f"character and fuse the outfit, colors and design motifs from the others onto it, "
                f"combining them into one coherent look."
            )
        full = (
            f"Using the character in the provided reference image(s), redraw with this change: {prompt}.{multi} "
            f"Preserve face, hair color, eye color and outfit identity. Clean neutral background. {STYLE_TAIL}"
        )
    images = await _image_call(full, ref_b64s=refs)
    return {"prompt": full, "images": images}


# ---------- Outfit extractor: reference art -> structured garment breakdown ----------
OUTFIT_SYSTEM = (
    "You are an expert anime costume analyst. Given reference art of a character, identify every "
    "clothing and outfit item precisely. Respond ONLY with valid JSON, no prose, no markdown fences."
)


async def extract_outfit(ref_b64s: List[str], notes: str = "", provider: Optional[str] = None) -> dict:
    """Reference art -> structured outfit spec (garments, colors, materials, palette).
    Accepts multiple angles/refs of the same character for a fuller read."""
    refs = [b for b in (ref_b64s or []) if b]
    if not refs:
        raise RuntimeError("extract_outfit requires at least one reference image")
    schema = (
        'JSON shape: {"garments":[{"slot":"headwear|top|innerwear|outerwear|dress|bottom|'
        'legwear|footwear|gloves|accessory","name":"short name","primary_color":"#RRGGBB",'
        '"secondary_color":"#RRGGBB or null","material":"cotton|denim|silk|leather|knit|wool|'
        'lace|pleather|metal|other","pattern":"solid|stripes|plaid|floral|graphic|checkered|'
        'gradient|other","coverage":"where it sits on the body","details":"trims, logos, cuffs, '
        'buttons, etc"}],"palette":["#RRGGBB", ...up to 6],"style_summary":"one sentence",'
        '"wardrobe_theme":"a short theme phrase usable as a wardrobe generator prompt"}'
    )
    prompt = (
        f"Extract the complete outfit worn by this anime character. List every visible garment "
        f"as a separate entry, front to back, head to toe. Estimate colors as hex. {notes}. "
        f"Return {schema}"
    )
    result = await _vision_json(OUTFIT_SYSTEM, prompt, refs, provider=provider)
    # VL models sometimes return a bare list of garments, or nest it under a
    # different key — normalize to the {"garments":[...]} shape the UI expects.
    if isinstance(result, list):
        result = {"garments": result}
    elif isinstance(result, dict) and "garments" not in result:
        for k in ("items", "clothing", "outfit", "garment"):
            if isinstance(result.get(k), list):
                result = {**result, "garments": result[k]}
                break
    return result


def _parse_json_object(text: str) -> dict:
    """Pull the first JSON object out of a model response (tolerates fences/prose)."""
    if not text:
        raise RuntimeError("Model returned an empty response")
    cleaned = re.sub(r"^```(?:json)?|```$", "", text.strip(), flags=re.MULTILINE).strip()
    try:
        return json.loads(cleaned)
    except Exception:
        m = re.search(r"\{.*\}", cleaned, re.DOTALL)
        if m:
            return json.loads(m.group(0))
        raise RuntimeError(f"Could not parse JSON from model. Got: {text[:200]}")


# ---------- Goal 2: UV-fitted texture generation for a model material ----------
async def guard_texture(image_b64: str, region: str = "garment", provider: Optional[str] = None) -> dict:
    """Vision deviation guard: reject output that isn't a flat anime UV texture for
    the target region (a new character, a face/body, a scene, photorealism, text)."""
    prompt = (
        f"Judge this image strictly as a UV TEXTURE MAP for an anime VRM character's {region}. "
        'Return exactly {"ok":true|false,"deviation":"none|new_character|face_or_body|'
        'photorealistic|has_text|scene_or_background|wrong_region|not_anime|other","reason":"short"}. '
        "Set ok=false if it shows a whole character, a face or body, a scene/background, photorealism, "
        "a 3D render, any text/watermark/logo, or is otherwise not a flat anime cel-shaded texture for that region."
    )
    return await _vision_json(GUARD_SYSTEM, prompt, [image_b64], provider=provider)


def _hex_to_rgb(h: str):
    h = (h or "").strip().lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    if len(h) != 6:
        return None
    try:
        return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))
    except Exception:
        return None


def _flatten_atlas_for_init(atlas_b64: str, palette: Optional[str] = None,
                            tint_amount: Optional[float] = None, bg=(128, 128, 128)) -> str:
    """RGBA atlas -> RGB on neutral gray so the diffusion init has no black voids.
    If a palette is given, first RECOLOR the garment pixels toward the primary
    palette hue (preserving each pixel's brightness, so folds/shading survive) —
    low-denoise img2img barely changes hue on its own, so this is what actually
    makes a restyle recolour. Alpha region only. Returns base64 PNG."""
    import io
    from PIL import Image
    try:
        atlas = Image.open(io.BytesIO(base64.b64decode(atlas_b64))).convert("RGBA")
        rgb = atlas.convert("RGB")
        target = None
        if palette:
            for tok in str(palette).replace(",", " ").split():
                target = _hex_to_rgb(tok)
                if target:
                    break
        amt = tint_amount if tint_amount is not None else float(os.getenv("TEXTURE_TINT_AMOUNT", "0.7"))
        if target and amt > 0:
            try:
                import numpy as np
                arr = np.asarray(rgb, dtype=np.float32) / 255.0  # HxWx3
                # Shading-multiply recolor: use the original's luminance as a
                # shading map and paint the TARGET colour onto it, normalised so
                # bright fabric lands on the full target (deep colours read deep,
                # not pastel) while folds stay darker. Reference = the atlas's own
                # bright-fabric level among garment (alpha>0) pixels.
                lum = arr[..., 0] * 0.299 + arr[..., 1] * 0.587 + arr[..., 2] * 0.114
                a_mask = np.asarray(atlas.getchannel("A"), dtype=np.float32) / 255.0
                garment = lum[a_mask > 0.03]
                ref = float(np.percentile(garment, 80)) if garment.size else 0.8
                ref = max(ref, 0.35)
                factor = np.clip(lum / ref, 0.0, 1.2)[..., None]
                tgt = np.asarray(target, dtype=np.float32) / 255.0
                tinted = np.clip(tgt[None, None, :] * factor, 0.0, 1.0)
                blended = arr * (1 - amt) + tinted * amt
                rgb = Image.fromarray((np.clip(blended, 0, 1) * 255).astype("uint8"), "RGB")
            except Exception:
                pass
        canvas = Image.new("RGB", atlas.size, bg)
        canvas.paste(rgb, (0, 0), atlas.getchannel("A"))
        out = io.BytesIO(); canvas.save(out, "PNG")
        return base64.b64encode(out.getvalue()).decode()
    except Exception:
        return atlas_b64


def _reapply_alpha(image_dict: dict, atlas_b64: str) -> dict:
    """Composite the ORIGINAL atlas's alpha channel back onto the (RGB) diffusion
    output. SDXL has no alpha, so without this the transparent UV void fills with
    stray fabric and the garment renders where it shouldn't. Keeps the exact
    empty regions the model UV expects."""
    import io
    from PIL import Image
    try:
        atlas = Image.open(io.BytesIO(base64.b64decode(atlas_b64))).convert("RGBA")
        alpha = atlas.getchannel("A")
        gen = Image.open(io.BytesIO(base64.b64decode(image_dict["data_b64"]))).convert("RGB")
        if gen.size != atlas.size:
            gen = gen.resize(atlas.size, Image.Resampling.LANCZOS)
        rgba = gen.convert("RGBA")
        rgba.putalpha(alpha)
        out = io.BytesIO(); rgba.save(out, "PNG")
        raw = out.getvalue()
        b64 = base64.b64encode(raw).decode()
        return {"data_b64": b64, "mime_type": "image/png", "size_bytes": len(raw)}
    except Exception:
        return image_dict


async def generate_material_texture(uv_template_b64: Optional[str], garment_ref_b64: Optional[str] = None,
                                    region: str = "garment", description: str = "",
                                    palette: Optional[str] = None, guard: bool = True,
                                    provider: Optional[str] = None,
                                    original_atlas_b64: Optional[str] = None,
                                    strength: Optional[float] = None,
                                    mode: str = "restyle") -> dict:
    """Paint an anime UV texture for ONE model material.

    Two UV-safe paths, both seeded off the material's ORIGINAL diffuse atlas
    (`original_atlas_b64`), with the original alpha re-composited after so the
    empty UV void stays empty:

    * mode="restyle" (default): LOW-denoise img2img — every panel stays locked
      in its exact UV island while only fabric colour/material/pattern shifts.
      Subtle by design; the palette tint does the recolouring.
    * mode="bold": HIGH-denoise img2img + canny ControlNet locked to the panel
      edges (derived from the atlas ALPHA, not RGB noise) — paints genuinely
      new fabric/pattern while the structure lock keeps it on the UV islands
      (direct-tested: strength 0.75 held every panel). ZeroGPU only; falls
      back to restyle when the Space is unavailable.

    Falls back to the old UV-template path when the material has no base texture.
    Optionally vision-guarded, retrying once if the result deviates.
    """
    palette_hint = f" Use approximately this palette: {palette}." if palette else ""
    restyle = original_atlas_b64 is not None
    bold = restyle and (mode or "").lower() == "bold" and _zerogpu_available()

    if restyle:
        # Layout comes from the atlas init; style comes from the prompt. Pony
        # (SDXL img2img) can't fuse a second reference image, so the garment's
        # look is conveyed as text, not as an extra ref.
        # Pre-tint the atlas toward the target palette (low-denoise img2img barely
        # shifts hue on its own), then Pony refines the fabric on top.
        init_b64 = _flatten_atlas_for_init(original_atlas_b64, palette=palette)
        if bold:
            # Structure comes from the ControlNet edges, so the prompt is free to
            # ask for a genuinely new fabric — no "keep everything" hedging, which
            # at high denoise just weakens the repaint.
            denoise = strength if strength is not None else float(os.getenv("TEXTURE_BOLD_STRENGTH", "0.75"))
            base = (
                f"Repaint this anime {region} UV texture atlas with a bold new fabric design. It is a flat "
                f"garment texture laid out in fixed UV panels — paint strictly inside the existing panel "
                f"outlines and keep the empty margins empty. Paint rich, detailed new fabric: "
                f"{description or region}.{palette_hint}"
            )
        else:
            # Low denoise: the tint already recolours, so Pony only adds light anime
            # polish. Higher values make Pony reinvent the fabric (quilting/frills).
            denoise = strength if strength is not None else float(os.getenv("TEXTURE_RESTYLE_STRENGTH", "0.32"))
            base = (
                f"Restyle this existing anime {region} UV texture atlas. It is a flat garment texture "
                f"laid out in fixed UV panels on a plain background. Keep the EXACT same panel shapes, seam "
                f"positions, layout, proportions and framing — do not move, add, merge or remove any panel, "
                f"and do not paint over the empty margins. Only change the fabric's colour, material and pattern. "
                f"Target: {description or region}.{palette_hint}"
            )
        refs: List[str] = []
    else:
        # No base texture: fall back to the UV-template + garment path (higher denoise).
        init_b64 = None
        denoise = strength if strength is not None else float(os.getenv("ZEROGPU_STRENGTH", "0.72"))
        refs = [b for b in (uv_template_b64, garment_ref_b64) if b]
        base = (
            f"Paint the {region} UV texture for an anime VRM character as a flat panel atlas. "
            + ("The FIRST reference image is the UV / seam layout — repaint every region strictly inside its "
               "seams, keeping the exact boundaries, aspect and framing. " if uv_template_b64 else "")
            + ("The other reference is the TARGET garment — reproduce its colours, pattern and material as a "
               "flat texture (never copy any character wearing it). " if garment_ref_b64 else "")
            + f"Target design: {description or region}.{palette_hint}"
        )

    prompt = base + TEXTURE_GUARD
    # The garment reference image conditions the fabric look via IP-Adapter (on
    # top of the atlas restyle), so the result matches the real garment — not just
    # the text description. Only when restyling (the atlas provides the layout).
    ip_ref = garment_ref_b64 if (restyle and garment_ref_b64) else None
    # Bold mode's structure lock: panel edges from the atlas alpha (computed once;
    # "" lets the Space fall back to its own canny-of-init).
    control_b64 = _panel_edge_control(original_atlas_b64) if bold else ""

    async def _gen(p: str) -> List[dict]:
        if bold:
            try:
                return await _zerogpu_texture_cn(p, init_b64, control_b64, strength=denoise)
            except Exception as e:
                logger.warning("ZeroGPU texture_cn failed, falling back to plain restyle: %s", e)
        return await _image_call(p, ref_b64s=refs, provider=provider,
                                 init_b64=init_b64, strength=denoise,
                                 ref_image_b64=ip_ref)

    images = await _gen(prompt)
    if restyle and images:
        images[0] = _reapply_alpha(images[0], original_atlas_b64)

    verdict = None
    if guard and images:
        try:
            verdict = await guard_texture(images[0]["data_b64"], region=region, provider=provider)
        except Exception as e:
            verdict = {"ok": True, "deviation": "none", "reason": f"guard skipped: {e}"}
        if verdict and verdict.get("ok") is False:
            # One corrective retry with the deviation called out explicitly.
            retry = (base + f" The previous attempt failed QA ({verdict.get('deviation')}): "
                     f"{verdict.get('reason','')}. Fix it." + TEXTURE_GUARD)
            images = await _gen(retry)
            if restyle and images:
                images[0] = _reapply_alpha(images[0], original_atlas_b64)
            try:
                verdict = await guard_texture(images[0]["data_b64"], region=region, provider=provider)
            except Exception:
                pass
    return {"prompt": prompt, "images": images, "region": region, "guard": verdict,
            "restyle": restyle, "mode": "bold" if bold else ("restyle" if restyle else "template")}


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
