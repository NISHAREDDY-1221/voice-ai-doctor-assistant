"""
SQLite database module for Voice AI Doctor Appointment Assistant.

Provides async connection handling, table schemas, and idempotent initialization
using aiosqlite with foreign key constraints and active appointment partial indexes.
"""

from contextlib import asynccontextmanager
from pathlib import Path
from typing import AsyncIterator, Optional, Union
import aiosqlite

# Resolve database path relative to this file's location
DEFAULT_DB_PATH = Path(__file__).resolve().parent / "appointments.db"

# Schema definitions
SCHEMA_SQL = """
PRAGMA foreign_keys = ON;

-- Doctors Table
CREATE TABLE IF NOT EXISTS doctors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    speciality TEXT NOT NULL
);

-- Slots Table
CREATE TABLE IF NOT EXISTS slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    doctor_id INTEGER NOT NULL,
    appointment_date TEXT NOT NULL,
    appointment_time TEXT NOT NULL,
    FOREIGN KEY (doctor_id) REFERENCES doctors(id) ON DELETE CASCADE,
    UNIQUE (doctor_id, appointment_date, appointment_time)
);

-- Appointments Table
CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slot_id INTEGER NOT NULL,
    phone_number TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('booked', 'cancelled')),
    created_at TEXT NOT NULL,
    cancelled_at TEXT,
    FOREIGN KEY (slot_id) REFERENCES slots(id) ON DELETE CASCADE
);

-- Partial unique index ensuring at most one active ('booked') appointment per slot.
-- When an appointment is cancelled, the slot automatically becomes bookable again.
CREATE UNIQUE INDEX IF NOT EXISTS idx_active_appointment_per_slot 
ON appointments(slot_id) 
WHERE status = 'booked';
"""


@asynccontextmanager
async def get_db_connection(
    db_path: Optional[Union[str, Path]] = None
) -> AsyncIterator[aiosqlite.Connection]:
    """
    Async context manager providing an aiosqlite connection with:
    1. Foreign keys enabled (PRAGMA foreign_keys = ON).
    2. Row factory configured to aiosqlite.Row for dict-like column access.
    3. Safe cleanup and closure on exit.
    """
    target_path = Path(db_path) if db_path is not None else DEFAULT_DB_PATH
    conn = await aiosqlite.connect(str(target_path))
    conn.row_factory = aiosqlite.Row
    await conn.execute("PRAGMA foreign_keys = ON;")
    try:
        yield conn
    finally:
        await conn.close()


async def init_db(db_path: Optional[Union[str, Path]] = None) -> None:
    """
    Initialize database schema idempotently.
    Safe to call multiple times without altering existing data or constraints.
    """
    async with get_db_connection(db_path) as conn:
        await conn.executescript(SCHEMA_SQL)
        await conn.commit()
