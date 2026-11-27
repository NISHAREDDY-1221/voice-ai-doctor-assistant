"""
FastAPI application for Voice AI Doctor Appointment Assistant.

Provides:
- REST API endpoints for doctors, available slots, appointments, and health.
- WebRTC signaling endpoints (/api/offer) for Pipecat SmallWebRTC client.
- Phone number privacy masking in dashboard responses.
- Startup initialization and seeding of doctor data.
- CORS configuration for local Vite frontend.
"""

import asyncio
from contextlib import asynccontextmanager
from datetime import datetime
import logging
import os
import sys
from typing import Any, Dict, List, Optional
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from loguru import logger

# 1. Completely disable repetitive Uvicorn HTTP GET 200 access logs
logging.getLogger("uvicorn.access").disabled = True
logging.getLogger("uvicorn.access").propagate = False

# 2. Configure Loguru to filter out noisy internal Pipecat DEBUG logs
logger.remove()
logger.add(sys.stderr, level="INFO")

# 1. Completely disable repetitive Uvicorn HTTP GET 200 access logs
logging.getLogger("uvicorn.access").disabled = True
logging.getLogger("uvicorn.access").propagate = False

# 2. Configure Loguru to filter out noisy internal Pipecat DEBUG logs
logger.remove()
logger.add(sys.stderr, level="INFO")
from pipecat.transports.smallwebrtc.connection import SmallWebRTCConnection
from pipecat.transports.smallwebrtc.request_handler import (
    SmallWebRTCPatchRequest,
    SmallWebRTCRequest,
    SmallWebRTCRequestHandler,
)

from backend.appointment_service import (
    APP_TIMEZONE,
    list_appointments,
    list_available_slots,
    list_doctors,
)
from backend.bot import run_voice_pipeline
from backend.seed import seed_mock_data

# Load environment configuration
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), ".env"))

# SmallWebRTC Request Handler
webrtc_handler = SmallWebRTCRequestHandler()


def mask_phone_number(phone: str) -> str:
    """Mask phone number for dashboard privacy (e.g., '+91 98****3210')."""
    if not phone:
        return "****"
    cleaned = str(phone).strip()
    if cleaned.startswith("+91") and len(cleaned) == 13:
        # +9198****3210
        return f"{cleaned[:5]}****{cleaned[-4:]}"
    elif len(cleaned) >= 10:
        return f"{cleaned[:3]}****{cleaned[-4:]}"
    return "****"


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: initialize database and seed mock doctors idempotently."""
    logger.info("Initializing SQLite database and seeding doctor mock data...")
    try:
        res = await seed_mock_data()
        logger.info(
            f"Database initialized: {res.get('doctors_count')} doctors, {res.get('slots_count')} slots."
        )
    except Exception as e:
        logger.error(f"Failed to seed mock data during startup: {e}")

    yield

    logger.info("Application shutting down. Closing WebRTC handlers...")
    try:
        await webrtc_handler.close()
    except Exception as e:
        logger.debug(f"Error closing webrtc_handler: {e}")


app = FastAPI(
    title="Voice AI Doctor Appointment Assistant",
    description="Conversational Voice AI assistant for doctor appointments powered by Pipecat, Gemini, ElevenLabs, and FastAPI.",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "*",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- REST API Endpoints ---

@app.get("/api/health", tags=["Health"])
async def get_health() -> Dict[str, Any]:
    """Health check endpoint."""
    now_iso = datetime.now(APP_TIMEZONE).isoformat()
    return {
        "status": "ok",
        "service": "Voice AI Doctor Appointment Assistant",
        "timestamp": now_iso,
        "database": "sqlite",
        "gemini_model": os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite"),
        "elevenlabs_voice_id": os.getenv("ELEVENLABS_VOICE_ID", "EXAVITQu4vr4xnSDxMaL"),
    }


@app.get("/api/doctors", tags=["Doctors"])
async def get_doctors() -> Dict[str, Any]:
    """Retrieve all clinic doctors and their specialities."""
    try:
        doctors = await list_doctors()
        return {
            "success": True,
            "count": len(doctors),
            "doctors": doctors,
        }
    except Exception as e:
        logger.error(f"Error fetching doctors: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve doctors list.",
        )


@app.get("/api/slots", tags=["Slots"])
async def get_available_slots(
    doctor_id: Optional[int] = Query(None, description="Filter by doctor ID"),
    date: Optional[str] = Query(None, description="Filter by ISO date YYYY-MM-DD"),
) -> Dict[str, Any]:
    """Retrieve available future slots, optionally filtered by doctor and date."""
    try:
        slots = await list_available_slots(doctor_id=doctor_id, date=date)
        return {
            "success": True,
            "count": len(slots),
            "slots": slots,
        }
    except Exception as e:
        logger.error(f"Error fetching slots: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve slots.",
        )


@app.get("/api/appointments", tags=["Appointments"])
async def get_appointments(
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by 'booked' or 'cancelled'"),
) -> Dict[str, Any]:
    """
    Retrieve all appointments with phone numbers masked for privacy in dashboard views.
    """
    try:
        appts = await list_appointments(status=status_filter)
        masked_appts = [
            {
                **a,
                "phone_number": mask_phone_number(a.get("phone_number", "")),
            }
            for a in appts
        ]
        return {
            "success": True,
            "count": len(masked_appts),
            "appointments": masked_appts,
        }
    except Exception as e:
        logger.error(f"Error fetching appointments: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve appointments.",
        )


# --- WebRTC Signaling Endpoints for SmallWebRTC ---

async def _on_webrtc_connection(connection: SmallWebRTCConnection) -> None:
    """Callback when a WebRTC peer connection is established. Spawns voice pipeline."""
    logger.info(f"New WebRTC connection established (pc_id={getattr(connection, 'pc_id', 'unknown')}). Launching bot pipeline.")
    asyncio.create_task(run_voice_pipeline(connection))


@app.post("/api/offer", tags=["WebRTC"])
async def handle_offer(request: SmallWebRTCRequest) -> Dict[str, Any]:
    """
    SmallWebRTC SDP offer exchange endpoint.
    Receives caller browser offer, sets up RTCPeerConnection, and returns SDP answer.
    """
    try:
        answer = await webrtc_handler.handle_web_request(
            request=request,
            webrtc_connection_callback=_on_webrtc_connection,
        )
        if not answer:
            raise HTTPException(status_code=400, detail="Failed to generate WebRTC answer.")
        return answer
    except Exception as e:
        logger.error(f"Error handling WebRTC offer: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.patch("/api/offer", tags=["WebRTC"])
async def handle_patch(request: SmallWebRTCPatchRequest) -> Dict[str, Any]:
    """Trickle ICE candidates endpoint for SmallWebRTC."""
    try:
        await webrtc_handler.handle_patch_request(request)
        return {"success": True}
    except Exception as e:
        logger.error(f"Error handling WebRTC patch: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
