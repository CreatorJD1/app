# VRoid Companion Studio — Deployment Guide

Anime-only VRM 3D character creator, powered by Gemini Nano Banana.

This guide covers **three persistent-host options** (choose one) plus how to make the app **compatible with the VRoid Unity SDK**.

---

## Option A. Hugging Face Spaces (recommended, free tier available)

1. Create a HuggingFace account and a new **Space** with SDK = **Docker**
2. In the Space settings, add secrets:
   - `EMERGENT_LLM_KEY` (your Emergent universal key)
   - `MONGO_URL` (use a free MongoDB Atlas cluster: https://www.mongodb.com/cloud/atlas/register)
   - `DB_NAME` = `vroid_companion`
   - Optional: `VROID_CLIENT_ID`, `VROID_CLIENT_SECRET` (for VRoid Hub OAuth)
   - Optional: `HF_TOKEN`, `HF_DATASET_REPO` (to persist uploaded VRMs into a HF Dataset)
3. Push this repo to the Space (add HF remote, push). HF will build the Dockerfile automatically.
4. Your app will be live at `https://<your-user>-<space-name>.hf.space`.

Notes:
- The Dockerfile builds the React frontend into `/app/frontend_build/` and serves it from the same FastAPI process on port 7860.
- Free-tier CPU Spaces are enough — image generation runs on Gemini's side, not locally.
- For VRM file persistence across container restarts, use the HF Dataset adapter (`backend/hf_dataset_storage.py`).

---

## Option B. Cloudflare Pages (frontend) + Cloudflare Workers/Tunnel (backend)

Cloudflare's edge doesn't run our Python/Mongo backend natively. Two workable patterns:

### B1. Pages + separate backend (Railway/Fly.io/Render)
1. Deploy the FastAPI backend to Railway/Fly/Render (they support Docker easily).
2. `frontend/`:
   ```bash
   yarn build
   ```
   Deploy the `build/` folder via Cloudflare Pages (connect GitHub repo, build command `yarn build`, output `build`).
3. In Cloudflare Pages settings, set env var `REACT_APP_BACKEND_URL` = your backend's URL.

### B2. Home lab + Cloudflare Tunnel
1. Run the app on any machine (`docker compose up` — see `docker-compose.yml`).
2. Install `cloudflared` and run:
   ```bash
   cloudflared tunnel --url http://localhost:7860
   ```
3. You'll get a public URL like `https://<random>.trycloudflare.com`.
4. For a stable URL, register a Cloudflare Tunnel bound to your domain.

---

## Option C. Google Colab (development/demo only)

Colab is not a persistent host — sessions die after ~12h. Good for demos.

1. Open `notebooks/colab_run.ipynb` in Colab.
2. It clones the repo, installs deps, starts uvicorn on port 7860, and opens a Cloudflare/ngrok tunnel.
3. Public URL prints in the last cell.

---

## VRoid Unity SDK Compatibility

The official VRoid SDK (v0.5.2) is a Unity C# package that speaks OAuth 2 + REST against `hub.vroid.com`. **Our backend already implements the same wire protocol** (see `backend/vroid_hub_client.py` + `backend/vroid_hub.py`).

To point a **forked** VRoid SDK at your backend instead of `hub.vroid.com`:

1. Fork the SDK.
2. Search-replace the base URL: replace all `https://hub.vroid.com` with `https://<your-backend-host>` (e.g. your HF Space URL).
3. Register an OAuth application on your backend (env vars `VROID_CLIENT_ID` / `VROID_CLIENT_SECRET`). Alternatively call `/api/vroid_hub/help` for setup instructions.
4. Rebuild the SDK in Unity. The SDK will now authenticate + fetch character models through your backend, using the same endpoints (`/oauth/token`, `/api/v1/account`, `/api/v1/character_models`, etc.).

Supported SDK endpoints (all under `/api/vroid_hub/*` on this backend):

| SDK call | This backend |
| -------- | ------------ |
| `Client.Login` (auth-code) | `POST /api/vroid_hub/login/start` + `GET /api/vroid_hub/login/callback` |
| `Client.LoginWithDeviceFlow` | `POST /api/vroid_hub/login/device` + `POST /api/vroid_hub/login/device/poll` |
| `Client.RefreshToken` | automatic on any REST call (see `vroid_hub_client.ensure_valid_client`) |
| `DefaultApi.GetAccount` | `GET /api/vroid_hub/account` |
| `DefaultApi.GetCharacterModels` | `GET /api/vroid_hub/character_models` |
| `DefaultApi.GetCharacterModel(id)` | `GET /api/vroid_hub/character_models/{id}` |
| `DefaultApi.PostCharacterModelDownloadLicense` | `POST /api/vroid_hub/character_models/{id}/import` (downloads VRM into a project) |

Caveat: our backend is a proxy — VRoid Hub still hosts the actual character catalog. Users authorizing through the forked SDK will be redirected to `hub.vroid.com` for the login page (since we don't own their character data). The forked SDK receives the same access tokens and can then use our backend's proxy endpoints, which relay to VRoid Hub with proper auth. If you want a fully self-hosted VRoid catalog, that's out of scope — VRoid Hub's content is not redistributable.

---

## GitHub push

From inside Emergent:
1. Click your profile icon → **Connect GitHub** (first time only).
2. Click the **Save to GitHub** button in the chat toolbar.
3. Pick a repo (public or private) + branch, then **Push to GitHub**.

Subsequent pushes go to the same repo. Save to GitHub requires an Emergent paid plan.

---

## Local development

```bash
# backend
cd backend && pip install -r requirements.txt httpx && \
  MONGO_URL=mongodb://localhost:27017 DB_NAME=vroid_companion EMERGENT_LLM_KEY=... \
  uvicorn server:app --reload --port 8001

# frontend
cd frontend && yarn && REACT_APP_BACKEND_URL=http://localhost:8001 yarn start
```
