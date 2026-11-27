import React from 'react';
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Clock,
  Radio,
  ShieldCheck
} from 'lucide-react';

/**
 * VoiceAssistantPanel
 * Compact, balanced voice consultation studio targeted at ~440px height on desktop.
 * Features:
 * - 440px desktop height to keep Start Conversation visible above the fold on standard laptops
 * - Perfectly centered AI orb, dynamic status typography, and action controls
 * - 6 distinct states driven by real Pipecat events:
 *   Idle, Connecting, Listening (Blue), Thinking (Purple), Speaking (Teal), and Error
 * - Real 7-bar white soundwave equalizer responding to speech and reasoning events
 */
export default function VoiceAssistantPanel({
  callState = 'idle',
  onStartCall,
  onEndCall,
  isSpeaking = false,
  isUserSpeaking = false,
  isThinking = false,
  isMuted = false,
  onToggleMute,
  callDuration = '00:00',
  errorMessage = null,
}) {
  const isConnected = callState === 'connected';
  const isConnecting = callState === 'connecting';
  const isError = callState === 'error';

  // Determine current distinct orb state (driven by actual Pipecat events)
  let orbState = 'idle';
  if (isError) {
    orbState = 'error';
  } else if (isConnecting) {
    orbState = 'connecting';
  } else if (isConnected) {
    if (isSpeaking) {
      orbState = 'speaking';
    } else if (isThinking) {
      orbState = 'thinking';
    } else if (isUserSpeaking) {
      orbState = 'listening';
    } else {
      orbState = 'idle';
    }
  }

  // State configurations (colors, typography, badges and SVG definitions)
  const stateConfig = {
    idle: {
      gradId: 'idleOrbGrad',
      haloFill: '#F0FDFA',
      haloStroke: '#5EEAD4',
      haloStrokeWidth: 2,
      rippleColor: 'border-teal-300/40',
      badgeBg: 'bg-teal-50 text-teal-700 border-teal-200/80',
      badgeDot: 'bg-teal-500',
      badgeLabel: isConnected ? 'Line Active • Ready' : 'Ready to assist',
      headline: isConnected ? 'How can I assist you?' : 'How can I help?',
      subtext: 'Book, check or cancel an appointment.',
    },
    connecting: {
      gradId: 'connectingOrbGrad',
      haloFill: '#F8FAFC',
      haloStroke: '#94A3B8',
      haloStrokeWidth: 2,
      rippleColor: 'border-slate-300/40',
      badgeBg: 'bg-slate-100 text-slate-700 border-slate-200',
      badgeDot: 'bg-slate-500 animate-ping',
      badgeLabel: 'Connecting Line...',
      headline: 'Connecting to assistant...',
      subtext: 'Establishing secure WebRTC audio session.',
    },
    listening: {
      // Blue for listening (user actively speaking)
      gradId: 'listeningOrbGrad',
      haloFill: '#EFF6FF',
      haloStroke: '#3B82F6',
      haloStrokeWidth: 2.5,
      rippleColor: 'border-blue-400/50',
      badgeBg: 'bg-blue-50 text-blue-700 border-blue-200',
      badgeDot: 'bg-blue-600 animate-ping',
      badgeLabel: 'Listening to you',
      headline: 'Listening...',
      subtext: 'Go ahead, I\'m listening. Speak naturally.',
    },
    thinking: {
      // Purple for thinking (Gemini reasoning & function execution)
      gradId: 'thinkingOrbGrad',
      haloFill: '#FAF5FF',
      haloStroke: '#A855F7',
      haloStrokeWidth: 2.5,
      rippleColor: 'border-purple-400/50',
      badgeBg: 'bg-purple-50 text-purple-700 border-purple-200',
      badgeDot: 'bg-purple-600 animate-pulse',
      badgeLabel: 'AI is thinking',
      headline: 'Thinking...',
      subtext: 'Processing your request with Gemini AI...',
    },
    speaking: {
      // Teal for speaking (assistant speaking back)
      gradId: 'speakingOrbGrad',
      haloFill: '#F0FDFA',
      haloStroke: '#0D9488',
      haloStrokeWidth: 2.5,
      rippleColor: 'border-teal-400/50',
      badgeBg: 'bg-teal-50 text-teal-700 border-teal-200',
      badgeDot: 'bg-teal-600 animate-ping',
      badgeLabel: 'Assistant Speaking',
      headline: 'Assistant is speaking...',
      subtext: 'Streaming response from ElevenLabs voice.',
    },
    error: {
      gradId: 'errorOrbGrad',
      haloFill: '#FFF1F2',
      haloStroke: '#F43F5E',
      haloStrokeWidth: 2,
      rippleColor: 'border-rose-400/40',
      badgeBg: 'bg-rose-50 text-rose-700 border-rose-200',
      badgeDot: 'bg-rose-500',
      badgeLabel: 'Connection Error',
      headline: 'Connection error',
      subtext: errorMessage || 'Could not connect. Check mic permissions and retry.',
    },
  };

  const current = stateConfig[orbState];

  // 7 Equalizer bars configuration
  const eqBars = [
    { id: 1, x: 74.75, y: 109, width: 6.5, height: 22, anim: 'animate-eq-1', thinkAnim: 'animate-thinking-1' },
    { id: 2, x: 88.75, y: 100, width: 6.5, height: 40, anim: 'animate-eq-2', thinkAnim: 'animate-thinking-2' },
    { id: 3, x: 102.75, y: 91, width: 6.5, height: 58, anim: 'animate-eq-3', thinkAnim: 'animate-thinking-3' },
    { id: 4, x: 116.75, y: 82, width: 6.5, height: 76, anim: 'animate-eq-5', thinkAnim: 'animate-thinking-4' },
    { id: 5, x: 130.75, y: 91, width: 6.5, height: 58, anim: 'animate-eq-3', thinkAnim: 'animate-thinking-3' },
    { id: 6, x: 144.75, y: 100, width: 6.5, height: 40, anim: 'animate-eq-2', thinkAnim: 'animate-thinking-2' },
    { id: 7, x: 158.75, y: 109, width: 6.5, height: 22, anim: 'animate-eq-1', thinkAnim: 'animate-thinking-1' },
  ];

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 sm:p-5 flex flex-col items-center justify-between text-center relative overflow-hidden transition-colors duration-300 lg:h-[440px]">

      {/* 1. Header: Title & Clock */}
      <div className="w-full flex items-center justify-between shrink-0">
        <div className="w-16" />
        <h2 className="text-sm sm:text-base font-semibold text-slate-800 tracking-tight">
          Voice assistant
        </h2>
        <div className="w-16 flex justify-end">
          {isConnected && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-mono font-medium">
              <Clock className="w-3 h-3 text-teal-600" />
              <span>{callDuration}</span>
            </div>
          )}
        </div>
      </div>

      {/* 2. Compact State Pill */}
      <div className="shrink-0 my-0.5">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${current.badgeBg} transition-colors duration-300`}>
          <span className={`h-1.5 w-1.5 rounded-full ${current.badgeDot}`} />
          {current.badgeLabel}
        </span>
      </div>

      {/* 3. Balanced Voice AI Orb (150px height) */}
      <div className="relative my-1 flex items-center justify-center shrink-0">
        {isConnected && (orbState === 'listening' || orbState === 'thinking' || orbState === 'speaking') && (
          <div className={`absolute inset-0 rounded-full border-2 ${current.rippleColor} animate-ripple pointer-events-none`} />
        )}

        <svg
          viewBox="0 0 240 240"
          className={`w-36 h-36 sm:w-[150px] sm:h-[150px] select-none transition-transform duration-300 ${orbState === 'speaking'
            ? 'scale-105'
            : orbState === 'thinking'
              ? 'animate-pulse-glow'
              : orbState === 'listening'
                ? 'scale-105'
                : 'animate-orb-breathe'
            }`}
        >
          <defs>
            {/* 1. Idle Gradient (Teal) */}
            <radialGradient id="idleOrbGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#14B8A6" />
              <stop offset="35%" stopColor="#0D9488" />
              <stop offset="70%" stopColor="#115E59" />
              <stop offset="92%" stopColor="#042F2E" />
              <stop offset="100%" stopColor="#022524" />
            </radialGradient>

            {/* 2. Connecting Gradient (Slate Neutral) */}
            <radialGradient id="connectingOrbGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#94A3B8" />
              <stop offset="35%" stopColor="#64748B" />
              <stop offset="70%" stopColor="#475569" />
              <stop offset="92%" stopColor="#334155" />
              <stop offset="100%" stopColor="#1E293B" />
            </radialGradient>

            {/* 3. Listening Gradient (BLUE) */}
            <radialGradient id="listeningOrbGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#60A5FA" />
              <stop offset="30%" stopColor="#3B82F6" />
              <stop offset="65%" stopColor="#2563EB" />
              <stop offset="88%" stopColor="#1D4ED8" />
              <stop offset="100%" stopColor="#172554" />
            </radialGradient>

            {/* 4. Thinking Gradient (PURPLE) */}
            <radialGradient id="thinkingOrbGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#D8B4FE" />
              <stop offset="30%" stopColor="#A855F7" />
              <stop offset="65%" stopColor="#8B5CF6" />
              <stop offset="88%" stopColor="#6D28D9" />
              <stop offset="100%" stopColor="#2E1065" />
            </radialGradient>

            {/* 5. Speaking Gradient (TEAL) */}
            <radialGradient id="speakingOrbGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#5EEAD4" />
              <stop offset="30%" stopColor="#14B8A6" />
              <stop offset="65%" stopColor="#0D9488" />
              <stop offset="88%" stopColor="#042F2E" />
              <stop offset="100%" stopColor="#021C1A" />
            </radialGradient>

            {/* 6. Error Gradient (ROSE) */}
            <radialGradient id="errorOrbGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FDA4AF" />
              <stop offset="30%" stopColor="#F43F5E" />
              <stop offset="65%" stopColor="#E11D48" />
              <stop offset="88%" stopColor="#9F1239" />
              <stop offset="100%" stopColor="#4C0519" />
            </radialGradient>

            {/* Drop Shadow */}
            <filter id="orbShadow" x="-15%" y="-15%" width="130%" height="130%">
              <feDropShadow dx="0" dy="5" stdDeviation="6" floodColor="#042F2E" floodOpacity="0.2" />
            </filter>
          </defs>

          {/* 1. Outer Halo Ring */}
          <circle
            cx="120"
            cy="120"
            r="104"
            fill={current.haloFill}
            stroke={current.haloStroke}
            strokeWidth={current.haloStrokeWidth}
            className="transition-all duration-500"
          />

          {/* 2. Inner Sphere */}
          <circle
            cx="120"
            cy="120"
            r="80"
            fill={`url(#${current.gradId})`}
            filter="url(#orbShadow)"
            className="transition-all duration-500"
          />

          {/* 3. Seven Equalizer Bars */}
          <g>
            {eqBars.map((bar) => {
              let barAnimClass = 'animate-idle-bars';
              if (orbState === 'speaking') {
                barAnimClass = bar.anim;
              } else if (orbState === 'listening') {
                barAnimClass = bar.anim;
              } else if (orbState === 'thinking') {
                barAnimClass = bar.thinkAnim;
              } else if (orbState === 'connecting') {
                barAnimClass = 'opacity-50 animate-idle-bars';
              } else if (orbState === 'error') {
                barAnimClass = 'opacity-70';
              }

              return (
                <rect
                  key={bar.id}
                  x={bar.x}
                  y={bar.y}
                  width={bar.width}
                  height={bar.height}
                  rx={3.25}
                  ry={3.25}
                  fill="#FFFFFF"
                  className={`${barAnimClass} transition-all duration-300`}
                />
              );
            })}
          </g>
        </svg>
      </div>

      {/* 4. Status Typography */}
      <div className="shrink-0 max-w-sm mx-auto my-0.5">
        <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight transition-colors duration-300">
          {current.headline}
        </h3>
        <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
          {current.subtext}
        </p>
      </div>

      {/* 5. Start Conversation Action Controls (Guaranteed visible without scrolling) */}
      <div className="w-full max-w-xs shrink-0 flex flex-col sm:flex-row items-center justify-center gap-2 mt-1">
        {isConnected ? (
          <>
            {/* End Call Button */}
            <button
              onClick={onEndCall}
              className="flex-1 w-full flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-medium text-xs sm:text-sm shadow-xs hover:shadow transition cursor-pointer"
            >
              <PhoneOff className="w-4 h-4" />
              <span>End call</span>
            </button>

            {/* Mute Button */}
            <button
              onClick={onToggleMute}
              className={`w-full sm:w-auto flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl font-medium text-xs transition border cursor-pointer ${isMuted
                ? 'bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100'
                : 'bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200'
                }`}
              title={isMuted ? 'Turn microphone back on' : 'Mute your microphone'}
            >
              {isMuted ? (
                <>
                  <MicOff className="w-3.5 h-3.5 text-rose-600" />
                  <span>Unmute</span>
                </>
              ) : (
                <>
                  <Mic className="w-3.5 h-3.5 text-slate-600" />
                  <span>Mute</span>
                </>
              )}
            </button>
          </>
        ) : (
          <button
            onClick={onStartCall}
            disabled={isConnecting}
            className={`w-full flex items-center justify-center gap-2 py-2.5 px-5 rounded-xl text-white font-semibold text-sm shadow-sm hover:shadow transition cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${isError
              ? 'bg-rose-600 hover:bg-rose-700'
              : 'bg-[#0D9488] hover:bg-[#0F766E] active:bg-[#115E59]'
              }`}
          >
            {isConnecting ? (
              <>
                <Radio className="w-4 h-4 animate-spin" />
                <span>Connecting Line...</span>
              </>
            ) : isError ? (
              <>
                <Phone className="w-4 h-4 fill-white" />
                <span>Retry</span>
              </>
            ) : (
              <>
                <Phone className="w-4 h-4 fill-white" />
                <span>Start Conversation</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* 6. Discreet Footnote */}
      <div className="shrink-0 flex items-center justify-center gap-1.5 text-[10px] text-slate-400 mt-1">
        <ShieldCheck className="w-3 h-3 text-teal-600" />
        <span>Audio streaming via SmallWebRTC</span>
      </div>

    </div>
  );
}
