from pydantic import BaseModel, Field


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
