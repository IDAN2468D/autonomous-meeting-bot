from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from aurameet_shared.config import settings
from aurameet_shared.database import close_mongo_connection, connect_to_mongo
from aurameet_shared.errors import register_exception_handlers
from app.routes import kafka_service, router as analytics_router


@asynccontextmanager
async def lifespan(_: FastAPI):
    await connect_to_mongo()
    await kafka_service.start()
    yield
    await kafka_service.stop()
    await close_mongo_connection()


app = FastAPI(
    title="AuraMeet Analytics, Schedule & Events Service",
    description="Microservice for Calendar Scheduling, Summary Templates, Dashboard Analytics & Kafka Event Monitoring.",
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

app.include_router(analytics_router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {
        "status": "ok",
        "service": "analytics-service",
        "kafka_enabled": str(settings.KAFKA_ENABLED),
        "kafka_connected": str(kafka_service.is_connected),
    }
