import base64
from dataclasses import asdict
from fastapi import APIRouter
from app.guardrails_service import guardrails_service
from app.llm_service import llm_service
from app.models import (
    GreetingRequest,
    GuardrailInputRequest,
    GuardrailOutputRequest,
    ReplyRequest,
    SummarizeRequest,
    TranscribeRequest,
)

router = APIRouter(prefix="/api/v1/ai", tags=["AI Engine & Guardrails"])


@router.post("/reply")
async def generate_reply(payload: ReplyRequest) -> dict:
    screen_bytes = (
        base64.b64decode(payload.screen_image_base64)
        if payload.screen_image_base64
        else None
    )
    reply, usage = await llm_service.generate_meeting_reply_with_usage(
        system_prompt=payload.system_prompt,
        agenda=payload.agenda,
        rag_context=payload.rag_context,
        history=payload.history,
        user_message=payload.user_message,
        language=payload.language,
        screen_image_bytes=screen_bytes,
        long_term_memory=payload.long_term_memory,
    )
    return {"reply": reply, "usage": usage}


@router.post("/greet")
async def generate_greeting(payload: GreetingRequest) -> dict[str, str]:
    greeting = await llm_service.generate_opening_greeting(
        persona_name=payload.persona_name,
        role_title=payload.role_title,
        agenda=payload.agenda,
        language=payload.language,
    )
    return {"greeting": greeting}


@router.post("/transcribe")
async def transcribe_audio(payload: TranscribeRequest) -> dict[str, str]:
    audio_bytes = base64.b64decode(payload.audio_base64)
    text = await llm_service.transcribe_audio(
        audio_bytes=audio_bytes,
        mime_type=payload.mime_type,
        language=payload.language,
    )
    return {"text": text}


@router.post("/summarize")
async def summarize_meeting(payload: SummarizeRequest) -> dict:
    return await llm_service.summarize_meeting(
        title=payload.title,
        transcript=payload.transcript,
        template_name=payload.template_name,
        template_instructions=payload.template_instructions,
    )


@router.post("/guardrails/check")
async def check_guardrails(payload: GuardrailInputRequest) -> dict:
    res = guardrails_service.check_input(payload.text, language=payload.language)
    return asdict(res)


@router.post("/guardrails/sanitize")
async def sanitize_guardrails(payload: GuardrailOutputRequest) -> dict:
    res = guardrails_service.sanitize_output(payload.text, max_chars=payload.max_chars)
    return asdict(res)
