# Running VRoid Companion Studio (VCS) locally in Claude Code

This is Jason's Emergent-built VCS, ported to run on this machine (Windows,
Python 3.12, Node). Cloned from `github.com/CreatorJD1/app@main` into `apps/vcs`.

## Start it (two terminals)

**Backend** (FastAPI, port 8001):
```powershell
cd apps\vcs\backend
..\.venv\Scripts\python.exe -m uvicorn server:app --host 127.0.0.1 --port 8001
```

**Frontend** (React/craco, port 3200):
```powershell
cd apps\vcs\frontend
npm start
```
Open http://localhost:3200 and Import a `.vrm` (e.g.
`data/avatar/vrm/alpecca_vroid_proxy_v0_first_test_20260706.vrm`).

## What was changed to make it run here (env adaptations only)

- `frontend/.env` — `REACT_APP_BACKEND_URL=http://localhost:8001`, `PORT=3200`.
- Pinned `ajv@8` in the frontend (CRA/Node-24 `ajv/dist/compile/codegen` break).
- `frontend/src/components/EmptyViewport.jsx` — VRM renders from a local blob URL
  first; backend persistence is best-effort (studio works with or without backend).
- `backend/server.py` — DB init falls back to an embedded in-memory Mongo
  (`mongomock-motor`) when `MONGO_URL` is `memory`; otherwise uses the real URI.
- `backend/.env` — `MONGO_URL=mongodb://localhost:27017` (local MongoDB 8.3
  service), `DB_NAME=vroid_companion`, `CORS_ORIGINS=*`, and `EMERGENT_LLM_KEY`.
- Isolated venv `apps/vcs/.venv` (does not touch the Alpecca Python env).

## Services

- **MongoDB 8.3** runs as a Windows service (auto-starts), listening on `:27017`.
  Data persists across backend restarts. Set `MONGO_URL=memory` in `backend/.env`
  to use the ephemeral in-memory store instead.
- **AI features** (Texture Studio, Character Analyzer, Wardrobe, Reference) use
  `emergentintegrations` (Emergent's Gemini wrapper) and require
  `EMERGENT_LLM_KEY` in `backend/.env` (git-ignored). The key is Emergent's
  universal key from the Emergent dashboard; it is injected server-side in the
  hosted app and is NOT committed to the repo.

## Notes

- `apps/vcs` keeps its own `.git` (origin `CreatorJD1/app`) and is excluded from
  the outer Alpecca repo via `.git/info/exclude`.
- Per CLAUDE.md the VRoid/VRM path is experimental and must not replace the
  2D/House HQ pipeline.
