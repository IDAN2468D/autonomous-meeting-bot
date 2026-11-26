import pytest
from fastapi.testclient import TestClient
from aurameet_shared.config import settings
from app.clients import ServiceClients
from app.did_service import DIDService
from app.main import app


def test_meeting_health_endpoint():
    with TestClient(app) as client:
        resp = client.get("/health")
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "ok"
        assert body["service"] == "meeting-service"
        assert "mock_mode" in body


@pytest.mark.asyncio
async def test_did_service_mock_mode(monkeypatch):
    monkeypatch.setattr(settings, "DID_MOCK_MODE", True)
    svc = DIDService()
    stream = await svc.create_stream("https://example.com/avatar.jpg")
    assert stream["mock"] is True
    assert stream["id"].startswith("mock_stream_")

    sdp = await svc.send_sdp_answer(stream["id"], stream["session_id"], {"type": "answer"})
    assert sdp["status"] == "started"

    talk = await svc.send_talk_script(stream["id"], stream["session_id"], "בדיקה")
    assert talk["status"] == "speaking_mock"


def test_invalid_session_id_returns_400():
    with TestClient(app) as client:
        resp = client.get("/api/v1/sessions/invalid-id")
        assert resp.status_code == 400


@pytest.mark.asyncio
async def test_service_clients_graceful_fallback(monkeypatch):
    monkeypatch.setattr(settings, "PERSONA_SERVICE_URL", "http://127.0.0.1:59999")
    monkeypatch.setattr(settings, "ANALYTICS_SERVICE_URL", "http://127.0.0.1:59999")
    clients = ServiceClients()
    ctx = await clients.persona_retrieve_context("p1", "test")
    assert ctx == {"rag_context": "", "long_term_memory": ""}

    tpl = await clients.analytics_get_template("weekly_status")
    assert tpl["id"] == "weekly_status"
