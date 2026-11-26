import asyncio
from typing import Any
import edge_tts
import httpx
from aurameet_shared.config import settings


class SimliService:
    def __init__(self) -> None:
        self.base_url = settings.SIMLI_API_URL.rstrip("/")

    async def create_session_token(self, face_id: str | None = None) -> dict[str, Any]:
        if not settings.SIMLI_API_KEY:
            raise ValueError("SIMLI_API_KEY is missing in .env")

        payload = {
            "faceId": face_id or settings.SIMLI_FACE_ID,
            "handleSilence": True,
            "maxSessionLength": 600,
            "maxIdleTime": 180,
        }
        headers = {
            "x-simli-api-key": settings.SIMLI_API_KEY,
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{self.base_url}/compose/token",
                headers=headers,
                json=payload,
            )
            resp.raise_for_status()
            return resp.json()

    async def text_to_pcm16(
        self, text: str, voice_id: str = "he-IL-AvriNeural"
    ) -> bytes:
        cleaned = text.strip()
        if not cleaned:
            return b""

        communicate = edge_tts.Communicate(text=cleaned, voice=voice_id)
        mp3_chunks: list[bytes] = []
        async for chunk in communicate.stream():
            if chunk.get("type") == "audio" and chunk.get("data"):
                mp3_chunks.append(chunk["data"])

        mp3_bytes = b"".join(mp3_chunks)
        if not mp3_bytes:
            return b""

        proc = await asyncio.create_subprocess_exec(
            "ffmpeg",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            "pipe:0",
            "-f",
            "s16le",
            "-acodec",
            "pcm_s16le",
            "-ar",
            "16000",
            "-ac",
            "1",
            "pipe:1",
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        pcm_bytes, stderr = await proc.communicate(input=mp3_bytes)
        if proc.returncode != 0:
            raise RuntimeError(
                f"ffmpeg PCM16 conversion failed: {stderr.decode(errors='ignore')}"
            )
        return pcm_bytes


simli_service = SimliService()
