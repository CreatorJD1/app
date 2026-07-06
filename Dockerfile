# Multi-stage build: react frontend + fastapi backend served together
FROM node:20-alpine AS frontend
WORKDIR /fe
COPY frontend/package.json frontend/yarn.lock ./
RUN yarn install --frozen-lockfile
COPY frontend/ ./
# Point built frontend at the same origin as the API
ENV REACT_APP_BACKEND_URL=
RUN yarn build

FROM python:3.11-slim AS runtime
WORKDIR /app
ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=7860

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
      curl ca-certificates build-essential && \
    rm -rf /var/lib/apt/lists/*

COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install -r backend/requirements.txt httpx

# Copy backend source
COPY backend/ ./backend/
# Copy compiled frontend
COPY --from=frontend /fe/build ./frontend_build

# Entrypoint
COPY <<'PY' /app/entrypoint.py
import os, uvicorn
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from starlette.middleware.base import BaseHTTPMiddleware
import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parent / "backend"))

from server import app

BUILD_DIR = pathlib.Path("/app/frontend_build")
app.mount("/static", StaticFiles(directory=BUILD_DIR / "static"), name="static")

@app.get("/")
async def index():
    return FileResponse(BUILD_DIR / "index.html")

@app.get("/{path:path}")
async def spa_fallback(path: str):
    fp = BUILD_DIR / path
    if fp.exists() and fp.is_file():
        return FileResponse(fp)
    return FileResponse(BUILD_DIR / "index.html")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.environ.get("PORT", "7860")))
PY

EXPOSE 7860
CMD ["python", "/app/entrypoint.py"]
