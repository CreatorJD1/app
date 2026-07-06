"""
POC: Anime-only image generation using Gemini Nano Banana.
Tests three workflows for the VRoid Studio companion app:
  1) text-to-image: anime-style texture (seamless material)
  2) image-to-image: reference-to-anime-styled variant
  3) turnaround sheet: 4-angle character sheet (front / 3-4 / side / back)
"""

import asyncio
import base64
import json
import os
import sys
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(dotenv_path=Path(__file__).resolve().parent.parent / "backend" / ".env")

from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent  # noqa: E402

OUT_DIR = Path(__file__).resolve().parent / "poc_output"
OUT_DIR.mkdir(parents=True, exist_ok=True)

MODEL_ID = "gemini-3.1-flash-image-preview"  # Nano Banana

# Short positive-only system message. Image models react badly to long / negative style briefs.
STYLE_SYSTEM = "You generate high quality anime style illustrations for a VRoid Studio companion app."

STYLE_TAIL = (
    "Style: modern Japanese anime, cel-shaded, clean lineart, expressive VTuber character art, "
    "high quality VRoid aesthetic, vibrant flat colors, soft rim light."
)


def _valid_img(path: Path) -> bool:
    try:
        with open(path, "rb") as f:
            head = f.read(8)
        is_png = head.startswith(b"\x89PNG\r\n\x1a\n")
        is_jpg = head[:3] == b"\xff\xd8\xff"
        return (is_png or is_jpg) and path.stat().st_size > 5_000
    except Exception:
        return False


def _new_chat() -> LlmChat:
    api_key = os.getenv("EMERGENT_LLM_KEY")
    if not api_key:
        raise RuntimeError("EMERGENT_LLM_KEY missing in environment")
    chat = LlmChat(
        api_key=api_key,
        session_id=f"poc-{uuid.uuid4()}",
        system_message=STYLE_SYSTEM,
    )
    chat.with_model("gemini", MODEL_ID).with_params(modalities=["image", "text"])
    return chat


async def _save_first_image(images, out_path: Path):
    if not images:
        return None
    img = images[0]
    data = base64.b64decode(img["data"])
    # Adjust extension to actual format
    if data[:3] == b"\xff\xd8\xff" and out_path.suffix.lower() != ".jpg":
        out_path = out_path.with_suffix(".jpg")
    elif data[:8].startswith(b"\x89PNG\r\n\x1a\n") and out_path.suffix.lower() != ".png":
        out_path = out_path.with_suffix(".png")
    out_path.write_bytes(data)
    return out_path if _valid_img(out_path) else None


async def _call(prompt: str, ref_b64: str | None = None):
    chat = _new_chat()
    contents = [ImageContent(ref_b64)] if ref_b64 else None
    msg = UserMessage(text=prompt, file_contents=contents)
    return await chat.send_message_multimodal_response(msg)


async def test_text_to_texture(manifest: dict) -> bool:
    print("\n[1/3] TEXT-TO-IMAGE: anime texture...")
    prompt = (
        "A seamless tileable anime clothing fabric texture, pastel pink and lavender palette, "
        "small cherry blossom motif, square format. " + STYLE_TAIL
    )
    try:
        text, images = await _call(prompt)
        out = OUT_DIR / "01_texture_anime.png"
        saved = await _save_first_image(images, out)
        ok = saved is not None
        manifest["text_to_texture"] = {
            "prompt": prompt,
            "ok": ok,
            "file": str(out) if ok else None,
            "images_count": len(images) if images else 0,
            "text_preview": (text or "")[:200],
        }
        print(f"    -> {'OK' if ok else 'FAIL'} ({out}) images={len(images) if images else 0} text={(text or '')[:100]!r}")
        return ok
    except Exception as e:
        print(f"    -> EXCEPTION: {e}")
        manifest["text_to_texture"] = {"ok": False, "error": str(e), "prompt": prompt}
        return False


async def test_image_to_variant(manifest: dict) -> bool:
    print("\n[2/3] IMAGE-TO-IMAGE: reference -> anime variant...")
    ref_prompt = (
        "A front-facing anime portrait of a young female character with long silver hair, "
        "purple eyes, wearing a school uniform, plain white background. " + STYLE_TAIL
    )
    try:
        text_ref, ref_images = await _call(ref_prompt)
        ref_path = OUT_DIR / "02a_reference.png"
        saved_ref = await _save_first_image(ref_images, ref_path)
        if saved_ref:
            ref_path = saved_ref  # actual path with correct extension
    except Exception as e:
        print(f"    -> reference EXCEPTION: {e}")
        manifest["image_to_variant"] = {"ok": False, "error": str(e)}
        return False

    if not saved_ref:
        print(f"    -> reference generation FAILED (images={len(ref_images) if ref_images else 0} text={(text_ref or '')[:100]!r})")
        manifest["image_to_variant"] = {"ok": False, "error": "reference gen failed", "ref_text": (text_ref or "")[:200]}
        return False

    with open(ref_path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("utf-8")

    variant_prompt = (
        "Using the character in the provided reference image, redraw them in a full body 3/4 view "
        "waving happily. Keep the same silver hair, purple eyes, and school uniform. "
        "Clean white background. " + STYLE_TAIL
    )
    try:
        text_var, var_images = await _call(variant_prompt, ref_b64=b64)
        out = OUT_DIR / "02b_variant.png"
        saved = await _save_first_image(var_images, out)
        ok = saved is not None
        manifest["image_to_variant"] = {
            "ok": ok,
            "reference": str(ref_path),
            "variant": str(out) if ok else None,
            "ref_prompt": ref_prompt,
            "variant_prompt": variant_prompt,
            "var_text_preview": (text_var or "")[:200],
            "var_images_count": len(var_images) if var_images else 0,
        }
        print(f"    -> {'OK' if ok else 'FAIL'} ({out})")
        return ok
    except Exception as e:
        print(f"    -> variant EXCEPTION: {e}")
        manifest["image_to_variant"] = {"ok": False, "error": str(e)}
        return False


async def test_turnaround(manifest: dict) -> bool:
    print("\n[3/3] TURNAROUND SHEET: 4 angles of one character...")
    base_desc = (
        "an anime girl character with short pink hair and white streaks, teal eyes, "
        "a sci-fi hoodie with glowing seams, black shorts, and sneakers, in a T-pose"
    )
    angles = [
        ("front", "front view, facing the camera directly"),
        ("three_quarter", "3/4 view turned slightly to the left"),
        ("side", "full side profile view facing right"),
        ("back", "back view showing hair and hoodie details"),
    ]
    saved_paths = []
    for i, (label, angle) in enumerate(angles):
        prompt = (
            f"A character reference model sheet illustration of {base_desc}, "
            f"{angle}, plain neutral gray background, no ground shadow. " + STYLE_TAIL
        )
        try:
            text, images = await _call(prompt)
            out = OUT_DIR / f"03_turnaround_{i}_{label}.png"
            saved = await _save_first_image(images, out)
            if saved:
                saved_paths.append(str(out))
                print(f"    [{i+1}/4] {label} -> OK")
            else:
                print(f"    [{i+1}/4] {label} -> FAIL images={len(images) if images else 0} text={(text or '')[:80]!r}")
        except Exception as e:
            print(f"    [{i+1}/4] {label} -> EXCEPTION: {e}")

    ok = len(saved_paths) >= 3
    manifest["turnaround"] = {
        "ok": ok,
        "count": len(saved_paths),
        "files": saved_paths,
        "base_desc": base_desc,
    }
    print(f"    -> {'OK' if ok else 'FAIL'} ({len(saved_paths)}/4)")
    return ok


async def main():
    started = time.time()
    manifest = {
        "started_at": datetime.now(timezone.utc).isoformat(),
        "model": MODEL_ID,
    }

    results = [
        await test_text_to_texture(manifest),
        await test_image_to_variant(manifest),
        await test_turnaround(manifest),
    ]

    manifest["duration_s"] = round(time.time() - started, 1)
    manifest["all_ok"] = all(results)
    (OUT_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2))

    print("\n============================================")
    print(f"POC RESULT: {'ALL OK' if all(results) else 'FAILED'}")
    print(f"Details -> {OUT_DIR/'manifest.json'}")
    print("============================================")
    sys.exit(0 if all(results) else 1)


if __name__ == "__main__":
    asyncio.run(main())
