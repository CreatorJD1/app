from fastapi import FastAPI, Request
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from starlette.responses import HTMLResponse, JSONResponse
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get("DB_NAME", "vroid_companion")]

app = FastAPI(title="VRoid Companion Studio", version="1.0.0")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("vcs.server")

from routes import router as api_router, init as init_routes  # noqa: E402
from vroid_hub import router as hub_router, init as init_hub  # noqa: E402

init_routes(db)
init_hub(db)
app.include_router(api_router)
app.include_router(hub_router)

# --- Access control (cloud hosting) ------------------------------------------
# When VCS_ACCESS_TOKEN is set, every request must carry the token -- as a
# ?token= query, an X-VCS-Token header, or the vcs_token cookie that a first
# ?token= visit drops. When it's blank (the default) there is no gate at all,
# so local dev and private deployments stay frictionless. Registered BEFORE the
# CORS middleware below on purpose: Starlette wraps last-added outermost, so
# CORS answers preflights without auth and 401s still carry CORS headers.
#
# Notes on the shape of this gate:
# - No localhost bypass: tunnel traffic (cloudflared/ngrok) arrives FROM
#   localhost, so a bypass would be a hole in exactly the deployments that
#   need the token.
# - The VRoid Hub OAuth callback stays gated too, and that's fine: hub.vroid.com
#   redirects the browser back with a top-level GET navigation, and samesite=lax
#   cookies ride those -- the browser that started the login already holds the
#   cookie.
# - /health is exempt so uptime probes and platform health checks never need
#   credentials (and leak nothing).
ACCESS_TOKEN = os.environ.get("VCS_ACCESS_TOKEN", "")

_LOGIN_HTML = """<!doctype html><meta name=viewport content="width=device-width,initial-scale=1">
<title>VRoid Companion Studio - access</title>
<body style="margin:0;height:100vh;display:flex;align-items:center;justify-content:center;background:#0b0e14;color:#e6e9f2;font-family:system-ui,sans-serif">
<form onsubmit="location='/?token='+encodeURIComponent(document.getElementById('t').value);return false"
 style="background:rgba(17,21,32,.8);padding:28px 26px;border-radius:14px;border:1px solid #262d40;text-align:center;max-width:340px">
  <div style="font-size:20px;font-weight:650;margin-bottom:6px">VRoid Companion Studio</div>
  <div style="color:#9aa4bf;font-size:13px;margin-bottom:16px">Enter the access token to open the studio.</div>
  <input id=t autofocus placeholder="access token" style="width:100%;box-sizing:border-box;padding:10px;border-radius:9px;border:1px solid #2c3652;background:#141927;color:#e6e9f2">
  <button style="margin-top:12px;width:100%;padding:10px;border:0;border-radius:9px;background:#8b7cf8;color:#0b0e14;font-weight:600;cursor:pointer">Enter</button>
</form></body>"""


def token_ok(query, headers, cookies) -> bool:
    """Whether a request carries the right token. With no token configured the
    gate is open (local / private use)."""
    if not ACCESS_TOKEN:
        return True
    tok = (query.get("token") or headers.get("X-VCS-Token")
           or cookies.get("vcs_token"))
    return tok == ACCESS_TOKEN


@app.middleware("http")
async def _auth_gate(request: Request, call_next):
    if request.method == "OPTIONS" or request.url.path == "/health":
        return await call_next(request)
    if not token_ok(request.query_params, request.headers, request.cookies):
        # A browser navigation gets a friendly token prompt; anything else 401s.
        if request.method == "GET" and "text/html" in request.headers.get("accept", ""):
            return HTMLResponse(_LOGIN_HTML, status_code=401)
        return JSONResponse({"detail": "access token required"}, status_code=401)
    resp = await call_next(request)
    # A valid ?token= visit drops a cookie so the SPA's later fetches carry it
    # automatically, without the token living in every URL.
    tok = request.query_params.get("token")
    if ACCESS_TOKEN and tok == ACCESS_TOKEN:
        resp.set_cookie("vcs_token", tok, max_age=60 * 60 * 24 * 30, samesite="lax")
    return resp


@app.get("/health")
async def health():
    """Always-open liveness probe (Hugging Face Spaces, uptime monitors)."""
    return {"ok": True}


app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_event():
    logger.info("VRoid Companion Studio API started (db=%s)", db.name)
    await db.projects.create_index("id", unique=True)
    await db.assets.create_index("id", unique=True)
    await db.assets.create_index("project_id")
    await db.assets.create_index("kind")


@app.on_event("shutdown")
async def shutdown_event():
    client.close()
