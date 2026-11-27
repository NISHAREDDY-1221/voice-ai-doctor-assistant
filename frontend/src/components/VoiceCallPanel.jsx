import React from 'react';
import { PhoneCall, PhoneOff, Mic, Volume2, AlertCircle } from 'lucide-react';

/**
 * VoiceCallPanel provides the voice interaction controls:
 * - Start Call (requests mic permission, initiates SmallWebRTC connection)
 * - End Call (hangs up WebRTC peer connection, stops microphone tracks)
 * - Call state indicators & microphone status
 */
export default function VoiceCallPanel({
  callState,
  onStartCall,
  onEndCall,
  isSpeaking,
  errorMessage,
}) {
  const isConnecting = callState === 'connecting';
  const isConnected = callState === 'connected';

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Left: Call Status & Guidance */}
        <div className="flex items-start gap-3">
          <div
            className={`w-12 h-12 rounded-xl flex items-center justify-center text-white shrink-0 transition-all ${
              isConnected
                ? 'bg-gradient-to-tr from-emerald-500 to-teal-600 shadow-sm shadow-emerald-200 animate-pulse'
                : isConnecting
                ? 'bg-gradient-to-tr from-amber-500 to-yellow-600 animate-bounce'
                : 'bg-gradient-to-tr from-blue-600 to-indigo-600'
            }`}
          >
            {isConnected ? (
              <Volume2 className="w-6 h-6" />
            ) : (
              <Mic className="w-6 h-6" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-slate-900">
                Voice AI Consultation Assistant
              </h2>
              <span
                className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                  isConnected
                    ? 'bg-emerald-100 text-emerald-800'
                    : isConnecting
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {isConnected
                  ? isSpeaking
                    ? 'AI is speaking...'
                    : 'Listening to you'
                  : isConnecting
                  ? 'Connecting...'
                  : 'Idle'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Speak naturally to check availability, book slots, or cancel existing appointments.
            </p>
          </div>
        </div>

        {/* Right: Call Action Buttons */}
        <div className="flex items-center gap-3">
          {!isConnected ? (
            <button
              onClick={onStartCall}
              disabled={isConnecting}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white shadow-xs transition-all ${
                isConnecting
                  ? 'bg-blue-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 active:scale-95 cursor-pointer'
              }`}
            >
              <PhoneCall className="w-4 h-4" />
              <span>{isConnecting ? 'Starting Call...' : 'Start Call'}</span>
            </button>
          ) : (
            <button
              onClick={onEndCall}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 active:scale-95 transition-all shadow-xs cursor-pointer"
            >
              <PhoneOff className="w-4 h-4" />
              <span>End Call</span>
            </button>
          )}
        </div>
      </div>

      {/* Error message banner if any */}
      {errorMessage && (
        <div className="mt-4 flex items-center gap-2 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Visual Live Waveform bar indicator when connected */}
      {isConnected && (
        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span>Microphone active • WebRTC audio streaming to ElevenLabs STT</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-1 h-3 bg-teal-500 rounded-full animate-pulse" />
            <span className="w-1 h-5 bg-teal-600 rounded-full animate-pulse [animation-delay:150ms]" />
            <span className="w-1 h-2 bg-teal-400 rounded-full animate-pulse [animation-delay:300ms]" />
            <span className="w-1 h-4 bg-teal-500 rounded-full animate-pulse [animation-delay:450ms]" />
          </div>
        </div>
      )}
    </div>
  );
}
