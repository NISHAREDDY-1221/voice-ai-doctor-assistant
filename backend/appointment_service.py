"""
Appointment business logic service for Voice AI Doctor Appointment Assistant.

Handles doctor availability checks, slot booking, cancellations, phone number
normalization, and appointment queries using async SQLite operations.

VOICE CONFIRMATION BOUNDARY:
This database service layer strictly manages data operations and invariants.
It does NOT assume that a valid phone number implies caller confirmation.
During Pipecat voice pipeline integration, explicit voice read-back and user confirmation
must be enforced in the conversation state machine prior to calling these methods.
"""

from datetime import datetime, timezone, timedelta
from pathlib import Path
import re
from typing import Any, Dict, List, Optional, Union
import aiosqlite

try:
    from zoneinfo import ZoneInfo
    try:
        APP_TIMEZONE = ZoneInfo("Asia/Kolkata")
    except Exception:
        APP_TIMEZONE = timezone(timedelta(hours=5, minutes=30), name="Asia/Kolkata")
except ImportError:
    APP_TIMEZONE = timezone(timedelta(hours=5, minutes=30), name="Asia/Kolkata")

try:
    from backend.database import get_db_connection
except ModuleNotFoundError:
    from database import get_db_connection


def normalize_phone_number(phone: str) -> str:
    """
    Normalizes Indian phone numbers into standard E.164 format (+91XXXXXXXXXX).
    
    Supports formatting characters: spaces, hyphens, parentheses, and dots.
    Accepts:
      - 10-digit number starting with 6-9 (e.g., '9876543210', '98765 43210')
      - +91 prefixed (e.g., '+91 98765 43210', '+91-9876543210')
      - 91 prefixed 12-digit (e.g., '919876543210')
      - 0 prefixed 11-digit (e.g., '09876543210')
    
    Rejects invalid inputs by raising ValueError.
    """
    if not phone or not isinstance(phone, str) or not phone.strip():
        raise ValueError("Invalid phone number: must be a non-empty string.")

    # Remove all common formatting characters
    cleaned = re.sub(r"[\s\-\(\)\.]", "", phone.strip())

    if cleaned.startswith("+91"):
        digits = cleaned[3:]
    elif cleaned.startswith("91") and len(cleaned) == 12:
        digits = cleaned[2:]
    elif cleaned.startswith("0") and len(cleaned) == 11:
        digits = cleaned[1:]
    elif len(cleaned) == 10:
        digits = cleaned
    else:
        raise ValueError(
            f"Invalid phone number '{phone}'. Expected a 10-digit Indian phone number with optional +91 or 0 prefix."
        )

    if not digits.isdigit() or len(digits) != 10:
        raise ValueError(
            f"Invalid phone number '{phone}'. Extracted digits '{digits}' must be exactly 10 digits."
        )

    if digits[0] not in "6789":
        raise ValueError(
            f"Invalid Indian mobile number '{phone}'. Number must begin with 6, 7, 8, or 9."
        )

    return f"+91{digits}"


async def list_doctors(
    db_path: Optional[Union[str, Path]] = None
) -> List[Dict[str, Any]]:
    """Return all registered doctors."""
    async with get_db_connection(db_path) as conn:
        async with conn.execute(
            "SELECT id, name, speciality FROM doctors ORDER BY name ASC"
        ) as cur:
            rows = await cur.fetchall()
            return [
                {"id": row["id"], "name": row["name"], "speciality": row["speciality"]}
                for row in rows
            ]


async def check_doctor_availability(
    doctor_name: Optional[str] = None,
    speciality: Optional[str] = None,
    date: Optional[str] = None,
    db_path: Optional[Union[str, Path]] = None,
) -> Dict[str, Any]:
    """
    Query available future appointment slots.
    
    Features:
    - Filters by optional doctor_name (case-insensitive substring).
    - Filters by optional speciality (case-insensitive substring).
    - Filters by optional date (ISO YYYY-MM-DD).
    - Excludes slots with active booked appointments.
    - Excludes past slots using Asia/Kolkata timezone.
    - Handles unknown doctors and unavailable dates gracefully without crashing.
    """
    now = datetime.now(APP_TIMEZONE)
    today_iso = now.date().isoformat()
    current_time_str = now.strftime("%H:%M")

    # Validate date format if supplied
    if date:
        date_clean = date.strip()
        try:
            parsed_date = datetime.strptime(date_clean, "%Y-%m-%d").date()
        except ValueError:
            return {
                "success": False,
                "error": f"Invalid date format '{date}'. Please use YYYY-MM-DD.",
                "slots": [],
                "count": 0,
            }
        # If the requested date is strictly in the past, return 0 slots
        if parsed_date < now.date():
            return {
                "success": True,
                "message": f"Requested date {date_clean} is in the past. No available future slots.",
                "slots": [],
                "count": 0,
            }

    base_query = """
        SELECT 
            s.id AS slot_id,
            s.doctor_id,
            d.name AS doctor_name,
            d.speciality,
            s.appointment_date,
            s.appointment_time
        FROM slots s
        JOIN doctors d ON s.doctor_id = d.id
        WHERE NOT EXISTS (
            SELECT 1 FROM appointments a 
            WHERE a.slot_id = s.id AND a.status = 'booked'
        )
        AND (
            s.appointment_date > ? 
            OR (s.appointment_date = ? AND s.appointment_time > ?)
        )
    """
    params: List[Any] = [today_iso, today_iso, current_time_str]

    if doctor_name:
        clean_name = doctor_name.lower().replace("dr.", "").replace("dr", "").strip()
        base_query += " AND LOWER(d.name) LIKE ?"
        params.append(f"%{clean_name}%")

    if speciality:
        clean_spec = speciality.lower().strip()
        base_query += " AND LOWER(d.speciality) LIKE ?"
        params.append(f"%{clean_spec}%")

    if date:
        base_query += " AND s.appointment_date = ?"
        params.append(date.strip())

    base_query += " ORDER BY s.appointment_date ASC, s.appointment_time ASC, d.name ASC"

    async with get_db_connection(db_path) as conn:
        async with conn.execute(base_query, params) as cur:
            rows = await cur.fetchall()

    slots = [
        {
            "slot_id": row["slot_id"],
            "doctor_id": row["doctor_id"],
            "doctor_name": row["doctor_name"],
            "speciality": row["speciality"],
            "appointment_date": row["appointment_date"],
            "appointment_time": row["appointment_time"],
        }
        for row in rows
    ]

    return {
        "success": True,
        "count": len(slots),
        "slots": slots,
        "message": "Slots retrieved successfully." if slots else "No available slots found matching the criteria.",
    }


async def list_available_slots(
    doctor_id: Optional[int] = None,
    date: Optional[str] = None,
    db_path: Optional[Union[str, Path]] = None,
) -> List[Dict[str, Any]]:
    """Convenience helper to retrieve available future slots, optionally filtered by doctor ID or date."""
    res = await check_doctor_availability(date=date, db_path=db_path)
    slots = res.get("slots", [])
    if doctor_id is not None:
        slots = [s for s in slots if s["doctor_id"] == doctor_id]
    return slots


async def book_appointment(
    slot_id: int,
    phone_number: str,
    db_path: Optional[Union[str, Path]] = None,
) -> Dict[str, Any]:
    """
    Book an appointment for a specific slot and phone number.
    
    Guarantees:
    - Normalizes and validates Indian phone numbers.
    - Validates slot existence.
    - Rejects slots in the past.
    - Atomically prevents duplicate bookings using SQLite partial unique index.
    - Returns structured success/error response with appointment details.
    """
    # 1. Validate and normalize phone number
    try:
        norm_phone = normalize_phone_number(phone_number)
    except ValueError as e:
        return {
            "success": False,
            "error": str(e),
        }

    # 2. Check slot existence and retrieve details
    async with get_db_connection(db_path) as conn:
        async with conn.execute(
            """
            SELECT s.id, s.doctor_id, s.appointment_date, s.appointment_time,
                   d.name AS doctor_name, d.speciality
            FROM slots s
            JOIN doctors d ON s.doctor_id = d.id
            WHERE s.id = ?
            """,
            (slot_id,),
        ) as cur:
            slot = await cur.fetchone()

        if not slot:
            return {
                "success": False,
                "error": f"Slot with ID {slot_id} does not exist.",
            }

        # 3. Reject past slots
        now = datetime.now(APP_TIMEZONE)
        slot_dt = datetime.strptime(
            f"{slot['appointment_date']} {slot['appointment_time']}",
            "%Y-%m-%d %H:%M",
        ).replace(tzinfo=APP_TIMEZONE)

        if slot_dt <= now:
            return {
                "success": False,
                "error": f"Cannot book slot {slot_id}: slot date/time ({slot['appointment_date']} {slot['appointment_time']}) has already passed.",
            }

        # 4. Attempt atomic booking inside transaction
        now_iso = now.isoformat()
        try:
            # Check if an active booking already exists
            async with conn.execute(
                "SELECT id FROM appointments WHERE slot_id = ? AND status = 'booked'",
                (slot_id,),
            ) as cur:
                existing = await cur.fetchone()
                if existing:
                    return {
                        "success": False,
                        "error": f"Slot {slot_id} is already booked.",
                    }

            cursor = await conn.execute(
                """
                INSERT INTO appointments (slot_id, phone_number, status, created_at)
                VALUES (?, ?, 'booked', ?)
                """,
                (slot_id, norm_phone, now_iso),
            )
            await conn.commit()
            appointment_id = cursor.lastrowid
        except aiosqlite.IntegrityError:
            # Caught by idx_active_appointment_per_slot in case of concurrent bookings
            return {
                "success": False,
                "error": f"Slot {slot_id} was booked by another request. Please select a different slot.",
            }

    return {
        "success": True,
        "appointment_id": appointment_id,
        "doctor": slot["doctor_name"],
        "speciality": slot["speciality"],
        "date": slot["appointment_date"],
        "time": slot["appointment_time"],
        "phone_number": norm_phone,
        "status": "booked",
    }


async def cancel_appointment(
    phone_number: str,
    appointment_id: Optional[int] = None,
    db_path: Optional[Union[str, Path]] = None,
) -> Dict[str, Any]:
    """
    Cancel an appointment for a caller.
    
    Rules:
    - If appointment_id is given: verifies it exists, is active, and belongs to caller's phone number.
    - If appointment_id is not given:
        * Finds active ('booked') appointments using normalized phone number.
        * If exactly one active appointment exists: cancels it.
        * If multiple active appointments exist: returns matching active appointments and requires appointment_id.
    - Updates appointment status to 'cancelled' with cancelled_at timestamp (does not delete).
    - Cancelled slot immediately becomes available again for booking.
    """
    try:
        norm_phone = normalize_phone_number(phone_number)
    except ValueError as e:
        return {
            "success": False,
            "error": str(e),
        }

    now_iso = datetime.now(APP_TIMEZONE).isoformat()

    async with get_db_connection(db_path) as conn:
        # Case 1: Specific appointment_id provided
        if appointment_id is not None:
            async with conn.execute(
                """
                SELECT a.id, a.phone_number, a.status, s.appointment_date, s.appointment_time,
                       d.name AS doctor_name, d.speciality
                FROM appointments a
                JOIN slots s ON a.slot_id = s.id
                JOIN doctors d ON s.doctor_id = d.id
                WHERE a.id = ?
                """,
                (appointment_id,),
            ) as cur:
                target_appt = await cur.fetchone()

            if not target_appt:
                return {
                    "success": False,
                    "error": f"Appointment with ID {appointment_id} does not exist.",
                }

            if target_appt["phone_number"] != norm_phone:
                return {
                    "success": False,
                    "error": f"Unauthorized: Appointment {appointment_id} does not belong to phone number {norm_phone}.",
                }

            if target_appt["status"] == "cancelled":
                return {
                    "success": False,
                    "error": f"Appointment {appointment_id} is already cancelled.",
                }

            chosen = target_appt
            target_id = chosen["id"]

        # Case 2: No appointment_id provided -> find active appointments for caller
        else:
            query = """
                SELECT 
                    a.id AS appointment_id,
                    a.slot_id,
                    a.phone_number,
                    a.status,
                    a.created_at,
                    s.appointment_date,
                    s.appointment_time,
                    d.name AS doctor_name,
                    d.speciality
                FROM appointments a
                JOIN slots s ON a.slot_id = s.id
                JOIN doctors d ON s.doctor_id = d.id
                WHERE a.phone_number = ? AND a.status = 'booked'
                ORDER BY s.appointment_date ASC, s.appointment_time ASC
            """
            async with conn.execute(query, (norm_phone,)) as cur:
                active_appts = await cur.fetchall()

            if not active_appts:
                return {
                    "success": False,
                    "error": f"No active appointment found for phone number {norm_phone}.",
                }

            if len(active_appts) == 1:
                chosen = active_appts[0]
                target_id = chosen["appointment_id"]
            else:
                return {
                    "success": False,
                    "requires_appointment_id": True,
                    "message": "Multiple active appointments found. Please specify which appointment ID to cancel.",
                    "appointments": [
                        {
                            "appointment_id": a["appointment_id"],
                            "doctor": a["doctor_name"],
                            "speciality": a["speciality"],
                            "date": a["appointment_date"],
                            "time": a["appointment_time"],
                        }
                        for a in active_appts
                    ],
                }

        # Perform cancellation
        await conn.execute(
            """
            UPDATE appointments
            SET status = 'cancelled', cancelled_at = ?
            WHERE id = ?
            """,
            (now_iso, target_id),
        )
        await conn.commit()

    return {
        "success": True,
        "appointment_id": target_id,
        "doctor": chosen["doctor_name"],
        "speciality": chosen["speciality"],
        "date": chosen["appointment_date"],
        "time": chosen["appointment_time"],
        "phone_number": norm_phone,
        "status": "cancelled",
        "cancelled_at": now_iso,
    }


async def get_appointments_by_phone(
    phone_number: str,
    db_path: Optional[Union[str, Path]] = None,
) -> List[Dict[str, Any]]:
    """Return all appointments (both booked and cancelled) associated with a phone number."""
    norm_phone = normalize_phone_number(phone_number)
    async with get_db_connection(db_path) as conn:
        async with conn.execute(
            """
            SELECT 
                a.id AS appointment_id,
                a.slot_id,
                a.phone_number,
                a.status,
                a.created_at,
                a.cancelled_at,
                s.appointment_date,
                s.appointment_time,
                d.name AS doctor_name,
                d.speciality
            FROM appointments a
            JOIN slots s ON a.slot_id = s.id
            JOIN doctors d ON s.doctor_id = d.id
            WHERE a.phone_number = ?
            ORDER BY s.appointment_date DESC, s.appointment_time DESC
            """,
            (norm_phone,),
        ) as cur:
            rows = await cur.fetchall()
            return [
                {
                    "id": row["appointment_id"],
                    "appointment_id": row["appointment_id"],
                    "slot_id": row["slot_id"],
                    "phone_number": row["phone_number"],
                    "status": row["status"],
                    "created_at": row["created_at"],
                    "cancelled_at": row["cancelled_at"],
                    "date": row["appointment_date"],
                    "appointment_date": row["appointment_date"],
                    "time": row["appointment_time"],
                    "appointment_time": row["appointment_time"],
                    "doctor": row["doctor_name"],
                    "doctor_name": row["doctor_name"],
                    "speciality": row["speciality"],
                }
                for row in rows
            ]


async def list_appointments(
    phone_number: Optional[str] = None,
    status: Optional[str] = None,
    db_path: Optional[Union[str, Path]] = None,
) -> List[Dict[str, Any]]:
    """List appointments with optional phone_number and status ('booked'/'cancelled') filters."""
    query = """
        SELECT 
            a.id AS appointment_id,
            a.slot_id,
            a.phone_number,
            a.status,
            a.created_at,
            a.cancelled_at,
            s.appointment_date,
            s.appointment_time,
            d.name AS doctor_name,
            d.speciality
        FROM appointments a
        JOIN slots s ON a.slot_id = s.id
        JOIN doctors d ON s.doctor_id = d.id
        WHERE 1=1
    """
    params: List[Any] = []

    if phone_number:
        norm_phone = normalize_phone_number(phone_number)
        query += " AND a.phone_number = ?"
        params.append(norm_phone)

    if status:
        query += " AND a.status = ?"
        params.append(status.strip().lower())

    query += " ORDER BY s.appointment_date ASC, s.appointment_time ASC"

    async with get_db_connection(db_path) as conn:
        async with conn.execute(query, params) as cur:
            rows = await cur.fetchall()
            return [
                {
                    "id": row["appointment_id"],
                    "appointment_id": row["appointment_id"],
                    "slot_id": row["slot_id"],
                    "phone_number": row["phone_number"],
                    "status": row["status"],
                    "created_at": row["created_at"],
                    "cancelled_at": row["cancelled_at"],
                    "date": row["appointment_date"],
                    "appointment_date": row["appointment_date"],
                    "time": row["appointment_time"],
                    "appointment_time": row["appointment_time"],
                    "doctor": row["doctor_name"],
                    "doctor_name": row["doctor_name"],
                    "speciality": row["speciality"],
                }
                for row in rows
            ]
