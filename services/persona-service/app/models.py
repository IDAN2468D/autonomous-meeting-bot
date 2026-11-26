from datetime import datetime, timezone
from typing import Literal
from pydantic import BaseModel, Field

DEFAULT_AVATAR_URL = (
    "https://create-images-results.d-id.com/DefaultPresenters/Noelle_f/image.jpeg"
)


class PersonaCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=80)
    role_title: str = Field(default="נציג אישי בפגישות")
    avatar_image_url: str | None = Field(default=None)
    voice_id: str = Field(default="he-IL-HilaNeural")
    language: Literal["he", "en"] = "he"
    system_prompt: str = Field(
        default=(
            "אתה הנציג האישי של המשתמש בפגישת וידאו. "
            "ענה בצורה מקצועית, טבעית, תמציתית (2-3 משפטים בכל תגובה) וברורה."
        )
    )


class PersonaResponse(BaseModel):
    id: str
    name: str
    role_title: str
    avatar_image_url: str = DEFAULT_AVATAR_URL
    voice_id: str
    language: Literal["he", "en"]
    system_prompt: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class MemorySaveRequest(BaseModel):
    session_id: str
    meeting_title: str
    facts: list[str]
