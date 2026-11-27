# Voice AI Doctor Appointment Assistant

A production-ready real-time conversational Voice AI Doctor Appointment Assistant built with **FastAPI**, **Pipecat**, **ElevenLabs STT & TTS**, **Google Gemini Function Calling**, and a **React 19 + Tailwind CSS** healthcare SaaS dashboard communicating over **SmallWebRTC**.

---

## 🩺 System Architecture

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                             REACT HEALTHCARE DASHBOARD                           │
│  • VoiceAssistantPanel: Interactive AI Studio (6 Pipecat States + Live Orb)      │
│  • LiveTranscript: Real-time turn-based dialogue bubbles & numeral formatting     │
│  • DoctorAvailability: Multi-specialist directory & 7-day schedule matrix         │
│  • DoctorScheduleView: Dedicated doctor view with recommended voice commands      │
│  • AppointmentsTable: Real-time registry with phone masking (e.g. 987****210)     │
│  • TopNav & Sidebar: Dynamic page header, responsive navigation, system status    │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │ SmallWebRTC Audio Stream (Bidirectional)
                                         │ & Data Channel Events
                                         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                         PIPECAT VOICE PIPELINE (BACKEND)                         │
│  • SmallWebRTCTransport: Low-latency peer-to-peer WebRTC signaling (aiortc)     │
│  • ElevenLabs STT: Real-time speech recognition                                  │
│  • Gemini LLM: Reasoning, prompt guardrails, and tool calling                     │
│  • ElevenLabs TTS: Warm, natural human speech synthesis                          │
│  • Session State Guard: Strict digit-by-digit phone readback confirmation        │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │ Async SQLite Queries
                                         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                           SQLITE DATABASE LAYER                                  │
│  • doctors: 5 medical specialists across distinct specialities                   │
│  • slots: 7-day rolling appointment schedule in Asia/Kolkata timezone (IST)      │
│  • appointments: Confirmed & cancelled bookings with voice audit logs            │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🌟 Key Features

1. **Real-Time Voice Appointment Assistant:**
   - Low-latency bidirectional voice conversation directly in the browser via SmallWebRTC.
   - 6 distinct visual assistant states driven by live pipeline events: *Idle, Connecting, Listening (Blue), Thinking (Purple), Speaking (Teal), and Error*.
   - Live turn-based dialogue transcript with automatic spoken digit normalization (e.g., converts *"nine eight seven..."* to readable numerals).

2. **Mandatory Phone Confirmation Invariant:**
   - Strict session-enforced safety boundary: Booking and cancellation tools cannot execute until the patient's 10-digit phone number is read back digit-by-digit and confirmed by the caller.
   - Operations are exclusively handled by the Voice Assistant to ensure end-to-end voice verification.

3. **Specialist Directory & Availability Matrix:**
   - Multi-specialist catalog (Cardiology, Dermatology, General Medicine, Orthopedics, Pediatrics).
   - 7-day horizontal calendar with accurate slot counts.
   - Segmented dropdown filters (Speciality and Date) with instant reset and quick search.
   - Dedicated doctor schedule view with full slot tables and recommended voice prompt instructions.

4. **Appointment Management & Privacy:**
   - Real-time appointment registry with sortable columns, pagination (10/25/50 rows), and status filtering.
   - Strict phone number masking: Only the middle 4 digits are masked with stars (`987****210` / `+91 987****210`).
   - Real-time sync: When an appointment is booked or cancelled over voice, the dashboard instantly reflects the update without manual page reloads.

---

## 🛠️ Technology Stack & Versions

| Layer | Technology | Version | Purpose |
| :--- | :--- | :--- | :--- |
| **Voice Framework** | `pipecat-ai` | `1.17.0` | Orchestrates STT, LLM, TTS, and WebRTC audio pipeline |
| **WebRTC Transport** | `aiortc` | `1.16.0` | Server-side WebRTC audio streaming and peer signaling |
| **WebRTC Client** | `@pipecat-ai/small-webrtc-transport` | `1.11.3` | Browser-side WebRTC transport adapter |
| **Pipecat Client** | `@pipecat-ai/client-js` | `1.17.0` | WebRTC event listeners and audio track handling |
| **Speech-to-Text** | ElevenLabs STT | Scribe API | Real-time speech recognition |
| **Text-to-Speech** | ElevenLabs TTS | `2.34.0` | Natural healthcare receptionist voice synthesis |
| **LLM & Tools** | Google Gemini | `gemini-3.5-flash-lite` | Fast conversational reasoning and function execution |
| **Backend API** | FastAPI & Uvicorn | `0.165.0` / `0.54.0` | REST API, CORS middleware, WebRTC SDP offer negotiation |
| **Database** | SQLite + `aiosqlite` | `0.22.1` | Asynchronous local database persistence |
| **Frontend UI** | React 19 + Vite | `19.3.1` / `8.3.8` | Component-based healthcare workspace |
| **Styling** | Tailwind CSS | `4.3.5` | SaaS design system with dark navy and teal palette |
| **Icons** | Lucide React | `1.80.0` | Consistent iconography across all pages |

---

## 📁 Repository Structure

```
voice-ai-doctor-assistant/
├── .gitignore                         # Excludes secrets, .venv, node_modules, .db files
├── .env.example                       # Root environment configuration template
├── README.md                          # Full system documentation and setup guide
├── backend/
│   ├── .env.example                   # Backend environment template
│   ├── requirements.txt               # Pinned backend dependencies
│   ├── main.py                        # FastAPI server, REST routes & /api/offer signaling
│   ├── bot.py                         # Pipecat WebRTC voice pipeline configuration
│   ├── prompts.py                     # AI receptionist instructions & voice guardrails
│   ├── tools.py                       # Gemini tool definitions & validation handlers
│   ├── appointment_service.py         # Business logic: slots, booking, cancellation
│   ├── session.py                     # In-memory session state & phone confirmation guard
│   ├── database.py                    # SQLite schema definition & async connection pool
│   ├── seed.py                        # Database seeder (5 doctors, 7 days of IST slots)
│   └── tests/                         # Automated test suite (22 tests in 2 test suites)
│       ├── test_appointments.py       # 13 tests: database, seeding, slots, booking, cancellation
│       └── test_confirmation_and_api.py # 9 tests: phone confirmation guard, tools, REST API endpoints
└── frontend/
    ├── .env.example                   # Frontend environment template
    ├── package.json                   # Dependencies & npm scripts
    ├── vite.config.js                 # Vite build configuration
    └── src/
        ├── api.js                     # REST API client (health, doctors, slots, appointments)
        ├── App.jsx                    # Root application, navigation & WebRTC client lifecycle
        ├── index.css                  # Global Tailwind CSS entry
        └── components/
            ├── TopNav.jsx             # Dynamic page header with connection status
            ├── Sidebar.jsx            # Dark navy navigation sidebar (expandable / collapsible)
            ├── StatsCards.jsx         # Executive KPI summary cards
            ├── VoiceAssistantPanel.jsx# Live voice assistant studio & animated state orb
            ├── LiveTranscript.jsx     # Dialogue transcript with spoken digit formatter
            ├── DoctorAvailability.jsx # Doctor cards, 7-day calendar & segmented filters
            ├── DoctorScheduleView.jsx # Dedicated single-doctor schedule & prompt guide
            └── AppointmentsTable.jsx  # Appointment registry with masked patient contacts
```

---

## ⚙️ Environment Configuration

### Backend Environment (`backend/.env`)

Create `backend/.env` (or copy from `backend/.env.example`):

```bash
# ElevenLabs API Key for STT & TTS
ELEVENLABS_API_KEY="your_elevenlabs_api_key_here"

# Google Gemini API Key for LLM Reasoning & Function Calling
GOOGLE_API_KEY="your_google_gemini_api_key_here"

# ElevenLabs Voice ID (Default: professional warm receptionist)
ELEVENLABS_VOICE_ID="EXAVITQu4vr4xnSDxMaL"

# Gemini Model Identifier
GEMINI_MODEL="gemini-3.5-flash-lite"
```

### Frontend Environment (`frontend/.env`)

Create `frontend/.env` (or copy from `frontend/.env.example`):

```bash
VITE_API_BASE_URL=http://localhost:8000
```

---

## 🚀 Installation & Startup Guide

### 1. Prerequisites
- **Python:** 3.10+ (Tested on Python 3.12.10)
- **Node.js:** 18+ (Tested on Node.js 24.14.0)
- **npm:** 9+ (Tested on npm 11.9.0)

### 2. Backend Setup

```powershell
# Navigate to project root
cd voice-ai-doctor-assistant

# Create and activate virtual environment
python -m venv .venv
.venv\Scripts\Activate.ps1

# Install dependencies
pip install -r backend/requirements.txt

# Start FastAPI backend server
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```

The database initializes automatically upon server startup and seeds 5 doctors across 5 specialities with open slots for the next 7 days in `Asia/Kolkata` time.

### 3. Frontend Setup

In a separate terminal:

```powershell
# Navigate to frontend
cd voice-ai-doctor-assistant/frontend

# Install dependencies
npm install

# Start Vite development server
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## 🧪 Verification & Testing

### Run Backend Unit & Integration Tests

Execute the comprehensive 22-test automated test suite:

```powershell
python -m unittest discover backend/tests -v
```

**Test Coverage Breakdown (22 Tests Total):**
- **`backend/tests/test_appointments.py` (13 tests):**
  - Database schema initialization, table constraints, and idempotent re-creation.
  - Mock data seeder idempotency across multiple runs.
  - Doctor availability filtering by doctor, speciality, date, and edge cases.
  - Slot booking, past slot rejection, and duplicate booking prevention.
  - Concurrent booking race conditions.
  - Phone number normalization and invalid phone rejection.
  - Cancellation slot release, caller authorization checks, and unknown phone handling.
- **`backend/tests/test_confirmation_and_api.py` (9 tests):**
  - Tool schemas registration for Gemini function calling.
  - Rejection of booking prior to verbal phone confirmation readback.
  - Successful booking after explicit caller confirmation.
  - Invalidation of confirmation when the phone number changes.
  - Cancellation requiring fresh verbal confirmation.
  - FastAPI endpoints: `/api/health`, `/api/doctors`, `/api/slots`, and `/api/appointments`.
  - Phone number masking verification (`987****210`).

### Build Frontend Production Bundle

```powershell
cd frontend
npm run build
```

---

## 🔒 Security & Privacy Practices

- **Strict Phone Masking:** Patient phone numbers are masked across all table views and summary cards, displaying only the first and last digits with the middle 4 digits obscured (e.g. `987****210` / `+91 987****210`).
- **Zero Bypass Controls:** Manual booking or cancellation buttons are intentionally omitted from UI tables to ensure all scheduling actions pass through voice authentication and confirmation readback.
- **Git Exclusions:** Private credentials (`.env`), SQLite databases (`*.db`), virtual environments (`.venv/`), and dependency folders (`node_modules/`) are strictly excluded from version control via `.gitignore`.
