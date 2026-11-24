from datetime import datetime
from pydantic import BaseModel, Field

DEFAULT_AVATAR_URL = (
    "https://create-images-results.d-id.com/DefaultPresenters/Noelle_f/image.jpeg"
)


class UserRegisterRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=100)
    email: str = Field(..., min_length=5, max_length=160)
    password: str = Field(..., min_length=6, max_length=128)
    avatar_image_url: str = Field(default=DEFAULT_AVATAR_URL)


class UserLoginRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=160)
    password: str = Field(..., min_length=1, max_length=128)


class UserProfileUpdateRequest(BaseModel):
    full_name: str | None = Field(default=None, min_length=2, max_length=100)
    avatar_image_url: str | None = Field(default=None, min_length=5, max_length=1000)


class UserPublic(BaseModel):
    id: str
    full_name: str
    email: str
    avatar_image_url: str = DEFAULT_AVATAR_URL
    created_at: datetime


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserPublic
