from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from aurameet_shared.config import settings
from aurameet_shared.database import close_mongo_connection, connect_to_mongo
from aurameet_shared.errors import register_exception_handlers
from app.routes_sessions import kafka_service, router as sessions_router
from app.ws_meeting import router as ws_router


@asynccontextmanager
async def lifespan(_: FastAPI):
    await connect_to_mongo()
    await kafka_service.start()
    yield
    await kafka_service.stop()
    await close_mongo_connection()


app = FastAPI(
    title="AuraMeet Live Meeting & Avatar Service",
    description="Microservice for Real-Time Meeting Sessions, WebSocket Orchestration & WebRTC Avatar Streaming (Simli / D-ID).",
    version="3.0.0",
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

app.include_router(sessions_router)
app.include_router(ws_router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {
        "status": "ok",
        "service": "meeting-service",
        "provider": settings.AVATAR_PROVIDER,
        "mock_mode": str(settings.DID_MOCK_MODE),
        "kafka_connected": str(kafka_service.is_connected),
    }
