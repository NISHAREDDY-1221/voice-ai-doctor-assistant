import React, { useState, useMemo, useEffect } from 'react';
import { 
  Stethoscope, 
  Calendar, 
  Clock, 
  Search, 
  X, 
  RotateCcw, 
  ArrowRight, 
  Sparkles, 
  Heart, 
  Baby, 
  Activity, 
  Users, 
  CalendarDays,
  ChevronRight,
  Filter,
  ChevronDown
} from 'lucide-react';
import DoctorScheduleView from './DoctorScheduleView';

/**
 * DoctorAvailability
 * Premium healthcare SaaS doctor directory & interactive availability schedule.
 *
 * Supported Modes:
 * - isCompact={false} (Dedicated Doctors Page):
 *     1. Independent Page Header Section (Title, status badge, last updated, refresh)
 *     2. Independent Search & Speciality Filter Toolbar
 *     3. Independent 7-Day Horizontal Calendar Date Selector Card
 *     4. Independent Doctor Cards Grid (3-column responsive, dates alongside times, full schedule view)
 * - isCompact={true} (Overview Page):
 *     1. Compact Doctor Availability preview container
 *     2. Prominent "View All Doctors" button routing to dedicated page
 *     3. Hides advanced search, speciality filters, and horizontal date calendar
 *     4. Displays dates alongside upcoming slot times to prevent ambiguity
 */
export default function DoctorAvailability({ 
  doctors = [], 
  slots = [],
  onRefresh,
  isLoading = false,
  isCompact = false,
  onViewAll
}) {
  const [selectedSpeciality, setSelectedSpeciality] = useState('all');
  const [selectedDate, setSelectedDate] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDoctorForSchedule, setSelectedDoctorForSchedule] = useState(null);
  const [lastUpdated, setLastUpdated] = useState('Just now');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Update "Last Updated" timestamp when slots change
  useEffect(() => {
    const now = new Date();
    setLastUpdated(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
  }, [slots]);

  // 1. Extract exactly 7-day sorted distinct dates from available slots
  const sevenDayCalendar = useMemo(() => {
    const dateMap = {};
    slots.forEach((s) => {
      if (!s.appointment_date) return;
      dateMap[s.appointment_date] = (dateMap[s.appointment_date] || 0) + 1;
    });

    const sortedDates = Object.keys(dateMap).sort().slice(0, 7);
    return sortedDates.map((dateStr) => {
      let weekday = '';
      let formattedDay = '';
      try {
        const d = new Date(dateStr + 'T00:00:00');
        weekday = d.toLocaleDateString('en-US', { weekday: 'short' });
        formattedDay = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      } catch {
        weekday = 'Date';
        formattedDay = dateStr;
      }
      return {
        iso: dateStr,
        weekday,
        formattedDay,
        count: dateMap[dateStr],
      };
    });
  }, [slots]);

  // Compute total slots within the 7-day calendar range
  const totalCalendarSlots = useMemo(() => {
    return sevenDayCalendar.reduce((sum, d) => sum + d.count, 0);
  }, [sevenDayCalendar]);

  // 2. Format 24-hr time to 12-hr readable format ("09:00:00" -> "9:00 AM")
  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':');
    const hour = parseInt(h, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${m} ${ampm}`;
  };

  // 3. Format ISO date to readable label: "Fri, Nov 27, 2026"
  const formatDateFull = (isoDate) => {
    if (!isoDate) return '';
    try {
      const d = new Date(isoDate + 'T00:00:00');
      return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return isoDate;
    }
  };

  // 4. Format ISO date to compact date chip label: "Nov 27"
  const formatSlotDateShort = (isoDate) => {
    if (!isoDate) return '';
    try {
      const d = new Date(isoDate + 'T00:00:00');
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return isoDate;
    }
  };

  // 5. Speciality visual configurations (soft pastels, icons and styling)
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

  // Compute doctor initials (e.g. "Dr. Anjali Reddy" -> "AR")
  const getInitials = (doctorName) => {
    if (!doctorName) return 'DR';
    return doctorName
      .replace(/^Dr\.\s*/i, '')
      .trim()
      .split(/\s+/)
      .map((part) => part[0])
      .join('')
      .toUpperCase();
  };

  // 6. Specialities list with icons and counts
  const specialityList = useMemo(() => {
    const counts = {};
    doctors.forEach((d) => {
      counts[d.speciality] = (counts[d.speciality] || 0) + 1;
    });
    const specs = Array.from(new Set(doctors.map((d) => d.speciality).filter(Boolean)));
    return specs.map((spec) => ({
      name: spec,
      count: counts[spec],
      ...getSpecialityConfig(spec),
    }));
  }, [doctors]);

  // 7. Filtered Doctors (used for dedicated page)
  const filteredDoctors = useMemo(() => {
    if (isCompact) {
      return doctors.slice(0, 3); // Overview preview: 3 doctors
    }

    return doctors.filter((doc) => {
      // Speciality filter
      if (selectedSpeciality !== 'all' && doc.speciality !== selectedSpeciality) {
        return false;
      }

      // Search filter (name or speciality)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = doc.name.toLowerCase().includes(q);
        const matchesSpec = doc.speciality.toLowerCase().includes(q);
        if (!matchesName && !matchesSpec) return false;
      }

      // Date filter (ensure doctor has slots on this date if date selected)
      if (selectedDate !== 'all') {
        const hasSlotOnDate = slots.some(
          (s) => s.doctor_id === doc.id && s.appointment_date === selectedDate
        );
        if (!hasSlotOnDate) return false;
      }

      return true;
    });
  }, [doctors, slots, selectedSpeciality, selectedDate, searchQuery, isCompact]);

  // 8. Get available slots for a doctor (respecting date filter)
  const getDoctorSlots = (doctorId, dateFilter = selectedDate) => {
    return slots.filter((s) => {
      if (s.doctor_id !== doctorId) return false;
      if (dateFilter !== 'all' && s.appointment_date !== dateFilter) return false;
      return true;
    });
  };

  const hasActiveFilters = selectedSpeciality !== 'all' || selectedDate !== 'all' || searchQuery.trim() !== '';

  const handleClearFilters = () => {
    setSelectedSpeciality('all');
    setSelectedDate('all');
    setSearchQuery('');
  };

  const handleManualRefresh = async () => {
    if (!onRefresh) return;
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  // If a doctor is selected for full schedule, display the dedicated DoctorScheduleView screen
  if (selectedDoctorForSchedule) {
    return (
      <DoctorScheduleView
        doctor={selectedDoctorForSchedule}
        slots={slots}
        onBack={() => setSelectedDoctorForSchedule(null)}
      />
    );
  }

  // =========================================================================
  // VIEW MODE A: COMPACT VIEW (For Overview Page)
  // - Clean doctor preview card container
  // - Displays top specialists with dates alongside slot times
  // - Includes "View All Doctors" button to navigate to Doctors tab
  // - Hides advanced search, speciality filters, and 7-day horizontal calendar
  // =========================================================================
  if (isCompact) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        {/* Compact Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-teal-50 border border-teal-200/80 flex items-center justify-center text-teal-600 shrink-0">
              <Stethoscope className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                  Doctors & Availability
                </h3>
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Available
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Medical specialists and real-time open appointment slots.
              </p>
            </div>
          </div>

          {/* "View All Doctors" Action Button */}
          {onViewAll && (
            <button
              onClick={onViewAll}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-50 hover:bg-teal-100/80 text-teal-700 text-xs font-semibold border border-teal-200/80 transition cursor-pointer self-start sm:self-auto group shadow-2xs"
            >
              <span>View All Doctors</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </button>
          )}
        </div>

        {/* Doctor Preview Grid (3 Columns) */}
        <div className="p-5">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-44 bg-slate-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : doctors.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              <Stethoscope className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">No doctors registered yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {doctors.slice(0, 3).map((doc) => {
                const config = getSpecialityConfig(doc.speciality);
                const Icon = config.icon;
                const initials = getInitials(doc.name);
                const doctorSlots = slots.filter((s) => s.doctor_id === doc.id);
                const previewSlots = doctorSlots.slice(0, 2);
                const remainingCount = doctorSlots.length - previewSlots.length;

                return (
                  <div
                    key={doc.id}
                    className="bg-white rounded-xl border border-slate-200/90 shadow-2xs hover:border-slate-300 hover:shadow-xs transition-all p-4 flex flex-col justify-between"
                  >
                    <div>
                      {/* Doctor Avatar + Name + Speciality */}
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-xl ${config.avatar} flex items-center justify-center font-bold text-xs shrink-0`}>
                          {initials}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-sm font-bold text-slate-900 leading-snug truncate">
                            {doc.name}
                          </h4>
                          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold mt-1 px-1.5 py-0.2 rounded ${config.badge}`}>
                            <Icon className={`w-2.5 h-2.5 ${config.accent}`} />
                            <span>{doc.speciality}</span>
                          </span>
                        </div>
                      </div>

                      {/* Available Slot Count */}
                      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                        <span className="text-slate-500 text-[11px]">Available Slots</span>
                        <span className="font-bold text-teal-700 text-xs bg-teal-50 px-2 py-0.5 rounded-md border border-teal-200">
                          {doctorSlots.length} slots
                        </span>
                      </div>

                      {/* Upcoming Slots Preview (With Dates Alongside Times) */}
                      <div className="mt-2.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                          Upcoming Slots:
                        </p>
                        {previewSlots.length === 0 ? (
                          <p className="text-xs text-slate-400 italic py-0.5">No slots open</p>
                        ) : (
                          <div className="flex flex-wrap items-center gap-1.5">
                            {previewSlots.map((slot) => (
                              <span
                                key={slot.id}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-50 border border-slate-200/80 text-[11px] text-slate-700"
                                title={`Slot #${slot.id} on ${formatDateFull(slot.appointment_date)}`}
                              >
                                <span className="font-medium text-slate-500">{formatSlotDateShort(slot.appointment_date)}</span>
                                <span className="text-slate-300 font-light">·</span>
                                <span className="font-bold text-slate-800">{formatTime(slot.appointment_time)}</span>
                              </span>
                            ))}
                            {remainingCount > 0 && (
                              <span className="text-[10px] font-semibold text-slate-500">
                                +{remainingCount} more
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Button */}
                    <div className="mt-3.5 pt-2.5 border-t border-slate-100">
                      <button
                        onClick={() => setSelectedDoctorForSchedule(doc)}
                        className="w-full py-1.5 px-3 rounded-lg bg-slate-50 hover:bg-teal-50 hover:text-teal-700 border border-slate-200 text-slate-700 font-semibold text-xs flex items-center justify-center gap-1 transition cursor-pointer"
                      >
                        <span>View Schedule</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Compact Footer */}
        {doctors.length > 3 && (
          <div className="px-5 py-3 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>
              Showing preview of <strong className="text-slate-800">3</strong> of{' '}
              <strong className="text-slate-800">{doctors.length}</strong> total specialists
            </span>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // VIEW MODE B: FULL DEDICATED DOCTORS PAGE
  // - Separated into 4 independent sections with consistent spacing:
  //     1. Independent Page Header Section
  //     2. Independent Search & Speciality Filter Toolbar
  //     3. Independent 7-Day Horizontal Calendar Date Selector Card
  //     4. Independent Doctor Cards Grid (with dates alongside slot times)
  // =========================================================================
  return (
    <div className="space-y-6">

      {/* =================================================================== */}
      {/* TOOLBAR: SEPARATED FILTER BAR (LEFT) & SEARCH BAR (RIGHT)           */}
      {/* =================================================================== */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        
        {/* Left: Unified Segmented Filter Bar Pill */}
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs flex flex-wrap items-center divide-x divide-slate-100 overflow-hidden">
          {/* Funnel Icon */}
          <div className="px-3.5 py-2.5 flex items-center justify-center text-slate-500">
            <Filter className="w-4 h-4 text-slate-600" />
          </div>

          {/* Speciality Dropdown */}
          <div className="relative flex items-center">
            <select
              value={selectedSpeciality}
              onChange={(e) => setSelectedSpeciality(e.target.value)}
              className="text-xs font-semibold text-slate-700 bg-transparent py-2.5 pl-3.5 pr-7 focus:outline-hidden cursor-pointer appearance-none"
            >
              <option value="all">Speciality: All ({doctors.length})</option>
              {specialityList.map((spec) => (
                <option key={spec.name} value={spec.name}>
                  {spec.name} ({spec.count})
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 pointer-events-none" />
          </div>

          {/* Date Dropdown */}
          <div className="relative flex items-center">
            <select
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="text-xs font-semibold text-slate-700 bg-transparent py-2.5 pl-3.5 pr-7 focus:outline-hidden cursor-pointer appearance-none"
            >
              <option value="all">Date: All ({totalCalendarSlots} slots)</option>
              {sevenDayCalendar.map((d) => (
                <option key={d.iso} value={d.iso}>
                  {d.weekday}, {d.formattedDay} ({d.count} slots)
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 pointer-events-none" />
          </div>

          {/* Reset Filter Button (Orange/Coral like appointment page filter) */}
          {hasActiveFilters ? (
            <button
              onClick={handleClearFilters}
              className="px-3.5 py-2.5 flex items-center gap-1.5 text-xs font-semibold text-orange-600 hover:text-orange-700 hover:bg-orange-50/50 transition cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-orange-500" />
              <span>Reset Filter</span>
            </button>
          ) : (
            <div className="px-3.5 py-2.5 flex items-center gap-1.5 text-xs font-medium text-slate-400 select-none">
              <RotateCcw className="w-3.5 h-3.5 text-slate-300" />
              <span>Reset Filter</span>
            </div>
          )}
        </div>

        {/* Right: Standalone Search Bar Pill & Refresh */}
        <div className="flex items-center gap-2.5 w-full lg:w-auto justify-end">
          <div className="relative bg-white rounded-xl border border-slate-200/90 shadow-2xs flex items-center px-3.5 py-2 w-full sm:w-72 md:w-80">
            <input
              type="text"
              placeholder="Search doctor or speciality..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-xs w-full pr-7 focus:outline-hidden text-slate-800 placeholder-slate-400"
            />
            {searchQuery ? (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            )}
          </div>

          {onRefresh && (
            <button
              onClick={handleManualRefresh}
              disabled={isLoading || isRefreshing}
              className="p-2.5 rounded-xl bg-white border border-slate-200/90 shadow-2xs hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition cursor-pointer disabled:opacity-50 shrink-0"
              title="Refresh availability from backend"
              aria-label="Refresh availability"
            >
              <RotateCcw className={`w-4 h-4 ${isRefreshing || isLoading ? 'animate-spin text-teal-600' : ''}`} />
            </button>
          )}
        </div>

      </div>

      {/* =================================================================== */}
      {/* SECTION 3: INDEPENDENT 7-DAY HORIZONTAL CALENDAR CARD               */}
      {/* =================================================================== */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-4 sm:p-5 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-800 flex items-center gap-1.5">
            <CalendarDays className="w-4 h-4 text-teal-600" />
            <span>Select Appointment Date</span>
          </span>
          <span className="text-[11px] text-slate-400">
            {selectedDate === 'all' 
              ? 'Showing all upcoming appointment slots' 
              : `Filtered by ${formatDateFull(selectedDate)}`}
          </span>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {/* All Dates Button */}
          <button
            onClick={() => setSelectedDate('all')}
            className={`shrink-0 px-3.5 py-2.5 rounded-xl text-left border transition-all cursor-pointer ${
              selectedDate === 'all'
                ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider opacity-90 leading-tight">
              All Dates
            </p>
            <p className="text-xs font-bold leading-tight mt-0.5">
              {sevenDayCalendar.length} Days ({totalCalendarSlots})
            </p>
          </button>

          {/* Day Cards */}
          {sevenDayCalendar.map((d) => {
            const isSelected = selectedDate === d.iso;
            return (
              <button
                key={d.iso}
                onClick={() => setSelectedDate(d.iso)}
                className={`shrink-0 min-w-[84px] px-3 py-2.5 rounded-xl text-center border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <p className={`text-[11px] font-semibold uppercase tracking-wide leading-tight ${isSelected ? 'text-teal-100' : 'text-slate-500'}`}>
                  {d.weekday}
                </p>
                <p className="text-xs font-bold leading-tight mt-0.5">
                  {d.formattedDay}
                </p>
                <span className={`inline-block text-[10px] font-medium px-1.5 py-0.2 rounded mt-1 ${
                  isSelected ? 'bg-teal-700/80 text-white' : 'bg-slate-100 text-slate-600'
                }`}>
                  {d.count} slots
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* =================================================================== */}
      {/* SECTION 4: INDEPENDENT DOCTOR CARDS GRID                            */}
      {/* =================================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredDoctors.length === 0 ? (
          <div className="col-span-full py-16 text-center text-slate-400 bg-white rounded-2xl border border-dashed border-slate-200 p-8 shadow-2xs">
            <Stethoscope className="w-10 h-10 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700">No doctors match your criteria</p>
            <p className="text-xs text-slate-400 mt-1">Try clearing filters or changing the selected date.</p>
            <button
              onClick={handleClearFilters}
              className="mt-3.5 px-4 py-2 rounded-xl bg-teal-600 text-white text-xs font-medium cursor-pointer hover:bg-teal-700 transition"
            >
              Show all doctors
            </button>
          </div>
        ) : (
          filteredDoctors.map((doc) => {
            const config = getSpecialityConfig(doc.speciality);
            const Icon = config.icon;
            const initials = getInitials(doc.name);
            const doctorSlots = getDoctorSlots(doc.id, selectedDate);
            const totalAvailableCount = slots.filter((s) => s.doctor_id === doc.id).length;
            const previewSlots = doctorSlots.slice(0, 3);
            const remainingCount = doctorSlots.length - previewSlots.length;

            return (
              <div
                key={doc.id}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs hover:border-slate-300 hover:shadow-md transition-all duration-200 p-5 flex flex-col justify-between h-full"
              >
                <div>
                  {/* Top: Pastel Initials Avatar + Full Doctor Name + Speciality */}
                  <div className="flex items-start gap-3.5">
                    {/* Pastel Initials Avatar */}
                    <div className={`w-12 h-12 rounded-2xl ${config.avatar} flex items-center justify-center font-bold text-sm shrink-0 shadow-xs`}>
                      {initials}
                    </div>

                    <div className="min-w-0 flex-1">
                      {/* Doctor Full Name (Never truncated) */}
                      <h4 className="text-base font-bold text-slate-900 leading-snug break-words">
                        {doc.name}
                      </h4>

                      {/* Speciality Badge with Icon */}
                      <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                        <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md ${config.badge}`}>
                          <Icon className={`w-3 h-3 ${config.accent}`} />
                          <span>{doc.speciality}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Availability Badge */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-medium">Available Slots</span>
                    <span className="font-bold text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-200 text-xs">
                      {selectedDate === 'all' 
                        ? `${totalAvailableCount} slots` 
                        : `${doctorSlots.length} on this date`}
                    </span>
                  </div>

                  {/* Upcoming Time Chips Preview (WITH DATES ALONGSIDE TIMES) */}
                  <div className="mt-3">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                      {selectedDate === 'all' ? 'Upcoming Slots' : 'Slots for selected date'}:
                    </p>

                    {previewSlots.length === 0 ? (
                      <p className="text-xs text-slate-400 italic py-1">
                        No slots open for selected date
                      </p>
                    ) : (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {previewSlots.map((slot) => (
                          <span
                            key={slot.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200/80 text-xs text-slate-700"
                            title={`Slot #${slot.id} on ${formatDateFull(slot.appointment_date)}`}
                          >
                            <Clock className="w-3 h-3 text-teal-600 shrink-0" />
                            <span className="text-[11px] font-medium text-slate-500">{formatSlotDateShort(slot.appointment_date)}</span>
                            <span className="text-slate-300 font-light">·</span>
                            <span className="font-bold text-slate-800">{formatTime(slot.appointment_time)}</span>
                          </span>
                        ))}

                        {remainingCount > 0 && (
                          <span className="text-[11px] font-semibold text-slate-500 px-1 py-0.5">
                            +{remainingCount} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* View Full Schedule Action Button -> Navigates to dedicated DoctorScheduleView screen */}
                <div className="mt-5 pt-3 border-t border-slate-100">
                  <button
                    onClick={() => setSelectedDoctorForSchedule(doc)}
                    className="w-full py-2.5 px-4 rounded-xl bg-slate-50 hover:bg-teal-600 hover:text-white border border-slate-200 text-slate-700 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer group shadow-2xs"
                  >
                    <span>View Full Schedule</span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-white group-hover:translate-x-0.5 transition" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

    </div>
  );
}
