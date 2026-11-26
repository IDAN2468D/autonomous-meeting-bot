import pytest
from fastapi.testclient import TestClient
from aurameet_shared.kafka_client import KafkaService, TOPIC_MEETING_EVENTS
from app.main import app


def test_analytics_health_endpoint():
    with TestClient(app) as client:
        resp = client.get("/health")
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "ok"
        assert body["service"] == "analytics-service"


def test_builtin_template_fetch_and_delete_guard():
    with TestClient(app) as client:
        resp = client.get("/api/v1/templates/weekly_status")
        assert resp.status_code == 200
        assert resp.json()["builtin"] is True

        del_resp = client.delete("/api/v1/templates/weekly_status")
        assert del_resp.status_code == 400


def test_kafka_status_and_events_endpoints():
    with TestClient(app) as client:
        resp = client.get("/api/v1/kafka/status")
        assert resp.status_code == 200
        body = resp.json()
        assert body["service"] == "analytics-service"
        assert TOPIC_MEETING_EVENTS in body["topics"]

        ev_resp = client.get("/api/v1/kafka/events?limit=10")
        assert ev_resp.status_code == 200
        assert isinstance(ev_resp.json(), list)


@pytest.mark.asyncio
async def test_kafka_degraded_publish():
    svc = KafkaService(service_name="analytics-test", enable_consumer=False)
    published = await svc.publish(TOPIC_MEETING_EVENTS, {"event_type": "unit_test"})
    assert published is False
