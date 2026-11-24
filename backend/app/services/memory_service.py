from datetime import datetime, timezone
from typing import Any
from app.core.database import get_db


class MemoryService:
    async def save_long_term_memories(
        self,
        persona_id: str,
        session_id: str,
        meeting_title: str,
        facts: list[str],
    ) -> int:
        cleaned = [f.strip() for f in facts if isinstance(f, str) and f.strip()]
        if not cleaned:
            return 0
        db = get_db()
        now = datetime.now(timezone.utc)
        docs = [
            {
                "persona_id": persona_id,
                "session_id": session_id,
                "meeting_title": meeting_title,
                "fact": fact,
                "created_at": now,
            }
            for fact in cleaned[:8]
        ]
        await db.memories.insert_many(docs)
        return len(docs)

    async def get_long_term_memory_context(
        self, persona_id: str, limit: int = 8
    ) -> str:
        db = get_db()
        cursor = (
            db.memories.find({"persona_id": persona_id})
            .sort("created_at", -1)
            .limit(limit)
        )
        lines: list[str] = []
        async for doc in cursor:
            title = doc.get("meeting_title", "Past meeting")
            fact = doc.get("fact", "")
            if fact:
                lines.append(f"- [{title}] {fact}")
        return "\n".join(lines)

    async def list_memories(self, persona_id: str, limit: int = 25) -> list[dict[str, Any]]:
        db = get_db()
        cursor = (
            db.memories.find({"persona_id": persona_id})
            .sort("created_at", -1)
            .limit(limit)
        )
        items: list[dict[str, Any]] = []
        async for doc in cursor:
            items.append(
                {
                    "id": str(doc["_id"]),
                    "persona_id": doc["persona_id"],
                    "session_id": doc.get("session_id", ""),
                    "meeting_title": doc.get("meeting_title", ""),
                    "fact": doc.get("fact", ""),
                    "created_at": doc["created_at"],
                }
            )
        return items


memory_service = MemoryService()
