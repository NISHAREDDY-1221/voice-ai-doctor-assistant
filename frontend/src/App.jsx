import React, { useState, useEffect, useRef, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import TopNav from './components/TopNav';
import StatsCards from './components/StatsCards';
import VoiceAssistantPanel from './components/VoiceAssistantPanel';
import LiveTranscript from './components/LiveTranscript';
import DoctorAvailability from './components/DoctorAvailability';
import AppointmentsTable from './components/AppointmentsTable';
import { fetchHealth, fetchDoctors, fetchSlots, fetchAppointments, API_BASE_URL } from './api';
import { PipecatClient, RTVIEvent } from '@pipecat-ai/client-js';
import { SmallWebRTCTransport } from '@pipecat-ai/small-webrtc-transport';

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
 * Voice AI Doctor Appointment Assistant
 * Premium Healthcare AI SaaS Workspace.
 */
export default function App() {
  // Navigation State ('overview' | 'assistant' | 'doctors' | 'appointments')
  const [activeTab, setActiveTab] = useState('overview');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // REST API State
  const [backendConnected, setBackendConnected] = useState(false);
  const [doctors, setDoctors] = useState([]);
  const [slots, setSlots] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Voice WebRTC State
  const [callState, setCallState] = useState('idle'); // 'idle' | 'connecting' | 'connected' | 'error'
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [callDurationSeconds, setCallDurationSeconds] = useState(0);
  const [errorMessage, setErrorMessage] = useState(null);
  const [messages, setMessages] = useState([]);

  // Client and Audio References
  const clientRef = useRef(null);
  const audioElementRef = useRef(null);

  // Call duration counter
  useEffect(() => {
    let timer;
    if (callState === 'connected') {
      setCallDurationSeconds(0);
      timer = setInterval(() => {
        setCallDurationSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setCallDurationSeconds(0);
    }
    return () => clearInterval(timer);
  }, [callState]);

  const formattedCallDuration = `${Math.floor(callDurationSeconds / 60)
    .toString()
    .padStart(2, '0')}:${(callDurationSeconds % 60).toString().padStart(2, '0')}`;

  /**
   * Add a message to the live transcript.
   * Filters out word-level streaming fragments so only full sentences appear.
   */
  const addMessage = useCallback((role, text) => {
    if (!text || !text.trim()) return;
    const cleanText = formatSpokenDigits(text.trim());

    // Assistant always speaks in sentences
    if (role === 'assistant') {
      const words = cleanText.split(/\s+/).filter(Boolean);
      if (words.length <= 2 && !/[.!?]$/.test(cleanText)) {
        return;
      }
    }

    setMessages((prev) => {
      // Prevent duplicate bubbles from recent identical frames
      const recentDuplicate = prev.slice(-2).some(
        (m) => m.role === role && m.text.trim().toLowerCase() === cleanText.toLowerCase()
      );
      if (recentDuplicate) {
        return prev;
      }

      // If the preceding turn was an interim prefix of this completed sentence, upgrade it in-place
      if (prev.length > 0) {
        const last = prev[prev.length - 1];
        if (
          last.role === role &&
          cleanText.toLowerCase().startsWith(last.text.toLowerCase()) &&
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
    setIsMuted(false);
    setMessages([]); // Reset conversation transcript for fresh call session

    try {
      // 1. Pre-verify microphone access in browser
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
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
        setIsUserSpeaking(false);
        setIsThinking(false);
      });

      client.on(RTVIEvent.Error, (err) => {
        console.error('PipecatClient error:', err);
        const errorText =
          err?.data?.message ||
          err?.data?.error ||
          err?.message ||
          (typeof err?.data === 'string' ? err.data : null) ||
          'Connection error occurred during the call.';
        setErrorMessage(errorText);
        setCallState('error');
        setIsThinking(false);
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

      // Real Pipecat voice pipeline events for distinct states:
      // Speaking (teal): Bot active audio synthesis
      client.on(RTVIEvent.BotStartedSpeaking, () => {
        setIsSpeaking(true);
        setIsThinking(false);
      });
      client.on(RTVIEvent.BotStoppedSpeaking, () => {
        setIsSpeaking(false);
      });

      // Listening (blue): User speech detected via Silero VAD
      client.on(RTVIEvent.UserStartedSpeaking, () => {
        setIsUserSpeaking(true);
        setIsThinking(false);
      });
      client.on(RTVIEvent.UserStoppedSpeaking, () => {
        setIsUserSpeaking(false);
      });

      // Thinking (purple): Pipecat LLM reasoning & function call execution
      client.on(RTVIEvent.BotLlmStarted, () => {
        setIsThinking(true);
      });
      client.on(RTVIEvent.BotLlmStopped, () => {
        setIsThinking(false);
      });

      client.on(RTVIEvent.BotInterrupted, () => {
        setIsSpeaking(false);
        setIsThinking(false);
      });

      // Handle custom server messages (full-turn transcripts, thinking state & appointment updates)
      client.on(RTVIEvent.ServerMessage, (msg) => {
        const payload = msg?.data || msg;
        if (payload?.type === 'transcript' && payload.text) {
          addMessage(payload.role, payload.text);
        } else if (payload?.type === 'bot-thinking') {
          setIsThinking(Boolean(payload.value));
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
      setCallState('error');
      setIsThinking(false);
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
      setIsUserSpeaking(false);
      setIsThinking(false);
    }
  };

  /**
   * Toggle microphone mute / unmute using Pipecat client API.
   */
  const handleToggleMute = () => {
    if (clientRef.current) {
      const nextMuted = !isMuted;
      clientRef.current.enableMic(!nextMuted);
      setIsMuted(nextMuted);
    }
  };

  return (
    <div className="min-h-screen bg-[#F5F7FA] text-[#0F172A] flex flex-col font-sans">
      {/* Hidden HTML audio element for assistant speech output */}
      <audio ref={audioElementRef} autoPlay playsInline className="hidden" />

      {/* Dark Navy Sidebar Navigation (230px expanded, 68px collapsed) */}
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        backendConnected={backendConnected}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
      />

      {/* Main Workspace Column (with dynamic smooth padding for 230px/68px fixed desktop sidebar) */}
      <div className={`flex-1 flex flex-col min-w-0 transition-all duration-300 ease-in-out ${isSidebarCollapsed ? 'lg:pl-[68px]' : 'lg:pl-[230px]'
        }`}>
        {/* Top Header */}
        <TopNav
          activeTab={activeTab}
          backendConnected={backendConnected}
          onOpenMobile={() => setMobileOpen(true)}
        />

        {/* Content Workspace */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          {/* TAB: OVERVIEW (Full Executive Workspace) */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Compact Summary KPIs */}
              <StatsCards
                doctorsCount={doctors.length}
                slotsCount={slots.length}
                appointments={appointments}
              />

              {/* Primary Appointment Center: Voice Assistant & Live Transcript */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-6">
                  <VoiceAssistantPanel
                    callState={callState}
                    onStartCall={handleStartCall}
                    onEndCall={handleEndCall}
                    isSpeaking={isSpeaking}
                    isUserSpeaking={isUserSpeaking}
                    isThinking={isThinking}
                    isMuted={isMuted}
                    onToggleMute={handleToggleMute}
                    callDuration={formattedCallDuration}
                    errorMessage={errorMessage}
                  />
                </div>

                <div className="lg:col-span-6">
                  <LiveTranscript
                    messages={messages}
                    onClear={() => setMessages([])}
                  />
                </div>
              </div>

              {/* Doctor Specialists Directory - Compact Preview */}
              <DoctorAvailability
                doctors={doctors}
                slots={slots}
                onRefresh={refreshData}
                isLoading={isLoading}
                isCompact={true}
                onViewAll={() => setActiveTab('doctors')}
              />

              {/* Appointments Registry Table - Compact Recent Activity (5 records) */}
              <AppointmentsTable
                appointments={appointments}
                onRefresh={refreshData}
                isLoading={isLoading}
                isCompact={true}
                onViewAll={() => setActiveTab('appointments')}
              />
            </div>
          )}

          {/* TAB: VOICE ASSISTANT (Dedicated Appointment Studio) */}
          {activeTab === 'assistant' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-6">
                  <VoiceAssistantPanel
                    callState={callState}
                    onStartCall={handleStartCall}
                    onEndCall={handleEndCall}
                    isSpeaking={isSpeaking}
                    isUserSpeaking={isUserSpeaking}
                    isThinking={isThinking}
                    isMuted={isMuted}
                    onToggleMute={handleToggleMute}
                    callDuration={formattedCallDuration}
                    errorMessage={errorMessage}
                  />
                </div>

                <div className="lg:col-span-6">
                  <LiveTranscript
                    messages={messages}
                    onClear={() => setMessages([])}
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB: DOCTORS (Dedicated Doctors Directory & Slot Matrix) */}
          {activeTab === 'doctors' && (
            <div className="space-y-6">
              <DoctorAvailability
                doctors={doctors}
                slots={slots}
                onRefresh={refreshData}
                isLoading={isLoading}
                isCompact={false}
              />
            </div>
          )}

          {/* TAB: APPOINTMENTS (Dedicated Appointments Registry Table - Full Management) */}
          {activeTab === 'appointments' && (
            <div className="space-y-6">
              <AppointmentsTable
                appointments={appointments}
                onRefresh={refreshData}
                isLoading={isLoading}
                isCompact={false}
              />
            </div>
          )}
        </main>

      </div>
    </div>
  );
}
