import uuid
from typing import Any
import httpx
from aurameet_shared.config import settings


class DIDService:
    def __init__(self) -> None:
        self.base_url = settings.DID_BASE_URL.rstrip("/")

    @property
    def mock_mode(self) -> bool:
        return settings.DID_MOCK_MODE

    def _headers(self) -> dict[str, str]:
        if not settings.DID_API_KEY:
            raise ValueError("DID_API_KEY is missing in .env")
        return {
            "Authorization": f"Basic {settings.DID_API_KEY}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    async def create_stream(self, source_url: str) -> dict[str, Any]:
        if self.mock_mode:
            return {
                "id": f"mock_stream_{uuid.uuid4().hex[:8]}",
                "session_id": f"mock_session_{uuid.uuid4().hex[:8]}",
                "offer": {"type": "offer", "sdp": "v=0\r\nmock-sdp"},
                "ice_servers": [],
                "mock": True,
            }

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{self.base_url}/talks/streams",
                headers=self._headers(),
                json={"source_url": source_url},
            )
            resp.raise_for_status()
            data = resp.json()
            data["mock"] = False
            return data

    async def send_sdp_answer(
        self, stream_id: str, did_session_id: str, answer: dict[str, Any]
    ) -> dict[str, Any]:
        if self.mock_mode:
            return {"status": "started", "mock": True}

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{self.base_url}/talks/streams/{stream_id}/sdp",
                headers=self._headers(),
                json={"answer": answer, "session_id": did_session_id},
            )
            resp.raise_for_status()
            return resp.json()

    async def send_ice_candidate(
        self, stream_id: str, did_session_id: str, candidate_payload: dict[str, Any]
    ) -> dict[str, Any]:
        if self.mock_mode:
            return {"status": "ok", "mock": True}

        payload = {**candidate_payload, "session_id": did_session_id}
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.post(
                f"{self.base_url}/talks/streams/{stream_id}/ice",
                headers=self._headers(),
                json=payload,
            )
            resp.raise_for_status()
            return resp.json()

    async def send_talk_script(
        self,
        stream_id: str,
        did_session_id: str,
        text: str,
        voice_id: str = "he-IL-AvriNeural",
    ) -> dict[str, Any]:
        if self.mock_mode:
            return {"status": "speaking_mock", "text": text, "mock": True}

        payload = {
            "script": {
                "type": "text",
                "input": text,
                "provider": {
                    "type": "microsoft",
                    "voice_id": voice_id,
                },
            },
            "driver_url": "bank://lively/",
            "config": {"stitch": True},
            "session_id": did_session_id,
        }
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{self.base_url}/talks/streams/{stream_id}",
                headers=self._headers(),
                json=payload,
            )
            resp.raise_for_status()
            return resp.json()

    async def close_stream(self, stream_id: str, did_session_id: str) -> None:
        if self.mock_mode:
            return

        async with httpx.AsyncClient(timeout=20.0) as client:
            await client.request(
                "DELETE",
                f"{self.base_url}/talks/streams/{stream_id}",
                headers=self._headers(),
                json={"session_id": did_session_id},
            )


did_service = DIDService()
