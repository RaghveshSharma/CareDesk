import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { StatusBadge } from '../components/StatusBadge';
import { BookAppointmentModal } from '../components/BookAppointmentModal';
import { RescheduleModal } from '../components/RescheduleModal';
import { CancelModal } from '../components/CancelModal';
import { DuplicateWarningModal } from '../components/DuplicateWarningModal';
import { Modal } from '../components/Modal';
import {
  Calendar,
  UserPlus,
  CalendarPlus,
  Search,
  UserCheck,
  CheckCircle,
  Clock,
  Stethoscope,
  RefreshCw,
  AlertCircle,
  Shield,
  Phone,
  User,
  ArrowRight,
  Sun,
  Sunset,
  Moon,
} from 'lucide-react';

export const ReceptionistDashboard = () => {
  const { user } = useAuth();
  const { addToast } = useToast();

  const [metrics, setMetrics] = useState({
    todayCount: 0,
    checkedInCount: 0,
    completedCount: 0,
    inConsultationCount: 0,
  });

  const [appointments, setAppointments] = useState([]);
  const [loadingAppts, setLoadingAppts] = useState(true);

  // Filters
  const getTodayStr = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const [filterDate, setFilterDate] = useState(getTodayStr());
  const [filterStatus, setFilterStatus] = useState('');
  const [filterShift, setFilterShift] = useState('all');

  const getCurrentShift = () => {
    const currentHour = new Date().getHours();
    if (currentHour >= 8 && currentHour < 16) {
      return {
        name: 'Shift 1: Morning Shift',
        hours: '08:00 – 16:00',
        id: 'morning',
        desc: 'Peak Outpatient (OPD) Intake & Registration Desk',
        badge: 'Morning Shift (08:00 – 16:00)',
        color: '#0284c7',
        bg: '#e0f2fe',
        border: '#bae6fd',
      };
    } else if (currentHour >= 16 && currentHour < 24) {
      return {
        name: 'Shift 2: Evening Shift',
        hours: '16:00 – 00:00',
        id: 'evening',
        desc: 'Outpatient Follow-ups & Diagnostic Handover Desk',
        badge: 'Evening Shift (16:00 – 00:00)',
        color: '#d97706',
        bg: '#fef3c7',
        border: '#fde68a',
      };
    } else {
      return {
        name: 'Shift 3: Night & Emergency Shift',
        hours: '00:00 – 08:00',
        id: 'night',
        desc: 'Emergency Triage & Urgent Walk-ins Desk (Resets to Shift 1 at 08:00 AM)',
        badge: 'Night / Emergency (00:00 – 08:00)',
        color: '#7c3aed',
        bg: '#ede9fe',
        border: '#ddd6fe',
      };
    }
  };

  const activeShift = getCurrentShift();

  // Modals state
  const [isBookModalOpen, setIsBookModalOpen] = useState(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [selectedAppt, setSelectedAppt] = useState(null);
  const [preselectedPatientForBooking, setPreselectedPatientForBooking] = useState(null);

  // Patient Registration Form state
  const [regForm, setRegForm] = useState({
    fullName: '',
    phone: '',
    email: '',
    dateOfBirth: '',
    gender: 'Female',
  });
  const [regSubmitting, setRegSubmitting] = useState(false);
  const [regError, setRegError] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  // Load metrics & appointments
  const loadDashboardData = useCallback(async () => {
    try {
      const [metricsRes, apptsRes] = await Promise.all([
        api.getMetrics(filterDate),
        api.getAppointments({
          date: filterDate,
          status: filterStatus || undefined,
        }),
      ]);

      const appts = apptsRes.appointments || [];
      setAppointments(appts);

      if (metricsRes && metricsRes.todayCount > 0) {
        setMetrics(metricsRes);
      } else {
        setMetrics({
          todayCount: appts.length,
          checkedInCount: appts.filter((a) => a.status === 'checked_in').length,
          inConsultationCount: appts.filter((a) => a.status === 'in_consultation').length,
          completedCount: appts.filter((a) => a.status === 'completed').length,
        });
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoadingAppts(false);
    }
  }, [filterDate, filterStatus]);

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 15000); // Poll every 15s for live updates
    return () => clearInterval(interval);
  }, [loadDashboardData]);

  // Search Patients
  const handleSearch = async (q) => {
    setSearchQuery(q);
    if (!q || q.trim().length === 0) {
      setSearchResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    try {
      const res = await api.searchPatients(q.trim());
      setSearchResults(res.patients || []);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setSearching(false);
    }
  };

  // Check In Appointment (booked -> checked_in)
  const handleCheckIn = async (appointment) => {
    try {
      const res = await api.checkInAppointment(appointment._id);
      addToast(
        `Patient ${appointment.patientId?.fullName} marked as Checked In! Ready for consultation.`,
        'success'
      );
      loadDashboardData();
    } catch (err) {
      addToast(err.message || 'Failed to check in patient.', 'error');
    }
  };

  // Mark No Show (booked -> no_show)
  const handleMarkNoShow = async (appointment) => {
    if (!window.confirm(`Mark ${appointment.patientId?.fullName}'s appointment as No-Show?`)) {
      return;
    }
    try {
      await api.markNoShow(appointment._id);
      addToast('Appointment marked as No-Show.', 'info');
      loadDashboardData();
    } catch (err) {
      addToast(err.message || 'Failed to update status.', 'error');
    }
  };

  // Patient Registration Submit
  const handleRegisterSubmit = async (confirmDuplicate = false) => {
    setRegSubmitting(true);
    setRegError('');

    try {
      const res = await api.registerPatient({
        ...regForm,
        confirmDuplicate,
      });

      if (res.isDuplicateWarning) {
        setDuplicateWarning(res.duplicates);
        setRegSubmitting(false);
        return;
      }

      addToast(`Patient registered successfully! Assigned ID: ${res.patient.patientId}`, 'success');
      setIsRegisterModalOpen(false);
      setDuplicateWarning(null);
      setRegForm({
        fullName: '',
        phone: '',
        email: '',
        dateOfBirth: '',
        gender: 'Female',
      });

      // Prompt to immediately book appointment for this newly registered patient
      setPreselectedPatientForBooking(res.patient);
      setIsBookModalOpen(true);
    } catch (err) {
      setRegError(err.message || 'Failed to register patient.');
    } finally {
      setRegSubmitting(false);
    }
  };

  // Demonstration: Try accessing doctor-only backend API
  const handleTestDoctorRouteSecurity = async () => {
    try {
      const res = await fetch('/api/doctors/me/profile', { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) {
        alert(
          `🔒 Server Security Verification Passed!\nStatus: ${res.status} Forbidden\nServer Response: "${data.error}"\nReceptionist role cannot access Doctor-only endpoints.`
        );
      } else {
        alert('Warning: Received doctor profile when none was expected.');
      }
    } catch (err) {
      alert(`Network error: ${err.message}`);
    }
  };

  return (
    <div className="main-content">
      {/* Top Banner / Welcome */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '24px',
          flexWrap: 'wrap',
          gap: '16px',
        }}
      >
        <div>
          <h2>Receptionist Workflow Hub</h2>
          <p style={{ marginTop: 2 }}>
            Manage patient intake, schedule outpatient visits, and manage live arrival queues.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setPreselectedPatientForBooking(null);
              setIsRegisterModalOpen(true);
            }}
            id="open-register-patient-btn"
          >
            <UserPlus size={16} />
            <span>Register New Patient</span>
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              setPreselectedPatientForBooking(null);
              setIsBookModalOpen(true);
            }}
            id="open-book-appointment-btn"
          >
            <CalendarPlus size={16} />
            <span>Book Appointment</span>
          </button>
        </div>
      </div>

      {/* Live Shift Handover & Rostering Status Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          color: '#ffffff',
          borderRadius: '12px',
          padding: '16px 20px',
          marginBottom: '20px',
          boxShadow: '0 4px 14px rgba(0,0,0,0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '14px',
        }}
        id="receptionist-shift-banner"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '10px',
              background: 'rgba(56, 189, 248, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#38bdf8',
            }}
          >
            <Clock size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94a3b8', fontWeight: 600 }}>
                Live Clinic Shift
              </span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.78rem',
                  padding: '2px 9px',
                  borderRadius: '12px',
                  background: activeShift.bg,
                  color: activeShift.color,
                  fontWeight: 700,
                  border: `1px solid ${activeShift.border}`,
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: activeShift.color }} />
                {activeShift.name} ({activeShift.hours})
              </span>
            </div>
            <div style={{ fontSize: '0.85rem', color: '#cbd5e1', marginTop: '3px' }}>
              {activeShift.desc} • <strong>2 Receptionists Active Per Shift</strong>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ background: 'rgba(255,255,255,0.07)', padding: '6px 14px', borderRadius: '8px', fontSize: '0.82rem' }}>
            <span style={{ color: '#94a3b8' }}>On-Duty Staff: </span>
            <strong style={{ color: '#f8fafc' }}>{user?.name || 'Reception Desk'}</strong>
            <span style={{ marginLeft: 6, padding: '2px 7px', borderRadius: 4, background: '#38bdf8', color: '#0f172a', fontWeight: 700, fontSize: '0.72rem' }}>
              {user?.shift?.toUpperCase() || 'MORNING'}
            </span>
          </div>
          <div style={{ fontSize: '0.76rem', color: '#94a3b8', maxWidth: '300px', lineHeight: 1.3 }}>
            🔄 <em>Handover Cycle: Shift 3 (Night) hands over at 08:00 AM, resetting the daily queue for day teams.</em>
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="stat-grid">
        <div className="stat-card" style={{ '--stat-accent': '#0284c7' }}>
          <div
            className="stat-icon-wrapper"
            style={{ '--stat-bg': '#e0f2fe', '--stat-color': '#0284c7' }}
          >
            <Calendar size={26} />
          </div>
          <div>
            <div className="stat-label">Today's Total</div>
            <div className="stat-value" id="metric-today-count">{metrics.todayCount}</div>
          </div>
        </div>

        <div className="stat-card" style={{ '--stat-accent': '#f59e0b' }}>
          <div
            className="stat-icon-wrapper"
            style={{ '--stat-bg': '#fffbeb', '--stat-color': '#f59e0b' }}
          >
            <UserCheck size={26} />
          </div>
          <div>
            <div className="stat-label">Waiting in Reception</div>
            <div className="stat-value" id="metric-checkedin-count">{metrics.checkedInCount}</div>
          </div>
        </div>

        <div className="stat-card" style={{ '--stat-accent': '#8b5cf6' }}>
          <div
            className="stat-icon-wrapper"
            style={{ '--stat-bg': '#f5f3ff', '--stat-color': '#8b5cf6' }}
          >
            <Stethoscope size={26} />
          </div>
          <div>
            <div className="stat-label">In Consultation</div>
            <div className="stat-value" id="metric-inconsult-count">{metrics.inConsultationCount}</div>
          </div>
        </div>

        <div className="stat-card" style={{ '--stat-accent': '#10b981' }}>
          <div
            className="stat-icon-wrapper"
            style={{ '--stat-bg': '#ecfdf5', '--stat-color': '#10b981' }}
          >
            <CheckCircle size={26} />
          </div>
          <div>
            <div className="stat-label">Completed Consultations</div>
            <div className="stat-value" id="metric-completed-count">{metrics.completedCount}</div>
          </div>
        </div>
      </div>

      {/* Patient Search Bar */}
      <div className="card" style={{ marginBottom: '24px', padding: '18px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Search size={20} color="var(--text-light)" />
          <input
            type="text"
            className="form-input"
            id="receptionist-patient-search-input"
            style={{ border: 'none', background: 'transparent', padding: '6px 0', fontSize: '0.95rem' }}
            placeholder="Search patients by Name, Phone (+91...), or Patient ID (PAT-2026-...)..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
          />
          {searchQuery && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => handleSearch('')}
            >
              Clear
            </button>
          )}
        </div>

        {/* Live Search Results Dropdown/Box */}
        {searchResults.length > 0 && (
          <div
            style={{
              marginTop: '16px',
              paddingTop: '16px',
              borderTop: '1px solid var(--border-color)',
            }}
          >
            <span style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Matching Patient Records ({searchResults.length})
            </span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px', marginTop: '10px' }}>
              {searchResults.map((pat) => (
                <div
                  key={pat._id}
                  style={{
                    padding: '12px',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    background: '#f8fafc',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '8px',
                  }}
                >
                  <div>
                    <strong>{pat.fullName}</strong>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      ID: {pat.patientId} • Phone: {pat.phone}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => {
                      setPreselectedPatientForBooking(pat);
                      setIsBookModalOpen(true);
                      setSearchResults([]);
                      setSearchQuery('');
                    }}
                    id={`book-for-patient-${pat.patientId}`}
                  >
                    <CalendarPlus size={14} />
                    <span>Book Appointment for {pat.fullName.split(' ')[0]}</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Appointments List / Table */}
      <div className="card">
        {/* Filters and Table Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '20px',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div>
            <h3>Clinic Appointments</h3>
            <p style={{ fontSize: '0.82rem', margin: 0 }}>
              Viewing scheduled bookings for {filterDate === getTodayStr() ? "Today" : filterDate}.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <input
              type="date"
              className="form-input"
              id="receptionist-filter-date"
              style={{ padding: '6px 12px', width: 'auto' }}
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
            />

            <select
              className="form-select"
              id="receptionist-filter-shift"
              style={{ padding: '6px 12px', width: 'auto' }}
              value={filterShift}
              onChange={(e) => setFilterShift(e.target.value)}
            >
              <option value="all">All Shifts (Full Queue)</option>
              <option value="morning">🌅 Shift 1: Morning (08:00 - 16:00)</option>
              <option value="evening">🌇 Shift 2: Evening (16:00 - 00:00)</option>
              <option value="night">🌙 Shift 3: Night / Emergency (00:00 - 08:00)</option>
            </select>

            <select
              className="form-select"
              id="receptionist-filter-status"
              style={{ padding: '6px 12px', width: 'auto' }}
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="booked">Booked</option>
              <option value="checked_in">Checked In</option>
              <option value="in_consultation">In Consultation</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="no_show">No Show</option>
            </select>

            <button
              className="btn btn-secondary btn-sm"
              onClick={loadDashboardData}
              title="Refresh list"
            >
              <RefreshCw size={14} />
            </button>
          </div>
        </div>

        {/* Appointments Table */}
        <div className="table-wrapper">
          <table className="data-table" id="appointments-table">
            <thead>
              <tr>
                <th>Time Slot</th>
                <th>Patient Details</th>
                <th>Assigned Doctor</th>
                <th>Status</th>
                <th>Reason for Visit</th>
                <th style={{ textAlign: 'right' }}>Workflow Actions</th>
              </tr>
            </thead>
            <tbody>
              {(() => {
                const displayedAppointments = appointments.filter((appt) => {
                  if (filterShift === 'all') return true;
                  const d = new Date(appt.startTime);
                  const hour = d.getHours();
                  if (filterShift === 'morning') return hour >= 8 && hour < 16;
                  if (filterShift === 'evening') return hour >= 16 && hour < 24;
                  if (filterShift === 'night') return hour >= 0 && hour < 8;
                  return true;
                });

                if (loadingAppts) {
                  return (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                        Loading appointments...
                      </td>
                    </tr>
                  );
                }

                if (displayedAppointments.length === 0) {
                  return (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                        No appointments found for this filter/shift. Click "+ Book Appointment" above to schedule a visit.
                      </td>
                    </tr>
                  );
                }

                return displayedAppointments.map((appt) => {
                  const startTime = new Date(appt.startTime);
                  const timeFormatted = startTime.toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true,
                  });

                  return (
                    <tr key={appt._id} id={`appointment-row-${appt._id}`}>
                      {/* Time */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
                          <Clock size={15} color="var(--primary)" />
                          <span>{timeFormatted}</span>
                        </div>
                        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>20 mins</span>
                      </td>

                      {/* Patient */}
                      <td>
                        <div style={{ fontWeight: 700 }}>{appt.patientId?.fullName || 'Patient'}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          ID: {appt.patientId?.patientId} • {appt.patientId?.phone}
                        </div>
                      </td>

                      {/* Doctor */}
                      <td>
                        <div style={{ fontWeight: 600 }}>{appt.doctorId?.displayName}</div>
                        <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                          {appt.doctorId?.specialty}
                        </span>
                      </td>

                      {/* Status */}
                      <td>
                        <StatusBadge status={appt.status} />
                      </td>

                      {/* Reason */}
                      <td style={{ maxWidth: '220px' }}>
                        <span style={{ fontSize: '0.84rem', color: appt.reasonForVisit ? 'var(--text-main)' : 'var(--text-light)' }}>
                          {appt.reasonForVisit || 'General outpatient consultation'}
                        </span>
                        {appt.cancellationReason && (
                          <div style={{ fontSize: '0.76rem', color: 'var(--status-cancelled-text)', marginTop: 2 }}>
                            Reason: {appt.cancellationReason}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                          {appt.status === 'booked' && (
                            <>
                              <button
                                type="button"
                                className="btn btn-success btn-sm"
                                id={`check-in-btn-${appt._id}`}
                                onClick={() => handleCheckIn(appt)}
                                title="Patient has arrived in clinic. Mark checked in."
                              >
                                <UserCheck size={14} />
                                <span>Check In</span>
                              </button>

                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                id={`reschedule-btn-${appt._id}`}
                                onClick={() => {
                                  setSelectedAppt(appt);
                                  setIsRescheduleModalOpen(true);
                                }}
                                title="Move appointment to another slot"
                              >
                                Reschedule
                              </button>

                              <button
                                type="button"
                                className="btn btn-danger btn-sm"
                                id={`cancel-btn-${appt._id}`}
                                onClick={() => {
                                  setSelectedAppt(appt);
                                  setIsCancelModalOpen(true);
                                }}
                                title="Cancel appointment and free slot"
                              >
                                Cancel
                              </button>

                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                id={`noshow-btn-${appt._id}`}
                                onClick={() => handleMarkNoShow(appt)}
                                title="Mark as No-Show"
                              >
                                No-Show
                              </button>
                            </>
                          )}

                          {appt.status === 'checked_in' && (
                            <span style={{ fontSize: '0.8rem', color: 'var(--status-checkedin-text)', fontWeight: 600 }}>
                              Waiting in Reception
                            </span>
                          )}

                          {appt.status === 'in_consultation' && (
                            <span style={{ fontSize: '0.8rem', color: 'var(--status-consulting-text)', fontWeight: 600 }}>
                              In Consultation with Doctor
                            </span>
                          )}

                          {appt.status === 'completed' && (
                            <span style={{ fontSize: '0.8rem', color: 'var(--status-completed-text)', fontWeight: 600 }}>
                              Visit Completed
                            </span>
                          )}

                          {appt.status === 'cancelled' && (
                            <span style={{ fontSize: '0.8rem', color: 'var(--status-cancelled-text)' }}>
                              Slot Freed
                            </span>
                          )}

                          {appt.status === 'no_show' && (
                            <span style={{ fontSize: '0.8rem', color: 'var(--status-noshow-text)' }}>
                              No Show
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                });
              })()}
            </tbody>
          </table>
        </div>
      </div>

      {/* Patient Registration Modal */}
      <Modal
        isOpen={isRegisterModalOpen}
        onClose={() => {
          setIsRegisterModalOpen(false);
          setRegError('');
          setDuplicateWarning(null);
        }}
        title="Register New Outpatient"
        id="register-patient-modal"
        footer={
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsRegisterModalOpen(false)}
              disabled={regSubmitting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              id="confirm-patient-register-btn"
              disabled={regSubmitting || !regForm.fullName || !regForm.phone}
              onClick={() => handleRegisterSubmit(false)}
            >
              <UserPlus size={16} />
              <span>{regSubmitting ? 'Registering...' : 'Complete Patient Registration'}</span>
            </button>
          </>
        }
      >
        {regError && (
          <div className="alert alert-error">
            <AlertCircle size={18} />
            <span>{regError}</span>
          </div>
        )}

        <div className="form-group">
          <label className="form-label" htmlFor="reg-fullname">
            Full Name <span style={{ color: 'var(--status-cancelled-text)' }}>*</span>
          </label>
          <input
            type="text"
            className="form-input"
            id="reg-fullname"
            placeholder="e.g. Johnathan Doe"
            value={regForm.fullName}
            onChange={(e) => setRegForm({ ...regForm, fullName: e.target.value })}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="reg-phone">
            Phone Number <span style={{ color: 'var(--status-cancelled-text)' }}>*</span>
          </label>
          <input
            type="text"
            className="form-input"
            id="reg-phone"
            placeholder="e.g. +91-9876543210"
            value={regForm.phone}
            onChange={(e) => setRegForm({ ...regForm, phone: e.target.value })}
            required
          />
          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block', marginTop: 4 }}>
            Families may share phone numbers. CareDesk alerts for potential duplicates.
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <div className="form-group">
            <label className="form-label" htmlFor="reg-email">
              Email Address <span className="optional">(optional)</span>
            </label>
            <input
              type="email"
              className="form-input"
              id="reg-email"
              placeholder="patient@example.com"
              value={regForm.email}
              onChange={(e) => setRegForm({ ...regForm, email: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="reg-dob">
              Date of Birth <span className="optional">(optional)</span>
            </label>
            <input
              type="date"
              className="form-input"
              id="reg-dob"
              value={regForm.dateOfBirth}
              onChange={(e) => setRegForm({ ...regForm, dateOfBirth: e.target.value })}
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Gender <span className="optional">(optional)</span></label>
          <select
            className="form-select"
            id="reg-gender"
            value={regForm.gender}
            onChange={(e) => setRegForm({ ...regForm, gender: e.target.value })}
          >
            <option value="Female">Female</option>
            <option value="Male">Male</option>
            <option value="Other">Other</option>
            <option value="Prefer not to say">Prefer not to say</option>
          </select>
        </div>
      </Modal>

      {/* Duplicate Patient Warning Modal */}
      {duplicateWarning && (
        <DuplicateWarningModal
          isOpen={true}
          onClose={() => setDuplicateWarning(null)}
          duplicates={duplicateWarning}
          onSelectExisting={(existingPatient) => {
            setDuplicateWarning(null);
            setIsRegisterModalOpen(false);
            setPreselectedPatientForBooking(existingPatient);
            setIsBookModalOpen(true);
          }}
          onConfirmRegisterAnyway={() => {
            setDuplicateWarning(null);
            handleRegisterSubmit(true);
          }}
        />
      )}

      {/* Book Appointment Modal */}
      <BookAppointmentModal
        isOpen={isBookModalOpen}
        onClose={() => {
          setIsBookModalOpen(false);
          setPreselectedPatientForBooking(null);
        }}
        preselectedPatient={preselectedPatientForBooking}
        onAppointmentBooked={(newAppt) => {
          loadDashboardData();
        }}
      />

      {/* Reschedule Modal */}
      <RescheduleModal
        isOpen={isRescheduleModalOpen}
        onClose={() => {
          setIsRescheduleModalOpen(false);
          setSelectedAppt(null);
        }}
        appointment={selectedAppt}
        onAppointmentRescheduled={() => {
          loadDashboardData();
        }}
      />

      {/* Cancel Modal */}
      <CancelModal
        isOpen={isCancelModalOpen}
        onClose={() => {
          setIsCancelModalOpen(false);
          setSelectedAppt(null);
        }}
        appointment={selectedAppt}
        onAppointmentCancelled={() => {
          loadDashboardData();
        }}
      />
    </div>
  );
};
