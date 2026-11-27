import React, { useEffect, useRef } from 'react';
import { 
  Bot, 
  User, 
  Trash2, 
  MessageSquare,
  MessageSquareDashed,
  CalendarSearch,
  CalendarPlus,
  CalendarX2,
  Mic
} from 'lucide-react';

/**
 * LiveTranscript
 * Premium conversational interface for real-time patient & AI receptionist dialogue.
 * Features:
 * - Distinct, elegant patient (right-aligned blue) and AI (left-aligned teal/white) message bubbles
 * - Minimal, elegant empty state with conversation icon and 3 suggested voice prompts:
 *   1. Checking availability
 *   2. Booking an appointment
 *   3. Cancelling an appointment
 * - Crisp avatar badges and monospaced timestamps
 * - Smooth auto-scrolling to newest turns
 * - Automatic duplicate bubble prevention without fake conversation messages
 */
export default function LiveTranscript({ messages = [], onClear }) {
  const scrollRef = useRef(null);
  const bottomAnchorRef = useRef(null);

  // Suggested voice prompts for checking availability, booking, and cancellation
  const suggestedPrompts = [
    {
      category: 'Check Availability',
      icon: CalendarSearch,
      prompt: 'Check available cardiologists for tomorrow',
      badgeColor: 'text-teal-700 bg-teal-50 border-teal-200/60',
    },
    {
      category: 'Book Appointment',
      icon: CalendarPlus,
      prompt: 'Book an appointment with Dr. Priya Sharma at 10 AM',
      badgeColor: 'text-blue-700 bg-blue-50 border-blue-200/60',
    },
    {
      category: 'Cancel Booking',
      icon: CalendarX2,
      prompt: 'Cancel my appointment with Dr. Arjun Rao',
      badgeColor: 'text-rose-700 bg-rose-50 border-rose-200/60',
    },
  ];

  // Smooth auto-scroll to latest turn
  useEffect(() => {
    if (bottomAnchorRef.current) {
      bottomAnchorRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [messages]);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm flex flex-col h-[440px] overflow-hidden transition-all duration-200">
      
      {/* Header Bar */}
      <div className="h-12 px-4 sm:px-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70 shrink-0">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${messages.length > 0 ? 'bg-teal-500 animate-pulse' : 'bg-slate-300'}`} />
          <h3 className="text-xs sm:text-sm font-semibold text-slate-900 tracking-tight">
            Live Dialogue Transcript
          </h3>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-200/70 text-slate-700 font-mono">
            {messages.length}
          </span>
        </div>

        {messages.length > 0 && (
          <button
            onClick={onClear}
            className="flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-rose-600 px-2 py-1 rounded-lg hover:bg-rose-50 transition cursor-pointer"
            title="Clear transcript history"
            aria-label="Clear transcript"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Clear</span>
          </button>
        )}
      </div>

      {/* Messages Stream Container */}
      <div
        ref={scrollRef}
        className={`flex-1 p-4 sm:p-5 bg-[#FAFBFD] ${
          messages.length > 0 
            ? 'overflow-y-auto space-y-3.5 scroll-smooth' 
            : 'overflow-hidden flex flex-col justify-center'
        }`}
      >
        {messages.length === 0 ? (
          /* Minimal, Elegant Empty State (Without Scrollbar) */
          <div className="flex flex-col items-center justify-center text-center p-1 text-slate-500">
            {/* Minimal Conversation Icon */}
            <div className="w-9 h-9 rounded-xl bg-slate-100 border border-slate-200/80 text-slate-500 flex items-center justify-center mb-2 shadow-2xs">
              <MessageSquareDashed className="w-4.5 h-4.5 text-slate-600" />
            </div>

            {/* Concise Instructions */}
            <h4 className="text-sm font-bold text-slate-900 tracking-tight">
              No active conversation
            </h4>
            <p className="text-xs text-slate-600 max-w-xs mt-0.5 leading-relaxed">
              Start a voice conversation to view the live dialogue in real time.
            </p>

            {/* Three Suggested Voice Prompts: Availability, Booking, Cancellation */}
            <div className="mt-3.5 w-full max-w-sm text-left">
              <div className="flex items-center justify-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
                <Mic className="w-3 h-3 text-teal-600" />
                <span>Suggested voice requests</span>
              </div>

              <div className="space-y-1.5">
                {suggestedPrompts.map((item, idx) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={idx}
                      className="p-2 rounded-xl bg-white border border-slate-200/90 shadow-2xs hover:border-slate-300 transition-all duration-150 flex items-start gap-2.5"
                    >
                      <div className="p-1 rounded-lg bg-slate-50 border border-slate-100 text-slate-600 shrink-0 mt-0.5">
                        <Icon className="w-3 h-3 text-teal-600" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded border ${item.badgeColor}`}>
                            {item.category}
                          </span>
                        </div>
                        <p className="text-xs text-slate-800 italic truncate font-medium">
                          "{item.prompt}"
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          /* Conversational Messages */
          messages.map((msg, idx) => {
            const isUser = msg.role === 'user';

            return (
              <div
                key={msg.id || idx}
                className={`flex items-start gap-2.5 ${
                  isUser ? 'flex-row-reverse' : 'flex-row'
                }`}
              >
                {/* Avatar */}
                <div
                  className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs shrink-0 shadow-xs ${
                    isUser
                      ? 'bg-gradient-to-tr from-blue-600 to-indigo-600 text-white'
                      : 'bg-gradient-to-tr from-teal-600 to-emerald-600 text-white'
                  }`}
                  title={isUser ? 'Patient' : 'AI Assistant'}
                >
                  {isUser ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                </div>

                {/* Message Bubble */}
                <div
                  className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 shadow-xs text-xs sm:text-[13px] transition-all duration-200 ${
                    isUser
                      ? 'bg-blue-600 text-white rounded-tr-xs'
                      : 'bg-white text-slate-800 border border-slate-200/90 rounded-tl-xs'
                  }`}
                >
                  {/* Meta Label & Timestamp */}
                  <div className="flex items-center justify-between gap-3 mb-1">
                    <span
                      className={`text-[10px] font-bold tracking-wider uppercase ${
                        isUser ? 'text-blue-100' : 'text-teal-700'
                      }`}
                    >
                      {isUser ? 'Patient' : 'AI Assistant'}
                    </span>
                    <span
                      className={`text-[10px] font-mono ${
                        isUser ? 'text-blue-200' : 'text-slate-400'
                      }`}
                    >
                      {msg.time}
                    </span>
                  </div>

                  {/* Transcript Content */}
                  <p className="leading-relaxed whitespace-pre-wrap font-normal">
                    {msg.text}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomAnchorRef} />
      </div>

    </div>
  );
}
