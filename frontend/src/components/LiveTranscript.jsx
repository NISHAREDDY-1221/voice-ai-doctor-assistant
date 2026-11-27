import React, { useEffect, useRef } from 'react';
import { MessageSquare, Bot, User, Trash2 } from 'lucide-react';

/**
 * LiveTranscript component renders real-time conversation messages between
 * caller (patient) and Voice AI doctor receptionist.
 *
 * @param {Object} props
 * @param {Array} props.messages - Array of { id, role: 'user'|'assistant', text, time }
 * @param {Function} props.onClear - Callback to clear transcript history
 */
export default function LiveTranscript({ messages = [], onClear }) {
  const scrollRef = useRef(null);

  // Auto-scroll to the latest message whenever messages update
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs flex flex-col h-[420px]">
      {/* Header bar */}
      <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-blue-600" />
          <h3 className="text-sm font-semibold text-slate-800">
            Live Conversation Transcript
          </h3>
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
            {messages.length} messages
          </span>
        </div>
        {messages.length > 0 && (
          <button
            onClick={onClear}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100 transition cursor-pointer"
            title="Clear transcript"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Messages area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-3 scroll-smooth bg-slate-50/50"
      >
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
            <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center mb-3">
              <Bot className="w-6 h-6" />
            </div>
            <p className="text-sm font-medium text-slate-600">
              No conversation messages yet
            </p>
            <p className="text-xs text-slate-400 max-w-xs mt-1">
              Click <span className="font-semibold text-blue-600">Start Call</span> and speak to begin. Try saying:
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-1.5 max-w-sm">
              <span className="text-[11px] bg-white border border-slate-200 rounded-md px-2 py-1 text-slate-600 shadow-2xs">
                "What cardiologists are available?"
              </span>
              <span className="text-[11px] bg-white border border-slate-200 rounded-md px-2 py-1 text-slate-600 shadow-2xs">
                "Book Dr. Priya Sharma tomorrow"
              </span>
              <span className="text-[11px] bg-white border border-slate-200 rounded-md px-2 py-1 text-slate-600 shadow-2xs">
                "Cancel my appointment"
              </span>
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                className={`flex items-start gap-2.5 ${
                  isUser ? 'flex-row-reverse' : 'flex-row'
                }`}
              >
                {/* Avatar */}
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs shrink-0 ${
                    isUser
                      ? 'bg-blue-600 text-white'
                      : 'bg-teal-600 text-white'
                  }`}
                >
                  {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                {/* Message bubble */}
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-xs sm:text-sm shadow-2xs ${
                    isUser
                      ? 'bg-blue-600 text-white rounded-tr-xs'
                      : 'bg-white text-slate-800 border border-slate-200 rounded-tl-xs'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 mb-1">
                    <span
                      className={`text-[10px] font-semibold uppercase tracking-wider ${
                        isUser ? 'text-blue-100' : 'text-teal-700'
                      }`}
                    >
                      {isUser ? 'You (Patient)' : 'AI Receptionist'}
                    </span>
                    <span
                      className={`text-[10px] ${
                        isUser ? 'text-blue-200' : 'text-slate-400'
                      }`}
                    >
                      {msg.time}
                    </span>
                  </div>
                  <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
