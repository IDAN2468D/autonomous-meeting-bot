from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from aurameet_shared.config import settings
from aurameet_shared.errors import register_exception_handlers
from aurameet_shared.kafka_client import KafkaService
from app.llm_service import llm_service
from app.routes import router as ai_router

kafka_service = KafkaService(service_name="ai-service", enable_consumer=False)


@asynccontextmanager
async def lifespan(_: FastAPI):
    await kafka_service.start()
    yield
    await kafka_service.stop()


app = FastAPI(
    title="AuraMeet AI & Guardrails Service",
    description="Microservice for Multi-LLM (Gemini/OpenAI/Demo), STT Transcription, Summarization & Guardrails.",
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

app.include_router(ai_router)


@app.get("/health")
async def health() -> dict[str, str]:
    return {
        "status": "ok",
        "service": "ai-service",
        "llm_provider": llm_service.resolve_provider(),
        "gemini_model": settings.GEMINI_MODEL,
        "kafka_connected": str(kafka_service.is_connected),
    }
