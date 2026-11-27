import React from 'react';
import { Users, Calendar, CheckCircle2, XCircle } from 'lucide-react';

/**
 * StatsCards
 * Compact, elegant KPI statistics cards (~105px height) designed for a premium SaaS workspace.
 * Features:
 * - Fixed elegant ~105px height (h-[105px])
 * - Crisp numerical typography & balanced icon placement
 * - Subtle slate borders and soft hover states
 * - Displays live real-time counts directly from the backend
 * - Eliminates verbose filler descriptions
 */
export default function StatsCards({ doctorsCount = 0, slotsCount = 0, appointments = [] }) {
  const activeBookings = appointments.filter((a) => a.status === 'booked').length;
  const cancelledBookings = appointments.filter((a) => a.status === 'cancelled').length;

  const kpis = [
    {
      id: 'doctors',
      label: 'Total Doctors',
      value: doctorsCount,
      icon: Users,
      iconColor: 'text-teal-600',
      bgColor: 'bg-teal-50',
      borderColor: 'border-teal-100/80',
    },
    {
      id: 'slots',
      label: 'Available Slots',
      value: slotsCount,
      icon: Calendar,
      iconColor: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-100/80',
    },
    {
      id: 'active',
      label: 'Active Appointments',
      value: activeBookings,
      icon: CheckCircle2,
      iconColor: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
      borderColor: 'border-emerald-100/80',
    },
    {
      id: 'cancelled',
      label: 'Cancelled Bookings',
      value: cancelledBookings,
      icon: XCircle,
      iconColor: 'text-rose-600',
      bgColor: 'bg-rose-50',
      borderColor: 'border-rose-100/80',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {kpis.map((kpi) => {
        const Icon = kpi.icon;
        return (
          <div
            key={kpi.id}
            className="h-[105px] bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs hover:border-slate-300 hover:shadow-sm transition-all duration-200 flex flex-col justify-between"
          >
            {/* Top Row: KPI Label & Compact Tinted Icon */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 tracking-tight">
                {kpi.label}
              </span>
              <div className={`w-8 h-8 rounded-xl ${kpi.bgColor} border ${kpi.borderColor} flex items-center justify-center shrink-0`}>
                <Icon className={`w-4 h-4 ${kpi.iconColor}`} />
              </div>
            </div>

            {/* Bottom Row: Crisp Prominent Number */}
            <div className="flex items-baseline">
              <span className="text-2xl sm:text-[28px] font-bold text-[#0F172A] tracking-tight font-sans leading-none">
                {kpi.value}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
