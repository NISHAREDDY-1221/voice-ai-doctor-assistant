"""
Pipecat LLM function calling tools and handlers for the Doctor Appointment Assistant.

Exposes the 3 mandatory appointment tools:
- check_doctor_availability
- book_appointment
- cancel_appointment
Plus:
- confirm_phone_number (enforces verbal digit-by-digit confirmation in session state)

All handlers connect directly to backend/appointment_service.py and backend/session.py.
"""

from typing import Any, Callable, Dict, List, Optional
from loguru import logger
from pipecat.processors.aggregators.llm_context import FunctionSchema
from pipecat.services.llm_service import FunctionCallParams

from backend.appointment_service import (
    book_appointment,
    cancel_appointment,
    check_doctor_availability,
    normalize_phone_number,
)
from backend.session import CallSession


def get_appointment_tool_schemas() -> List[FunctionSchema]:
    """Define the structured schemas for Gemini function calling."""
    return [
        FunctionSchema(
            name="check_doctor_availability",
            description="Check available doctor appointment slots. Optionally filter by doctor name, medical speciality, or date (YYYY-MM-DD). Returns available future slots with doctor details and unique slot IDs.",
            properties={
                "doctor_name": {
                    "type": "string",
                    "description": "Optional name of the doctor, e.g. 'Priya Sharma' or 'Arjun Rao'.",
                },
                "speciality": {
                    "type": "string",
                    "description": "Optional medical speciality, e.g. 'Cardiology', 'General Medicine', 'Dermatology', 'Orthopedics', 'Pediatrics'.",
                },
                "date": {
                    "type": "string",
                    "description": "Optional date in ISO format YYYY-MM-DD.",
                },
            },
            required=[],
        ),
        FunctionSchema(
            name="confirm_phone_number",
            description="Record the caller's explicit verbal confirmation of their spoken phone number after it has been read back digit by digit.",
            properties={
                "confirmed": {
                    "type": "boolean",
                    "description": "True if the caller verified the read-back number is correct; False if the caller stated it was wrong.",
                },
            },
            required=["confirmed"],
        ),
        FunctionSchema(
            name="book_appointment",
            description="Book an appointment for a specific slot ID and confirmed phone number. The phone number must be verified by the caller first.",
            properties={
                "slot_id": {
                    "type": "integer",
                    "description": "The exact numeric slot ID obtained from check_doctor_availability.",
                },
                "phone_number": {
                    "type": "string",
                    "description": "The caller's 10-digit Indian phone number.",
                },
            },
            required=["slot_id", "phone_number"],
        ),
        FunctionSchema(
            name="cancel_appointment",
            description="Cancel an active appointment for a caller's confirmed phone number. If the caller has multiple active appointments, appointment_id is required.",
            properties={
                "phone_number": {
                    "type": "string",
                    "description": "The caller's 10-digit Indian phone number.",
                },
                "appointment_id": {
                    "type": "integer",
                    "description": "Optional appointment ID to cancel when multiple appointments exist for this number.",
                },
            },
            required=["phone_number"],
        ),
    ]


def register_appointment_tools(
    llm: Any,
    session: CallSession,
    on_booking_success: Optional[Callable[[Dict[str, Any]], None]] = None,
    on_cancellation_success: Optional[Callable[[Dict[str, Any]], None]] = None,
    db_path: Optional[Any] = None,
) -> None:
    """
    Register the appointment tool handlers with the Pipecat LLM service.
    Enforces per-call session confirmation state and database invariants.
    """

    # 1. Handler: check_doctor_availability
    async def handle_check_availability(params: FunctionCallParams) -> None:
        args = params.arguments
        doctor_name = args.get("doctor_name")
        speciality = args.get("speciality")
        date = args.get("date")

        logger.info(
            f"[{session.session_id}] Tool check_doctor_availability: doctor={doctor_name}, spec={speciality}, date={date}"
        )
        res = await check_doctor_availability(
            doctor_name=doctor_name,
            speciality=speciality,
            date=date,
            db_path=db_path,
        )
        await params.result_callback(res)

    # 2. Handler: confirm_phone_number
    async def handle_confirm_phone(params: FunctionCallParams) -> None:
        args = params.arguments
        confirmed = bool(args.get("confirmed", False))
        logger.info(f"[{session.session_id}] Tool confirm_phone_number: confirmed={confirmed}")

        if confirmed:
            session.confirm_phone(True)
            res = {
                "success": True,
                "confirmed": True,
                "phone_number": session.confirmed_phone_number,
                "operation": session.current_operation,
                "message": f"Phone number {session.confirmed_phone_number} is verified. You can now execute {session.current_operation or 'the action'}.",
            }
        else:
            session.confirm_phone(False)
            res = {
                "success": False,
                "confirmed": False,
                "message": "The caller stated the phone number is incorrect. Ask them to speak their correct 10-digit phone number.",
            }
        await params.result_callback(res)

    # 3. Handler: book_appointment
    async def handle_book_appointment(params: FunctionCallParams) -> None:
        args = params.arguments
        slot_id = args.get("slot_id")
        phone_number = args.get("phone_number")

        logger.info(f"[{session.session_id}] Tool book_appointment: slot_id={slot_id}, phone={phone_number}")

        if not slot_id or not phone_number:
            await params.result_callback({
                "success": False,
                "error": "Both slot_id and phone_number are required.",
            })
            return

        # Check Phone Confirmation Boundary in Session State
        if not session.is_operation_confirmed(str(phone_number), "booking"):
            try:
                norm_phone = session.set_pending_phone(str(phone_number), "booking")
            except ValueError as e:
                await params.result_callback({"success": False, "error": str(e)})
                return

            session.selected_slot_id = int(slot_id)
            readback = session.format_phone_digit_by_digit(norm_phone)
            await params.result_callback({
                "success": False,
                "requires_confirmation": True,
                "pending_phone": norm_phone,
                "digit_readback": readback,
                "message": (
                    f"PHONE NOT CONFIRMED YET. You MUST read this number back to the caller digit by digit: "
                    f"'{readback}' and ask: 'Is this number correct?'. "
                    f"Do NOT book until the caller explicitly confirms and you call confirm_phone_number(confirmed=true)."
                ),
            })
            return

        # Phone is confirmed in session -> execute database booking
        res = await book_appointment(int(slot_id), session.confirmed_phone_number, db_path=db_path)
        if res.get("success") and on_booking_success:
            try:
                on_booking_success(res)
            except Exception as e:
                logger.error(f"Error in on_booking_success callback: {e}")

        await params.result_callback(res)

    # 4. Handler: cancel_appointment
    async def handle_cancel_appointment(params: FunctionCallParams) -> None:
        args = params.arguments
        phone_number = args.get("phone_number")
        appointment_id = args.get("appointment_id")

        logger.info(
            f"[{session.session_id}] Tool cancel_appointment: phone={phone_number}, appt_id={appointment_id}"
        )

        if not phone_number:
            await params.result_callback({
                "success": False,
                "error": "phone_number is required for cancellation.",
            })
            return

        # Check Phone Confirmation Boundary in Session State
        if not session.is_operation_confirmed(str(phone_number), "cancellation"):
            try:
                norm_phone = session.set_pending_phone(str(phone_number), "cancellation")
            except ValueError as e:
                await params.result_callback({"success": False, "error": str(e)})
                return

            if appointment_id is not None:
                session.selected_appointment_id = int(appointment_id)

            readback = session.format_phone_digit_by_digit(norm_phone)
            await params.result_callback({
                "success": False,
                "requires_confirmation": True,
                "pending_phone": norm_phone,
                "digit_readback": readback,
                "message": (
                    f"PHONE NOT CONFIRMED FOR CANCELLATION. You MUST read this number back to the caller digit by digit: "
                    f"'{readback}' and ask: 'Is this number correct?'. "
                    f"Do NOT cancel until the caller explicitly confirms and you call confirm_phone_number(confirmed=true)."
                ),
            })
            return

        # Phone is confirmed in session -> execute database cancellation
        appt_id_int = int(appointment_id) if appointment_id is not None else None
        res = await cancel_appointment(
            session.confirmed_phone_number,
            appointment_id=appt_id_int,
            db_path=db_path,
        )
        if res.get("success") and on_cancellation_success:
            try:
                on_cancellation_success(res)
            except Exception as e:
                logger.error(f"Error in on_cancellation_success callback: {e}")

        await params.result_callback(res)

    # Register all four handlers on the LLM service
    llm.register_function("check_doctor_availability", handle_check_availability)
    llm.register_function("confirm_phone_number", handle_confirm_phone)
    llm.register_function("book_appointment", handle_book_appointment)
    llm.register_function("cancel_appointment", handle_cancel_appointment)
