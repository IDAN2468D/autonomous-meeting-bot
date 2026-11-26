from datetime import datetime, timezone
from pathlib import Path
import uuid
from bson import ObjectId
from fastapi import APIRouter, Depends, File, Response, UploadFile
from aurameet_shared.config import settings
from aurameet_shared.database import get_db
from aurameet_shared.errors import BadRequestError, NotFoundError, UnauthorizedError
from aurameet_shared.kafka_client import (
    KafkaService,
    TOPIC_MEETING_ALERTS,
    TOPIC_MEETING_AUTH,
)
from aurameet_shared.security import (
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)
from app.models import (
    DEFAULT_AVATAR_URL,
    AuthResponse,
    UserLoginRequest,
    UserProfileUpdateRequest,
    UserPublic,
    UserRegisterRequest,
)

kafka_service = KafkaService(service_name="auth-service", enable_consumer=False)
router = APIRouter(prefix="/api/v1/auth", tags=["Authentication (JWT)"])


def _serialize_user(doc: dict) -> UserPublic:
    return UserPublic(
        id=str(doc["_id"]),
        full_name=doc["full_name"],
        email=doc["email"],
        avatar_image_url=doc.get("avatar_image_url") or DEFAULT_AVATAR_URL,
        created_at=doc["created_at"],
    )


ALLOWED_IMAGE_EXTS = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
}
MAX_AVATAR_BYTES = 5 * 1024 * 1024


@router.post("/avatar/upload")
async def upload_avatar_image(file: UploadFile = File(...)) -> dict[str, str]:
    filename = file.filename or "avatar.png"
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_IMAGE_EXTS:
        raise BadRequestError("פורמט תמונה לא נתמך. ניתן להעלות JPG, PNG או WEBP בלבד.")

    raw = await file.read()
    if not raw:
        raise BadRequestError("קובץ התמונה ריק")
    if len(raw) > MAX_AVATAR_BYTES:
        raise BadRequestError("גודל התמונה חורג מ-5MB")

    db = get_db()
    saved_name = f"{uuid.uuid4().hex}{ext}"
    res = await db.avatars.insert_one(
        {
            "filename": saved_name,
            "content_type": ALLOWED_IMAGE_EXTS[ext],
            "data": raw,
            "created_at": datetime.now(timezone.utc),
        }
    )
    avatar_id = str(res.inserted_id)
    url = f"/api/v1/auth/avatars/{avatar_id}"
    await kafka_service.publish(
        TOPIC_MEETING_AUTH,
        {
            "event_type": "avatar_uploaded",
            "filename": saved_name,
            "size_bytes": len(raw),
            "avatar_image_url": url,
        },
        key=saved_name,
    )
    return {"avatar_image_url": url, "filename": saved_name}


@router.get("/avatars/{avatar_id}")
async def get_avatar_image(avatar_id: str) -> Response:
    if not ObjectId.is_valid(avatar_id):
        raise BadRequestError("Invalid avatar_id")
    db = get_db()
    doc = await db.avatars.find_one({"_id": ObjectId(avatar_id)})
    if not doc or not doc.get("data"):
        raise NotFoundError("Avatar image not found")
    return Response(
        content=bytes(doc["data"]),
        media_type=doc.get("content_type", "image/jpeg"),
        headers={"Cache-Control": "public, max-age=86400"},
    )


@router.post("/register", response_model=AuthResponse)
async def register(payload: UserRegisterRequest) -> AuthResponse:
    db = get_db()
    normalized_email = payload.email.strip().lower()
    if "@" not in normalized_email:
        raise BadRequestError("כתובת אימייל אינה תקינה")

    existing = await db.users.find_one({"email": normalized_email})
    if existing:
        raise BadRequestError("משתמש עם אימייל זה כבר קיים במערכת")

    avatar_url = (payload.avatar_image_url or "").strip() or DEFAULT_AVATAR_URL
    doc = {
        "full_name": payload.full_name.strip(),
        "email": normalized_email,
        "avatar_image_url": avatar_url,
        "password_hash": hash_password(payload.password),
        "created_at": datetime.now(timezone.utc),
    }
    res = await db.users.insert_one(doc)
    doc["_id"] = res.inserted_id
    user = _serialize_user(doc)
    token = create_access_token(user.id, user.email, user.full_name)

    await kafka_service.publish(
        TOPIC_MEETING_AUTH,
        {
            "event_type": "user_registered",
            "user_id": user.id,
            "full_name": user.full_name,
            "email": user.email,
            "avatar_image_url": user.avatar_image_url,
        },
        key=user.id,
    )
    return AuthResponse(access_token=token, user=user)


@router.post("/login", response_model=AuthResponse)
async def login(payload: UserLoginRequest) -> AuthResponse:
    db = get_db()
    normalized_email = payload.email.strip().lower()
    doc = await db.users.find_one({"email": normalized_email})
    if not doc or not verify_password(payload.password, doc.get("password_hash", "")):
        await kafka_service.publish(
            TOPIC_MEETING_ALERTS,
            {
                "event_type": "auth_login_failed",
                "severity": "warning",
                "email": normalized_email,
                "message": f"ניסיון התחברות כושל עבור {normalized_email}",
            },
            key=normalized_email,
        )
        raise UnauthorizedError("אימייל או סיסמה שגויים")

    user = _serialize_user(doc)
    token = create_access_token(user.id, user.email, user.full_name)
    await kafka_service.publish(
        TOPIC_MEETING_AUTH,
        {
            "event_type": "user_logged_in",
            "user_id": user.id,
            "full_name": user.full_name,
            "email": user.email,
        },
        key=user.id,
    )
    return AuthResponse(access_token=token, user=user)


@router.get("/me", response_model=UserPublic)
async def me(claims: dict = Depends(get_current_user)) -> UserPublic:
    db = get_db()
    sub = claims.get("sub", "")
    if not ObjectId.is_valid(sub):
        raise UnauthorizedError("Invalid user token subject")
    doc = await db.users.find_one({"_id": ObjectId(sub)})
    if not doc:
        raise UnauthorizedError("User not found")
    return _serialize_user(doc)


@router.patch("/me", response_model=UserPublic)
async def update_profile(
    payload: UserProfileUpdateRequest,
    claims: dict = Depends(get_current_user),
) -> UserPublic:
    db = get_db()
    sub = claims.get("sub", "")
    if not ObjectId.is_valid(sub):
        raise UnauthorizedError("Invalid user token subject")

    updates: dict[str, str] = {}
    if payload.full_name is not None:
        updates["full_name"] = payload.full_name.strip()
    if payload.avatar_image_url is not None:
        updates["avatar_image_url"] = payload.avatar_image_url.strip() or DEFAULT_AVATAR_URL

    if updates:
        await db.users.update_one({"_id": ObjectId(sub)}, {"$set": updates})

    doc = await db.users.find_one({"_id": ObjectId(sub)})
    if not doc:
        raise UnauthorizedError("User not found")

    user = _serialize_user(doc)
    await kafka_service.publish(
        TOPIC_MEETING_AUTH,
        {
            "event_type": "user_profile_updated",
            "user_id": user.id,
            "updated_fields": list(updates.keys()),
        },
        key=user.id,
    )
    return user
