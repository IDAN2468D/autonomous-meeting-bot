# SPEC — Technical Architecture

## Tech Stack
- **Backend:** Python 3.11+, FastAPI, Pydantic v2, Motor (MongoDB Async), ChromaDB, Google GenAI SDK (`google-genai`), HTTPX.
- **Avatar Streaming:** D-ID Talks Streams API (`/talks/streams`, WebRTC SDP + ICE).
- **Frontend:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4 (RTL Hebrew), Lucide Icons.

## API Contract
- `GET /health` — בדיקת תקינות השרת ומצב Mock Mode.
- `POST /api/v1/personas` | `GET /api/v1/personas` | `DELETE /api/v1/personas/{id}` — ניהול פרסונות.
- `POST /api/v1/personas/{id}/knowledge` — העלאת קובץ PDF/TXT/MD ואינדוקס ל-ChromaDB.
- `POST /api/v1/sessions` — פתיחת סשן פגישה ואתחול D-ID WebRTC Stream.
- `POST /api/v1/sessions/{id}/sdp` — שליחת WebRTC SDP Answer.
- `POST /api/v1/sessions/{id}/ice` — החלפת ICE Candidates.
- `POST /api/v1/sessions/{id}/end` — סגירת Stream והפקת סיכום פגישה + Action Items.
- `GET /api/v1/sessions` | `GET /api/v1/sessions/{id}` — שליפת היסטוריית פגישות.
- `WS /ws/meeting/{session_id}` — ערוץ דו-כיווני בזמן אמת (טקסט/אודיו -> תמלול -> RAG -> Gemini -> D-ID).
