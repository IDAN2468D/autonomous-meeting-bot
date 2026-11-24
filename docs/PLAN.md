# PLAN — Implementation Roadmap

1. **שלב 1 — תשתית ומסמכים:** מבנה תיקיות, Docker Compose (MongoDB), הגדרות FastAPI ו-Next.js.
2. **שלב 2 — מנוע D-ID ו-WebRTC:** מימוש מלא של `DIDService` (Live + Mock Mode) ו-Signaling endpoints.
3. **שלב 3 — מוח LLM, תמלול ו-RAG:** חיבור `LLMService` (Gemini) ו-`RAGService` (ChromaDB) מעל WebSocket.
4. **שלב 4 — ממשק משתמש RTL:** חדר פגישה חי עם נגן WebRTC, הקלטת אודיו, ניהול פרסונות והעלאת מסמכים.
5. **שלב 5 — היסטוריה, סיכומים ובדיקות:** סיכום אוטומטי בסיום פגישה, היסטוריית פגישות ובדיקות `pytest`.
