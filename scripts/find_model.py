"""Probe which image-capable Gemini model is available via Emergent key."""
import asyncio, os, base64
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(dotenv_path=Path(__file__).resolve().parent.parent / "backend" / ".env")
from emergentintegrations.llm.chat import LlmChat, UserMessage

CANDIDATES = [
    "gemini-2.5-flash-image-preview",
    "gemini-3.1-flash-image-preview",
    "gemini-3-pro-image-preview",
    "gemini-2.0-flash-preview-image-generation",
    "gemini-2.0-flash-exp-image-generation",
    "gemini-2.5-flash-image",
    "gemini-2.5-flash-preview-image-generation",
]

async def try_model(model_id: str):
    key = os.getenv("EMERGENT_LLM_KEY")
    try:
        chat = LlmChat(api_key=key, session_id=f"probe-{model_id}", system_message="test")
        chat.with_model("gemini", model_id).with_params(modalities=["image", "text"])
        text, images = await chat.send_message_multimodal_response(
            UserMessage(text="A tiny simple red circle on white background, anime cel-shaded.")
        )
        n = len(images) if images else 0
        return f"OK   [{model_id}] images={n}"
    except Exception as e:
        msg = str(e)
        if len(msg) > 160: msg = msg[:160]
        return f"FAIL [{model_id}] {msg}"

async def main():
    for m in CANDIDATES:
        print(await try_model(m))

if __name__ == "__main__":
    asyncio.run(main())
