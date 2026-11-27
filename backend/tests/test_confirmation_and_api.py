"""
Integration and unit tests for:
- Phone number confirmation boundary in session state and tool handlers.
- Rejection of booking and cancellation prior to verbal confirmation.
- Confirmation reset when phone number changes.
- Cancellation requiring fresh confirmation even when number was previously used for booking.
- FastAPI REST endpoints (/api/health, /api/doctors, /api/slots, /api/appointments).
- Phone number privacy masking in dashboard responses.
"""

import asyncio
from datetime import datetime
import os
from pathlib import Path
import tempfile
import unittest
from fastapi.testclient import TestClient

from backend.appointment_service import book_appointment, check_doctor_availability
from backend.database import get_db_connection, init_db
from backend.main import app, mask_phone_number
from backend.seed import seed_mock_data
from backend.session import CallSession, get_call_session
from backend.tools import get_appointment_tool_schemas, register_appointment_tools


class MockLLMService:
    """Mock LLM service to capture registered tools and handlers."""

    def __init__(self):
        self.registered_functions = {}

    def register_function(self, name, handler, **kwargs):
        self.registered_functions[name] = handler


class MockFunctionCallParams:
    """Mock FunctionCallParams simulating Pipecat's invocation of tool handlers."""

    def __init__(self, function_name: str, arguments: dict):
        self.function_name = function_name
        self.tool_call_id = "test_call_id"
        self.arguments = arguments
        self.result = None

    async def result_callback(self, result: dict):
        self.result = result


class TestPhoneConfirmationAndTools(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.temp_file = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
        self.temp_file.close()
        self.db_path = Path(self.temp_file.name)
        await seed_mock_data(self.db_path)

        # Create session and mock LLM
        self.session = CallSession("test_session_123")
        self.llm = MockLLMService()
        self.booking_events = []
        self.cancellation_events = []

        register_appointment_tools(
            llm=self.llm,
            session=self.session,
            on_booking_success=lambda r: self.booking_events.append(r),
            on_cancellation_success=lambda r: self.cancellation_events.append(r),
            db_path=self.db_path,
        )

    async def asyncTearDown(self):
        for ext in ["", "-journal", "-wal", "-shm"]:
            f = Path(str(self.db_path) + ext)
            if f.exists():
                try:
                    os.unlink(f)
                except OSError:
                    pass

    async def test_tool_schemas_registered(self):
        """Verify all mandatory tools and confirmation schemas are defined."""
        schemas = get_appointment_tool_schemas()
        names = [s.name for s in schemas]
        self.assertIn("check_doctor_availability", names)
        self.assertIn("book_appointment", names)
        self.assertIn("cancel_appointment", names)
        self.assertIn("confirm_phone_number", names)

    async def test_booking_rejected_before_phone_confirmation(self):
        """
        Verify that calling book_appointment without caller confirmation is rejected
        and returns digit-by-digit readback.
        """
        avail = await check_doctor_availability(db_path=self.db_path)
        slot_id = avail["slots"][0]["slot_id"]

        params = MockFunctionCallParams(
            "book_appointment",
            {"slot_id": slot_id, "phone_number": "9876543210"},
        )
        await self.llm.registered_functions["book_appointment"](params)

        self.assertFalse(params.result["success"])
        self.assertTrue(params.result["requires_confirmation"])
        self.assertIn("digit_readback", params.result)
        self.assertEqual(params.result["pending_phone"], "+919876543210")
        self.assertFalse(self.session.is_phone_confirmed)

    async def test_booking_succeeds_after_explicit_confirmation(self):
        """
        Verify flow:
        1. Attempt booking -> blocked.
        2. Caller confirms -> confirm_phone_number(confirmed=True) records confirmation.
        3. Attempt booking -> database booking succeeds.
        """
        avail = await check_doctor_availability(db_path=self.db_path)
        slot_id = avail["slots"][0]["slot_id"]
        phone = "9876543210"

        # 1. Unconfirmed attempt
        params1 = MockFunctionCallParams("book_appointment", {"slot_id": slot_id, "phone_number": phone})
        await self.llm.registered_functions["book_appointment"](params1)
        self.assertFalse(params1.result["success"])

        # 2. Verbal confirmation
        confirm_params = MockFunctionCallParams("confirm_phone_number", {"confirmed": True})
        await self.llm.registered_functions["confirm_phone_number"](confirm_params)
        self.assertTrue(confirm_params.result["success"])
        self.assertTrue(self.session.is_phone_confirmed)

        # 3. Confirmed booking
        params2 = MockFunctionCallParams("book_appointment", {"slot_id": slot_id, "phone_number": phone})
        await self.llm.registered_functions["book_appointment"](params2)
        self.assertTrue(params2.result["success"])
        self.assertEqual(params2.result["status"], "booked")
        self.assertEqual(len(self.booking_events), 1)

    async def test_confirmation_resets_when_phone_number_changes(self):
        """Verify changing the phone number invalidates prior confirmation."""
        phone1 = "9876543210"
        phone2 = "9123456780"

        # Confirm phone 1
        self.session.set_pending_phone(phone1, "booking")
        self.session.confirm_phone(True)
        self.assertTrue(self.session.is_operation_confirmed(phone1, "booking"))

        # Caller provides phone 2 -> confirmation must be reset
        self.session.set_pending_phone(phone2, "booking")
        self.assertFalse(self.session.is_operation_confirmed(phone2, "booking"))
        self.assertFalse(self.session.is_phone_confirmed)

    async def test_cancellation_requires_fresh_confirmation(self):
        """
        Verify that cancellation requires explicit confirmation even if the number
        was previously confirmed for booking.
        """
        avail = await check_doctor_availability(db_path=self.db_path)
        slot_id = avail["slots"][0]["slot_id"]
        phone = "9876543210"

        # Book with confirmed phone
        self.session.set_pending_phone(phone, "booking")
        self.session.confirm_phone(True)
        booking = await book_appointment(slot_id, phone, db_path=self.db_path)
        self.assertTrue(booking["success"])

        # Now attempt cancellation without fresh confirmation
        cancel_params = MockFunctionCallParams("cancel_appointment", {"phone_number": phone})
        await self.llm.registered_functions["cancel_appointment"](cancel_params)

        # Must be blocked for cancellation
        self.assertFalse(cancel_params.result["success"])
        self.assertTrue(cancel_params.result["requires_confirmation"])
        self.assertIn("PHONE NOT CONFIRMED FOR CANCELLATION", cancel_params.result["message"])

        # Confirm cancellation
        conf_params = MockFunctionCallParams("confirm_phone_number", {"confirmed": True})
        await self.llm.registered_functions["confirm_phone_number"](conf_params)
        self.assertTrue(conf_params.result["success"])

        # Now cancellation proceeds
        cancel_params2 = MockFunctionCallParams("cancel_appointment", {"phone_number": phone})
        await self.llm.registered_functions["cancel_appointment"](cancel_params2)
        self.assertTrue(cancel_params2.result["success"])
        self.assertEqual(cancel_params2.result["status"], "cancelled")


class TestFastAPIEndpoints(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_health_endpoint(self):
        """Verify GET /api/health returns 200 and expected service status."""
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "ok")
        self.assertEqual(data["database"], "sqlite")
        self.assertIn("gemini_model", data)
        self.assertIn("elevenlabs_voice_id", data)

    def test_get_doctors_endpoint(self):
        """Verify GET /api/doctors returns all seeded clinic doctors."""
        response = self.client.get("/api/doctors")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["success"])
        self.assertGreaterEqual(data["count"], 5)
        doctor_names = [d["name"] for d in data["doctors"]]
        self.assertTrue(any("Priya Sharma" in n for n in doctor_names))
        self.assertTrue(any("Arjun Rao" in n for n in doctor_names))

    def test_get_slots_endpoint(self):
        """Verify GET /api/slots returns available slots with optional filters."""
        # Unfiltered
        response = self.client.get("/api/slots")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["success"])
        self.assertGreater(data["count"], 0)

        # Filter by doctor_id
        doc_id = data["slots"][0]["doctor_id"]
        doc_resp = self.client.get(f"/api/slots?doctor_id={doc_id}")
        self.assertEqual(doc_resp.status_code, 200)
        for s in doc_resp.json()["slots"]:
            self.assertEqual(s["doctor_id"], doc_id)

    def test_get_appointments_masks_phone_numbers(self):
        """Verify GET /api/appointments masks phone numbers for dashboard privacy."""
        response = self.client.get("/api/appointments")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertTrue(data["success"])

        # Test masking helper directly on sample numbers
        self.assertEqual(mask_phone_number("+919876543210"), "+9198****3210")
        self.assertEqual(mask_phone_number("9876543210"), "987****3210")
        self.assertEqual(mask_phone_number(""), "****")


if __name__ == "__main__":
    unittest.main()
