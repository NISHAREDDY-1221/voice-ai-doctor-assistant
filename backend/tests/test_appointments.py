"""
Unit and integration tests for SQLite database and appointment business logic.

Covers:
- Database initialization and idempotency
- Mock data seeder idempotency
- Doctor availability filtering and edge cases
- Successful bookings and duplicate prevention
- Concurrent booking race conditions
- Phone number validation and normalization
- Slot validation and past slot rejection
- Cancellations, slot release, unknown phones, multiple appointments, and authorization boundaries
"""

import asyncio
from datetime import datetime, timedelta
import os
from pathlib import Path
import tempfile
import unittest
from zoneinfo import ZoneInfo
import aiosqlite

from backend.appointment_service import (
    APP_TIMEZONE,
    book_appointment,
    cancel_appointment,
    check_doctor_availability,
    get_appointments_by_phone,
    list_appointments,
    list_available_slots,
    list_doctors,
    normalize_phone_number,
)
from backend.database import get_db_connection, init_db
from backend.seed import seed_mock_data


class TestAppointments(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self) -> None:
        """Create an isolated temporary database for each test."""
        self.temp_file = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.temp_file.close()
        self.db_path = Path(self.temp_file.name)
        # Initialize and seed mock data
        await seed_mock_data(self.db_path)

    async def asyncTearDown(self) -> None:
        """Clean up the isolated temporary database."""
        for ext in ["", "-journal", "-wal", "-shm"]:
            f = Path(str(self.db_path) + ext)
            if f.exists():
                try:
                    os.unlink(f)
                except OSError:
                    pass

    async def test_database_initialization(self) -> None:
        """Verify tables, constraints, partial unique index, and idempotency."""
        # Test on a brand new empty database file
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as tmp:
            fresh_db = Path(tmp.name)

        try:
            # 1. Initialize
            await init_db(fresh_db)

            async with get_db_connection(fresh_db) as conn:
                # Check tables exist
                async with conn.execute(
                    "SELECT name FROM sqlite_master WHERE type='table'"
                ) as cur:
                    tables = [row["name"] for row in await cur.fetchall()]
                    self.assertIn("doctors", tables)
                    self.assertIn("slots", tables)
                    self.assertIn("appointments", tables)

                # Check partial unique index exists
                async with conn.execute(
                    "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_active_appointment_per_slot'"
                ) as cur:
                    idx = await cur.fetchone()
                    self.assertIsNotNone(idx)

            # 2. Idempotency: re-running init_db should succeed without error
            await init_db(fresh_db)
        finally:
            if fresh_db.exists():
                os.unlink(fresh_db)

    async def test_idempotent_mock_data_creation(self) -> None:
        """Verify repeated seeding does not duplicate doctors/slots or reset bookings."""
        # 1. Initial counts
        async with get_db_connection(self.db_path) as conn:
            async with conn.execute("SELECT COUNT(*) FROM doctors") as cur:
                initial_doc_count = (await cur.fetchone())[0]
            async with conn.execute("SELECT COUNT(*) FROM slots") as cur:
                initial_slot_count = (await cur.fetchone())[0]

        self.assertEqual(initial_doc_count, 5)
        self.assertGreater(initial_slot_count, 0)

        # 2. Book an appointment
        avail = await check_doctor_availability(db_path=self.db_path)
        slot = avail["slots"][0]
        booking = await book_appointment(slot["slot_id"], "9876543210", db_path=self.db_path)
        self.assertTrue(booking["success"])

        # 3. Seed again
        res = await seed_mock_data(self.db_path)
        self.assertEqual(res["doctors_count"], 5)
        self.assertEqual(res["slots_count"], initial_slot_count)

        # 4. Verify existing booking is still intact
        appts = await get_appointments_by_phone("9876543210", db_path=self.db_path)
        self.assertEqual(len(appts), 1)
        self.assertEqual(appts[0]["appointment_id"], booking["appointment_id"])
        self.assertEqual(appts[0]["status"], "booked")

    async def test_doctor_availability(self) -> None:
        """Verify availability filtering by doctor, speciality, date, and edge cases."""
        # All available slots
        avail = await check_doctor_availability(db_path=self.db_path)
        self.assertTrue(avail["success"])
        self.assertGreater(avail["count"], 0)

        # Filter by doctor name (case-insensitive substring)
        doc_avail = await check_doctor_availability(doctor_name="priya", db_path=self.db_path)
        self.assertTrue(doc_avail["success"])
        for s in doc_avail["slots"]:
            self.assertIn("Priya", s["doctor_name"])

        # Filter with "Dr." prefix
        doc_avail_prefix = await check_doctor_availability(
            doctor_name="Dr. Arjun Rao", db_path=self.db_path
        )
        self.assertTrue(doc_avail_prefix["success"])
        for s in doc_avail_prefix["slots"]:
            self.assertIn("Arjun Rao", s["doctor_name"])

        # Filter by speciality
        spec_avail = await check_doctor_availability(
            speciality="dermatology", db_path=self.db_path
        )
        self.assertTrue(spec_avail["success"])
        for s in spec_avail["slots"]:
            self.assertEqual(s["speciality"], "Dermatology")

        # Unknown doctor returns 0 slots gracefully without raising an exception
        unknown_doc = await check_doctor_availability(
            doctor_name="NonExistentDoctor", db_path=self.db_path
        )
        self.assertTrue(unknown_doc["success"])
        self.assertEqual(unknown_doc["count"], 0)
        self.assertEqual(len(unknown_doc["slots"]), 0)

        # Past date returns 0 slots gracefully
        past_res = await check_doctor_availability(date="2020-01-01", db_path=self.db_path)
        self.assertTrue(past_res["success"])
        self.assertEqual(past_res["count"], 0)

        # Invalid date format returns structured error
        invalid_date = await check_doctor_availability(date="not-a-date", db_path=self.db_path)
        self.assertFalse(invalid_date["success"])
        self.assertIn("Invalid date format", invalid_date["error"])

    async def test_successful_booking(self) -> None:
        """Verify booking a future slot records all details and removes slot from availability."""
        avail = await check_doctor_availability(db_path=self.db_path)
        slot = avail["slots"][0]
        slot_id = slot["slot_id"]

        booking = await book_appointment(
            slot_id=slot_id,
            phone_number="+91 98765 43210",
            db_path=self.db_path,
        )

        self.assertTrue(booking["success"])
        self.assertIsInstance(booking["appointment_id"], int)
        self.assertEqual(booking["doctor"], slot["doctor_name"])
        self.assertEqual(booking["speciality"], slot["speciality"])
        self.assertEqual(booking["date"], slot["appointment_date"])
        self.assertEqual(booking["time"], slot["appointment_time"])
        self.assertEqual(booking["phone_number"], "+919876543210")
        self.assertEqual(booking["status"], "booked")

        # Verify the slot is no longer in available slots
        new_avail = await check_doctor_availability(db_path=self.db_path)
        new_slot_ids = [s["slot_id"] for s in new_avail["slots"]]
        self.assertNotIn(slot_id, new_slot_ids)

    async def test_duplicate_booking_prevention(self) -> None:
        """Verify that booking the same slot twice is rejected."""
        avail = await check_doctor_availability(db_path=self.db_path)
        slot = avail["slots"][0]
        slot_id = slot["slot_id"]

        # First booking succeeds
        first = await book_appointment(slot_id, "9876543210", db_path=self.db_path)
        self.assertTrue(first["success"])

        # Second booking for the same slot fails
        second = await book_appointment(slot_id, "9123456789", db_path=self.db_path)
        self.assertFalse(second["success"])
        self.assertIn("already booked", second["error"].lower())

    async def test_concurrent_booking_attempts(self) -> None:
        """Verify that concurrent bookings for the exact same slot result in only one success."""
        avail = await check_doctor_availability(db_path=self.db_path)
        slot = avail["slots"][0]
        slot_id = slot["slot_id"]

        # Simulate concurrent booking requests
        results = await asyncio.gather(
            book_appointment(slot_id, "9876543210", db_path=self.db_path),
            book_appointment(slot_id, "9123456789", db_path=self.db_path),
        )

        successes = [r for r in results if r.get("success") is True]
        failures = [r for r in results if r.get("success") is False]

        self.assertEqual(len(successes), 1, "Exactly one concurrent booking must succeed.")
        self.assertEqual(len(failures), 1, "The competing concurrent booking must fail.")

    async def test_invalid_phone_number_rejection(self) -> None:
        """Verify rejection of malformed or invalid phone numbers."""
        invalid_numbers = [
            "",
            "12345",              # Too short
            "98765",              # 5 digits
            "1234567890",         # Doesn't start with 6,7,8,9
            "01234567890",        # Leading 0 but invalid starting mobile digit
            "+911234567890",      # +91 prefix but invalid starting mobile digit
            "abcdefghij",         # Non-digits
            "98765432101234",     # Too long
        ]

        avail = await check_doctor_availability(db_path=self.db_path)
        slot_id = avail["slots"][0]["slot_id"]

        for invalid_phone in invalid_numbers:
            with self.subTest(phone=invalid_phone):
                res = await book_appointment(slot_id, invalid_phone, db_path=self.db_path)
                self.assertFalse(res["success"])
                self.assertIn("Invalid", res["error"])

    async def test_invalid_slot_rejection(self) -> None:
        """Verify rejection when booking a non-existent slot or a slot in the past."""
        # Non-existent slot
        res = await book_appointment(999999, "9876543210", db_path=self.db_path)
        self.assertFalse(res["success"])
        self.assertIn("does not exist", res["error"])

        # Manually create a slot in the past
        past_date = (datetime.now(APP_TIMEZONE).date() - timedelta(days=2)).isoformat()
        async with get_db_connection(self.db_path) as conn:
            cur = await conn.execute(
                "INSERT INTO slots (doctor_id, appointment_date, appointment_time) VALUES (1, ?, '10:00')",
                (past_date,),
            )
            await conn.commit()
            past_slot_id = cur.lastrowid

        past_booking = await book_appointment(
            past_slot_id, "9876543210", db_path=self.db_path
        )
        self.assertFalse(past_booking["success"])
        self.assertIn("already passed", past_booking["error"].lower())

    async def test_successful_cancellation(self) -> None:
        """Verify successful cancellation updates status to cancelled and records timestamp."""
        avail = await check_doctor_availability(db_path=self.db_path)
        slot = avail["slots"][0]

        booking = await book_appointment(slot["slot_id"], "9876543210", db_path=self.db_path)
        self.assertTrue(booking["success"])

        cancellation = await cancel_appointment("9876543210", db_path=self.db_path)
        self.assertTrue(cancellation["success"])
        self.assertEqual(cancellation["status"], "cancelled")
        self.assertEqual(cancellation["appointment_id"], booking["appointment_id"])
        self.assertIsNotNone(cancellation["cancelled_at"])

        # Verify in database: appointment status is 'cancelled' (not deleted)
        async with get_db_connection(self.db_path) as conn:
            async with conn.execute(
                "SELECT status, cancelled_at FROM appointments WHERE id = ?",
                (booking["appointment_id"],),
            ) as cur:
                row = await cur.fetchone()
                self.assertEqual(row["status"], "cancelled")
                self.assertIsNotNone(row["cancelled_at"])

    async def test_slot_availability_after_cancellation(self) -> None:
        """Verify that cancelling an appointment makes the slot available again for booking."""
        avail = await check_doctor_availability(db_path=self.db_path)
        slot_id = avail["slots"][0]["slot_id"]

        # Book slot
        b1 = await book_appointment(slot_id, "9876543210", db_path=self.db_path)
        self.assertTrue(b1["success"])

        # Slot is unavailable
        cur_avail = await check_doctor_availability(db_path=self.db_path)
        self.assertNotIn(slot_id, [s["slot_id"] for s in cur_avail["slots"]])

        # Cancel appointment
        c1 = await cancel_appointment("9876543210", db_path=self.db_path)
        self.assertTrue(c1["success"])

        # Slot must now be available again
        released_avail = await check_doctor_availability(db_path=self.db_path)
        self.assertIn(slot_id, [s["slot_id"] for s in released_avail["slots"]])

        # A new caller can book the same released slot
        b2 = await book_appointment(slot_id, "9123456789", db_path=self.db_path)
        self.assertTrue(b2["success"])
        self.assertEqual(b2["phone_number"], "+919123456789")

    async def test_cancellation_unknown_phone_number(self) -> None:
        """Verify cancellation fails gracefully when the caller has no active appointments."""
        res = await cancel_appointment("9999999999", db_path=self.db_path)
        self.assertFalse(res["success"])
        self.assertIn("No active appointment found", res["error"])

    async def test_multiple_appointments_associated_with_one_phone_number(self) -> None:
        """
        Verify that when a caller has multiple active bookings:
        1. Cancellation without ID returns list of appointments and requires an ID.
        2. Cancellation with a specific ID cancels only that appointment.
        """
        avail = await check_doctor_availability(db_path=self.db_path)
        slot1 = avail["slots"][0]["slot_id"]
        slot2 = avail["slots"][1]["slot_id"]
        phone = "9876543210"

        b1 = await book_appointment(slot1, phone, db_path=self.db_path)
        b2 = await book_appointment(slot2, phone, db_path=self.db_path)
        self.assertTrue(b1["success"])
        self.assertTrue(b2["success"])

        # Attempt to cancel without appointment_id
        res_ambiguous = await cancel_appointment(phone, db_path=self.db_path)
        self.assertFalse(res_ambiguous["success"])
        self.assertTrue(res_ambiguous.get("requires_appointment_id"))
        self.assertEqual(len(res_ambiguous["appointments"]), 2)

        # Cancel specific appointment 1
        res_cancel = await cancel_appointment(
            phone, appointment_id=b1["appointment_id"], db_path=self.db_path
        )
        self.assertTrue(res_cancel["success"])
        self.assertEqual(res_cancel["appointment_id"], b1["appointment_id"])

        # Verify appointment 2 is still active
        appts = await get_appointments_by_phone(phone, db_path=self.db_path)
        active_appts = [a for a in appts if a["status"] == "booked"]
        self.assertEqual(len(active_appts), 1)
        self.assertEqual(active_appts[0]["appointment_id"], b2["appointment_id"])

    async def test_prevention_of_cancellation_using_another_phone_number(self) -> None:
        """Verify that caller B cannot cancel caller A's appointment even with their ID."""
        avail = await check_doctor_availability(db_path=self.db_path)
        slot_id = avail["slots"][0]["slot_id"]

        # Caller A books
        booking_a = await book_appointment(slot_id, "9876543210", db_path=self.db_path)
        self.assertTrue(booking_a["success"])
        appt_a_id = booking_a["appointment_id"]

        # Caller B attempts to cancel Caller A's appointment
        unauthorized = await cancel_appointment(
            phone_number="9123456789",
            appointment_id=appt_a_id,
            db_path=self.db_path,
        )
        self.assertFalse(unauthorized["success"])
        self.assertIn("Unauthorized", unauthorized["error"])

        # Verify Caller A's appointment remains active
        async with get_db_connection(self.db_path) as conn:
            async with conn.execute(
                "SELECT status FROM appointments WHERE id = ?", (appt_a_id,)
            ) as cur:
                status = (await cur.fetchone())["status"]
                self.assertEqual(status, "booked")


if __name__ == "__main__":
    unittest.main()
