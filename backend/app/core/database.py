from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.core.config import settings


class Database:
    client: AsyncIOMotorClient | None = None
    db: AsyncIOMotorDatabase | None = None


db_manager = Database()


async def connect_to_mongo() -> None:
    db_manager.client = AsyncIOMotorClient(settings.MONGODB_URI)
    db_manager.db = db_manager.client[settings.MONGODB_DB_NAME]


async def close_mongo_connection() -> None:
    if db_manager.client:
        db_manager.client.close()


def get_db() -> AsyncIOMotorDatabase:
    if db_manager.db is None:
        raise RuntimeError("Database is not initialized")
    return db_manager.db
