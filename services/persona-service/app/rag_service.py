import uuid
from aurameet_shared.config import settings


class RAGService:
    def __init__(self) -> None:
        self._client = None
        self._collection = None

    def _get_collection(self):
        if self._collection is None:
            import chromadb

            self._client = chromadb.PersistentClient(path=settings.CHROMA_PERSIST_DIR)
            self._collection = self._client.get_or_create_collection(
                name="meeting_knowledge"
            )
        return self._collection

    def _chunk_text(
        self, text: str, chunk_size: int = 600, overlap: int = 80
    ) -> list[str]:
        cleaned = " ".join(text.split())
        if not cleaned:
            return []
        chunks: list[str] = []
        start = 0
        while start < len(cleaned):
            end = start + chunk_size
            chunks.append(cleaned[start:end])
            start += chunk_size - overlap
        return chunks

    def index_document(self, persona_id: str, filename: str, content: str) -> int:
        chunks = self._chunk_text(content)
        if not chunks:
            return 0
        collection = self._get_collection()
        ids = [f"{persona_id}_{uuid.uuid4().hex[:8]}" for _ in chunks]
        metadatas = [{"persona_id": persona_id, "filename": filename} for _ in chunks]
        collection.add(documents=chunks, metadatas=metadatas, ids=ids)
        return len(chunks)

    def retrieve_context(self, persona_id: str, query: str, n_results: int = 3) -> str:
        collection = self._get_collection()
        if collection.count() == 0:
            return ""
        existing = collection.get(where={"persona_id": persona_id})
        matched_ids = existing.get("ids", [])
        if not matched_ids:
            return ""

        safe_n = min(n_results, len(matched_ids))
        results = collection.query(
            query_texts=[query],
            n_results=safe_n,
            where={"persona_id": persona_id},
        )
        docs = results.get("documents", [[]])[0]
        return "\n---\n".join(docs) if docs else ""


rag_service = RAGService()
