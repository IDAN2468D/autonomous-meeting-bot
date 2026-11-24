from datetime import datetime, timezone
from typing import Any, Literal
from pydantic import BaseModel, Field


class TranscriptEntry(BaseModel):
    speaker: Literal["participant", "avatar"]
    text: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class SessionCreateRequest(BaseModel):
    persona_id: str
    title: str = Field(default="פגישת עבודה")
    agenda: str = Field(default="")
    template_id: str = Field(default="weekly_status")


class SdpAnswerRequest(BaseModel):
    answer: dict[str, Any]


class IceCandidateRequest(BaseModel):
    candidate: str | None = None
    sdpMid: str | None = None
    sdpMLineIndex: int | None = None


class SessionSummaryResponse(BaseModel):
    session_id: str
    summary: str
    action_items: list[str]
    template_name: str | None = None


class SummaryTemplateCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=80)
    category: str = Field(default="כללי")
    description: str = Field(default="")
    instructions: str = Field(..., min_length=5, max_length=1500)


class ScheduledMeetingCreate(BaseModel):
    title: str = Field(..., min_length=2, max_length=120)
    persona_id: str
    scheduled_at: str
    duration_minutes: int = Field(default=30, ge=5, le=240)
    agenda: str = Field(default="")
    template_id: str = Field(default="weekly_status")
