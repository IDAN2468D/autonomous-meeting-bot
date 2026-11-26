from typing import Any
import httpx
from aurameet_shared.config import settings


class ServiceClients:
    """Async HTTP client facade for inter-service calls to AI, Persona & Analytics services."""

    async def ai_health(self) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{settings.AI_SERVICE_URL.rstrip('/')}/health")
            resp.raise_for_status()
            return resp.json()

    async def ai_check_input(self, text: str, language: str = "he") -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"{settings.AI_SERVICE_URL.rstrip('/')}/api/v1/ai/guardrails/check",
                json={"text": text, "language": language},
            )
            resp.raise_for_status()
            return resp.json()

    async def ai_sanitize_output(self, text: str, max_chars: int = 420) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"{settings.AI_SERVICE_URL.rstrip('/')}/api/v1/ai/guardrails/sanitize",
                json={"text": text, "max_chars": max_chars},
            )
            resp.raise_for_status()
            return resp.json()

    async def ai_generate_greeting(
        self, persona_name: str, role_title: str, agenda: str, language: str = "he"
    ) -> str:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"{settings.AI_SERVICE_URL.rstrip('/')}/api/v1/ai/greet",
                json={
                    "persona_name": persona_name,
                    "role_title": role_title,
                    "agenda": agenda,
                    "language": language,
                },
            )
            resp.raise_for_status()
            return resp.json()["greeting"]

    async def ai_transcribe(
        self, audio_base64: str, mime_type: str = "audio/webm", language: str = "he"
    ) -> str:
        async with httpx.AsyncClient(timeout=45.0) as client:
            resp = await client.post(
                f"{settings.AI_SERVICE_URL.rstrip('/')}/api/v1/ai/transcribe",
                json={
                    "audio_base64": audio_base64,
                    "mime_type": mime_type,
                    "language": language,
                },
            )
            resp.raise_for_status()
            return resp.json()["text"]

    async def ai_generate_reply(self, payload: dict[str, Any]) -> tuple[str, dict[str, Any]]:
        async with httpx.AsyncClient(timeout=45.0) as client:
            resp = await client.post(
                f"{settings.AI_SERVICE_URL.rstrip('/')}/api/v1/ai/reply",
                json=payload,
            )
            resp.raise_for_status()
            data = resp.json()
            return data["reply"], data["usage"]

    async def ai_summarize(
        self,
        title: str,
        transcript: list[dict[str, Any]],
        template_name: str | None = None,
        template_instructions: str | None = None,
    ) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=45.0) as client:
            resp = await client.post(
                f"{settings.AI_SERVICE_URL.rstrip('/')}/api/v1/ai/summarize",
                json={
                    "title": title,
                    "transcript": transcript,
                    "template_name": template_name,
                    "template_instructions": template_instructions,
                },
            )
            resp.raise_for_status()
            return resp.json()

    async def persona_retrieve_context(self, persona_id: str, query: str) -> dict[str, str]:
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.get(
                    f"{settings.PERSONA_SERVICE_URL.rstrip('/')}/api/v1/personas/{persona_id}/context",
                    params={"query": query},
                )
                resp.raise_for_status()
                return resp.json()
        except Exception:
            return {"rag_context": "", "long_term_memory": ""}

    async def persona_save_memories(
        self, persona_id: str, session_id: str, meeting_title: str, facts: list[str]
    ) -> int:
        if not facts:
            return 0
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"{settings.PERSONA_SERVICE_URL.rstrip('/')}/api/v1/personas/{persona_id}/memories",
                json={
                    "session_id": session_id,
                    "meeting_title": meeting_title,
                    "facts": facts,
                },
            )
            resp.raise_for_status()
            return int(resp.json().get("saved_count", 0))

    async def analytics_get_template(self, template_id: str) -> dict[str, Any]:
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    f"{settings.ANALYTICS_SERVICE_URL.rstrip('/')}/api/v1/templates/{template_id}"
                )
                resp.raise_for_status()
                return resp.json()
        except Exception:
            return {
                "id": "weekly_status",
                "name": "סטטוס שבועי",
                "instructions": "התמקד בהתקדמות שהושגה, חסמים ויעדים לשבוע הקרוב.",
            }


service_clients = ServiceClients()
