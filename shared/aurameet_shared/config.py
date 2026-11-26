from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    APP_ENV: str = "development"
    SERVICE_NAME: str = "aurameet-service"
    MONGODB_URI: str = "mongodb://localhost:27017"
    MONGODB_DB_NAME: str = "meeting_bot_db"
    CHROMA_PERSIST_DIR: str = "./chroma_data"
    UPLOADS_DIR: str = "./uploads"
    PUBLIC_BASE_URL: str = "http://localhost:8088"

    # Internal Microservice URLs (Docker Compose DNS)
    AUTH_SERVICE_URL: str = "http://auth-service:8001"
    PERSONA_SERVICE_URL: str = "http://persona-service:8002"
    MEETING_SERVICE_URL: str = "http://meeting-service:8003"
    AI_SERVICE_URL: str = "http://ai-service:8004"
    ANALYTICS_SERVICE_URL: str = "http://analytics-service:8005"

    # Multi-LLM Engine (auto | gemini | openai | demo)
    LLM_PROVIDER: str = "auto"
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-3.5-flash-lite"
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"
    OPENAI_WHISPER_MODEL: str = "whisper-1"

    # LLM Generation Controls
    LLM_TEMPERATURE: float = 0.6
    LLM_MAX_TOKENS: int = 240
    LLM_TOP_P: float = 0.9

    # Avatar Streaming Providers (simli | did | mock)
    AVATAR_PROVIDER: str = "simli"
    SIMLI_API_KEY: str = ""
    SIMLI_FACE_ID: str = "tmp9i8bbq7c"
    SIMLI_API_URL: str = "https://api.simli.ai"

    DID_API_KEY: str = ""
    DID_BASE_URL: str = "https://api.d-id.com"
    DID_MOCK_MODE: bool = False

    # Server-Side Security (JWT)
    JWT_SECRET_KEY: str = "change-me-in-production-super-secret-jwt-key"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 1440
    AUTH_REQUIRED: bool = False

    # Kafka Event-Driven Architecture
    KAFKA_ENABLED: bool = False
    KAFKA_BOOTSTRAP_SERVERS: str = "localhost:29092"
    KAFKA_CONSUMER_GROUP: str = "meeting-bot-consumer"

    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:8088"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
