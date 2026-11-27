import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  CalendarCheck, 
  CheckCircle2, 
  XCircle, 
  ShieldCheck, 
  Search, 
  Calendar, 
  Clock, 
  X, 
  ArrowUpDown, 
  ArrowUp, 
  ArrowDown, 
  ChevronLeft, 
  ChevronRight, 
  ArrowRight,
  Heart, 
  Sparkles, 
  Baby, 
  Activity, 
  CalendarDays,
  Stethoscope,
  Filter,
  RotateCcw,
  ChevronDown
} from 'lucide-react';

/**
 * AppointmentsTable (Appointment Management)
 * Premium Healthcare SaaS Data Management Interface.
 *
 * Supported Modes:
 * - isCompact={false} (Dedicated Appointments page):
 *     1. Independent KPI cards container (Total, Booked, Cancelled, Today's)
 *     2. Independent Search & Filters container (Search bar, refresh, status pills, doctor/speciality/date select, reset)
 *     3. Independent Data Table container (Sortable sticky headers, full records, pagination 10/25/50)
 * - isCompact={true} (Overview page):
 *     1. Displays only the 5 most recent appointments in a compact table container
 *     2. Prominent "View All Appointments" button that routes to the dedicated Appointments tab
 *     3. Hides appointment-specific KPIs, search, filters, and pagination
 * - Both modes share:
 *     - Real-time newly added/updated highlight animation
 *     - Strict phone number masking (987****210)
 *     - Zero duplicate API calls (relying on parent data props)
 *     - Voice-only booking and cancellation operations
 */
export default function AppointmentsTable({ 
  appointments = [], 
  onRefresh, 
  isLoading = false,
  isCompact = false,
  onViewAll
}) {
  // Filter state (active only when isCompact === false)
  const [statusFilter, setStatusFilter] = useState('all');
  const [doctorFilter, setDoctorFilter] = useState('all');
  const [specialityFilter, setSpecialityFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Sorting state (for dedicated view)
  const [sortField, setSortField] = useState('created_at');
  const [sortDirection, setSortDirection] = useState('desc'); // 'asc' | 'desc'

  // Pagination state (for dedicated view)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Live timestamp & refresh animation state
  const [lastUpdated, setLastUpdated] = useState('Just now');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Track newly added/updated appointment IDs for brief soft highlight
  const [highlightedId, setHighlightedId] = useState(null);
  const prevCountRef = useRef(appointments.length);

  // Update "Last Updated" timestamp and detect newly added appointments
  useEffect(() => {
    const now = new Date();
    setLastUpdated(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

    if (appointments.length > prevCountRef.current && appointments.length > 0) {
      const newest = appointments[appointments.length - 1];
      const newId = newest.appointment_id || newest.id;
      setHighlightedId(newId);
      const timer = setTimeout(() => setHighlightedId(null), 3500);
      return () => clearTimeout(timer);
    }
    prevCountRef.current = appointments.length;
  }, [appointments]);

  // Format appointment ID to APT-0001
  const formatAppointmentId = (id) => {
    if (!id && id !== 0) return 'APT-0000';
    const num = parseInt(String(id).replace(/\D/g, ''), 10);
    return isNaN(num) ? `APT-${id}` : `APT-${String(num).padStart(4, '0')}`;
  };

  // Format 24-hr time into readable 12-hr time
  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    const [h, m] = timeStr.split(':');
    const hour = parseInt(h, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    return `${hour12}:${m} ${ampm}`;
  };

  // Format ISO date into readable format: "Nov 27, 2026"
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const [year, month, day] = dateStr.split('-');
      const d = new Date(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10));
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  // Format creation timestamp
  const formatCreatedTimestamp = (timestamp) => {
    if (!timestamp) return 'Recent';
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) return timestamp;
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Recent';
    }
  };

  // Mask only middle 4 numbers with star symbol (e.g., "987****3210" or "+91 98****3210")
  const maskPhone = (phone) => {
    if (!phone) return '****';
    const str = String(phone).trim();
    // If already masked with stars from backend API, return as is
    if (str.includes('*')) {
      return str;
    }

    const digits = str.replace(/\D/g, '');
    if (digits.length === 10) {
      // 10-digit number: first 3, middle 4 masked with ****, last 3
      return `${digits.slice(0, 3)}****${digits.slice(7)}`;
    } else if (digits.length === 12 && digits.startsWith('91')) {
      // +91 followed by 10 digits
      const main10 = digits.slice(2);
      return `+91 ${main10.slice(0, 3)}****${main10.slice(7)}`;
    } else if (digits.length > 4) {
      // Mask 4 digits in the middle
      const maskLen = 4;
      const start = Math.floor((digits.length - maskLen) / 2);
      const prefix = digits.slice(0, start);
      const suffix = digits.slice(start + maskLen);
      return `${prefix}****${suffix}`;
    }
    return str || '****';
  };

  // Extract initials from doctor name
  const getInitials = (name) => {
    if (!name) return 'DR';
    return name
      .replace(/^Dr\.\s*/i, '')
      .split(' ')
      .filter(Boolean)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'DR';
  };

  // Pastel speciality colors & icons configuration
  const getSpecialityConfig = (speciality) => {
    const s = (speciality || '').toLowerCase();
    if (s.includes('cardio')) {
      return {
        avatar: 'bg-rose-50 text-rose-700 border border-rose-200/80',
        badge: 'bg-rose-50 text-rose-700 border border-rose-200/80',
        accent: 'text-rose-600',
        icon: Heart,
      };
    }
    if (s.includes('derma')) {
      return {
        avatar: 'bg-amber-50 text-amber-700 border border-amber-200/80',
        badge: 'bg-amber-50 text-amber-700 border border-amber-200/80',
        accent: 'text-amber-600',
        icon: Sparkles,
      };
    }
    if (s.includes('pediat')) {
      return {
        avatar: 'bg-purple-50 text-purple-700 border border-purple-200/80',
        badge: 'bg-purple-50 text-purple-700 border border-purple-200/80',
        accent: 'text-purple-600',
        icon: Baby,
      };
    }
    if (s.includes('ortho')) {
      return {
        avatar: 'bg-blue-50 text-blue-700 border border-blue-200/80',
        badge: 'bg-blue-50 text-blue-700 border border-blue-200/80',
        accent: 'text-blue-600',
        icon: Activity,
      };
    }
    return {
      avatar: 'bg-teal-50 text-teal-800 border border-teal-200/80',
      badge: 'bg-teal-50 text-teal-800 border border-teal-200/80',
      accent: 'text-teal-600',
      icon: Stethoscope,
    };
  };

  // Unique options for filters
  const uniqueDoctors = useMemo(() => {
    const set = new Set();
    appointments.forEach((a) => {
      const doc = a.doctor || a.doctor_name;
      if (doc) set.add(doc);
    });
    return Array.from(set).sort();
  }, [appointments]);

  const uniqueSpecialities = useMemo(() => {
    const set = new Set();
    appointments.forEach((a) => {
      if (a.speciality) set.add(a.speciality);
    });
    return Array.from(set).sort();
  }, [appointments]);

  const uniqueDates = useMemo(() => {
    const set = new Set();
    appointments.forEach((a) => {
      const d = a.date || a.appointment_date;
      if (d) set.add(d);
    });
    return Array.from(set).sort();
  }, [appointments]);

  // Today's date string (YYYY-MM-DD)
  const todayStr = useMemo(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  // Summary counts for KPIs (used on dedicated Appointments page)
  const totalCount = appointments.length;
  const bookedCount = useMemo(() => appointments.filter((a) => a.status === 'booked').length, [appointments]);
  const cancelledCount = useMemo(() => appointments.filter((a) => a.status === 'cancelled').length, [appointments]);
  const todayCount = useMemo(() => {
    return appointments.filter((a) => {
      const d = a.date || a.appointment_date;
      return d === todayStr && a.status !== 'cancelled';
    }).length;
  }, [appointments, todayStr]);

  // Five most recent appointments for Overview compact mode
  const recentAppointments = useMemo(() => {
    const list = [...appointments];
    list.sort((a, b) => {
      const aVal = a.created_at || a.appointment_id || a.id || 0;
      const bVal = b.created_at || b.appointment_id || b.id || 0;
      return bVal > aVal ? 1 : bVal < aVal ? -1 : 0;
    });
    return list.slice(0, 5);
  }, [appointments]);

  // Filtered & Searched appointments for full dedicated page
  const filteredAppointments = useMemo(() => {
    if (isCompact) return recentAppointments;

    return appointments.filter((appt) => {
      // Status filter
      if (statusFilter !== 'all' && appt.status !== statusFilter) return false;

      // Doctor filter
      if (doctorFilter !== 'all') {
        const docName = appt.doctor || appt.doctor_name;
        if (docName !== doctorFilter) return false;
      }

      // Speciality filter
      if (specialityFilter !== 'all' && appt.speciality !== specialityFilter) return false;

      // Date filter
      if (dateFilter !== 'all') {
        const d = appt.date || appt.appointment_date;
        if (d !== dateFilter) return false;
      }

      // Search query (matches formatted ID, raw ID, doctor name, speciality, masked phone)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const rawId = String(appt.appointment_id || appt.id || '');
        const formattedId = formatAppointmentId(rawId).toLowerCase();
        const docName = (appt.doctor || appt.doctor_name || '').toLowerCase();
        const spec = (appt.speciality || '').toLowerCase();
        const phone = (appt.phone_number || '').toLowerCase();

        if (
          !rawId.includes(q) &&
          !formattedId.includes(q) &&
          !docName.includes(q) &&
          !spec.includes(q) &&
          !phone.includes(q)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [appointments, isCompact, recentAppointments, statusFilter, doctorFilter, specialityFilter, dateFilter, searchQuery]);

  // Sorted appointments for full dedicated page
  const sortedAppointments = useMemo(() => {
    if (isCompact) return recentAppointments;

    const list = [...filteredAppointments];
    list.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      // Handle field aliases
      if (sortField === 'id') {
        aVal = a.appointment_id || a.id || 0;
        bVal = b.appointment_id || b.id || 0;
      } else if (sortField === 'doctor') {
        aVal = a.doctor || a.doctor_name || '';
        bVal = b.doctor || b.doctor_name || '';
      } else if (sortField === 'date') {
        aVal = (a.date || a.appointment_date || '') + ' ' + (a.time || a.appointment_time || '');
        bVal = (b.date || b.appointment_date || '') + ' ' + (b.time || b.appointment_time || '');
      } else if (sortField === 'created_at') {
        aVal = a.created_at || a.appointment_id || a.id || 0;
        bVal = b.created_at || b.appointment_id || b.id || 0;
      }

      if (typeof aVal === 'string') {
        return sortDirection === 'asc' 
          ? aVal.localeCompare(bVal) 
          : bVal.localeCompare(aVal);
      }
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    });
    return list;
  }, [filteredAppointments, isCompact, recentAppointments, sortField, sortDirection]);

  // Paginated records (for full dedicated page)
  const totalPages = Math.ceil(sortedAppointments.length / pageSize) || 1;
  const paginatedAppointments = useMemo(() => {
    if (isCompact) return recentAppointments;
    const start = (currentPage - 1) * pageSize;
    return sortedAppointments.slice(start, start + pageSize);
  }, [sortedAppointments, isCompact, recentAppointments, currentPage, pageSize]);

  // Reset page when filters change
  useEffect(() => {
    if (!isCompact) {
      setCurrentPage(1);
    }
  }, [statusFilter, doctorFilter, specialityFilter, dateFilter, searchQuery, pageSize, isCompact]);

  // Toggle column sort
  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Trigger manual refresh
  const handleRefresh = async () => {
    if (!onRefresh) return;
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  const hasActiveFilters = 
    statusFilter !== 'all' || 
    dateFilter !== 'all' || 
    searchQuery.trim() !== '';

  const handleClearFilters = () => {
    setStatusFilter('all');
    setDateFilter('all');
    setSearchQuery('');
  };

  // =========================================================================
  // VIEW MODE A: COMPACT VIEW (For Overview Page)
  // - Displays only the 5 most recent appointments
  // - Includes "View All Appointments" button to navigate to Appointments page
  // - Hides appointment-specific KPIs, search, filters, and pagination
  // =========================================================================
  if (isCompact) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        {/* Compact Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-teal-50 border border-teal-200/80 flex items-center justify-center text-teal-600 shrink-0">
              <CalendarCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 tracking-tight">
                  Recent Appointments
                </h3>
                <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Synced
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Latest 5 patient appointments and voice assistant bookings.
              </p>
            </div>
          </div>

          {/* "View All Appointments" Action Button */}
          {onViewAll && (
            <button
              onClick={onViewAll}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-teal-50 hover:bg-teal-100/80 text-teal-700 text-xs font-semibold border border-teal-200/80 transition cursor-pointer self-start sm:self-auto group shadow-2xs"
            >
              <span>View All Appointments</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </button>
          )}
        </div>

        {/* Compact Table */}
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-5 space-y-2.5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-9 bg-slate-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : recentAppointments.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs px-4">
              <Calendar className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">No appointments recorded yet</p>
              <p className="text-xs text-slate-400 mt-1">
                Appointments booked via voice assistant will appear here automatically.
              </p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/90 border-b border-slate-200/80 text-slate-500 uppercase tracking-wider font-semibold text-[10px]">
                  <th className="py-2.5 px-4 w-[16%]">Appt ID</th>
                  <th className="py-2.5 px-4 w-[30%]">Doctor & Speciality</th>
                  <th className="py-2.5 px-4 w-[24%]">Schedule</th>
                  <th className="py-2.5 px-4 w-[18%]">Patient Contact</th>
                  <th className="py-2.5 px-4 w-[12%] text-right sm:text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {recentAppointments.map((appt) => {
                  const isBooked = appt.status === 'booked';
                  const rawId = appt.appointment_id || appt.id;
                  const formattedId = formatAppointmentId(rawId);
                  const doctorName = appt.doctor || appt.doctor_name || 'Dr. Specialist';
                  const speciality = appt.speciality || 'General Medicine';
                  const dateStr = appt.date || appt.appointment_date;
                  const timeStr = appt.time || appt.appointment_time;
                  const config = getSpecialityConfig(speciality);
                  const initials = getInitials(doctorName);
                  const isHighlighted = highlightedId === rawId;

                  return (
                    <tr
                      key={rawId || Math.random()}
                      className={`transition-colors duration-200 ${
                        isHighlighted ? 'bg-teal-50/80' : 'hover:bg-slate-50/70'
                      }`}
                    >
                      {/* Formatted ID */}
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 border border-slate-200/80 text-[11px]">
                          {formattedId}
                        </span>
                      </td>

                      {/* Doctor with Pastel Initials Avatar */}
                      <td className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-6.5 h-6.5 rounded-lg ${config.avatar} flex items-center justify-center font-bold text-[10px] shrink-0`}>
                            {initials}
                          </div>
                          <div>
                            <span className="font-semibold text-slate-900">{doctorName}</span>
                            <span className={`ml-2 inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-medium ${config.badge}`}>
                              {speciality}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Date & Time */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-semibold text-slate-900 text-[11px]">
                          {formatDate(dateStr)}
                        </div>
                        <div className="text-[10px] text-teal-700 font-semibold flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5 text-teal-600" />
                          <span>{formatTime(timeStr)}</span>
                        </div>
                      </td>

                      {/* Masked Contact */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 font-mono text-[11px] text-slate-700 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200">
                          <ShieldCheck className="w-3 h-3 text-emerald-600" />
                          <span>{maskPhone(appt.phone_number)}</span>
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-4 whitespace-nowrap text-right sm:text-left">
                        {isBooked ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <span>Booked</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                            <span>Cancelled</span>
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Compact Footer Bar */}
        {recentAppointments.length > 0 && (
          <div className="px-5 py-3 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>
              Showing latest <strong className="text-slate-800">{recentAppointments.length}</strong> of{' '}
              <strong className="text-slate-800">{appointments.length}</strong> total records
            </span>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // VIEW MODE B: FULL DEDICATED APPOINTMENTS PAGE
  // - Separated into 3 independent containers with consistent spacing:
  //     1. Independent KPI Cards Grid
  //     2. Independent Search & Filter Toolbar Card
  //     3. Independent Data Table Card with Sticky Headers & Pagination
  // =========================================================================
  return (
    <div className="space-y-6">

      {/* =================================================================== */}
      {/* CONTAINER 1: INDEPENDENT KPI SUMMARY CARDS GRID                     */}
      {/* =================================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total Records Card */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-4 sm:p-5 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Total Appointments
            </span>
            <p className="text-2xl font-bold text-slate-900 mt-1">{totalCount}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Lifetime appointments</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 flex items-center justify-center shrink-0">
            <CalendarCheck className="w-5 h-5" />
          </div>
        </div>

        {/* Confirmed Booked Card */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-4 sm:p-5 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">
              Confirmed Booked
            </span>
            <p className="text-2xl font-bold text-emerald-950 mt-1">{bookedCount}</p>
            <p className="text-[11px] text-emerald-600/90 mt-0.5">Active reservations</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        {/* Cancelled Bookings Card */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-4 sm:p-5 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-rose-700">
              Cancelled Bookings
            </span>
            <p className="text-2xl font-bold text-rose-950 mt-1">{cancelledCount}</p>
            <p className="text-[11px] text-rose-600/90 mt-0.5">Patient phone verification</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0">
            <XCircle className="w-5 h-5" />
          </div>
        </div>

        {/* Today's Consults Card */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs p-4 sm:p-5 flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-teal-700">
              Today's Appointments
            </span>
            <p className="text-2xl font-bold text-teal-950 mt-1">{todayCount}</p>
            <p className="text-[11px] text-teal-600/90 mt-0.5">Scheduled for today</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-200 text-teal-600 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
        </div>

      </div>

      {/* =================================================================== */}
      {/* CONTAINER 2: SEPARATED FILTER BAR (LEFT) & SEARCH BAR (RIGHT)       */}
      {/* =================================================================== */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        
        {/* Left: Unified Segmented Filter Bar Pill */}
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-2xs flex flex-wrap items-center divide-x divide-slate-100 overflow-hidden">
          {/* Funnel Icon */}
          <div className="px-3.5 py-2.5 flex items-center justify-center text-slate-500">
            <Filter className="w-4 h-4 text-slate-600" />
          </div>

          {/* Status Dropdown */}
          <div className="relative flex items-center">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs font-semibold text-slate-700 bg-transparent py-2.5 pl-3.5 pr-7 focus:outline-hidden cursor-pointer appearance-none"
            >
              <option value="all">Status: All</option>
              <option value="booked">Booked</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 pointer-events-none" />
          </div>

          {/* Date Dropdown */}
          <div className="relative flex items-center">
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="text-xs font-semibold text-slate-700 bg-transparent py-2.5 pl-3.5 pr-7 focus:outline-hidden cursor-pointer appearance-none"
            >
              <option value="all">Date: All</option>
              {uniqueDates.map((d) => (
                <option key={d} value={d}>{formatDate(d)}</option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 pointer-events-none" />
          </div>

          {/* Reset Filter Button (Orange/Coral like reference screenshot) */}
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

        {/* Right: Standalone Search Bar Pill */}
        <div className="flex items-center w-full lg:w-auto justify-end">
          <div className="relative bg-white rounded-xl border border-slate-200/90 shadow-2xs flex items-center px-3.5 py-2 w-full sm:w-72 md:w-80">
            <input
              type="text"
              placeholder="Search ...."
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
        </div>

      </div>

      {/* =================================================================== */}
      {/* CONTAINER 3: INDEPENDENT DATA TABLE & PAGINATION CONTAINER         */}
      {/* =================================================================== */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
        
        {/* Table Container Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-teal-50 border border-teal-200/80 flex items-center justify-center text-teal-600">
              <CalendarCheck className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                Appointment Registry
              </h3>
            </div>
          </div>
          <span className="text-xs text-slate-500">
            Showing <strong className="text-slate-800">{paginatedAppointments.length}</strong> of{' '}
            <strong className="text-slate-800">{filteredAppointments.length}</strong> filtered
          </span>
        </div>

        {/* Table Shell with Clean Overflow Control */}
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-10 bg-slate-100 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : paginatedAppointments.length === 0 ? (
            <div className="text-center py-16 text-slate-400 text-xs px-4">
              <Calendar className="w-9 h-9 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">No appointment records found</p>
              <p className="text-xs text-slate-400 mt-1">
                {hasActiveFilters 
                  ? 'No records match your active search and filter criteria.' 
                  : 'Appointments booked through the voice assistant will appear here.'}
              </p>
              {hasActiveFilters && (
                <button
                  onClick={handleClearFilters}
                  className="mt-3 px-3.5 py-1.5 rounded-lg bg-teal-600 text-white text-xs font-medium cursor-pointer"
                >
                  Clear all filters
                </button>
              )}
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50/90 border-b border-slate-200">
                <tr className="text-slate-500 uppercase tracking-wider font-semibold text-[10px]">
                  
                  {/* Sortable ID Column */}
                  <th 
                    onClick={() => handleSort('id')}
                    className="py-2.5 px-4 cursor-pointer hover:text-slate-800 transition select-none w-[12%]"
                  >
                    <div className="flex items-center gap-1">
                      <span>Appt ID</span>
                      {sortField === 'id' ? (
                        sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-teal-600" /> : <ArrowDown className="w-3 h-3 text-teal-600" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-40" />
                      )}
                    </div>
                  </th>

                  {/* Sortable Doctor Column */}
                  <th 
                    onClick={() => handleSort('doctor')}
                    className="py-2.5 px-4 cursor-pointer hover:text-slate-800 transition select-none w-[20%]"
                  >
                    <div className="flex items-center gap-1">
                      <span>Doctor</span>
                      {sortField === 'doctor' ? (
                        sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-teal-600" /> : <ArrowDown className="w-3 h-3 text-teal-600" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-40" />
                      )}
                    </div>
                  </th>

                  {/* Speciality Column */}
                  <th className="py-2.5 px-4 w-[15%]">Speciality</th>

                  {/* Sortable Date & Time Column */}
                  <th 
                    onClick={() => handleSort('date')}
                    className="py-2.5 px-4 cursor-pointer hover:text-slate-800 transition select-none w-[19%]"
                  >
                    <div className="flex items-center gap-1">
                      <span>Appointment Schedule</span>
                      {sortField === 'date' ? (
                        sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-teal-600" /> : <ArrowDown className="w-3 h-3 text-teal-600" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-40" />
                      )}
                    </div>
                  </th>

                  {/* Patient Phone Column */}
                  <th className="py-2.5 px-4 w-[15%]">Patient Contact</th>

                  {/* Status Column */}
                  <th className="py-2.5 px-4 w-[10%]">Booking Status</th>

                  {/* Sortable Created At Column */}
                  <th 
                    onClick={() => handleSort('created_at')}
                    className="py-2.5 px-4 cursor-pointer hover:text-slate-800 transition select-none w-[9%]"
                  >
                    <div className="flex items-center gap-1">
                      <span>Booked At</span>
                      {sortField === 'created_at' ? (
                        sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 text-teal-600" /> : <ArrowDown className="w-3 h-3 text-teal-600" />
                      ) : (
                        <ArrowUpDown className="w-3 h-3 opacity-40" />
                      )}
                    </div>
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100 text-slate-700 bg-white">
                {paginatedAppointments.map((appt) => {
                  const isBooked = appt.status === 'booked';
                  const rawId = appt.appointment_id || appt.id;
                  const formattedId = formatAppointmentId(rawId);
                  const doctorName = appt.doctor || appt.doctor_name || 'Dr. Specialist';
                  const speciality = appt.speciality || 'General Medicine';
                  const dateStr = appt.date || appt.appointment_date;
                  const timeStr = appt.time || appt.appointment_time;
                  const config = getSpecialityConfig(speciality);
                  const initials = getInitials(doctorName);
                  const isHighlighted = highlightedId === rawId;

                  return (
                    <tr
                      key={rawId || Math.random()}
                      className={`transition-colors duration-200 ${
                        isHighlighted ? 'bg-teal-50/80' : 'hover:bg-slate-50/80'
                      }`}
                    >
                      {/* Formatted Appointment ID */}
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-800 border border-slate-200/80">
                          {formattedId}
                        </span>
                      </td>

                      {/* Doctor with Pastel Initials Avatar */}
                      <td className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-7 h-7 rounded-lg ${config.avatar} flex items-center justify-center font-bold text-[10px] shrink-0 shadow-2xs`}>
                            {initials}
                          </div>
                          <span className="font-semibold">{doctorName}</span>
                        </div>
                      </td>

                      {/* Speciality Badge with Icon */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold ${config.badge}`}>
                          <config.icon className={`w-3 h-3 ${config.accent}`} />
                          <span>{speciality}</span>
                        </span>
                      </td>

                      {/* Date & Time Chips */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="font-bold text-slate-900">
                          {formatDate(dateStr)}
                        </div>
                        <div className="text-[11px] text-teal-700 font-semibold flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3 text-teal-600" />
                          <span>{formatTime(timeStr)}</span>
                        </div>
                      </td>

                      {/* Masked Patient Phone */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-slate-700 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                          <ShieldCheck className="w-3 h-3 text-emerald-600" />
                          <span>{maskPhone(appt.phone_number)}</span>
                        </span>
                      </td>

                      {/* Booking Status Badge */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {isBooked ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <span>Booked</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                            <span>Cancelled</span>
                          </span>
                        )}
                      </td>

                      {/* Created / Booked Timestamp */}
                      <td className="py-3 px-4 text-slate-500 text-[11px] whitespace-nowrap font-mono">
                        {formatCreatedTimestamp(appt.created_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Dedicated Pagination Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 border-t border-slate-100 bg-slate-50/50 text-xs text-slate-500">
          <div className="flex items-center gap-3">
            <span>
              Showing{' '}
              <strong className="text-slate-900">
                {filteredAppointments.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}
              </strong>{' '}
              to{' '}
              <strong className="text-slate-900">
                {Math.min(currentPage * pageSize, filteredAppointments.length)}
              </strong>{' '}
              of <strong className="text-slate-900">{filteredAppointments.length}</strong> records
            </span>

            {/* Page size select */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px]">Rows per page:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="text-xs px-2 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 focus:outline-hidden cursor-pointer"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>

          {/* Page navigation buttons */}
          <div className="flex items-center gap-1.5 self-end sm:self-auto">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="px-2.5 py-1 text-xs font-semibold text-slate-800">
              Page {currentPage} of {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
              aria-label="Next page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>

    </div>
  );
}
