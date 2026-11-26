import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.memory_service import MemoryService
from app.rag_service import RAGService


def test_persona_health_endpoint():
    with TestClient(app) as client:
        resp = client.get("/health")
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "ok"
        assert body["service"] == "persona-service"


def test_rag_chunking_with_overlap():
    rag = RAGService()
    text = "שלום עולם " * 200
    chunks = rag._chunk_text(text, chunk_size=200, overlap=40)
    assert len(chunks) > 1
    assert all(len(c) <= 200 for c in chunks)
    assert rag._chunk_text("   ") == []


def test_invalid_persona_id_returns_400():
    with TestClient(app) as client:
        resp = client.get("/api/v1/personas/not-an-objectid")
        assert resp.status_code == 400
        resp_mem = client.get("/api/v1/personas/not-an-objectid/memories")
        assert resp_mem.status_code == 400


@pytest.mark.asyncio
async def test_memory_service_ignores_empty_facts():
    svc = MemoryService()
    count = await svc.save_long_term_memories("p1", "s1", "Weekly", ["", "   "])
    assert count == 0
