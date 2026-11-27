import React from 'react';
import { Users, CalendarCheck, Clock, CheckCircle2 } from 'lucide-react';

/**
 * StatsCards displays summary metrics of the clinic:
 * - Total registered doctors
 * - Currently available slots
 * - Active booked appointments
 * - Total appointments handled
 */
export default function StatsCards({ doctorsCount = 0, slotsCount = 0, appointments = [] }) {
  const activeBookings = appointments.filter((a) => a.status === 'booked').length;
  const cancelledBookings = appointments.filter((a) => a.status === 'cancelled').length;

  const stats = [
    {
      title: 'Total Doctors',
      value: doctorsCount,
      description: 'Active specialists',
      icon: Users,
      color: 'blue',
      accentBg: 'bg-blue-50 text-blue-600 border-blue-200',
    },
    {
      title: 'Available Slots',
      value: slotsCount,
      description: 'Next 7 days in IST',
      icon: Clock,
      color: 'teal',
      accentBg: 'bg-teal-50 text-teal-600 border-teal-200',
    },
    {
      title: 'Active Appointments',
      value: activeBookings,
      description: 'Confirmed bookings',
      icon: CalendarCheck,
      color: 'emerald',
      accentBg: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    },
    {
      title: 'Total Processed',
      value: appointments.length,
      description: `${cancelledBookings} cancelled`,
      icon: CheckCircle2,
      color: 'indigo',
      accentBg: 'bg-indigo-50 text-indigo-600 border-indigo-200',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((item, idx) => {
        const Icon = item.icon;
        return (
          <div
            key={idx}
            className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5 shadow-xs transition hover:shadow-sm"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                {item.title}
              </span>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${item.accentBg}`}>
                <Icon className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-bold text-slate-900">
                {item.value}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">{item.description}</p>
          </div>
        );
      })}
    </div>
  );
}
