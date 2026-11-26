import pytest
from fastapi.testclient import TestClient
from aurameet_shared.errors import UnauthorizedError
from aurameet_shared.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)
from app.main import app


def test_auth_health_endpoint():
    with TestClient(app) as client:
        resp = client.get("/health")
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "ok"
        assert body["service"] == "auth-service"
        assert "auth_required" in body


def test_centralized_validation_error():
    with TestClient(app) as client:
        resp = client.post("/api/v1/auth/login", json={"email": "x"})
        assert resp.status_code == 422
        body = resp.json()
        assert body["error"]["code"] == "VALIDATION_ERROR"
        assert "request_id" in body["error"]


def test_jwt_and_password_hashing():
    hashed = hash_password("SuperSecret123!")
    assert verify_password("SuperSecret123!", hashed) is True
    assert verify_password("WrongPass", hashed) is False

    token = create_access_token("user123", "test@example.com", "Test User")
    claims = decode_access_token(token)
    assert claims["sub"] == "user123"
    assert claims["email"] == "test@example.com"

    with pytest.raises(UnauthorizedError):
        decode_access_token("invalid.jwt.token")


def test_avatar_upload_rejects_invalid_extension():
    with TestClient(app) as client:
        resp = client.post(
            "/api/v1/auth/avatar/upload",
            files={"file": ("malware.exe", b"binary", "application/octet-stream")},
        )
        assert resp.status_code == 400
        assert resp.json()["error"]["code"] == "BAD_REQUEST"
