import asyncio
import base64
import io
import json
import logging
from typing import Any
from google import genai
from google.genai import types
from openai import AsyncOpenAI
from app.core.config import settings

logger = logging.getLogger("meeting_bot.llm")


def _estimate_tokens(text: str) -> int:
    if not text:
        return 0
    return max(1, len(text) // 4)


class LLMService:
    def __init__(self) -> None:
        self._gemini_client: genai.Client | None = None
        self._openai_client: AsyncOpenAI | None = None

    def resolve_provider(self) -> str:
        configured = settings.LLM_PROVIDER.strip().lower()
        if configured in {"gemini", "openai", "demo"}:
            if configured == "gemini" and not settings.GEMINI_API_KEY:
                return "openai" if settings.OPENAI_API_KEY else "demo"
            if configured == "openai" and not settings.OPENAI_API_KEY:
                return "gemini" if settings.GEMINI_API_KEY else "demo"
            return configured

        # Auto mode: prefer Gemini (existing setup), then OpenAI, then built-in Demo
        if settings.GEMINI_API_KEY:
            return "gemini"
        if settings.OPENAI_API_KEY:
            return "openai"
        return "demo"

    def _get_gemini(self) -> genai.Client:
        if self._gemini_client is None:
            if not settings.GEMINI_API_KEY:
                raise ValueError("GEMINI_API_KEY is missing in .env")
            self._gemini_client = genai.Client(api_key=settings.GEMINI_API_KEY)
        return self._gemini_client

    def _get_openai(self) -> AsyncOpenAI:
        if self._openai_client is None:
            if not settings.OPENAI_API_KEY:
                raise ValueError("OPENAI_API_KEY is missing in .env")
            self._openai_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        return self._openai_client

    async def _gemini_generate_with_fallback(
        self, contents: Any, config: types.GenerateContentConfig
    ) -> tuple[Any, str]:
        client = self._get_gemini()
        model_name = settings.GEMINI_MODEL
        last_exc: Exception | None = None

        for attempt in range(3):
            try:
                resp = await client.aio.models.generate_content(
                    model=model_name,
                    contents=contents,
                    config=config,
                )
                return resp, model_name
            except Exception as exc:
                last_exc = exc
                msg = str(exc)
                is_transient = any(
                    code in msg for code in ("503", "UNAVAILABLE", "429", "RESOURCE_EXHAUSTED", "overloaded")
                )
                logger.warning(
                    "Gemini call failed (model=%s, attempt=%d/3): %s",
                    model_name,
                    attempt + 1,
                    msg[:160],
                )
                if is_transient and attempt < 2:
                    await asyncio.sleep(0.8 * (attempt + 1))
                    continue
                break
        if last_exc:
            raise last_exc
        raise RuntimeError("Gemini generation failed")

    async def generate_meeting_reply_with_usage(
        self,
        system_prompt: str,
        agenda: str,
        rag_context: str,
        history: list[dict[str, Any]],
        user_message: str,
        language: str = "he",
        screen_image_bytes: bytes | None = None,
        long_term_memory: str = "",
    ) -> tuple[str, dict[str, Any]]:
        provider = self.resolve_provider()
        lang_instruction = (
            "Respond strictly in natural spoken Hebrew."
            if language == "he"
            else "Respond strictly in natural spoken English."
        )
        memory_block = (
            f"Long-Term Memory from Previous Meetings:\n{long_term_memory}\n"
            if long_term_memory
            else ""
        )
        full_system = (
            f"{system_prompt}\n"
            f"Meeting Agenda: {agenda or 'General meeting'}\n"
            f"{memory_block}"
            f"Relevant Personal Knowledge (RAG):\n{rag_context or 'None'}\n"
            f"Rules: {lang_instruction} Keep replies conversational and concise (max 2-3 short sentences) "
            "because they are spoken aloud by a live video avatar. Never use markdown bullets or emojis."
        )

        formatted_history = "\n".join(
            f"{'Participant' if m['speaker'] == 'participant' else 'You'}: {m['text']}"
            for m in history[-10:]
        )
        prompt = (
            f"Conversation so far:\n{formatted_history}\n\n"
            f"Participant just said: {user_message}\n"
            "Your spoken reply:"
        )

        if provider == "demo":
            reply = self._demo_reply(user_message, agenda, rag_context, language)
            usage = {
                "provider": "demo",
                "model": "demo-simulator",
                "prompt_tokens": _estimate_tokens(full_system + prompt),
                "completion_tokens": _estimate_tokens(reply),
                "total_tokens": _estimate_tokens(full_system + prompt + reply),
            }
            return reply, usage

        if provider == "openai":
            client = self._get_openai()
            user_content: Any = prompt
            if screen_image_bytes:
                b64_img = base64.b64encode(screen_image_bytes).decode("ascii")
                user_content = [
                    {
                        "type": "text",
                        "text": f"The participant is currently sharing their screen.\n{prompt}",
                    },
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:image/jpeg;base64,{b64_img}"},
                    },
                ]
            resp = await client.chat.completions.create(
                model=settings.OPENAI_MODEL,
                messages=[
                    {"role": "system", "content": full_system},
                    {"role": "user", "content": user_content},
                ],
                temperature=settings.LLM_TEMPERATURE,
                max_tokens=settings.LLM_MAX_TOKENS,
                top_p=settings.LLM_TOP_P,
            )
            reply = (resp.choices[0].message.content or "").strip()
            usage_obj = resp.usage
            usage = {
                "provider": "openai",
                "model": settings.OPENAI_MODEL,
                "prompt_tokens": getattr(usage_obj, "prompt_tokens", _estimate_tokens(full_system + prompt)),
                "completion_tokens": getattr(usage_obj, "completion_tokens", _estimate_tokens(reply)),
                "total_tokens": getattr(usage_obj, "total_tokens", _estimate_tokens(full_system + prompt + reply)),
            }
            return reply, usage

        # Default: Gemini strictly locked to settings.GEMINI_MODEL (with transient retries)
        contents: Any = prompt
        if screen_image_bytes:
            contents = [
                types.Part.from_bytes(data=screen_image_bytes, mime_type="image/jpeg"),
                f"The participant is currently sharing their screen (attached image).\n{prompt}",
            ]

        response, used_model = await self._gemini_generate_with_fallback(
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=full_system,
                temperature=settings.LLM_TEMPERATURE,
                max_output_tokens=settings.LLM_MAX_TOKENS,
                top_p=settings.LLM_TOP_P,
            ),
        )
        reply = (response.text or "").strip()
        meta = getattr(response, "usage_metadata", None)
        prompt_toks = getattr(meta, "prompt_token_count", None) or _estimate_tokens(full_system + prompt)
        comp_toks = getattr(meta, "candidates_token_count", None) or _estimate_tokens(reply)
        total_toks = getattr(meta, "total_token_count", None) or (prompt_toks + comp_toks)
        usage = {
            "provider": "gemini",
            "model": used_model,
            "prompt_tokens": int(prompt_toks),
            "completion_tokens": int(comp_toks),
            "total_tokens": int(total_toks),
        }
        return reply, usage

    async def generate_meeting_reply(
        self,
        system_prompt: str,
        agenda: str,
        rag_context: str,
        history: list[dict[str, Any]],
        user_message: str,
        language: str = "he",
        screen_image_bytes: bytes | None = None,
        long_term_memory: str = "",
    ) -> str:
        reply, _ = await self.generate_meeting_reply_with_usage(
            system_prompt=system_prompt,
            agenda=agenda,
            rag_context=rag_context,
            history=history,
            user_message=user_message,
            language=language,
            screen_image_bytes=screen_image_bytes,
            long_term_memory=long_term_memory,
        )
        return reply

    async def generate_opening_greeting(
        self, persona_name: str, role_title: str, agenda: str, language: str = "he"
    ) -> str:
        if language == "en":
            agenda_part = f" Today we are covering {agenda}." if agenda else ""
            return f"Hi everyone, I'm {persona_name}, {role_title}, joining autonomously.{agenda_part} Ready whenever you are."
        agenda_part = f" היום נעבור על {agenda}." if agenda else ""
        return f"שלום לכולם, אני {persona_name}, {role_title}, מצטרף לפגישה באופן אוטונומי.{agenda_part} אפשר להתחיל."

    async def transcribe_audio(
        self, audio_bytes: bytes, mime_type: str = "audio/webm", language: str = "he"
    ) -> str:
        provider = self.resolve_provider()
        if provider == "demo":
            return (
                "שלום, מה הסטטוס העדכני של הפרויקט?"
                if language == "he"
                else "Hi, what is the latest status on the project?"
            )

        if provider == "openai":
            client = self._get_openai()
            ext = "webm" if "webm" in mime_type else "wav"
            audio_file = io.BytesIO(audio_bytes)
            audio_file.name = f"speech.{ext}"
            transcript = await client.audio.transcriptions.create(
                model=settings.OPENAI_WHISPER_MODEL,
                file=audio_file,
                language=language,
            )
            return (transcript.text or "").strip()

        prompt = (
            "Transcribe this spoken audio accurately in Hebrew. Return only the raw transcription text."
            if language == "he"
            else "Transcribe this spoken audio accurately in English. Return only the raw transcription text."
        )
        response, _ = await self._gemini_generate_with_fallback(
            contents=[
                types.Part.from_bytes(data=audio_bytes, mime_type=mime_type),
                prompt,
            ],
            config=types.GenerateContentConfig(temperature=0.0),
        )
        return (response.text or "").strip()

    async def summarize_meeting(
        self,
        title: str,
        transcript: list[dict[str, Any]],
        template_name: str | None = None,
        template_instructions: str | None = None,
    ) -> dict[str, Any]:
        if not transcript:
            return {"summary": "הפגישה הסתיימה ללא תמליל.", "action_items": [], "key_facts": []}

        provider = self.resolve_provider()
        if provider == "demo":
            turns = len(transcript)
            return {
                "summary": f"סיכום מצב Demo עבור הפגישה '{title}' ({turns} הודעות). התקיים דיון ממוקד בהתאם לאג'נדה והוגדרו צעדי המשך.",
                "action_items": [
                    "סקירת סיכום הפגישה והפצתו למשתתפים",
                    "מעקב אחר המשימות שהועלו בדיון",
                ],
                "key_facts": [f"התקיימה פגישה בנושא {title} עם {turns} חילופי דברים."],
            }

        joined = "\n".join(f"{t['speaker']}: {t['text']}" for t in transcript)
        template_block = (
            f"\nתבנית סיכום נבחרת ({template_name}): {template_instructions}\n"
            if template_instructions
            else ""
        )
        prompt = (
            f"סכם את הפגישה '{title}' בעברית מתוך התמליל הבא.{template_block}\n"
            "החזר אך ורק JSON תקני במבנה:\n"
            '{"summary": "תקציר ברור של 3-5 משפטים לפי התבנית", "action_items": ["משימה 1", "משימה 2"], "key_facts": ["עובדה חשובה לזיכרון ארוך-טווח 1"]}\n\n'
            f"תמליל:\n{joined}"
        )

        if provider == "openai":
            client = self._get_openai()
            resp = await client.chat.completions.create(
                model=settings.OPENAI_MODEL,
                messages=[{"role": "user", "content": prompt}],
                response_format={"type": "json_object"},
                temperature=0.3,
            )
            raw = resp.choices[0].message.content or "{}"
        else:
            response, _ = await self._gemini_generate_with_fallback(
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.3,
                ),
            )
            raw = response.text or "{}"

        try:
            parsed = json.loads(raw)
            parsed.setdefault("action_items", [])
            parsed.setdefault("key_facts", [])
            return parsed
        except json.JSONDecodeError:
            return {"summary": raw.strip(), "action_items": [], "key_facts": []}

    def _demo_reply(
        self, user_message: str, agenda: str, rag_context: str, language: str
    ) -> str:
        snippet = rag_context[:120].strip() if rag_context else ""
        if language == "en":
            base = f"Got it regarding '{user_message[:60]}'."
            if snippet:
                return f"{base} Based on my knowledge base, {snippet}."
            return f"{base} Let's align this with our agenda on {agenda or 'the current sprint'} and follow up right after."
        base = f"הבנתי לגבי '{user_message[:60]}'."
        if snippet:
            return f"{base} לפי בסיס הידע שלי, {snippet}."
        return f"{base} בוא נשלב את זה במסגרת האג'נדה של {agenda or 'הפגישה הנוכחית'} ונסכם את צעדי ההמשך."


llm_service = LLMService()
