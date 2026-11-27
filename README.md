# Voice AI Doctor Appointment Assistant

An end-to-end, production-ready real-time conversational Voice AI Doctor Appointment Booking Assistant built with Python FastAPI, Pipecat voice pipeline, ElevenLabs STT & TTS, Google Gemini function calling, and a React + Tailwind CSS dashboard communicating over SmallWebRTC.

## 🩺 System Architecture Overview

```
[ User Browser: React Dashboard + SmallWebRTC Client ]
                     │  ▲  (Direct Peer-to-Peer WebRTC Audio Streaming & Data Channel)
                     ▼  │
        [ Backend: Pipecat Voice Pipeline ]
         ├─ Transport: SmallWebRTCTransport (aiortc)
         ├─ Speech-to-Text: ElevenLabs STT (Real-time Speech Recognition)
         ├─ Transcript Relay: Real-time user & assistant transcripts over WebRTC
         ├─ Intelligence & Tools: Google Gemini LLM (Function Calling & Session Guard)
         │    ├─ check_doctor_availability
         │    ├─ confirm_phone_number (Digit-by-digit readback verification)
         │    ├─ book_appointment
         │    └─ cancel_appointment
         ├─ Text-to-Speech: ElevenLabs TTS (Voice ID: EXAVITQu4vr4xnSDxMaL)
         └─ Database: SQLite via aiosqlite (Idempotent Doctors, Slots & Appointments)
```

## 📁 Project Structure

```
voice-ai-doctor-assistant/
├── .gitignore                     # Git ignore rules for secrets, virtual environments, builds
├── README.md                      # Project documentation and setup guide
├── backend/
│   ├── .env                       # Environment variables (private, excluded by git)
│   ├── .env.example               # Environment template
│   ├── requirements.txt           # Pinned compatible Python dependencies
│   ├── database.py                # Idempotent SQLite schema & connection helpers
│   ├── seed.py                    # Seed 5 doctors and next 7 days slots in Asia/Kolkata
│   ├── appointment_service.py     # Business logic: availability, booking & cancellation
│   ├── session.py                 # Per-call session state & phone confirmation boundary
│   ├── prompts.py                 # Doctor receptionist system prompts & voice rules
│   ├── tools.py                   # LLM tool schemas & execution handlers
│   ├── bot.py                     # Pipecat WebRTC pipeline (ElevenLabs + Gemini)
│   ├── main.py                    # FastAPI server & WebRTC signaling endpoint
│   └── tests/                     # 22 comprehensive unit & integration tests
│       ├── test_appointments.py
│       └── test_confirmation_and_api.py
└── frontend/
    ├── index.html                 # HTML entry point
    ├── package.json               # Frontend dependencies & scripts
    ├── vite.config.js             # Vite configuration with Tailwind CSS v4
    ├── .env                       # Frontend environment variables
    ├── .env.example               # Frontend environment template
    └── src/
        ├── api.js                 # Backend REST client (health, doctors, slots, appointments)
        ├── App.jsx                # Main application component & WebRTC integration
        ├── index.css              # Global styles & Tailwind entry
        ├── main.jsx               # React DOM entry point
        └── components/
            ├── Header.jsx         # Branding, clinic info & live connection badge
            ├── StatsCards.jsx     # Summary cards: doctors, slots, active bookings
            ├── VoiceCallPanel.jsx # Start/End Call controls & mic/speaker indicators
            ├── LiveTranscript.jsx # Real-time conversation bubbles with auto-scroll
            ├── DoctorSlotsList.jsx# Doctors & available slots with doctor filtering
            └── AppointmentsTable.jsx # Booked & cancelled appointments registry
```

## ⚙️ Prerequisites & Environment

- **Operating System:** Windows 11 / Windows 10
- **Python:** 3.12.10
- **Node.js:** 24.14.0
- **npm:** 11.9.0
- **Virtual Environment:** Python `.venv`

## 🚀 Quickstart Guide

### 1. Backend Configuration

Ensure `backend/.env` is configured with valid API keys:

```bash
ELEVENLABS_API_KEY="your-elevenlabs-api-key"
GOOGLE_API_KEY="your-google-gemini-api-key"
ELEVENLABS_VOICE_ID="EXAVITQu4vr4xnSDxMaL"
GEMINI_MODEL="gemini-3.5-flash"
```

Start the FastAPI backend server:

```powershell
& .venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```

The server automatically initializes SQLite and seeds mock doctors and appointment slots for the next 7 days in `Asia/Kolkata` time.

### 2. Frontend Launch

Open a separate terminal and start the Vite development server:

```powershell
cd frontend
npm run dev
```

Visit `http://localhost:5173` in your browser.

### 3. Using the Voice Assistant

1. Click **Start Call** on the dashboard.
2. Allow browser microphone access when prompted.
3. The AI receptionist greets you: *"Hello! Thank you for calling Apollo Clinic. How can I help you book or manage an appointment today?"*
4. Ask for doctor availability (e.g., *"What cardiologists are available?"*).
5. Request a slot booking (e.g., *"Book Dr. Priya Sharma tomorrow at 10 AM"*).
6. Provide your 10-digit phone number.
7. The assistant enforces strict digit-by-digit readback: *"I have recorded your number as 9, 8, 7, 6, 5, 4, 3, 2, 1, 0. Is this correct?"*
8. Say *"Yes"* to confirm. The assistant executes the booking, and the dashboard immediately updates to display your appointment.

## 🧪 Testing & Verification

Run the complete 22-test automated test suite:

```powershell
& .venv\Scripts\python.exe -m unittest discover backend/tests -v
```

Build the React frontend production bundle:

```powershell
cd frontend
npm run build
```

## 📌 Technology Stack Versions

| Component | Library / Tool | Installed Version |
| :--- | :--- | :--- |
| Voice Pipeline | `pipecat-ai` | `1.17.0` |
| WebRTC Transport | `aiortc` | `1.16.0` |
| WebRTC Client | `@pipecat-ai/small-webrtc-transport` | `1.11.3` |
| Pipecat Client SDK | `@pipecat-ai/client-js` & `@pipecat-ai/client-react` | `1.17.0` / `1.12.0` |
| Backend Server | `fastapi` | `0.165.0` |
| ASGI Server | `uvicorn` | `0.54.0` |
| LLM Integration | `google-genai` & `gemini-3.5-flash` | `3.6.1` |
| STT & TTS | `elevenlabs` | `2.34.0` |
| Database | `aiosqlite` | `0.22.1` |
| Frontend Framework | `react` & `react-dom` | `19.3.1` |
| Build Tool | `vite` | `8.3.8` |
| Styling | `tailwindcss` | `4.3.5` |
| Icons | `lucide-react` | `1.80.0` |
