"""
Mock data seeder for Voice AI Doctor Appointment Assistant.

Seeds five fictional doctors and their daily appointment slots for the next 7 days
in the Asia/Kolkata timezone.
Idempotent: safe to run repeatedly without creating duplicates or modifying existing appointments.
"""

from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Dict, List, Optional, Union

try:
    from zoneinfo import ZoneInfo
    try:
        APP_TIMEZONE = ZoneInfo("Asia/Kolkata")
    except Exception:
        APP_TIMEZONE = timezone(timedelta(hours=5, minutes=30), name="Asia/Kolkata")
except ImportError:
    APP_TIMEZONE = timezone(timedelta(hours=5, minutes=30), name="Asia/Kolkata")

try:
    from backend.database import get_db_connection, init_db
except ModuleNotFoundError:
    from database import get_db_connection, init_db

DOCTORS_DATA: List[Dict[str, Union[str, List[str]]]] = [
    {
        "name": "Dr. Priya Sharma",
        "speciality": "Cardiology",
        "slot_times": ["10:00", "11:00", "14:00"],
    },
    {
        "name": "Dr. Arjun Rao",
        "speciality": "General Medicine",
        "slot_times": ["09:00", "11:00", "15:00"],
    },
    {
        "name": "Dr. Neha Patel",
        "speciality": "Dermatology",
        "slot_times": ["10:00", "12:00", "16:00"],
    },
    {
        "name": "Dr. Rahul Verma",
        "speciality": "Orthopedics",
        "slot_times": ["09:00", "13:00", "15:00"],
    },
    {
        "name": "Dr. Anjali Reddy",
        "speciality": "Pediatrics",
        "slot_times": ["10:00", "12:00", "14:00"],
    },
]


async def seed_mock_data(
    db_path: Optional[Union[str, Path]] = None,
    days_ahead: int = 7,
) -> Dict[str, int]:
    """
    Seed initial doctors and their slots for today through the next `days_ahead` days.
    
    Guarantees:
    - Creates tables if they do not exist.
    - Idempotent: checks for existing doctors before insertion.
    - Uses INSERT OR IGNORE for slots based on UNIQUE(doctor_id, appointment_date, appointment_time).
    - Preserves all existing appointments and bookings.
    """
    await init_db(db_path)

    now = datetime.now(APP_TIMEZONE)
    today = now.date()

    async with get_db_connection(db_path) as conn:
        for doc in DOCTORS_DATA:
            # 1. Fetch or create doctor idempotently
            cursor = await conn.execute(
                "SELECT id FROM doctors WHERE name = ?", (doc["name"],)
            )
            row = await cursor.fetchone()
            if row:
                doctor_id = row[0]
            else:
                cursor = await conn.execute(
                    "INSERT INTO doctors (name, speciality) VALUES (?, ?)",
                    (doc["name"], doc["speciality"]),
                )
                doctor_id = cursor.lastrowid

            # 2. Seed slots for today + next `days_ahead` days
            for day_offset in range(0, days_ahead + 1):
                slot_date = (today + timedelta(days=day_offset)).isoformat()
                for slot_time in doc["slot_times"]:
                    await conn.execute(
                        """
                        INSERT OR IGNORE INTO slots (doctor_id, appointment_date, appointment_time)
                        VALUES (?, ?, ?)
                        """,
                        (doctor_id, slot_date, slot_time),
                    )

        await conn.commit()

        # Query counts for verification
        async with conn.execute("SELECT COUNT(*) FROM doctors") as cur:
            doc_count = (await cur.fetchone())[0]

        async with conn.execute("SELECT COUNT(*) FROM slots") as cur:
            slot_count = (await cur.fetchone())[0]

    return {
        "doctors_count": doc_count,
        "slots_count": slot_count,
    }


if __name__ == "__main__":
    import asyncio

    result = asyncio.run(seed_mock_data())
    print(f"Seeding completed successfully: {result}")
