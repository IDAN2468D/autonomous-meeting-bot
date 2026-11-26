from typing import Any
from pydantic import BaseModel, Field


class ReplyRequest(BaseModel):
    system_prompt: str
    agenda: str = ""
    rag_context: str = ""
    history: list[dict[str, Any]] = Field(default_factory=list)
    user_message: str
    language: str = "he"
    screen_image_base64: str | None = None
    long_term_memory: str = ""


class GreetingRequest(BaseModel):
    persona_name: str
    role_title: str = ""
    agenda: str = ""
    language: str = "he"


class TranscribeRequest(BaseModel):
    audio_base64: str
    mime_type: str = "audio/webm"
    language: str = "he"


class SummarizeRequest(BaseModel):
    title: str
    transcript: list[dict[str, Any]] = Field(default_factory=list)
    template_name: str | None = None
    template_instructions: str | None = None


class GuardrailInputRequest(BaseModel):
    text: str
    language: str = "he"


class GuardrailOutputRequest(BaseModel):
    text: str
    max_chars: int = 420
