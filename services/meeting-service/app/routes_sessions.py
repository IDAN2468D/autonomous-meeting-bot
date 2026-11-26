from datetime import datetime, timezone
from bson import ObjectId
import httpx
from fastapi import APIRouter, HTTPException
from aurameet_shared.config import settings
from aurameet_shared.database import get_db
from aurameet_shared.kafka_client import KafkaService, TOPIC_MEETING_EVENTS
from app.clients import service_clients
from app.did_service import did_service
from app.models import (
    IceCandidateRequest,
    SdpAnswerRequest,
    SessionCreateRequest,
    SessionSummaryResponse,
)
from app.simli_service import simli_service

kafka_service = KafkaService(service_name="meeting-service", enable_consumer=False)
router = APIRouter(prefix="/api/v1/sessions", tags=["Meeting Sessions"])


async def _get_session_or_404(session_id: str) -> dict:
    db = get_db()
    if not ObjectId.is_valid(session_id):
        raise HTTPException(status_code=400, detail="Invalid session_id")
    session = await db.sessions.find_one({"_id": ObjectId(session_id)})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@router.post("")
async def create_meeting_session(payload: SessionCreateRequest) -> dict:
    db = get_db()
    if not ObjectId.is_valid(payload.persona_id):
        raise HTTPException(status_code=400, detail="Invalid persona_id")

    persona = await db.personas.find_one({"_id": ObjectId(payload.persona_id)})
    if not persona:
        raise HTTPException(status_code=404, detail="Persona not found")

    provider = "mock" if settings.DID_MOCK_MODE else settings.AVATAR_PROVIDER.lower()

    if provider == "simli":
        try:
            simli_data = await simli_service.create_session_token(
                persona.get("simli_face_id")
            )
        except httpx.HTTPStatusError as exc:
            detail = f"Simli API error ({exc.response.status_code}): {exc.response.text}"
            raise HTTPException(status_code=502, detail=detail) from exc
        except Exception as exc:
            raise HTTPException(status_code=500, detail=str(exc)) from exc

        session_doc = {
            "persona_id": payload.persona_id,
            "persona_name": persona["name"],
            "avatar_image_url": persona["avatar_image_url"],
            "title": payload.title,
            "agenda": payload.agenda,
            "template_id": payload.template_id,
            "provider": "simli",
            "did_stream_id": "",
            "did_session_id": "",
            "status": "live",
            "transcript": [],
            "summary": None,
            "action_items": [],
            "created_at": datetime.now(timezone.utc),
        }
        res = await db.sessions.insert_one(session_doc)
        await kafka_service.publish(
            TOPIC_MEETING_EVENTS,
            {
                "event_type": "session_started",
                "session_id": str(res.inserted_id),
                "persona_id": payload.persona_id,
                "persona_name": persona["name"],
                "title": payload.title,
                "provider": "simli",
            },
            key=str(res.inserted_id),
        )

        return {
            "session_id": str(res.inserted_id),
            "provider": "simli",
            "simli_session_token": simli_data["session_token"],
            "did_stream_id": "",
            "did_session_id": "",
            "offer": None,
            "ice_servers": [],
            "mock": False,
        }

    try:
        did_stream = await did_service.create_stream(persona["avatar_image_url"])
    except httpx.HTTPStatusError as exc:
        detail = f"D-ID API error ({exc.response.status_code}): {exc.response.text}"
        raise HTTPException(status_code=502, detail=detail) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc

    session_doc = {
        "persona_id": payload.persona_id,
        "persona_name": persona["name"],
        "avatar_image_url": persona["avatar_image_url"],
        "title": payload.title,
        "agenda": payload.agenda,
        "template_id": payload.template_id,
        "provider": "mock" if did_stream.get("mock", False) else "did",
        "did_stream_id": did_stream["id"],
        "did_session_id": did_stream["session_id"],
        "status": "initializing",
        "transcript": [],
        "summary": None,
        "action_items": [],
        "created_at": datetime.now(timezone.utc),
    }
    res = await db.sessions.insert_one(session_doc)
    await kafka_service.publish(
        TOPIC_MEETING_EVENTS,
        {
            "event_type": "session_started",
            "session_id": str(res.inserted_id),
            "persona_id": payload.persona_id,
            "persona_name": persona["name"],
            "title": payload.title,
            "provider": session_doc["provider"],
        },
        key=str(res.inserted_id),
    )

    return {
        "session_id": str(res.inserted_id),
        "provider": session_doc["provider"],
        "did_stream_id": did_stream["id"],
        "did_session_id": did_stream["session_id"],
        "offer": did_stream["offer"],
        "ice_servers": did_stream.get("ice_servers", []),
        "mock": did_stream.get("mock", False),
    }


@router.post("/{session_id}/sdp")
async def send_sdp(session_id: str, payload: SdpAnswerRequest) -> dict:
    db = get_db()
    session = await _get_session_or_404(session_id)
    result = await did_service.send_sdp_answer(
        session["did_stream_id"], session["did_session_id"], payload.answer
    )
    await db.sessions.update_one(
        {"_id": session["_id"]}, {"$set": {"status": "live"}}
    )
    return result


@router.post("/{session_id}/ice")
async def send_ice(session_id: str, payload: IceCandidateRequest) -> dict:
    session = await _get_session_or_404(session_id)
    return await did_service.send_ice_candidate(
        session["did_stream_id"],
        session["did_session_id"],
        payload.model_dump(exclude_none=True),
    )


@router.post("/{session_id}/end", response_model=SessionSummaryResponse)
async def end_session(session_id: str) -> SessionSummaryResponse:
    db = get_db()
    session = await _get_session_or_404(session_id)

    if session.get("provider", "did") == "did" and session.get("did_stream_id"):
        try:
            await did_service.close_stream(
                session["did_stream_id"], session["did_session_id"]
            )
        except Exception:
            pass

    tpl = await service_clients.analytics_get_template(
        session.get("template_id", "weekly_status")
    )
    summary_data = await service_clients.ai_summarize(
        title=session["title"],
        transcript=session.get("transcript", []),
        template_name=tpl.get("name"),
        template_instructions=tpl.get("instructions"),
    )
    summary = str(summary_data.get("summary", ""))
    action_items = [str(item) for item in summary_data.get("action_items", [])]
    key_facts = [str(item) for item in summary_data.get("key_facts", [])]

    if key_facts:
        try:
            await service_clients.persona_save_memories(
                persona_id=session["persona_id"],
                session_id=session_id,
                meeting_title=session["title"],
                facts=key_facts,
            )
        except Exception:
            pass

    await db.sessions.update_one(
        {"_id": session["_id"]},
        {
            "$set": {
                "status": "ended",
                "summary": summary,
                "action_items": action_items,
                "template_name": tpl.get("name"),
                "ended_at": datetime.now(timezone.utc),
            }
        },
    )
    await kafka_service.publish(
        TOPIC_MEETING_EVENTS,
        {
            "event_type": "session_ended",
            "session_id": session_id,
            "persona_id": session["persona_id"],
            "title": session["title"],
            "action_items_count": len(action_items),
            "key_facts_saved": len(key_facts),
            "template_name": tpl.get("name"),
        },
        key=session_id,
    )
    return SessionSummaryResponse(
        session_id=session_id,
        summary=summary,
        action_items=action_items,
        template_name=tpl.get("name"),
    )


@router.get("")
async def list_sessions() -> list[dict]:
    db = get_db()
    cursor = db.sessions.find().sort("created_at", -1).limit(30)
    items = []
    async for doc in cursor:
        doc["id"] = str(doc.pop("_id"))
        items.append(doc)
    return items


@router.get("/{session_id}")
async def get_session(session_id: str) -> dict:
    session = await _get_session_or_404(session_id)
    session["id"] = str(session.pop("_id"))
    return session
