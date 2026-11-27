import React, { useState, useEffect, useRef, useCallback } from 'react';
import Header from './components/Header';
import StatsCards from './components/StatsCards';
import VoiceCallPanel from './components/VoiceCallPanel';
import LiveTranscript from './components/LiveTranscript';
import DoctorSlotsList from './components/DoctorSlotsList';
import AppointmentsTable from './components/AppointmentsTable';
import { fetchHealth, fetchDoctors, fetchSlots, fetchAppointments, API_BASE_URL } from './api';
import { PipecatClient, RTVIEvent } from '@pipecat-ai/client-js';
import { SmallWebRTCTransport } from '@pipecat-ai/small-webrtc-transport';

/**
 * Main application dashboard for Voice AI Doctor Appointment Assistant.
 *
 * Integrates:
 * - Real-time SmallWebRTC audio pipeline with ElevenLabs STT/TTS and Gemini LLM
 * - Live transcript synchronized with incoming data-channel speech events
 * - Clinic statistics cards
 * - Real-time doctors and available appointment slots
 * - Appointments registry with masked phone numbers
 * - Automated polling (every 2.5s) and event-driven updates
 */
export default function App() {
  // REST API State
  const [backendConnected, setBackendConnected] = useState(false);
  const [doctors, setDoctors] = useState([]);
  const [slots, setSlots] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Voice WebRTC State
  const [callState, setCallState] = useState('idle'); // 'idle' | 'connecting' | 'connected' | 'error'
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [messages, setMessages] = useState([]);

  // Client and Audio References
  const clientRef = useRef(null);
  const audioElementRef = useRef(null);

const DIGIT_WORDS_MAP = {
  zero: '0', oh: '0',
  one: '1', two: '2', three: '3',
  four: '4', five: '5', six: '6',
  seven: '7', eight: '8', nine: '9',
};

/**
 * Format spoken digit words (e.g. 'eight one zero six five double nine six zero six')
 * into numerals ('8106599606') for readable transcript display.
 */
function formatSpokenDigits(text) {
  if (!text) return text;
  const tokens = text.split(/\s+/);
  const output = [];
  let i = 0;
  let digitBuffer = [];
  let trailingPunct = '';

  const flush = () => {
    if (digitBuffer.length > 0) {
      if (digitBuffer.length >= 3) {
        output.push(digitBuffer.join('') + trailingPunct);
      } else {
        digitBuffer.forEach((d, idx) => {
          const p = idx === digitBuffer.length - 1 ? trailingPunct : '';
          output.push(d + p);
        });
      }
      digitBuffer = [];
      trailingPunct = '';
    }
  };

  while (i < tokens.length) {
    const token = tokens[i];
    const m = token.match(/^([a-zA-Z]+)([^a-zA-Z]*)$/);
    const cleanWord = m ? m[1].toLowerCase() : token.toLowerCase();
    const punct = m ? m[2] : '';

    if ((cleanWord === 'double' || cleanWord === 'triple') && i + 1 < tokens.length) {
      const nextToken = tokens[i + 1];
      const nm = nextToken.match(/^([a-zA-Z]+)([^a-zA-Z]*)$/);
      const nextWord = nm ? nm[1].toLowerCase() : nextToken.toLowerCase();
      if (DIGIT_WORDS_MAP[nextWord] !== undefined) {
        const count = cleanWord === 'double' ? 2 : 3;
        for (let c = 0; c < count; c++) digitBuffer.push(DIGIT_WORDS_MAP[nextWord]);
        trailingPunct = nm ? nm[2] : '';
        i += 2;
        continue;
      }
    }

    if (DIGIT_WORDS_MAP[cleanWord] !== undefined) {
      digitBuffer.push(DIGIT_WORDS_MAP[cleanWord]);
      trailingPunct = punct;
      i++;
    } else {
      flush();
      output.push(token);
      i++;
    }
  }

  flush();
  return output.join(' ');
}

  /**
   * Add a message to the live transcript if it is not an exact duplicate or partial fragment.
   * Filters out any word-level streaming tokens so only clean, full sentences are displayed.
   */
  const addMessage = useCallback((role, text) => {
    if (!text || !text.trim()) return;
    const cleanText = formatSpokenDigits(text.trim());

    // 1. Assistant always speaks in full sentences.
    // Drop any 1-2 word isolated fragments (e.g. "Thank", "you", "Hello!") that lack sentence punctuation.
    if (role === 'assistant') {
      const words = cleanText.split(/\s+/).filter(Boolean);
      if (words.length <= 2 && !/[.!?]$/.test(cleanText)) {
        return;
      }
    }

    setMessages((prev) => {
      // 2. Prevent word-level tokens from creating new bubbles if already present in any message in history
      const alreadyPresent = prev.some(
        (m) => m.role === role && (m.text === cleanText || m.text.includes(cleanText))
      );
      if (alreadyPresent) {
        return prev;
      }

      // 3. If previous was a prefix of the incoming sentence, upgrade it in-place
      if (prev.length > 0) {
        const last = prev[prev.length - 1];
        if (
          last.role === role &&
          cleanText.startsWith(last.text) &&
          cleanText.length > last.text.length
        ) {
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...last,
            text: cleanText,
          };
          return updated;
        }
      }

      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

      return [
        ...prev,
        {
          id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          role,
          text: cleanText,
          time: timeStr,
        },
      ];
    });
  }, []);

  /**
   * Fetch active slots and appointments to keep dashboard synchronized.
   */
  const refreshData = useCallback(async () => {
    try {
      const [slotsData, apptsData] = await Promise.all([
        fetchSlots(),
        fetchAppointments(),
      ]);
      setSlots(slotsData);
      setAppointments(apptsData);
      setBackendConnected(true);
    } catch (err) {
      console.warn('Backend refresh error:', err);
      setBackendConnected(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Initial page load: check health, fetch doctors list, and initial slots/appointments.
   * Real-time updates occur event-driven via the WebRTC data channel (appointment_updated).
   */
  useEffect(() => {
    async function init() {
      try {
        await fetchHealth();
        setBackendConnected(true);
        const docs = await fetchDoctors();
        setDoctors(docs);
        await refreshData();
      } catch (err) {
        console.warn('Initial load error:', err);
        setBackendConnected(false);
      }
    }
    init();
  }, [refreshData]);

  /**
   * Start a real-time voice call session with Pipecat SmallWebRTC backend.
   */
  const handleStartCall = async () => {
    setErrorMessage(null);
    setCallState('connecting');
    setMessages([]); // Reset conversation transcript for fresh call session

    try {
      // 1. Pre-verify microphone access in browser
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          // Stop probe tracks immediately so the transport manages device capture cleanly
          micStream.getTracks().forEach((t) => t.stop());
        } catch (micErr) {
          throw new Error('Microphone permission denied. Please allow microphone access to talk to the assistant.');
        }
      }

      // 2. Instantiate SmallWebRTCTransport with backend signaling endpoint
      const transport = new SmallWebRTCTransport({
        webrtcRequestParams: {
          endpoint: `${API_BASE_URL}/api/offer`,
        },
      });

      // 3. Create PipecatClient
      const client = new PipecatClient({
        transport,
        enableMic: true,
        enableCam: false,
      });

      // 4. Register event listeners
      client.on(RTVIEvent.Connected, () => {
        setCallState('connected');
        setErrorMessage(null);
      });

      client.on(RTVIEvent.Disconnected, () => {
        setCallState('idle');
        setIsSpeaking(false);
      });

      client.on(RTVIEvent.Error, (err) => {
        console.error('PipecatClient error:', err);
        setErrorMessage(err?.message || 'Connection error occurred during the call.');
        setCallState('error');
      });

      // Remote bot audio track handler
      client.on(RTVIEvent.TrackStarted, (track) => {
        if (track.kind === 'audio' && audioElementRef.current) {
          audioElementRef.current.srcObject = new MediaStream([track]);
          audioElementRef.current
            .play()
            .catch((e) => console.warn('Audio autoPlay play() failed:', e));
        }
      });

      client.on(RTVIEvent.BotStartedSpeaking, () => setIsSpeaking(true));
      client.on(RTVIEvent.BotStoppedSpeaking, () => setIsSpeaking(false));

      // Handle custom server messages (full-turn transcripts and appointment events)
      client.on(RTVIEvent.ServerMessage, (msg) => {
        const payload = msg?.data || msg;
        if (payload?.type === 'transcript' && payload.text) {
          addMessage(payload.role, payload.text);
        } else if (payload?.type === 'appointment_updated') {
          // Immediately refresh slots and appointments
          refreshData();
        }
      });

      clientRef.current = client;

      // 5. Connect WebRTC peer connection
      await client.connect();
    } catch (err) {
      console.error('Failed to start call:', err);
      setErrorMessage(err?.message || 'Failed to start voice call.');
      setCallState('idle');
      clientRef.current = null;
    }
  };

  /**
   * Hang up and release WebRTC and audio resources.
   */
  const handleEndCall = async () => {
    try {
      if (clientRef.current) {
        await clientRef.current.disconnect();
      }
    } catch (err) {
      console.warn('Error during disconnect:', err);
    } finally {
      clientRef.current = null;
      setCallState('idle');
      setIsSpeaking(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Hidden HTML audio element for assistant speech output */}
      <audio ref={audioElementRef} autoPlay playsInline className="hidden" />

      {/* Top Navigation Bar */}
      <Header backendConnected={backendConnected} callState={callState} />

      {/* Main Dashboard Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Metric Cards Row */}
        <StatsCards
          doctorsCount={doctors.length}
          slotsCount={slots.length}
          appointments={appointments}
        />

        {/* Voice Call & Live Transcript Row */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Voice Call Controls & Doctors */}
          <div className="lg:col-span-6 space-y-6">
            <VoiceCallPanel
              callState={callState}
              onStartCall={handleStartCall}
              onEndCall={handleEndCall}
              isSpeaking={isSpeaking}
              errorMessage={errorMessage}
            />

            <DoctorSlotsList doctors={doctors} slots={slots} />
          </div>

          {/* Right Column: Live Conversation Transcript */}
          <div className="lg:col-span-6">
            <LiveTranscript
              messages={messages}
              onClear={() => setMessages([])}
            />
          </div>
        </div>

        {/* Appointments Registry Table */}
        <AppointmentsTable
          appointments={appointments}
          onRefresh={refreshData}
        />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-400">
        Voice AI Doctor Appointment Assistant • Built with Pipecat, Gemini, ElevenLabs, FastAPI & React
      </footer>
    </div>
  );
}
