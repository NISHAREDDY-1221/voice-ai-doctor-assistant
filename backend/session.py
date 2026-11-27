"""
Per-call session state management and phone confirmation boundary.

Enforces explicit caller confirmation before booking or cancelling appointments.
Guarantees:
- Phone number must be read back digit by digit.
- Booking and cancellation are strictly blocked in backend tool handlers
  until explicit confirmation is recorded in session state.
- Changing the phone number resets confirmation state.
- Separate confirmation required for cancellation even if previously confirmed for booking.
"""

from typing import Dict, Optional
from backend.appointment_service import normalize_phone_number


class CallSession:
    """Independent per-call session state container."""

    def __init__(self, session_id: str):
        self.session_id: str = session_id
        self.pending_phone_number: Optional[str] = None
        self.confirmed_phone_number: Optional[str] = None
        self.is_phone_confirmed: bool = False
        self.current_operation: Optional[str] = None  # 'booking' or 'cancellation'
        self.selected_slot_id: Optional[int] = None
        self.selected_appointment_id: Optional[int] = None

    def set_pending_phone(self, phone: str, operation: str) -> str:
        """
        Record a spoken phone number as pending verification.
        Resets confirmation if phone number or operation changes.
        """
        normalized = normalize_phone_number(phone)
        if (
            normalized != self.confirmed_phone_number
            or operation != self.current_operation
        ):
            self.is_phone_confirmed = False
            self.confirmed_phone_number = None

        self.pending_phone_number = normalized
        self.current_operation = operation
        return normalized

    def format_phone_digit_by_digit(self, phone: Optional[str] = None) -> str:
        """Format phone number with separated digits for clear voice read-back."""
        target = phone or self.pending_phone_number or ""
        # E.164: +91XXXXXXXXXX -> "+91 " followed by separated digits
        if target.startswith("+91") and len(target) == 13:
            country = "+91"
            digits = target[3:]
            spaced_digits = " ".join(list(digits))
            return f"{country} {spaced_digits}"
        return " ".join(list(target))

    def confirm_phone(self, confirmed: bool) -> bool:
        """Record caller confirmation status."""
        if confirmed and self.pending_phone_number:
            self.is_phone_confirmed = True
            self.confirmed_phone_number = self.pending_phone_number
            return True
        else:
            self.is_phone_confirmed = False
            self.confirmed_phone_number = None
            return False

    def is_operation_confirmed(self, phone: str, operation: str) -> bool:
        """Check whether the given phone number and operation have been confirmed."""
        try:
            normalized = normalize_phone_number(phone)
        except ValueError:
            return False

        return (
            self.is_phone_confirmed
            and self.confirmed_phone_number == normalized
            and self.current_operation == operation
        )

    def reset(self) -> None:
        """Reset all session state."""
        self.pending_phone_number = None
        self.confirmed_phone_number = None
        self.is_phone_confirmed = False
        self.current_operation = None
        self.selected_slot_id = None
        self.selected_appointment_id = None


# Registry of active call sessions keyed by connection or call ID
_active_sessions: Dict[str, CallSession] = {}


def get_call_session(session_id: str) -> CallSession:
    """Retrieve or create an active call session."""
    if session_id not in _active_sessions:
        _active_sessions[session_id] = CallSession(session_id)
    return _active_sessions[session_id]


def remove_call_session(session_id: str) -> None:
    """Clean up call session when connection closes."""
    _active_sessions.pop(session_id, None)
