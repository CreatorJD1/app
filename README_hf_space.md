---
title: VRoid Companion Studio
emoji: 🎨
colorFrom: purple
colorTo: pink
sdk: docker
app_port: 7860
pinned: true
license: mit
---

# VRoid Companion Studio — Hugging Face Space

Anime-only VRM 3D character creator app. Loads .vrm files, drives runtime animations, generates textures / wardrobe / accessories with Gemini Nano Banana, analyzes reference art into VRoid Studio recipes.

## Required Secrets (Space Settings → Repository secrets)

| Name | Value |
| ---- | ----- |
| `EMERGENT_LLM_KEY` | Gemini/OpenAI/Anthropic key (Emergent universal) |
| `MONGO_URL` | mongodb+srv://... (MongoDB Atlas free tier works) |
| `DB_NAME` | e.g. `vroid_companion` |
| `VROID_CLIENT_ID` | (optional) VRoid Hub OAuth app client id |
| `VROID_CLIENT_SECRET` | (optional) VRoid Hub OAuth app client secret |

## Persistent storage

Add a persistent disk from the Space settings (or use the free ephemeral one). The backend stores uploaded VRMs in `/app/backend/storage/vrm/` — mount a persistent path there if you need permanence beyond the container.

Alternatively, use a Hugging Face Dataset as blob storage: create a dataset repo, then set `HF_DATASET_REPO=your-user/vroid-companion-storage` and `HF_TOKEN=...` — see `backend/hf_dataset_storage.py` for the optional adapter.

## Build

The repo root Dockerfile builds the React frontend and serves it plus the FastAPI backend from a single container on port 7860. Just push and HF will build it.
