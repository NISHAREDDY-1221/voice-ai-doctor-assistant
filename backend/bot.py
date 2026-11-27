"""
Pipecat voice pipeline implementation for Voice AI Doctor Appointment Assistant.

Pipeline architecture:
Browser audio input → ElevenLabs STT → Transcript Relay → Context Aggregator →
Google Gemini LLM (function calling) → ElevenLabs TTS → Browser audio output.

Features:
- SmallWebRTC direct peer-to-peer transport.
- Real-time transcripts and appointment update events delivered over data channel.
- Per-call isolated session state and conversation context.
- Safe task cancellation on client disconnect.
"""

import asyncio
import os
import re
from typing import Any, Optional
import aiohttp
from loguru import logger

from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.frames.frames import (
    Frame,
    LLMContextFrame,
    OutputTransportMessageFrame,
    TTSSpeakFrame,
    TTSTextFrame,
    TextFrame,
    TranscriptionFrame,
)
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineParams, PipelineTask
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.llm_response_universal import LLMContextAggregatorPair
from pipecat.processors.audio.vad_processor import VADProcessor
from pipecat.processors.frame_processor import FrameDirection, FrameProcessor
from pipecat.services.elevenlabs.stt import ElevenLabsSTTService
from pipecat.services.elevenlabs.tts import ElevenLabsTTSService
from pipecat.services.google.llm import GoogleLLMService
from pipecat.transports.base_transport import TransportParams
from pipecat.transports.smallwebrtc.connection import SmallWebRTCConnection
from pipecat.transports.smallwebrtc.transport import SmallWebRTCTransport

from backend.prompts import get_system_prompt
from backend.session import get_call_session, remove_call_session
from backend.tools import get_appointment_tool_schemas, register_appointment_tools

DIGIT_WORDS = {
    "zero": "0", "oh": "0",
    "one": "1", "two": "2", "three": "3",
    "four": "4", "five": "5", "six": "6",
    "seven": "7", "eight": "8", "nine": "9",
}


def normalize_spoken_digits(text: str) -> str:
    """
    Convert sequences of spoken digit words (e.g. 'eight one zero six five double nine six zero six')
    into numeric digits ('8106599606') for clean transcript presentation.
    """
    if not text:
        return text

    tokens = text.split()
    output = []
    i = 0
    digit_buffer = []
    trailing_punct = ""

    def flush_digits():
        nonlocal digit_buffer, trailing_punct
        if digit_buffer:
            if len(digit_buffer) >= 3:
                output.append("".join(digit_buffer) + trailing_punct)
            else:
                for idx, d in enumerate(digit_buffer):
                    p = trailing_punct if idx == len(digit_buffer) - 1 else ""
                    output.append(d + p)
            digit_buffer = []
            trailing_punct = ""

    while i < len(tokens):
        token = tokens[i]
        m = re.match(r"^([a-zA-Z]+)([^a-zA-Z]*)$", token)
        if m:
            clean_word = m.group(1).lower()
            punct = m.group(2)
        else:
            clean_word = token.lower()
            punct = ""

        if clean_word in ("double", "triple") and i + 1 < len(tokens):
            next_token = tokens[i + 1]
            nm = re.match(r"^([a-zA-Z]+)([^a-zA-Z]*)$", next_token)
            next_word = nm.group(1).lower() if nm else next_token.lower()
            if next_word in DIGIT_WORDS:
                count = 2 if clean_word == "double" else 3
                digit_buffer.extend([DIGIT_WORDS[next_word]] * count)
                trailing_punct = nm.group(2) if nm else ""
                i += 2
                continue

        if clean_word in DIGIT_WORDS:
            digit_buffer.append(DIGIT_WORDS[clean_word])
            trailing_punct = punct
            i += 1
        else:
            flush_digits()
            output.append(token)
            i += 1

    flush_digits()
    return " ".join(output)


async def run_voice_pipeline(
    connection: SmallWebRTCConnection,
    elevenlabs_api_key: Optional[str] = None,
    google_api_key: Optional[str] = None,
    voice_id: Optional[str] = None,
    model: Optional[str] = None,
) -> None:
    """
    Initialize and run an isolated Pipecat voice pipeline for a caller WebRTC connection.
    """
    # 1. Resolve credentials
    el_key = elevenlabs_api_key or os.getenv("ELEVENLABS_API_KEY")
    g_key = google_api_key or os.getenv("GOOGLE_API_KEY")
    v_id = voice_id or os.getenv("ELEVENLABS_VOICE_ID", "EXAVITQu4vr4xnSDxMaL")
    llm_model = model or os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")

    if not el_key or not g_key:
        logger.error("Missing ELEVENLABS_API_KEY or GOOGLE_API_KEY in environment.")
        return

    # 2. Session state
    session_id = getattr(connection, "pc_id", None) or getattr(connection, "id", None) or "default_session"
    session = get_call_session(str(session_id))
    session.reset()

    # 3. WebRTC Transport
    transport = SmallWebRTCTransport(
        webrtc_connection=connection,
        params=TransportParams(
            audio_in_enabled=True,
            audio_out_enabled=True,
            camera_in_enabled=False,
        ),
    )

    async with aiohttp.ClientSession() as aiohttp_session:
        # 4. Speech-to-Text (ElevenLabs)
        stt = ElevenLabsSTTService(
            api_key=el_key,
            aiohttp_session=aiohttp_session,
        )

        # 5. Text-to-Speech (ElevenLabs)
        tts = ElevenLabsTTSService(
            api_key=el_key,
            settings=ElevenLabsTTSService.Settings(
                voice=v_id,
            ),
        )

        # 6. Google Gemini LLM Service
        llm = GoogleLLMService(
            api_key=g_key,
            settings=GoogleLLMService.Settings(
                model=llm_model,
            ),
        )

        # 7. LLM Context & Aggregators
        system_instruction = get_system_prompt()
        initial_messages = [
            {"role": "system", "content": system_instruction},
        ]
        tool_schemas = get_appointment_tool_schemas()
        context = LLMContext(messages=initial_messages, tools=tool_schemas)
        context_aggregator = LLMContextAggregatorPair(context=context)
        user_aggregator = context_aggregator.user()
        assistant_aggregator = context_aggregator.assistant()

        # Turn completion event handlers: emit complete, finalized sentences to the UI
        # instead of word-by-word streaming fragments
        @user_aggregator.event_handler("on_user_turn_stopped")
        async def on_user_turn_stopped(aggregator, strategy, message):
            if message and message.content:
                raw_text = str(message.content).strip()
                if raw_text:
                    display_text = normalize_spoken_digits(raw_text)
                    logger.info(f"[{session_id}] Patient: {display_text}")
                    try:
                        await connection.send_app_message({
                            "label": "rtvi-ai",
                            "type": "server-message",
                            "data": {
                                "type": "transcript",
                                "role": "user",
                                "text": display_text,
                            },
                            "role": "user",
                            "text": display_text,
                        })
                    except Exception as e:
                        logger.debug(f"Error sending user transcript: {e}")

        @assistant_aggregator.event_handler("on_assistant_turn_stopped")
        async def on_assistant_turn_stopped(aggregator, message):
            if message and message.content:
                text = str(message.content).strip()
                if text:
                    logger.info(f"[{session_id}] Assistant: {text}")
                    try:
                        await connection.send_app_message({
                            "label": "rtvi-ai",
                            "type": "server-message",
                            "data": {
                                "type": "transcript",
                                "role": "assistant",
                                "text": text,
                            },
                            "role": "assistant",
                            "text": text,
                        })
                    except Exception as e:
                        logger.debug(f"Error sending assistant transcript: {e}")

        # Live update notification callbacks
        def on_booking_success(result: dict):
            asyncio.create_task(
                connection.send_app_message({
                    "label": "rtvi-ai",
                    "type": "server-message",
                    "data": {
                        "type": "appointment_updated",
                        "action": "booked",
                        "data": result,
                    },
                    "type": "appointment_updated",
                    "action": "booked",
                    "data": result,
                })
            )

        def on_cancellation_success(result: dict):
            asyncio.create_task(
                connection.send_app_message({
                    "label": "rtvi-ai",
                    "type": "server-message",
                    "data": {
                        "type": "appointment_updated",
                        "action": "cancelled",
                        "data": result,
                    },
                    "type": "appointment_updated",
                    "action": "cancelled",
                    "data": result,
                })
            )

        # Register functions on the LLM
        register_appointment_tools(
            llm=llm,
            session=session,
            on_booking_success=on_booking_success,
            on_cancellation_success=on_cancellation_success,
        )

        # Voice Activity Detection (VAD) to detect user speech start/stop for ElevenLabs STT
        vad = SileroVADAnalyzer()
        vad_processor = VADProcessor(vad_analyzer=vad)

        # 8. Pipeline Assembly
        # Clean pipeline with Silero VAD segmenting caller audio for ElevenLabs STT.
        # User and assistant full sentences are emitted via turn completion handlers.
        pipeline = Pipeline([
            transport.input(),              # Audio from browser
            vad_processor,                  # Detects speech start/stop to trigger STT
            stt,                            # ElevenLabs STT (transcribes segmented user speech)
            user_aggregator,                # Aggregates user speech into complete turns
            llm,                            # Gemini reasoning & tool calls
            tts,                            # ElevenLabs TTS
            transport.output(),             # Audio back to browser
            assistant_aggregator,           # Aggregates assistant response into complete turns
        ])

        task = PipelineTask(
            pipeline,
            params=PipelineParams(
                allow_interruptions=True,
                enable_metrics=True,
            ),
        )

        # 10. Connection Event Handlers & Initial Greeting
        greeted = False

        async def send_greeting():
            nonlocal greeted
            if greeted:
                return
            greeted = True
            logger.info(f"[{session_id}] Sending initial receptionist greeting to caller.")
            greeting = (
                "Hello! Thank you for calling Apollo Clinic. "
                "How can I help you book or manage an appointment today?"
            )
            # Use TTSSpeakFrame to instruct ElevenLabs TTS to synthesize and stream speech
            await task.queue_frame(TTSSpeakFrame(greeting))
            # Also send the transcript to the frontend data channel immediately
            try:
                await connection.send_app_message({
                    "label": "rtvi-ai",
                    "type": "server-message",
                    "data": {
                        "type": "transcript",
                        "role": "assistant",
                        "text": greeting,
                    },
                    "role": "assistant",
                    "text": greeting,
                })
            except Exception as e:
                logger.debug(f"Error sending initial greeting over data channel: {e}")

        @transport.event_handler("on_client_connected")
        async def on_client_connected(transport, client):
            logger.info(f"[{session_id}] Caller connected via WebRTC event.")
            await send_greeting()

        @transport.event_handler("on_client_disconnected")
        async def on_client_disconnected(transport, client):
            logger.info(f"[{session_id}] Caller disconnected. Cancelling pipeline task.")
            await task.cancel()
            remove_call_session(str(session_id))

        # Also ensure greeting fires shortly after pipeline starts if WebRTC was already connected
        async def ensure_greeting():
            await asyncio.sleep(0.5)
            if not greeted:
                await send_greeting()

        asyncio.create_task(ensure_greeting())

        # 11. Run Pipeline
        runner = PipelineRunner()
        try:
            await runner.run(task)
        finally:
            remove_call_session(str(session_id))
            logger.info(f"[{session_id}] Pipeline run complete.")
