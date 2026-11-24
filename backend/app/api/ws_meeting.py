import base64
from datetime import datetime, timezone
import time
import uuid
from bson import ObjectId
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.core.database import get_db
from app.services.did_service import did_service
from app.services.guardrails_service import guardrails_service
from app.services.kafka_service import (
    TOPIC_MEETING_ALERTS,
    TOPIC_MEETING_TRANSCRIPTS,
    kafka_service,
)
from app.services.llm_service import llm_service
from app.services.memory_service import memory_service
from app.services.rag_service import rag_service
from app.services.simli_service import simli_service

router = APIRouter(tags=["Live Meeting WebSocket"])


async def _deliver_avatar_speech(
    websocket: WebSocket,
    session: dict,
    persona: dict,
    reply_text: str,
) -> int:
    t0 = time.perf_counter()
    await websocket.send_json({"type": "status", "status": "speaking"})
    if session.get("provider") == "simli":
        pcm_bytes = await simli_service.text_to_pcm16(
            text=reply_text,
            voice_id=persona["voice_id"],
        )
        if pcm_bytes:
            await websocket.send_json(
                {
                    "type": "audio_pcm16",
                    "audio_base64": base64.b64encode(pcm_bytes).decode("ascii"),
                    "sample_rate": 16000,
                }
            )
    else:
        await did_service.send_talk_script(
            stream_id=session["did_stream_id"],
            did_session_id=session["did_session_id"],
            text=reply_text,
            voice_id=persona["voice_id"],
        )
    await websocket.send_json(
        {"type": "transcript", "speaker": "avatar", "text": reply_text}
    )
    await websocket.send_json({"type": "status", "status": "idle"})
    return int((time.perf_counter() - t0) * 1000)


@router.websocket("/ws/meeting/{session_id}")
async def meeting_ws(websocket: WebSocket, session_id: str) -> None:
    await websocket.accept()
    db = get_db()

    if not ObjectId.is_valid(session_id):
        await websocket.send_json({"type": "error", "message": "Invalid session_id"})
        await websocket.close()
        return

    session = await db.sessions.find_one({"_id": ObjectId(session_id)})
    if not session:
        await websocket.send_json({"type": "error", "message": "Session not found"})
        await websocket.close()
        return

    persona = await db.personas.find_one({"_id": ObjectId(session["persona_id"])})
    if not persona:
        await websocket.send_json({"type": "error", "message": "Persona not found"})
        await websocket.close()
        return

    hitl_mode = False
    pending_drafts: dict[str, dict] = {}

    await websocket.send_json(
        {
            "type": "ready",
            "persona_name": persona["name"],
            "llm_provider": llm_service.resolve_provider(),
            "avatar_provider": session.get("provider", "simli"),
            "hitl_mode": hitl_mode,
        }
    )

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")

            if msg_type == "set_mode":
                hitl_mode = bool(data.get("hitl", False))
                await websocket.send_json({"type": "mode_updated", "hitl_mode": hitl_mode})
                continue

            if msg_type == "greet":
                greeting = await llm_service.generate_opening_greeting(
                    persona_name=persona["name"],
                    role_title=persona["role_title"],
                    agenda=session.get("agenda", ""),
                    language=persona["language"],
                )
                avatar_entry = {
                    "speaker": "avatar",
                    "text": greeting,
                    "timestamp": datetime.now(timezone.utc),
                }
                await db.sessions.update_one(
                    {"_id": ObjectId(session_id)},
                    {"$push": {"transcript": avatar_entry}},
                )
                await _deliver_avatar_speech(websocket, session, persona, greeting)
                await kafka_service.publish(
                    TOPIC_MEETING_TRANSCRIPTS,
                    {
                        "event_type": "autonomous_greeting",
                        "session_id": session_id,
                        "persona_id": session["persona_id"],
                        "avatar_text": greeting,
                    },
                    key=session_id,
                )
                continue

            if msg_type == "approve_draft":
                draft_id = str(data.get("draft_id", ""))
                draft = pending_drafts.pop(draft_id, None)
                if not draft:
                    continue
                approved_text = str(data.get("text") or draft["reply_text"]).strip()
                out_guard = guardrails_service.sanitize_output(approved_text)
                final_reply = out_guard.sanitized_text
                avatar_entry = {
                    "speaker": "avatar",
                    "text": final_reply,
                    "timestamp": datetime.now(timezone.utc),
                }
                await db.sessions.update_one(
                    {"_id": ObjectId(session_id)},
                    {
                        "$push": {
                            "transcript": {"$each": [draft["participant_entry"], avatar_entry]}
                        }
                    },
                )
                tts_ms = await _deliver_avatar_speech(websocket, session, persona, final_reply)
                metrics = {
                    **draft["metrics"],
                    "tts_ms": tts_ms,
                    "total_ms": draft["metrics"]["total_ms"] + tts_ms,
                }
                await websocket.send_json({"type": "metrics", **metrics})
                continue

            if msg_type == "reject_draft":
                draft_id = str(data.get("draft_id", ""))
                pending_drafts.pop(draft_id, None)
                await websocket.send_json({"type": "status", "status": "idle"})
                continue

            turn_start = time.perf_counter()
            stt_ms = 0
            user_text = ""

            if msg_type == "text":
                user_text = str(data.get("text", "")).strip()
            elif msg_type == "audio":
                audio_b64 = data.get("audio_base64", "")
                mime_type = data.get("mime_type", "audio/webm")
                if not audio_b64:
                    continue
                audio_bytes = base64.b64decode(audio_b64)
                await websocket.send_json({"type": "status", "status": "transcribing"})
                t_stt = time.perf_counter()
                user_text = await llm_service.transcribe_audio(
                    audio_bytes, mime_type=mime_type, language=persona["language"]
                )
                stt_ms = int((time.perf_counter() - t_stt) * 1000)
            else:
                continue

            if not user_text:
                await websocket.send_json({"type": "status", "status": "idle"})
                continue

            # Guardrails on incoming participant utterance
            in_guard = guardrails_service.check_input(user_text, language=persona["language"])
            safe_user_text = user_text if not in_guard.allowed else in_guard.sanitized_text

            participant_entry = {
                "speaker": "participant",
                "text": safe_user_text,
                "timestamp": datetime.now(timezone.utc),
            }
            await websocket.send_json(
                {"type": "transcript", "speaker": "participant", "text": safe_user_text}
            )
            await websocket.send_json({"type": "status", "status": "thinking"})

            rag_ms = 0
            llm_ms = 0
            usage: dict = {
                "provider": llm_service.resolve_provider(),
                "model": "guardrail",
                "total_tokens": 0,
            }
            guardrails_triggered = in_guard.triggered

            if not in_guard.allowed:
                reply_text = in_guard.sanitized_text
            else:
                t_rag = time.perf_counter()
                rag_context = rag_service.retrieve_context(session["persona_id"], safe_user_text)
                long_term_mem = await memory_service.get_long_term_memory_context(
                    session["persona_id"]
                )
                rag_ms = int((time.perf_counter() - t_rag) * 1000)

                current_session = await db.sessions.find_one({"_id": ObjectId(session_id)})
                history = current_session.get("transcript", []) if current_session else []

                screen_image_b64 = data.get("screen_image_base64")
                screen_image_bytes = (
                    base64.b64decode(screen_image_b64) if screen_image_b64 else None
                )

                t_llm = time.perf_counter()
                raw_reply, usage = await llm_service.generate_meeting_reply_with_usage(
                    system_prompt=persona["system_prompt"],
                    agenda=session.get("agenda", ""),
                    rag_context=rag_context,
                    history=history,
                    user_message=safe_user_text,
                    language=persona["language"],
                    screen_image_bytes=screen_image_bytes,
                    long_term_memory=long_term_mem,
                )
                llm_ms = int((time.perf_counter() - t_llm) * 1000)

                out_guard = guardrails_service.sanitize_output(raw_reply)
                reply_text = out_guard.sanitized_text
                guardrails_triggered = guardrails_triggered or out_guard.triggered

            metrics_base = {
                "stt_ms": stt_ms,
                "rag_ms": rag_ms,
                "llm_ms": llm_ms,
                "tts_ms": 0,
                "total_ms": int((time.perf_counter() - turn_start) * 1000),
                "tokens_used": int(usage.get("total_tokens", 0)),
                "llm_provider": usage.get("provider", "gemini"),
                "llm_model": usage.get("model", ""),
                "guardrails_triggered": guardrails_triggered,
            }

            if hitl_mode:
                draft_id = uuid.uuid4().hex[:10]
                pending_drafts[draft_id] = {
                    "participant_entry": participant_entry,
                    "reply_text": reply_text,
                    "metrics": metrics_base,
                }
                await websocket.send_json(
                    {
                        "type": "draft_reply",
                        "draft_id": draft_id,
                        "text": reply_text,
                        "metrics": metrics_base,
                    }
                )
                await kafka_service.publish(
                    TOPIC_MEETING_ALERTS,
                    {
                        "event_type": "hitl_approval_required",
                        "severity": "info",
                        "session_id": session_id,
                        "draft_id": draft_id,
                        "draft_text": reply_text,
                    },
                    key=session_id,
                )
                await websocket.send_json({"type": "status", "status": "idle"})
                continue

            avatar_entry = {
                "speaker": "avatar",
                "text": reply_text,
                "timestamp": datetime.now(timezone.utc),
            }
            await db.sessions.update_one(
                {"_id": ObjectId(session_id)},
                {
                    "$push": {"transcript": {"$each": [participant_entry, avatar_entry]}},
                    "$inc": {"total_tokens": int(usage.get("total_tokens", 0))},
                },
            )

            tts_ms = await _deliver_avatar_speech(websocket, session, persona, reply_text)
            metrics_final = {
                **metrics_base,
                "tts_ms": tts_ms,
                "total_ms": int((time.perf_counter() - turn_start) * 1000),
            }
            await websocket.send_json({"type": "metrics", **metrics_final})
            await kafka_service.publish(
                TOPIC_MEETING_TRANSCRIPTS,
                {
                    "event_type": "meeting_turn",
                    "session_id": session_id,
                    "persona_id": session["persona_id"],
                    "participant_text": safe_user_text,
                    "avatar_text": reply_text,
                    "metrics": metrics_final,
                },
                key=session_id,
            )
            if guardrails_triggered:
                await kafka_service.publish(
                    TOPIC_MEETING_ALERTS,
                    {
                        "event_type": "guardrail_triggered",
                        "session_id": session_id,
                        "persona_id": session["persona_id"],
                        "reason": in_guard.reason or "output_sanitized",
                    },
                    key=session_id,
                )

    except WebSocketDisconnect:
        return
    except Exception as exc:
        await kafka_service.publish(
            TOPIC_MEETING_ALERTS,
            {
                "event_type": "websocket_error",
                "severity": "error",
                "session_id": session_id,
                "message": str(exc),
            },
            key=session_id,
        )
        try:
            await websocket.send_json({"type": "error", "message": str(exc)})
            await websocket.send_json({"type": "status", "status": "idle"})
        except Exception:
            pass
