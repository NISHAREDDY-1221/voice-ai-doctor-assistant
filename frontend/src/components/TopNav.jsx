import React from 'react';
import { Menu } from 'lucide-react';

/**
 * Page metadata mapping for dynamic page-specific header.
 */
const PAGE_CONFIG = {
  overview: {
    title: 'Overview',
    description: 'Executive dashboard, appointment metrics, and clinic activity',
  },
  assistant: {
    title: 'Voice Assistant',
    description: 'Interactive AI appointment booking studio with real-time speech processing',
  },
  doctors: {
    title: 'Doctors & Availability',
    description: 'Medical specialist directory, open appointment slots, and weekly schedules',
  },
  appointments: {
    title: 'Appointment Management',
    description: 'Patient booking records, status verification, and voice confirmation audit',
  },
};

/**
 * TopNav header component for the VoiceCare healthcare workspace.
 * Features:
 * - Dynamic page-specific title and concise description based on active sidebar tab
 * - Compact 64px height (h-16), sticky with subtle backdrop blur
 * - Actual real-time system connection status (Core API & Live Call)
 * - Minimal, distraction-free design adhering to navy (#0F172A) & teal color palette
 */
export default function TopNav({
  activeTab = 'overview',
  backendConnected = false,
  onOpenMobile,
}) {
  const page = PAGE_CONFIG[activeTab] || PAGE_CONFIG.overview;

  return (
    <header className="h-16 bg-white/95 backdrop-blur-md border-b border-slate-200/90 px-4 sm:px-6 lg:px-8 flex items-center justify-between sticky top-0 z-30 shrink-0">
      
      {/* Left: Mobile Drawer Trigger & Dynamic Page Title + Description */}
      <div className="flex items-center gap-3 sm:gap-4 min-w-0">
        <button
          onClick={onOpenMobile}
          className="lg:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition cursor-pointer shrink-0"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="min-w-0">
          <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight leading-tight truncate">
            {page.title}
          </h1>
          <p className="text-xs text-slate-500 hidden sm:block truncate leading-tight mt-0.5">
            {page.description}
          </p>
        </div>
      </div>

      {/* Right: Backend System Connection Status Indicator */}
      <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border shadow-2xs ${
            backendConnected
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200/80'
              : 'bg-rose-50 text-rose-700 border-rose-200'
          }`}
          title={backendConnected ? 'Core FastAPI server online on port 8000' : 'Backend API disconnected'}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              backendConnected ? 'bg-emerald-500 shadow-[0_0_6px_#10b981]' : 'bg-rose-500'
            }`}
          />
          <span className="hidden sm:inline">
            {backendConnected ? 'System Online' : 'System Offline'}
          </span>
          <span className="sm:hidden">
            {backendConnected ? 'Online' : 'Offline'}
          </span>
        </div>
      </div>
    </header>
  );
}
