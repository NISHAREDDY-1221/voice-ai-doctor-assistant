import React from 'react';
import { Activity, Radio, Stethoscope } from 'lucide-react';

/**
 * Header component displaying project title and live system status.
 *
 * @param {Object} props
 * @param {boolean} props.backendConnected - Whether backend API is responding
 * @param {string} props.callState - Current call state ('idle', 'connecting', 'connected', 'error')
 */
export default function Header({ backendConnected, callState }) {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Left: Branding & Title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-teal-500 flex items-center justify-center text-white shadow-xs">
            <Stethoscope className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                Voice AI Doctor Appointment Assistant
              </h1>
              <span className="hidden sm:inline-flex text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                Apollo Clinic
              </span>
            </div>
            <p className="text-xs text-slate-500 hidden sm:block">
              Conversational Voice Pipeline • Pipecat • Gemini • ElevenLabs
            </p>
          </div>
        </div>

        {/* Right: Status Badges */}
        <div className="flex items-center gap-3">
          {/* Call Status Badge */}
          {callState !== 'idle' && (
            <div
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
                callState === 'connected'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : callState === 'connecting'
                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                  : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}
            >
              <Radio
                className={`w-3.5 h-3.5 ${
                  callState === 'connected' ? 'animate-pulse text-emerald-600' : ''
                }`}
              />
              <span className="capitalize">{callState === 'connected' ? 'Call Active' : callState}</span>
            </div>
          )}

          {/* Backend Connection Status */}
          <div
            className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border ${
              backendConnected
                ? 'bg-slate-50 text-slate-700 border-slate-200'
                : 'bg-rose-50 text-rose-700 border-rose-200'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                backendConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
              }`}
            />
            <span className="hidden md:inline">
              {backendConnected ? 'Backend Connected' : 'Connecting to API...'}
            </span>
            <span className="md:hidden">
              {backendConnected ? 'Online' : 'Offline'}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
