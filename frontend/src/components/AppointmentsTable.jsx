import React, { useState } from 'react';
import { CalendarCheck, CheckCircle2, XCircle, ShieldCheck } from 'lucide-react';

/**
 * AppointmentsTable displays all booked and cancelled clinic appointments:
 * - Appointment ID
 * - Doctor & Speciality
 * - Appointment Date & 24-hr/12-hr Time
 * - Masked Patient Phone number (privacy protected)
 * - Booking status (Booked / Cancelled)
 * - Booking created timestamp
 */
export default function AppointmentsTable({ appointments = [], onRefresh }) {
  const [filter, setFilter] = useState('all');

  const filteredAppointments = appointments.filter((appt) => {
    if (filter === 'all') return true;
    return appt.status === filter;
  });

  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':');
    const hour = parseInt(h, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${m} ${ampm}`;
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
      {/* Table Header and Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <CalendarCheck className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-semibold text-slate-900">
              Appointments Registry
            </h3>
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
              {appointments.length} total
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Live record of patient bookings with masked phone numbers
          </p>
        </div>

        {/* Status Filter Buttons */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setFilter('all')}
            className={`text-xs px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
              filter === 'all'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All ({appointments.length})
          </button>
          <button
            onClick={() => setFilter('booked')}
            className={`text-xs px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
              filter === 'booked'
                ? 'bg-emerald-600 text-white'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            Booked ({appointments.filter((a) => a.status === 'booked').length})
          </button>
          <button
            onClick={() => setFilter('cancelled')}
            className={`text-xs px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
              filter === 'cancelled'
                ? 'bg-rose-600 text-white'
                : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
            }`}
          >
            Cancelled ({appointments.filter((a) => a.status === 'cancelled').length})
          </button>
        </div>
      </div>

      {/* Table Content */}
      <div className="mt-4 overflow-x-auto">
        {filteredAppointments.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-xs">
            No appointments found matching this filter.
          </div>
        ) : (
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider font-semibold text-[10px]">
                <th className="py-2.5 px-3">ID</th>
                <th className="py-2.5 px-3">Doctor</th>
                <th className="py-2.5 px-3">Speciality</th>
                <th className="py-2.5 px-3">Date & Time</th>
                <th className="py-2.5 px-3">Patient Phone</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Booked At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredAppointments.map((appt) => {
                const isBooked = appt.status === 'booked';
                const apptId = appt.appointment_id || appt.id;
                const doctorName = appt.doctor || appt.doctor_name || 'Dr. Specialist';
                const apptDate = appt.date || appt.appointment_date || '-';
                const apptTime = appt.time || appt.appointment_time || '';
                return (
                  <tr
                    key={apptId || Math.random()}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    <td className="py-2.5 px-3 font-semibold text-slate-900">
                      #{apptId}
                    </td>
                    <td className="py-2.5 px-3 font-medium text-slate-900">
                      {doctorName}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      {appt.speciality}
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-medium text-slate-900">
                        {apptDate}
                      </div>
                      <div className="text-[11px] text-teal-700 font-semibold">
                        {formatTime(apptTime)}
                      </div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="inline-flex items-center gap-1 font-mono text-[11px] text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                        <ShieldCheck className="w-3 h-3 text-emerald-600" />
                        {appt.phone_number}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      {isBooked ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                          <CheckCircle2 className="w-3 h-3" />
                          Booked
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">
                          <XCircle className="w-3 h-3" />
                          Cancelled
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                      {appt.created_at ? appt.created_at.slice(0, 16).replace('T', ' ') : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
