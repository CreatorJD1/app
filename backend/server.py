from fastapi import FastAPI
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ.get("MONGO_URL", "memory").strip()
if mongo_url.lower() in ("", "memory", "mock", "embedded"):
    # Local Claude Code port: no MongoDB/Docker installed on this machine, so
    # use an in-memory async Mongo (mongomock-motor) and the whole backend runs
    # offline. Set MONGO_URL to a real mongodb:// URI for cross-restart
    # persistence (e.g. after installing MongoDB locally).
    from mongomock_motor import AsyncMongoMockClient
    client = AsyncMongoMockClient()
    logging.getLogger("vcs").info("DB: embedded in-memory (mongomock-motor); set MONGO_URL for persistence")
else:
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
