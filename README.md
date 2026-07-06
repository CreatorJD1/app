# VRoid Companion Studio

An **anime-only** 3D character creator assistant built around VRM files.

![status](https://img.shields.io/badge/status-mvp-brightgreen)

## What it does

- **Runtime VRM viewer** with orbit controls, procedural lighting, transparent bg
- **Animation library** — Idle, Idle-soft, Wave, Cheer, Bow, Thinking, Peace Sign, Hands on Hips, Dance, K-Pop, Walk, Run, Jump, Sit, Custom keyframe timeline
- **Anatomy-safe pose editor** — bone rotation sliders clamped to plausible ranges (toggle to unlock)
- **Expression control** — sliders for all VRM morph targets + auto-blink + look-at-mouse
- **Texture Studio (Gemini Nano Banana):**
  - Prompt-based textures (cloth / hair / skin / eye / pattern)
  - **Wardrobe** — automated coordinated outfit (tops + bottoms + shoes + outerwear)
  - **Accessories** — hair, earring, necklace, glasses, tail, wings
  - Reference-to-anime-variant (image-to-image)
  - **8K progressive upscale** on any generated asset
- **Reference Studio** — anime concept art + 4-angle character turnaround
- **Character Analyzer** — reference art → structured VRoid Studio parameter recipe (Gemini vision)
- **VRoid Hub bridge** — URL import + REST-compatible port of the Unity SDK's OAuth + API surface
- **HQ Poly Subdivision** — Loop subdivision for higher-poly render fidelity
- **Projects** — save VRM + generated assets + material assignments in MongoDB

## Quick start

See [DEPLOY.md](DEPLOY.md) for full instructions (Hugging Face Space, Cloudflare, Docker Compose, local dev).

```bash
docker compose up --build
# app at http://localhost:7860
```

## Architecture

```
/backend    FastAPI + Motor (MongoDB async) + Gemini image + text
/frontend   React + Three.js + @pixiv/three-vrm + shadcn/ui + Zustand
/scripts    POC test scripts (see poc_nano_banana.py)
```

## Screenshots

_See `docs/screenshots/` after generating your own with the Screenshot tool in Studio._

## VRoid Unity SDK

The official VRoid SDK is a Unity C# package. This backend ports the SDK's REST wire protocol so a **forked** SDK can talk to this backend as if it were `hub.vroid.com`. See [DEPLOY.md](DEPLOY.md#vroid-unity-sdk-compatibility).

## License

MIT.
