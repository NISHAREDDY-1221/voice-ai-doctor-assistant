import React, { useState } from 'react';
import { Calendar, UserCheck, Stethoscope, ChevronRight, RefreshCw } from 'lucide-react';

/**
 * DoctorSlotsList displays:
 * - List of clinic doctors with their speciality
 * - Available future slots grouped by doctor
 * - Interactive filter by doctor
 */
export default function DoctorSlotsList({ doctors = [], slots = [], onRefresh }) {
  const [selectedDoctorId, setSelectedDoctorId] = useState(null);

  // Filter slots if doctor selected
  const filteredSlots = selectedDoctorId
    ? slots.filter((s) => s.doctor_id === selectedDoctorId)
    : slots;

  // Format time (e.g. "10:00" -> "10:00 AM")
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <Stethoscope className="w-4 h-4 text-teal-600" />
            Doctors & Available Slots
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time availability updated after bookings and cancellations
          </p>
        </div>

        {/* Doctor filter pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setSelectedDoctorId(null)}
            className={`text-xs px-2.5 py-1 rounded-lg font-medium transition cursor-pointer ${
              selectedDoctorId === null
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Doctors ({slots.length})
          </button>
          {doctors.map((doc) => {
            const count = slots.filter((s) => s.doctor_id === doc.id).length;
            const isSelected = selectedDoctorId === doc.id;
            return (
              <button
                key={doc.id}
                onClick={() => setSelectedDoctorId(doc.id)}
                className={`text-xs px-2.5 py-1 rounded-lg font-medium transition cursor-pointer flex items-center gap-1 ${
                  isSelected
                    ? 'bg-blue-600 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <span>{doc.name.split(' ').slice(0, 2).join(' ')}</span>
                <span
                  className={`text-[10px] px-1 rounded-md ${
                    isSelected ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              title="Refresh availability"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Available Slots Grid */}
      <div className="mt-4">
        {filteredSlots.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-xs">
            No available future slots found for this selection.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 max-h-[300px] overflow-y-auto p-1">
            {filteredSlots.slice(0, 30).map((slot) => (
              <div
                key={slot.slot_id || slot.id}
                className="bg-slate-50 hover:bg-teal-50/50 border border-slate-200 hover:border-teal-300 rounded-lg p-2.5 transition text-left group"
              >
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700">
                  <span className="text-teal-700 font-bold">
                    {formatTime(slot.appointment_time)}
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal">
                    #{slot.slot_id || slot.id}
                  </span>
                </div>
                <div className="mt-1 text-xs font-medium text-slate-800 truncate">
                  {slot.doctor_name}
                </div>
                <div className="text-[10px] text-slate-500 truncate">
                  {slot.speciality}
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-400 border-t border-slate-200/60 pt-1">
                  <span>{slot.appointment_date}</span>
                  <span className="text-[9px] bg-emerald-100 text-emerald-800 font-medium px-1 rounded">
                    Open
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
        {filteredSlots.length > 30 && (
          <div className="mt-2 text-center text-[11px] text-slate-400">
            Showing first 30 of {filteredSlots.length} available slots
          </div>
        )}
      </div>
    </div>
  );
}
