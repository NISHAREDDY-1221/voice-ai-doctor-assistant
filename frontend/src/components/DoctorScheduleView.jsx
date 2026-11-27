import React, { useState, useMemo } from 'react';
import { 
  ArrowLeft, 
  Calendar, 
  Clock, 
  Mic, 
  Stethoscope, 
  Heart, 
  Sparkles, 
  Baby, 
  Activity, 
  CalendarDays,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';

/**
 * DoctorScheduleView
 * Dedicated component-based screen for viewing a doctor's full appointment schedule.
 * Features:
 * - Replaces slide-over drawers with a dedicated, spacious SaaS screen
 * - Full doctor profile header with pastel initials avatar & speciality badge
 * - Prominent voice booking instructions banner
 * - Interactive date filter tabs tailored to the doctor's availability
 * - Multi-column responsive grid of date schedule cards with elegant time chips
 * - Preserves live WebRTC audio connection and real-time backend data
 */
export default function DoctorScheduleView({ doctor, slots = [], onBack }) {
  const [selectedDate, setSelectedDate] = useState('all');

  // Format 24-hr time into 12-hr readable format ("14:00:00" -> "2:00 PM")
  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':');
    const hour = parseInt(h, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${m} ${ampm}`;
  };

  // Format ISO date into full readable date: "Friday, Nov 27, 2026"
  const formatDateFull = (isoDate) => {
    if (!isoDate) return '';
    try {
      const d = new Date(isoDate + 'T00:00:00');
      return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return isoDate;
    }
  };

  // Format ISO date into short label: "Fri, Nov 27"
  const formatDateShort = (isoDate) => {
    if (!isoDate) return '';
    try {
      const d = new Date(isoDate + 'T00:00:00');
      return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    } catch {
      return isoDate;
    }
  };

  // Compute doctor initials
  const getInitials = (name) => {
    if (!name) return 'DR';
    return name
      .replace(/^Dr\.\s*/i, '')
      .trim()
      .split(/\s+/)
      .map((n) => n[0])
      .join('')
      .toUpperCase();
  };

  // Speciality visual config
  const getSpecialityConfig = (speciality) => {
    switch (speciality) {
      case 'Cardiology':
        return {
          icon: Heart,
          avatar: 'bg-rose-50 text-rose-700 border border-rose-200/80',
          badge: 'bg-rose-50 text-rose-700 border border-rose-200/80',
          accent: 'text-rose-600',
        };
      case 'Dermatology':
        return {
          icon: Sparkles,
          avatar: 'bg-amber-50 text-amber-700 border border-amber-200/80',
          badge: 'bg-amber-50 text-amber-700 border border-amber-200/80',
          accent: 'text-amber-600',
        };
      case 'General Medicine':
        return {
          icon: Stethoscope,
          avatar: 'bg-teal-50 text-teal-800 border border-teal-200/80',
          badge: 'bg-teal-50 text-teal-800 border border-teal-200/80',
          accent: 'text-teal-600',
        };
      case 'Orthopedics':
        return {
          icon: Activity,
          avatar: 'bg-blue-50 text-blue-700 border border-blue-200/80',
          badge: 'bg-blue-50 text-blue-700 border border-blue-200/80',
          accent: 'text-blue-600',
        };
      case 'Pediatrics':
        return {
          icon: Baby,
          avatar: 'bg-purple-50 text-purple-700 border border-purple-200/80',
          badge: 'bg-purple-50 text-purple-700 border border-purple-200/80',
          accent: 'text-purple-600',
        };
      default:
        return {
          icon: Stethoscope,
          avatar: 'bg-slate-50 text-slate-700 border border-slate-200',
          badge: 'bg-slate-50 text-slate-700 border border-slate-200',
          accent: 'text-slate-600',
        };
    }
  };

  // Filter and group slots specifically for this doctor
  const doctorSlots = useMemo(() => {
    if (!doctor || !doctor.id) return [];
    return slots.filter((s) => s.doctor_id === doctor.id);
  }, [slots, doctor?.id]);

  // Distinct dates available for this doctor
  const availableDates = useMemo(() => {
    const dates = Array.from(new Set(doctorSlots.map((s) => s.appointment_date).filter(Boolean))).sort();
    return dates;
  }, [doctorSlots]);

  // Group slots by date respecting selected date filter
  const groupedSlots = useMemo(() => {
    const filtered = selectedDate === 'all'
      ? doctorSlots
      : doctorSlots.filter((s) => s.appointment_date === selectedDate);

    const map = {};
    filtered.forEach((slot) => {
      if (!map[slot.appointment_date]) {
        map[slot.appointment_date] = [];
      }
      map[slot.appointment_date].push(slot);
    });
    return map;
  }, [doctorSlots, selectedDate]);

  if (!doctor) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/90 p-8 text-center">
        <p className="text-sm text-slate-600">No doctor selected.</p>
        <button
          onClick={onBack}
          className="mt-3 px-4 py-2 rounded-xl bg-teal-600 text-white text-xs font-semibold"
        >
          Back to Directory
        </button>
      </div>
    );
  }

  const config = getSpecialityConfig(doctor.speciality);
  const Icon = config.icon;
  const initials = getInitials(doctor.name);
  const firstSlot = doctorSlots[0];

  return (
    <div className="space-y-6 animate-fade-in">
      
      {/* 1. Top Breadcrumb & Navigation Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-200/90 text-xs font-semibold text-slate-700 hover:text-teal-700 hover:border-teal-300 shadow-2xs hover:shadow-xs transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 text-slate-500" />
          <span>Back to Doctors Directory</span>
        </button>

        <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
          <span>Doctors</span>
          <span>/</span>
          <span className="text-slate-700 font-semibold">{doctor.name}</span>
          <span>/</span>
          <span className="text-teal-600 font-semibold">Schedule</span>
        </div>
      </div>

      {/* 2. Doctor Profile Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-6 sm:p-7 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-start sm:items-center gap-4 sm:gap-5">
          {/* Pastel Initials Avatar */}
          <div className={`w-16 h-16 rounded-2xl ${config.avatar} flex items-center justify-center font-bold text-xl shrink-0 shadow-xs`}>
            {initials}
          </div>

          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                {doctor.name}
              </h2>
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full ${config.badge}`}>
                <Icon className={`w-3.5 h-3.5 ${config.accent}`} />
                <span>{doctor.speciality} Specialist</span>
              </span>
            </div>

            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Practicing specialist with available appointment slots in IST across the next 7 calendar days.
            </p>
          </div>
        </div>

        {/* Quick Stats Pill */}
        <div className="flex items-center gap-3 shrink-0 self-start md:self-auto pt-3 md:pt-0 border-t md:border-t-0 border-slate-100">
          <div className="text-right">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Total Open Slots</p>
            <p className="text-2xl font-bold text-teal-700 tracking-tight leading-none mt-0.5">
              {doctorSlots.length}
            </p>
          </div>

          <div className="h-10 w-px bg-slate-200 mx-1" />

          <div className="text-right">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Available Days</p>
            <p className="text-2xl font-bold text-slate-800 tracking-tight leading-none mt-0.5">
              {availableDates.length}
            </p>
          </div>
        </div>
      </div>

      {/* 3. Voice Assistant Callout Banner */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-teal-50 to-emerald-50/60 border border-teal-200/90 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-teal-900/20">
            <Mic className="w-5 h-5 text-white" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-teal-950 uppercase tracking-wide flex items-center gap-1.5">
              <span>Book this specialist via Voice Assistant</span>
              <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-teal-200/60 text-teal-900">
                Recommended
              </span>
            </h4>
            <p className="text-xs text-teal-800 mt-0.5 leading-relaxed">
              Start a conversation and say: <span className="font-semibold italic text-teal-950">
                "{firstSlot ? `Book an appointment with ${doctor.name} on ${formatDateShort(firstSlot.appointment_date)} at ${formatTime(firstSlot.appointment_time)}` : `Book an appointment with ${doctor.name}`}"
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* 4. Interactive Date Filter Tabs */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 sm:p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-teal-600" />
            <h3 className="text-sm font-bold text-slate-900">
              Filter by Available Date
            </h3>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            {selectedDate === 'all' 
              ? `Showing all ${doctorSlots.length} available slots` 
              : `Showing slots for ${formatDateShort(selectedDate)}`}
          </span>
        </div>

        {/* Date Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setSelectedDate('all')}
            className={`shrink-0 px-3.5 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer ${
              selectedDate === 'all'
                ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            All Dates ({doctorSlots.length})
          </button>

          {availableDates.map((dateStr) => {
            const count = doctorSlots.filter((s) => s.appointment_date === dateStr).length;
            const isSelected = selectedDate === dateStr;

            return (
              <button
                key={dateStr}
                onClick={() => setSelectedDate(dateStr)}
                className={`shrink-0 px-3.5 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <span>{formatDateShort(dateStr)}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  isSelected ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-600'
                }`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 5. Schedule Cards Grid */}
      <div className="space-y-4">
        {Object.keys(groupedSlots).length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/90 p-12 text-center text-slate-400">
            <Calendar className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-semibold text-slate-700">No open appointment slots found</p>
            <p className="text-xs text-slate-400 mt-1">Try selecting "All Dates" to view other available days.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {Object.entries(groupedSlots).map(([date, slotsOnDate]) => (
              <div
                key={date}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:border-slate-300 hover:shadow-sm transition p-5 flex flex-col justify-between"
              >
                <div>
                  {/* Card Date Header */}
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-100 text-teal-600 flex items-center justify-center">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 leading-tight">
                          {formatDateShort(date)}
                        </h4>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                          {date}
                        </p>
                      </div>
                    </div>

                    <span className="text-[11px] font-bold text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200">
                      {slotsOnDate.length} {slotsOnDate.length === 1 ? 'slot' : 'slots'}
                    </span>
                  </div>

                  {/* Time Chips Grid */}
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                      Available Appointment Times:
                    </p>

                    <div className="grid grid-cols-2 gap-2">
                      {slotsOnDate.map((slot) => (
                        <div
                          key={slot.id}
                          className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/80 text-slate-800 hover:bg-teal-600 hover:text-white hover:border-teal-600 transition shadow-2xs group cursor-default"
                          title={`Slot #${slot.id} • Speak to assistant to book`}
                        >
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-teal-600 group-hover:text-white" />
                            <span className="text-xs font-bold">
                              {formatTime(slot.appointment_time)}
                            </span>
                          </div>
                          <span className="text-[10px] font-mono text-slate-400 group-hover:text-teal-100">
                            #{slot.id}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Footer hint */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Standard 45-min appointment</span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
