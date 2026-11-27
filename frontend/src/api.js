/**
 * REST API client for Voice AI Doctor Appointment Assistant.
 *
 * Connects to the FastAPI backend running at VITE_API_BASE_URL (default: http://localhost:8000).
 * Handles:
 * - Health check
 * - Doctors list
 * - Available slots (with optional doctor and date filters)
 * - Appointments list (with optional status filter)
 */

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

/**
 * Fetch backend health status.
 */
export async function fetchHealth() {
  const res = await fetch(`${API_BASE_URL}/api/health`);
  if (!res.ok) {
    throw new Error(`Health check failed with HTTP ${res.status}`);
  }
  return res.json();
}

/**
 * Fetch list of all doctors.
 */
export async function fetchDoctors() {
  const res = await fetch(`${API_BASE_URL}/api/doctors`);
  if (!res.ok) {
    throw new Error(`Failed to fetch doctors (HTTP ${res.status})`);
  }
  const data = await res.json();
  return data.doctors || [];
}

/**
 * Fetch available appointment slots.
 * @param {number|null} doctorId - Optional doctor filter
 * @param {string|null} date - Optional ISO date filter (YYYY-MM-DD)
 */
export async function fetchSlots(doctorId = null, date = null) {
  const params = new URLSearchParams();
  if (doctorId) params.append('doctor_id', doctorId);
  if (date) params.append('date', date);

  const url = `${API_BASE_URL}/api/slots${params.toString() ? '?' + params.toString() : ''}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch slots (HTTP ${res.status})`);
  }
  const data = await res.json();
  return data.slots || [];
}

/**
 * Fetch all appointments (phone numbers masked by backend).
 * @param {string|null} status - Optional filter: 'booked' or 'cancelled'
 */
export async function fetchAppointments(status = null) {
  const params = new URLSearchParams();
  if (status) params.append('status', status);

  const url = `${API_BASE_URL}/api/appointments${params.toString() ? '?' + params.toString() : ''}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch appointments (HTTP ${res.status})`);
  }
  const data = await res.json();
  return data.appointments || [];
}
