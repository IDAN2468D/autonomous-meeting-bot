from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.api.routes_auth import router as auth_router
from app.api.routes_features import router as features_router
from app.api.routes_personas import router as personas_router
from app.api.routes_sessions import router as sessions_router
from app.api.ws_meeting import router as ws_router
from app.core.config import settings
from app.core.database import close_mongo_connection, connect_to_mongo
from app.core.errors import register_exception_handlers
from app.services.kafka_service import kafka_service
from app.services.llm_service import llm_service


@asynccontextmanager
async def lifespan(_: FastAPI):
    await connect_to_mongo()
    await kafka_service.start()
    yield
    await kafka_service.stop()
    await close_mongo_connection()


app = FastAPI(
    title="Autonomous Meeting Bot API",
    description=(
        "Production-Ready Autonomous Meeting Bot Backend — FastAPI Async, "
        "Multi-LLM (Gemini/OpenAI/Demo), ChromaDB RAG, Long-Term Memory, "
        "Guardrails, Human-in-the-Loop, Kafka Event Streaming, JWT Auth & Real-Time WebRTC Avatar Streaming."
    ),
    version="2.1.0",
    lifespan=lifespan,
)

register_exception_handlers(app)

origins = [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(personas_router)
app.include_router(sessions_router)
app.include_router(features_router)
app.include_router(ws_router)

uploads_path = Path(settings.UPLOADS_DIR)
(uploads_path / "avatars").mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(uploads_path)), name="uploads")


@app.get("/health")
async def health() -> dict[str, str]:
    return {
        "status": "ok",
        "provider": settings.AVATAR_PROVIDER,
        "llm_provider": llm_service.resolve_provider(),
        "auth_required": str(settings.AUTH_REQUIRED),
        "kafka_enabled": str(settings.KAFKA_ENABLED),
        "kafka_connected": str(kafka_service.is_connected),
        "mock_mode": str(settings.DID_MOCK_MODE),
    }


@app.get("/api/v1/kafka/status", tags=["Kafka Events"])
async def kafka_status() -> dict:
    return kafka_service.get_status()


@app.get("/api/v1/kafka/events", tags=["Kafka Events"])
async def kafka_recent_events(limit: int = 20) -> list[dict]:
    return kafka_service.get_recent_events(limit=min(max(limit, 1), 50))
