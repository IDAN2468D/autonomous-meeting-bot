from datetime import datetime, timezone
import io
from pathlib import Path
import uuid
from bson import ObjectId
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pypdf import PdfReader
from app.core.config import settings
from app.core.database import get_db
from app.core.security import get_optional_user
from app.models.auth import DEFAULT_AVATAR_URL
from app.models.persona import PersonaCreate, PersonaResponse
from app.services.kafka_service import TOPIC_MEETING_PERSONAS, kafka_service
from app.services.memory_service import memory_service
from app.services.rag_service import rag_service

router = APIRouter(prefix="/api/v1/personas", tags=["Personas"])


def _serialize_persona(doc: dict) -> PersonaResponse:
    return PersonaResponse(
        id=str(doc["_id"]),
        name=doc["name"],
        role_title=doc["role_title"],
        avatar_image_url=doc.get("avatar_image_url") or DEFAULT_AVATAR_URL,
        voice_id=doc["voice_id"],
        language=doc["language"],
        system_prompt=doc["system_prompt"],
        created_at=doc["created_at"],
    )


@router.post("", response_model=PersonaResponse)
async def create_persona(
    payload: PersonaCreate,
    user_claims: dict | None = Depends(get_optional_user),
) -> PersonaResponse:
    db = get_db()
    avatar_url = (payload.avatar_image_url or "").strip()

    if not avatar_url and user_claims:
        sub = user_claims.get("sub", "")
        if ObjectId.is_valid(sub):
            user_doc = await db.users.find_one({"_id": ObjectId(sub)})
            if user_doc and user_doc.get("avatar_image_url"):
                avatar_url = str(user_doc["avatar_image_url"]).strip()

    doc = payload.model_dump()
    doc["avatar_image_url"] = avatar_url or DEFAULT_AVATAR_URL
    doc["created_at"] = datetime.now(timezone.utc)
    result = await db.personas.insert_one(doc)
    doc["_id"] = result.inserted_id
    persona = _serialize_persona(doc)

    await kafka_service.publish(
        TOPIC_MEETING_PERSONAS,
        {
            "event_type": "persona_created",
            "persona_id": persona.id,
            "name": persona.name,
            "role_title": persona.role_title,
            "voice_id": persona.voice_id,
            "language": persona.language,
            "avatar_image_url": persona.avatar_image_url,
        },
        key=persona.id,
    )
    return persona


@router.get("", response_model=list[PersonaResponse])
async def list_personas() -> list[PersonaResponse]:
    db = get_db()
    cursor = db.personas.find().sort("created_at", -1)
    return [_serialize_persona(doc) async for doc in cursor]


@router.delete("/{persona_id}")
async def delete_persona(persona_id: str) -> dict[str, str]:
    db = get_db()
    if not ObjectId.is_valid(persona_id):
        raise HTTPException(status_code=400, detail="Invalid persona_id")
    res = await db.personas.delete_one({"_id": ObjectId(persona_id)})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Persona not found")

    await kafka_service.publish(
        TOPIC_MEETING_PERSONAS,
        {"event_type": "persona_deleted", "persona_id": persona_id},
        key=persona_id,
    )
    return {"status": "deleted", "id": persona_id}


@router.post("/{persona_id}/knowledge")
async def upload_knowledge(persona_id: str, file: UploadFile = File(...)) -> dict:
    db = get_db()
    if not ObjectId.is_valid(persona_id):
        raise HTTPException(status_code=400, detail="Invalid persona_id")
    persona = await db.personas.find_one({"_id": ObjectId(persona_id)})
    if not persona:
        raise HTTPException(status_code=404, detail="Persona not found")

    raw = await file.read()
    filename = file.filename or "document.txt"

    if filename.lower().endswith(".pdf"):
        reader = PdfReader(io.BytesIO(raw))
        text = "\n".join(page.extract_text() or "" for page in reader.pages)
    else:
        text = raw.decode("utf-8", errors="ignore")

    chunks_count = rag_service.index_document(persona_id, filename, text)
    await kafka_service.publish(
        TOPIC_MEETING_PERSONAS,
        {
            "event_type": "knowledge_indexed",
            "persona_id": persona_id,
            "persona_name": persona["name"],
            "filename": filename,
            "indexed_chunks": chunks_count,
        },
        key=persona_id,
    )
    return {"filename": filename, "indexed_chunks": chunks_count}


@router.post("/{persona_id}/avatar", response_model=PersonaResponse)
async def upload_persona_avatar(
    persona_id: str, file: UploadFile = File(...)
) -> PersonaResponse:
    db = get_db()
    if not ObjectId.is_valid(persona_id):
        raise HTTPException(status_code=400, detail="Invalid persona_id")
    persona = await db.personas.find_one({"_id": ObjectId(persona_id)})
    if not persona:
        raise HTTPException(status_code=404, detail="Persona not found")

    filename = file.filename or "avatar.png"
    ext = Path(filename).suffix.lower()
    if ext not in {".jpg", ".jpeg", ".png", ".webp"}:
        raise HTTPException(
            status_code=400,
            detail="פורמט תמונה לא נתמך. ניתן להעלות JPG, PNG או WEBP בלבד.",
        )

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="קובץ התמונה ריק")
    if len(raw) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="גודל התמונה חורג מ-5MB")

    avatars_dir = Path(settings.UPLOADS_DIR) / "avatars"
    avatars_dir.mkdir(parents=True, exist_ok=True)
    saved_name = f"persona_{persona_id}_{uuid.uuid4().hex[:8]}{ext}"
    (avatars_dir / saved_name).write_bytes(raw)

    url = f"{settings.PUBLIC_BASE_URL.rstrip('/')}/uploads/avatars/{saved_name}"
    await db.personas.update_one(
        {"_id": ObjectId(persona_id)},
        {"$set": {"avatar_image_url": url}},
    )
    persona["avatar_image_url"] = url

    await kafka_service.publish(
        TOPIC_MEETING_PERSONAS,
        {
            "event_type": "persona_avatar_updated",
            "persona_id": persona_id,
            "persona_name": persona["name"],
            "avatar_image_url": url,
        },
        key=persona_id,
    )
    return _serialize_persona(persona)


@router.get("/{persona_id}/memories")
async def get_persona_memories(persona_id: str) -> list[dict]:
    if not ObjectId.is_valid(persona_id):
        raise HTTPException(status_code=400, detail="Invalid persona_id")
    return await memory_service.list_memories(persona_id)
