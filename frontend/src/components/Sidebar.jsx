import React from 'react';
import {
  LayoutDashboard,
  Mic,
  Stethoscope,
  CalendarCheck,
  Activity,
  X,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen
} from 'lucide-react';

/**
 * Sidebar navigation component for VoiceCare healthcare SaaS workspace.
 * Features:
 * - Reduced width to 230px as requested
 * - Collapsible desktop rail mode (68px) with smooth transitions
 * - Refined navigation icons, active-state highlighting & typography
 * - Compact live call status and mute controls in both expanded & collapsed modes
 * - Preserves premium dark navy (#101C30) and primary teal theme
 */
export default function Sidebar({
  activeTab,
  onSelectTab,
  callState,
  callDuration,
  isMuted,
  onToggleMute,
  backendConnected,
  mobileOpen,
  onCloseMobile,
  isCollapsed = false,
  onToggleCollapse,
}) {
  const isConnected = callState === 'connected';

  const navItems = [
    {
      id: 'overview',
      label: 'Overview',
      icon: LayoutDashboard,
      desc: 'Executive dashboard'
    },
    {
      id: 'assistant',
      label: 'Voice Assistant',
      icon: Mic,
      desc: 'Interactive AI appointment booking',
    },
    {
      id: 'doctors',
      label: 'Doctors',
      icon: Stethoscope,
      desc: 'Specialists & availability'
    },
    {
      id: 'appointments',
      label: 'Appointments',
      icon: CalendarCheck,
      desc: 'Patient booking records'
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-slate-900/60 z-40 lg:hidden backdrop-blur-xs transition-opacity"
        />
      )}

      {/* Main Sidebar Shell: 230px expanded, 68px collapsed on desktop */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 bg-[#101C30] text-slate-200 flex flex-col transition-all duration-300 ease-in-out border-r border-slate-800/80 ${mobileOpen
          ? 'translate-x-0 w-[230px]'
          : '-translate-x-full lg:translate-x-0'
          } ${isCollapsed ? 'lg:w-[68px]' : 'lg:w-[230px]'}`}
      >
        {/* Brand Header */}
        <div className="h-16 px-3.5 flex items-center justify-between border-b border-slate-800/80 shrink-0">
          <div className={`flex items-center gap-2.5 overflow-hidden transition-all duration-300 ${isCollapsed ? 'lg:justify-center lg:w-full' : ''}`}>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-teal-600 to-teal-400 flex items-center justify-center text-white shadow-md shadow-teal-950/40 shrink-0">
              <Sparkles className="w-4.5 h-4.5 text-white" />
            </div>
          </div>

          {/* Brand Title (hidden when collapsed on desktop) */}
          <div className={`transition-all duration-300 ${isCollapsed ? 'lg:hidden' : 'block'}`}>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm text-white tracking-tight">VoiceCare AI</span>
            </div>
          </div>

          {/* Desktop Collapse Toggle Button */}
          {onToggleCollapse && (
            <button
              onClick={onToggleCollapse}
              className={`hidden lg:flex p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer ${isCollapsed ? 'mx-auto' : ''
                }`}
              title={isCollapsed ? 'Expand sidebar (230px)' : 'Collapse sidebar'}
              aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {isCollapsed ? (
                <PanelLeftOpen className="w-4 h-4 text-teal-400" />
              ) : (
                <PanelLeftClose className="w-4 h-4 text-slate-400 hover:text-slate-200" />
              )}
            </button>
          )}

          {/* Mobile Drawer Close Button */}
          <button
            onClick={onCloseMobile}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-2 py-3 space-y-1 overflow-y-auto">
          {!isCollapsed && (
            <p className="px-2.5 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Navigation
            </p>
          )}

          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectTab(item.id);
                  if (onCloseMobile) onCloseMobile();
                }}
                title={item.label}
                className={`w-full flex items-center rounded-xl text-left transition-all duration-200 group cursor-pointer relative ${isCollapsed
                  ? 'justify-center p-2.5'
                  : 'gap-2.5 px-3 py-2.5'
                  } ${isActive
                    ? 'bg-teal-500/15 text-teal-300 font-semibold border border-teal-500/30 shadow-xs'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                  }`}
              >
                {/* Active Indicator Bar on left */}
                {isActive && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r bg-teal-400 shadow-[0_0_8px_#2dd4bf]" />
                )}

                <Icon
                  className={`w-4 h-4 shrink-0 transition-colors ${isActive ? 'text-teal-400' : 'text-slate-400 group-hover:text-slate-200'
                    }`}
                />

                {!isCollapsed && (
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs leading-none tracking-tight">{item.label}</span>
                      {item.badge && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-teal-500 text-slate-950 animate-pulse">
                          {item.badge}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </button>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
