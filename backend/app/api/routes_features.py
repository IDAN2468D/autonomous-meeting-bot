from datetime import datetime, timedelta, timezone
from bson import ObjectId
from fastapi import APIRouter, HTTPException
from app.core.database import get_db
from app.models.meeting import ScheduledMeetingCreate, SummaryTemplateCreate
from app.services.kafka_service import (
    TOPIC_MEETING_ALERTS,
    TOPIC_MEETING_EVENTS,
    TOPIC_MEETING_SCHEDULE,
    kafka_service,
)

router = APIRouter(prefix="/api/v1", tags=["Features & Analytics"])

BUILTIN_TEMPLATES = [
    {
        "id": "weekly_status",
        "name": "סטטוס שבועי",
        "category": "ניהול",
        "description": "תקציר התקדמות, חסמים מרכזיים ומשימות לשבוע הקרוב.",
        "instructions": "התמקד בהתקדמות שהושגה, חסמים/סיכונים שעלו ויעדים קונקרטיים לשבוע הקרוב.",
        "builtin": True,
    },
    {
        "id": "executive_brief",
        "name": "סיכום מנהלים (Executive)",
        "category": "הנהלה",
        "description": "החלטות מרכזיות, השפעה עסקית וצעדים הבאים בתמציתיות.",
        "instructions": "סכם בגישה ניהולית קצרה וממוקדת: החלטות שהתקבלו, השפעה עסקית, ולוחות זמנים.",
        "builtin": True,
    },
    {
        "id": "sales_discovery",
        "name": "פגישת מכירה ולקוחות",
        "category": "מכירות",
        "description": "צרכי לקוח, התנגדויות, הצעת ערך ו-Next Steps.",
        "instructions": "ציין את כאבי הלקוח, צרכים שעלו, התנגדויות וצעדי המשך לסגירת עסקה.",
        "builtin": True,
    },
    {
        "id": "tech_architecture",
        "name": "תכנון טכני וארכיטקטורה",
        "category": "פיתוח",
        "description": "החלטות ארכיטקטורה, APIs, סיכונים טכניים ומשימות פיתוח.",
        "instructions": "פרט החלטות ארכיטקטורה, תלויות טכניות, סיכונים ומשימות פיתוח ברורות.",
        "builtin": True,
    },
    {
        "id": "interview_eval",
        "name": "ראיון עבודה והערכה",
        "category": "גיוס",
        "description": "חוזקות המועמד, נקודות לבדיקה והמלצת המשך.",
        "instructions": "סכם את התרשמות הראיון, חוזקות מקצועיות, פערים אפשריים והמלצה לשלב הבא.",
        "builtin": True,
    },
]


async def get_template_by_id(template_id: str) -> dict:
    for tpl in BUILTIN_TEMPLATES:
        if tpl["id"] == template_id:
            return tpl
    db = get_db()
    if ObjectId.is_valid(template_id):
        doc = await db.summary_templates.find_one({"_id": ObjectId(template_id)})
        if doc:
            doc["id"] = str(doc.pop("_id"))
            doc["builtin"] = False
            return doc
    return BUILTIN_TEMPLATES[0]


@router.get("/templates")
async def list_templates() -> list[dict]:
    db = get_db()
    custom: list[dict] = []
    async for doc in db.summary_templates.find().sort("created_at", -1):
        doc["id"] = str(doc.pop("_id"))
        doc["builtin"] = False
        custom.append(doc)
    return BUILTIN_TEMPLATES + custom


@router.post("/templates")
async def create_template(payload: SummaryTemplateCreate) -> dict:
    db = get_db()
    doc = {
        "name": payload.name,
        "category": payload.category,
        "description": payload.description,
        "instructions": payload.instructions,
        "created_at": datetime.now(timezone.utc),
    }
    res = await db.summary_templates.insert_one(doc)
    doc["id"] = str(res.inserted_id)
    doc.pop("_id", None)
    doc["builtin"] = False
    await kafka_service.publish(
        TOPIC_MEETING_EVENTS,
        {
            "event_type": "template_created",
            "template_id": doc["id"],
            "name": doc["name"],
            "category": doc["category"],
        },
        key=doc["id"],
    )
    return doc


@router.delete("/templates/{template_id}")
async def delete_template(template_id: str) -> dict:
    if any(t["id"] == template_id for t in BUILTIN_TEMPLATES):
        raise HTTPException(status_code=400, detail="Cannot delete built-in template")
    if not ObjectId.is_valid(template_id):
        raise HTTPException(status_code=400, detail="Invalid template_id")
    db = get_db()
    res = await db.summary_templates.delete_one({"_id": ObjectId(template_id)})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")
    await kafka_service.publish(
        TOPIC_MEETING_EVENTS,
        {"event_type": "template_deleted", "template_id": template_id},
        key=template_id,
    )
    return {"status": "deleted"}


@router.get("/schedule")
async def list_scheduled_meetings() -> list[dict]:
    db = get_db()
    items: list[dict] = []
    async for doc in db.scheduled_meetings.find().sort("scheduled_at", 1):
        doc["id"] = str(doc.pop("_id"))
        items.append(doc)
    return items


@router.post("/schedule")
async def create_scheduled_meeting(payload: ScheduledMeetingCreate) -> dict:
    db = get_db()
    if not ObjectId.is_valid(payload.persona_id):
        raise HTTPException(status_code=400, detail="Invalid persona_id")
    persona = await db.personas.find_one({"_id": ObjectId(payload.persona_id)})
    if not persona:
        raise HTTPException(status_code=404, detail="Persona not found")

    doc = {
        "title": payload.title,
        "persona_id": payload.persona_id,
        "persona_name": persona["name"],
        "scheduled_at": payload.scheduled_at,
        "duration_minutes": payload.duration_minutes,
        "agenda": payload.agenda,
        "template_id": payload.template_id,
        "status": "scheduled",
        "created_at": datetime.now(timezone.utc),
    }
    res = await db.scheduled_meetings.insert_one(doc)
    doc["id"] = str(res.inserted_id)
    doc.pop("_id", None)
    await kafka_service.publish(
        TOPIC_MEETING_SCHEDULE,
        {
            "event_type": "meeting_scheduled",
            "meeting_id": doc["id"],
            "title": doc["title"],
            "persona_id": doc["persona_id"],
            "persona_name": doc["persona_name"],
            "scheduled_at": doc["scheduled_at"],
            "duration_minutes": doc["duration_minutes"],
            "agenda": doc["agenda"],
            "template_id": doc["template_id"],
        },
        key=doc["id"],
    )
    await kafka_service.publish(
        TOPIC_MEETING_ALERTS,
        {
            "event_type": "calendar_scheduled_alert",
            "severity": "info",
            "meeting_id": doc["id"],
            "message": f"פגישה חדשה תוזמנה: {doc['title']} עם {doc['persona_name']} בתאריך {doc['scheduled_at']}",
        },
        key=doc["id"],
    )
    return doc


@router.delete("/schedule/{meeting_id}")
async def delete_scheduled_meeting(meeting_id: str) -> dict:
    if not ObjectId.is_valid(meeting_id):
        raise HTTPException(status_code=400, detail="Invalid meeting_id")
    db = get_db()
    res = await db.scheduled_meetings.delete_one({"_id": ObjectId(meeting_id)})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Scheduled meeting not found")
    await kafka_service.publish(
        TOPIC_MEETING_SCHEDULE,
        {"event_type": "meeting_schedule_deleted", "meeting_id": meeting_id},
        key=meeting_id,
    )
    await kafka_service.publish(
        TOPIC_MEETING_ALERTS,
        {
            "event_type": "calendar_cancelled_alert",
            "severity": "warning",
            "meeting_id": meeting_id,
            "message": f"פגישה מתוזמנת בוטלה ({meeting_id})",
        },
        key=meeting_id,
    )
    return {"status": "deleted"}


@router.get("/stats")
async def get_dashboard_stats() -> dict:
    db = get_db()
    personas_count = await db.personas.count_documents({})
    scheduled_count = await db.scheduled_meetings.count_documents({})

    total_meetings = 0
    ended_meetings = 0
    total_messages = 0
    total_action_items = 0
    persona_counts: dict[str, int] = {}

    now = datetime.now(timezone.utc)
    daily_buckets: dict[str, int] = {}
    for i in range(6, -1, -1):
        day = (now - timedelta(days=i)).strftime("%Y-%m-%d")
        daily_buckets[day] = 0

    async for session in db.sessions.find():
        total_meetings += 1
        if session.get("status") == "ended":
            ended_meetings += 1
        transcript = session.get("transcript") or []
        total_messages += len(transcript)
        total_action_items += len(session.get("action_items") or [])

        p_name = session.get("persona_name") or "לא ידוע"
        persona_counts[p_name] = persona_counts.get(p_name, 0) + 1

        created = session.get("created_at")
        if isinstance(created, datetime):
            day_key = created.strftime("%Y-%m-%d")
            if day_key in daily_buckets:
                daily_buckets[day_key] += 1

    avg_messages = round(total_messages / total_meetings, 1) if total_meetings else 0

    return {
        "total_meetings": total_meetings,
        "ended_meetings": ended_meetings,
        "total_personas": personas_count,
        "scheduled_meetings": scheduled_count,
        "total_messages": total_messages,
        "total_action_items": total_action_items,
        "avg_messages_per_meeting": avg_messages,
        "daily_activity": [
            {"date": day, "count": count} for day, count in daily_buckets.items()
        ],
        "persona_breakdown": [
            {"name": name, "count": count}
            for name, count in sorted(
                persona_counts.items(), key=lambda x: x[1], reverse=True
            )
        ],
    }
