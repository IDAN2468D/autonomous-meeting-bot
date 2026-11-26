import asyncio
from collections import deque
from datetime import datetime, timezone
import json
import logging
from typing import Any
from aiokafka import AIOKafkaConsumer, AIOKafkaProducer
from aiokafka.admin import AIOKafkaAdminClient, NewTopic
from aurameet_shared.config import settings

logger = logging.getLogger("aurameet.kafka")

TOPIC_MEETING_EVENTS = "meeting.events"
TOPIC_MEETING_SCHEDULE = "meeting.schedule"
TOPIC_MEETING_TRANSCRIPTS = "meeting.transcripts"
TOPIC_MEETING_PERSONAS = "meeting.personas"
TOPIC_MEETING_AUTH = "meeting.auth"
TOPIC_MEETING_ALERTS = "meeting.alerts"

ALL_TOPICS = [
    TOPIC_MEETING_EVENTS,
    TOPIC_MEETING_SCHEDULE,
    TOPIC_MEETING_TRANSCRIPTS,
    TOPIC_MEETING_PERSONAS,
    TOPIC_MEETING_AUTH,
    TOPIC_MEETING_ALERTS,
]


class KafkaService:
    def __init__(self, service_name: str | None = None, enable_consumer: bool = False) -> None:
        self._service_name = service_name or settings.SERVICE_NAME
        self._enable_consumer = enable_consumer
        self._producer: AIOKafkaProducer | None = None
        self._consumer: AIOKafkaConsumer | None = None
        self._consumer_task: asyncio.Task | None = None
        self._connected: bool = False
        self._recent_events: deque[dict[str, Any]] = deque(maxlen=100)

    @property
    def is_connected(self) -> bool:
        return self._connected

    async def _ensure_topics(self) -> None:
        admin = AIOKafkaAdminClient(bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS)
        try:
            await admin.start()
            existing = set(await admin.list_topics())
            missing = [
                NewTopic(name=t, num_partitions=1, replication_factor=1)
                for t in ALL_TOPICS
                if t not in existing
            ]
            if missing:
                await admin.create_topics(missing)
                logger.info("Created Kafka topics: %s", [t.name for t in missing])
        except Exception as exc:
            logger.warning("Topic auto-creation warning: %s", exc)
        finally:
            try:
                await admin.close()
            except Exception:
                pass

    async def start(self) -> None:
        if not settings.KAFKA_ENABLED:
            logger.info("[%s] Kafka is disabled via KAFKA_ENABLED=false", self._service_name)
            return

        for attempt in range(1, 6):
            try:
                await self._ensure_topics()
                self._producer = AIOKafkaProducer(
                    bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
                    value_serializer=lambda v: json.dumps(
                        v, ensure_ascii=False, default=str
                    ).encode("utf-8"),
                )
                await self._producer.start()

                if self._enable_consumer:
                    self._consumer = AIOKafkaConsumer(
                        *ALL_TOPICS,
                        bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
                        group_id=f"{settings.KAFKA_CONSUMER_GROUP}-{self._service_name}",
                        auto_offset_reset="latest",
                        value_deserializer=lambda v: json.loads(v.decode("utf-8")),
                    )
                    await self._consumer.start()
                    self._consumer_task = asyncio.create_task(self._consume_loop())

                self._connected = True
                logger.info(
                    "[%s] Kafka connected to %s",
                    self._service_name,
                    settings.KAFKA_BOOTSTRAP_SERVERS,
                )
                await self.publish(
                    TOPIC_MEETING_EVENTS,
                    {
                        "event_type": "service_started",
                        "service": self._service_name,
                        "topics": ALL_TOPICS,
                    },
                    key=self._service_name,
                )
                return
            except Exception as exc:
                logger.warning(
                    "[%s] Kafka connection attempt %d failed: %s",
                    self._service_name,
                    attempt,
                    exc,
                )
                await self._cleanup_clients()
                await asyncio.sleep(2)

        logger.error("[%s] Kafka unavailable after retries; degraded mode", self._service_name)

    async def stop(self) -> None:
        if self._consumer_task:
            self._consumer_task.cancel()
            try:
                await self._consumer_task
            except asyncio.CancelledError:
                pass
            self._consumer_task = None
        await self._cleanup_clients()

    async def _cleanup_clients(self) -> None:
        self._connected = False
        if self._consumer:
            try:
                await self._consumer.stop()
            except Exception:
                pass
            self._consumer = None
        if self._producer:
            try:
                await self._producer.stop()
            except Exception:
                pass
            self._producer = None

    async def publish(
        self, topic: str, payload: dict[str, Any], key: str | None = None
    ) -> bool:
        enriched = {
            **payload,
            "service": self._service_name,
            "topic": topic,
            "published_at": datetime.now(timezone.utc).isoformat(),
        }
        if not self._connected or self._producer is None:
            return False
        try:
            key_bytes = key.encode("utf-8") if key else None
            await self._producer.send_and_wait(topic, value=enriched, key=key_bytes)
            return True
        except Exception as exc:
            logger.warning("[%s] Failed to publish to %s: %s", self._service_name, topic, exc)
            return False

    async def _consume_loop(self) -> None:
        if self._consumer is None:
            return
        try:
            async for msg in self._consumer:
                record = {
                    "topic": msg.topic,
                    "partition": msg.partition,
                    "offset": msg.offset,
                    "key": msg.key.decode("utf-8") if msg.key else None,
                    "value": msg.value,
                    "received_at": datetime.now(timezone.utc).isoformat(),
                }
                self._recent_events.appendleft(record)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.warning("[%s] Kafka consumer loop error: %s", self._service_name, exc)

    def get_status(self) -> dict[str, Any]:
        return {
            "service": self._service_name,
            "enabled": settings.KAFKA_ENABLED,
            "connected": self._connected,
            "bootstrap_servers": settings.KAFKA_BOOTSTRAP_SERVERS,
            "topics": ALL_TOPICS,
            "consumed_buffer_size": len(self._recent_events),
        }

    def get_recent_events(self, limit: int = 20) -> list[dict[str, Any]]:
        return list(self._recent_events)[:limit]
