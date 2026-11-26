from datetime import datetime, timezone
import logging
import uuid
from typing import Any
from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

logger = logging.getLogger("aurameet.errors")


class AppError(Exception):
    def __init__(
        self,
        message: str,
        status_code: int = 500,
        code: str = "INTERNAL_ERROR",
        details: Any = None,
    ) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.code = code
        self.details = details


class NotFoundError(AppError):
    def __init__(self, message: str = "Resource not found", details: Any = None) -> None:
        super().__init__(message=message, status_code=404, code="NOT_FOUND", details=details)


class BadRequestError(AppError):
    def __init__(self, message: str = "Bad request", details: Any = None) -> None:
        super().__init__(message=message, status_code=400, code="BAD_REQUEST", details=details)


class UnauthorizedError(AppError):
    def __init__(self, message: str = "Authentication required", details: Any = None) -> None:
        super().__init__(message=message, status_code=401, code="UNAUTHORIZED", details=details)


class ExternalServiceError(AppError):
    def __init__(self, service: str, message: str, details: Any = None) -> None:
        super().__init__(
            message=f"{service} error: {message}",
            status_code=502,
            code="EXTERNAL_SERVICE_ERROR",
            details=details,
        )


def _error_payload(
    code: str, message: str, details: Any = None, request_id: str | None = None
) -> dict[str, Any]:
    return {
        "detail": message,
        "error": {
            "code": code,
            "message": message,
            "details": details,
            "request_id": request_id or uuid.uuid4().hex[:12],
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
    }


def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def handle_app_error(_: Request, exc: AppError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=_error_payload(exc.code, exc.message, exc.details),
        )

    @app.exception_handler(HTTPException)
    async def handle_http_exception(_: Request, exc: HTTPException) -> JSONResponse:
        msg = exc.detail if isinstance(exc.detail, str) else "HTTP error"
        details = None if isinstance(exc.detail, str) else exc.detail
        return JSONResponse(
            status_code=exc.status_code,
            content=_error_payload(f"HTTP_{exc.status_code}", msg, details),
        )

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(
        _: Request, exc: RequestValidationError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content=_error_payload(
                "VALIDATION_ERROR",
                "Invalid request payload",
                exc.errors(),
            ),
        )

    @app.exception_handler(Exception)
    async def handle_unexpected_error(request: Request, exc: Exception) -> JSONResponse:
        req_id = uuid.uuid4().hex[:12]
        logger.exception("Unhandled error [%s] on %s: %s", req_id, request.url.path, exc)
        return JSONResponse(
            status_code=500,
            content=_error_payload(
                "INTERNAL_SERVER_ERROR",
                "An unexpected server error occurred",
                str(exc),
                request_id=req_id,
            ),
        )
