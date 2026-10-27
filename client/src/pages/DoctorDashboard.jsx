import React, { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { StatusBadge } from '../components/StatusBadge';
import { Modal } from '../components/Modal';
import {
  Stethoscope,
  Clock,
  User,
  CheckCircle,
  FileText,
  UserCheck,
  Calendar,
  AlertCircle,
  Play,
  Save,
  Shield,
  RefreshCw,
  CalendarPlus,
  Sparkles,
  CheckCircle2,
  Edit3,
} from 'lucide-react';

const CLINICAL_TEMPLATES = [
  {
    label: 'Normal Checkup',
    text: 'Patient presented for routine consultation. Vital signs within normal limits. General physical examination unremarkable. Recommended regular hydration and active lifestyle.',
  },
  {
    label: 'Upper Respiratory / Viral',
    text: 'Patient reports mild seasonal dry cough and low-grade fever. Throat mildly erythematous; chest clear on auscultation. Advised warm fluids, saline gargles, rest, and follow-up if symptoms persist past 7 days.',
  },
  {
    label: 'Vitals & Hypertension Review',
    text: 'Follow-up blood pressure evaluation recorded at 124/82 mmHg. Patient compliant with daily medication. Reviewed low-sodium diet and stress reduction techniques.',
  },
  {
    label: 'Post-Recovery Clearance',
    text: 'Follow-up evaluation following previous acute illness. Full resolution of primary symptoms reported. Patient cleared to resume normal work activities.',
  },
];

export const DoctorDashboard = () => {
  const { user } = useAuth();
  const { addToast } = useToast();

  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    todayCount: 0,
    checkedInCount: 0,
    inConsultationCount: 0,
    completedCount: 0,
  });

  const getTodayStr = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const [filterDate, setFilterDate] = useState(getTodayStr());

  // Active consultation state
  const [activeAppt, setActiveAppt] = useState(null);
  const [visitSummaryText, setVisitSummaryText] = useState('');
  const [savingSummary, setSavingSummary] = useState(false);
  const [completingVisit, setCompletingVisit] = useState(false);
  const [lastDraftSavedTime, setLastDraftSavedTime] = useState(null);

  // Live elapsed consultation timer
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Follow-up appointment modal (Doctor's own calendar only)
  const [isFollowupModalOpen, setIsFollowupModalOpen] = useState(false);
  const [followupPatient, setFollowupPatient] = useState(null);
  const [followupDate, setFollowupDate] = useState(getTodayStr());
  const [followupSlots, setFollowupSlots] = useState(null);
  const [selectedFollowupSlot, setSelectedFollowupSlot] = useState(null);
  const [followupReason, setFollowupReason] = useState('Scheduled clinical follow-up');
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submittingFollowup, setSubmittingFollowup] = useState(false);
  const [followupError, setFollowupError] = useState('');

  const loadDoctorData = useCallback(async () => {
    try {
      const [metricsRes, apptsRes] = await Promise.all([
        api.getMetrics(filterDate),
        api.getAppointments({ date: filterDate }),
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

      const inConsult = appts.find((a) => a.status === 'in_consultation');
      if (inConsult) {
        setActiveAppt(inConsult);
        setVisitSummaryText((prev) => {
          if (!prev || prev.trim() === '') {
            return inConsult.visitSummary || '';
          }
          return prev;
        });
      } else {
        setActiveAppt(null);
        setVisitSummaryText('');
      }
    } catch (err) {
      console.error('Failed to load doctor dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, [filterDate]);

  useEffect(() => {
    loadDoctorData();
    const interval = setInterval(loadDoctorData, 12000);
    return () => clearInterval(interval);
  }, [loadDoctorData]);

  // Elapsed consultation counter
  useEffect(() => {
    if (!activeAppt?.visitStartedAt) {
      setElapsedSeconds(0);
      return;
    }

    const startMs = new Date(activeAppt.visitStartedAt).getTime();
    const updateElapsed = () => {
      const nowMs = Date.now();
      const diffSec = Math.max(0, Math.floor((nowMs - startMs) / 1000));
      setElapsedSeconds(diffSec);
    };

    updateElapsed();
    const timer = setInterval(updateElapsed, 1000);
    return () => clearInterval(timer);
  }, [activeAppt]);

  const formatElapsed = (sec) => {
    const hours = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    const remainingSec = sec % 60;
    if (hours > 0) {
      return `${hours}h ${String(mins).padStart(2, '0')}m ${String(remainingSec).padStart(2, '0')}s`;
    }
    return `${String(mins).padStart(2, '0')}:${String(remainingSec).padStart(2, '0')}`;
  };

  // Start Visit (checked_in -> in_consultation)
  const handleStartVisit = async (appointment) => {
    try {
      await api.startVisit(appointment._id);
      addToast(
        `Consultation started for ${appointment.patientId?.fullName}. Status changed to in_consultation.`,
        'success'
      );
      loadDoctorData();
    } catch (err) {
      addToast(err.message || 'Failed to start visit.', 'error');
    }
  };

  // Save draft visit summary
  const handleSaveSummary = async () => {
    if (!activeAppt) return;
    setSavingSummary(true);
    try {
      await api.saveVisitSummary(activeAppt._id, visitSummaryText);
      const timeStr = new Date().toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
      });
      setLastDraftSavedTime(timeStr);
      setActiveAppt((prev) => (prev ? { ...prev, visitSummary: visitSummaryText } : prev));
      addToast(`Visit summary draft saved successfully at ${timeStr}. Accessible in queue below.`, 'success');
      loadDoctorData();
    } catch (err) {
      addToast(err.message || 'Failed to save visit summary.', 'error');
    } finally {
      setSavingSummary(false);
    }
  };

  // Complete Visit (in_consultation -> completed)
  const handleCompleteVisit = async () => {
    if (!activeAppt) return;
    if (!visitSummaryText || visitSummaryText.trim() === '') {
      if (!window.confirm('No visit summary was entered. Do you want to complete the visit without clinical notes?')) {
        return;
      }
    }

    setCompletingVisit(true);
    try {
      await api.completeVisit(activeAppt._id, visitSummaryText);
      addToast(
        `Appointment completed successfully for ${activeAppt.patientId?.fullName}! Final visit time logged.`,
        'success'
      );
      setActiveAppt(null);
      setVisitSummaryText('');
      loadDoctorData();
    } catch (err) {
      addToast(err.message || 'Failed to complete visit.', 'error');
    } finally {
      setCompletingVisit(false);
    }
  };

  // Follow-up modal slot fetch (strict to logged in doctor)
  useEffect(() => {
    if (isFollowupModalOpen && user?.doctorId && followupDate) {
      setLoadingSlots(true);
      setFollowupError('');
      setSelectedFollowupSlot(null);

      api.getDoctorSlots(user.doctorId, followupDate)
        .then((res) => setFollowupSlots(res))
        .catch((err) => {
          setFollowupError(err.message || 'Failed to fetch slots.');
          setFollowupSlots(null);
        })
        .finally(() => setLoadingSlots(false));
    }
  }, [isFollowupModalOpen, user, followupDate]);

  const handleOpenFollowup = (patient) => {
    setFollowupPatient(patient);
    setFollowupDate(getTodayStr());
    setFollowupReason(`Doctor follow-up consultation with ${user?.displayName || 'attending physician'}`);
    setIsFollowupModalOpen(true);
  };

  const handleBookFollowupSubmit = async () => {
    if (!followupPatient || !selectedFollowupSlot) {
      setFollowupError('Please click to select an available time slot.');
      return;
    }

    setSubmittingFollowup(true);
    setFollowupError('');

    try {
      await api.doctorBookFollowup({
        patientId: followupPatient._id,
        startTime: selectedFollowupSlot.startTime,
        reasonForVisit: followupReason,
      });

      addToast(
        `Follow-up appointment booked for ${followupPatient.fullName} on your calendar!`,
        'success'
      );
      setIsFollowupModalOpen(false);
      loadDoctorData();
    } catch (err) {
      setFollowupError(err.message || 'Failed to book follow-up appointment.');
    } finally {
      setSubmittingFollowup(false);
    }
  };

  const handleTestReceptionistRouteSecurity = async () => {
    try {
      const res = await fetch('/api/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ fullName: 'Forbidden Patient', phone: '123' }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(
          `🔒 Server Security Verification Passed!\nStatus: ${res.status} Forbidden\nServer Response: "${data.error}"\nDoctor role cannot access Receptionist-only patient intake.`
        );
      } else {
        alert('Warning: Patient registration succeeded when it should have been forbidden.');
      }
    } catch (err) {
      alert(`Network error: ${err.message}`);
    }
  };

  return (
    <div className="main-content">
      {/* Header Banner */}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 'var(--radius-md)',
                background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
              }}
            >
              <Stethoscope size={20} />
            </div>
            <div>
              <h2>{user?.displayName || 'Dr. Sarah Smith, MD'}</h2>
              <p style={{ margin: 0, fontSize: '0.84rem' }}>
                Family Medicine & Outpatient Care • 20-Minute Consultations with 5-Min Buffer Gaps
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <input
            type="date"
            className="form-input"
            id="doctor-filter-date"
            style={{ width: 'auto', padding: '6px 12px' }}
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
          />

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={loadDoctorData}
            title="Refresh patient queue"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="stat-grid">
        <div className="stat-card" style={{ '--stat-accent': '#6d28d9' }}>
          <div
            className="stat-icon-wrapper"
            style={{ '--stat-bg': '#f5f3ff', '--stat-color': '#6d28d9' }}
          >
            <Calendar size={26} />
          </div>
          <div>
            <div className="stat-label">Assigned Today</div>
            <div className="stat-value" id="doc-metric-today">{metrics.todayCount}</div>
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
            <div className="stat-label">Waiting in Queue</div>
            <div className="stat-value" id="doc-metric-waiting">{metrics.checkedInCount}</div>
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
            <div className="stat-value" id="doc-metric-inconsult">{metrics.inConsultationCount}</div>
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
            <div className="stat-value" id="doc-metric-completed">{metrics.completedCount}</div>
          </div>
        </div>
      </div>

      {/* Active Consultation Console */}
      {activeAppt ? (
        <div
          className="card"
          style={{
            marginBottom: '28px',
            border: '2px solid #8b5cf6',
            boxShadow: '0 8px 24px rgba(139, 92, 246, 0.15)',
          }}
          id="active-consultation-console"
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid var(--border-color)',
              paddingBottom: '16px',
              marginBottom: '16px',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  background: '#8b5cf6',
                  display: 'inline-block',
                  boxShadow: '0 0 0 4px rgba(139, 92, 246, 0.25)',
                }}
              />
              <h3 style={{ margin: 0, color: '#6d28d9' }}>Active Consultation in Progress</h3>
              <span
                style={{
                  background: '#f5f3ff',
                  border: '1px solid #ddd6fe',
                  color: '#6d28d9',
                  borderRadius: 'var(--radius-full)',
                  padding: '3px 10px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                <Clock size={13} />
                <span>Elapsed: {formatElapsed(elapsedSeconds)}</span>
              </span>

              {activeAppt.visitSummary ? (
                <span
                  id="active-draft-saved-badge"
                  style={{
                    background: '#ecfdf5',
                    border: '1px solid #6ee7b7',
                    color: '#065f46',
                    borderRadius: 'var(--radius-full)',
                    padding: '3px 10px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                  }}
                  title="Clinical notes have been saved to the database"
                >
                  <CheckCircle size={13} color="#10b981" />
                  <span>Draft Saved in System {lastDraftSavedTime ? `(${lastDraftSavedTime})` : ''}</span>
                </span>
              ) : (
                <span
                  style={{
                    background: '#fffbeb',
                    border: '1px solid #fde68a',
                    color: '#92400e',
                    borderRadius: 'var(--radius-full)',
                    padding: '3px 10px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                  }}
                >
                  <Save size={13} color="#f59e0b" />
                  <span>Draft Not Saved Yet</span>
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => handleOpenFollowup(activeAppt.patientId)}
                title="Book a future follow-up consultation on your own calendar"
                id="doctor-book-followup-active-btn"
              >
                <CalendarPlus size={14} color="#6d28d9" />
                <span>Schedule Follow-Up (My Calendar)</span>
              </button>
              <StatusBadge status="in_consultation" />
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '16px',
              padding: '14px 18px',
              background: '#f8fafc',
              borderRadius: 'var(--radius-md)',
              marginBottom: '18px',
            }}
          >
            <div>
              <span style={{ fontSize: '0.74rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>
                Patient
              </span>
              <div style={{ fontWeight: 700, fontSize: '1.05rem', marginTop: 2 }}>
                {activeAppt.patientId?.fullName}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                ID: {activeAppt.patientId?.patientId} • Phone: {activeAppt.patientId?.phone}
              </div>
            </div>

            <div>
              <span style={{ fontSize: '0.74rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>
                Demographics
              </span>
              <div style={{ fontSize: '0.86rem', marginTop: 2 }}>
                DOB: {activeAppt.patientId?.dateOfBirth || 'N/A'} • Gender: {activeAppt.patientId?.gender || 'N/A'}
              </div>
            </div>

            <div>
              <span style={{ fontSize: '0.74rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>
                Reason for Visit
              </span>
              <div style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-main)', marginTop: 2 }}>
                {activeAppt.reasonForVisit || 'Routine outpatient consultation'}
              </div>
            </div>

            <div>
              <span style={{ fontSize: '0.74rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>
                Started At
              </span>
              <div style={{ fontSize: '0.86rem', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Clock size={14} color="#8b5cf6" />
                <span>
                  {activeAppt.visitStartedAt
                    ? new Date(activeAppt.visitStartedAt).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                      })
                    : 'Just now'}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Clinical Templates */}
          <div style={{ marginBottom: 12 }}>
            <span style={{ fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 5 }}>
              <Sparkles size={12} color="#8b5cf6" /> Quick Clinical Note Templates:
            </span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
              {CLINICAL_TEMPLATES.map((tmpl, idx) => (
                <button
                  type="button"
                  key={idx}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.76rem', padding: '4px 10px' }}
                  onClick={() => {
                    setVisitSummaryText((prev) =>
                      prev && prev.trim().length > 0 ? `${prev}\n${tmpl.text}` : tmpl.text
                    );
                    addToast(`Inserted '${tmpl.label}' template`, 'info', 2000);
                  }}
                >
                  {tmpl.label}
                </button>
              ))}
            </div>
          </div>

          {/* Visit Summary Input */}
          <div className="form-group">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <label className="form-label" htmlFor="doctor-visit-summary" style={{ marginBottom: 0 }}>
                Clinical Consultation Summary & Treatment Plan <span style={{ color: 'var(--status-cancelled-text)' }}>*</span>
              </label>
              <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                Doctor-confidential • Receptionist cannot view this summary
              </span>
            </div>
            <textarea
              className="form-textarea"
              id="doctor-visit-summary"
              rows={4}
              placeholder="Record clinical encounter summary (e.g. Patient evaluated for acute migraine. Vitals stable. Advised rest and follow-up...)"
              value={visitSummaryText}
              onChange={(e) => setVisitSummaryText(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px', marginTop: 16, flexWrap: 'wrap' }}>
            {lastDraftSavedTime && (
              <span
                id="draft-saved-timestamp-label"
                style={{
                  fontSize: '0.82rem',
                  color: '#059669',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                <CheckCircle size={14} color="#10b981" />
                <span>Draft saved at {lastDraftSavedTime} (persisted in system)</span>
              </span>
            )}

            <button
              type="button"
              className="btn btn-secondary"
              id="save-draft-summary-btn"
              onClick={handleSaveSummary}
              disabled={savingSummary}
              title="Save clinical note draft to server so you can resume anytime"
            >
              <Save size={15} />
              <span>{savingSummary ? 'Saving Draft...' : 'Save Draft Summary'}</span>
            </button>

            <button
              type="button"
              className="btn btn-success"
              id="complete-visit-btn"
              onClick={handleCompleteVisit}
              disabled={completingVisit}
            >
              <CheckCircle size={16} />
              <span>{completingVisit ? 'Completing...' : 'Complete Visit & Sign Off'}</span>
            </button>
          </div>
        </div>
      ) : null}

      {/* Doctor Appointments Queue Table */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
          <div>
            <h3>My Assigned Patient Queue</h3>
            <p style={{ fontSize: '0.82rem', margin: 0 }}>
              Appointments scheduled exclusively with {user?.displayName || 'Dr. Sarah Smith'}.
            </p>
          </div>
        </div>

        <div className="table-wrapper">
          <table className="data-table" id="doctor-queue-table">
            <thead>
              <tr>
                <th>Time Slot</th>
                <th>Patient Details</th>
                <th>Reason for Visit</th>
                <th>Status</th>
                <th>Clinical Visit Summary</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                    Loading patient queue...
                  </td>
                </tr>
              ) : appointments.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                    No appointments assigned for this date.
                  </td>
                </tr>
              ) : (
                appointments.map((appt) => {
                  const startTime = new Date(appt.startTime);
                  const timeFormatted = startTime.toLocaleTimeString('en-US', {
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true,
                  });

                  return (
                    <tr
                      key={appt._id}
                      id={`doctor-row-${appt._id}`}
                      style={{
                        background: appt.status === 'in_consultation' ? '#fcfaff' : undefined,
                      }}
                    >
                      {/* Time */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}>
                          <Clock size={15} color="#8b5cf6" />
                          <span>{timeFormatted}</span>
                        </div>
                        <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>20 min slot</span>
                      </td>

                      {/* Patient */}
                      <td>
                        <div style={{ fontWeight: 700 }}>{appt.patientId?.fullName}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          ID: {appt.patientId?.patientId} • Phone: {appt.patientId?.phone}
                        </div>
                      </td>

                      {/* Reason */}
                      <td>
                        <span style={{ fontSize: '0.84rem' }}>
                          {appt.reasonForVisit || 'General outpatient visit'}
                        </span>
                      </td>

                      {/* Status */}
                      <td>
                        <StatusBadge status={appt.status} />
                      </td>

                      {/* Visit Summary */}
                      <td style={{ maxWidth: '280px' }}>
                        {appt.status === 'completed' && appt.visitSummary ? (
                          <div
                            style={{
                              fontSize: '0.82rem',
                              background: '#ecfdf5',
                              border: '1px solid #a7f3d0',
                              borderRadius: 'var(--radius-sm)',
                              padding: '8px 10px',
                              color: '#065f46',
                            }}
                            id={`completed-summary-${appt._id}`}
                          >
                            <FileText size={13} style={{ display: 'inline', marginRight: 4 }} />
                            <span>{appt.visitSummary}</span>
                            {appt.visitCompletedAt && (
                              <div style={{ fontSize: '0.72rem', color: '#047857', marginTop: 4 }}>
                                Completed at:{' '}
                                {new Date(appt.visitCompletedAt).toLocaleTimeString('en-US', {
                                  hour: 'numeric',
                                  minute: '2-digit',
                                })}
                              </div>
                            )}
                          </div>
                        ) : appt.status === 'in_consultation' ? (
                          appt.visitSummary && appt.visitSummary.trim().length > 0 ? (
                            <div
                              style={{
                                fontSize: '0.82rem',
                                background: '#faf5ff',
                                border: '1px solid #d8b4fe',
                                borderRadius: 'var(--radius-sm)',
                                padding: '8px 10px',
                                color: '#581c87',
                              }}
                              id={`draft-summary-${appt._id}`}
                            >
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  fontWeight: 700,
                                  color: '#6d28d9',
                                  marginBottom: 3,
                                  fontSize: '0.72rem',
                                  textTransform: 'uppercase',
                                }}
                              >
                                <Save size={12} />
                                <span>Saved Clinical Draft</span>
                              </div>
                              <div
                                style={{
                                  fontStyle: 'italic',
                                  color: '#4c1d95',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  display: '-webkit-box',
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: 'vertical',
                                }}
                              >
                                "{appt.visitSummary}"
                              </div>
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.82rem', color: '#6d28d9', fontWeight: 600 }}>
                              Active in Consultation (No draft saved yet)
                            </span>
                          )
                        ) : (
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-light)' }}>
                            {appt.status === 'booked'
                              ? 'Awaiting patient arrival'
                              : appt.status === 'checked_in'
                              ? 'Ready for doctor consultation'
                              : 'None recorded'}
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                          {appt.status === 'checked_in' && (
                            <button
                              type="button"
                              className="btn btn-indigo btn-sm"
                              id={`start-visit-btn-${appt._id}`}
                              onClick={() => handleStartVisit(appt)}
                              title="Start consultation with checked-in patient"
                            >
                              <Play size={14} />
                              <span>Start Visit</span>
                            </button>
                          )}

                          {appt.status === 'completed' && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleOpenFollowup(appt.patientId)}
                              title="Schedule future follow-up for this patient on your calendar"
                            >
                              <CalendarPlus size={13} />
                              <span>Follow-Up</span>
                            </button>
                          )}

                          {appt.status === 'booked' && (
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                              Awaiting Check-in
                            </span>
                          )}

                          {appt.status === 'in_consultation' && (
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              id={`open-draft-btn-${appt._id}`}
                              onClick={() => {
                                setActiveAppt(appt);
                                setVisitSummaryText(appt.visitSummary || '');
                                const consoleElem = document.getElementById('active-consultation-console');
                                if (consoleElem) {
                                  consoleElem.scrollIntoView({ behavior: 'smooth' });
                                }
                                addToast(`Opened draft notes for ${appt.patientId?.fullName}`, 'info', 2000);
                              }}
                              title="Open consultation console & edit saved clinical draft"
                              style={{ display: 'flex', alignItems: 'center', gap: 5 }}
                            >
                              <Edit3 size={13} />
                              <span>{appt.visitSummary ? 'Open / Resume Draft' : 'Resume Visit'}</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Doctor Follow-Up Booking Modal (Strictly Scoped to Doctor's Own Calendar) */}
      <Modal
        isOpen={isFollowupModalOpen}
        onClose={() => setIsFollowupModalOpen(false)}
        title="Schedule Follow-Up Consultation (My Calendar Only)"
        id="doctor-followup-modal"
        large={true}
        footer={
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsFollowupModalOpen(false)}
              disabled={submittingFollowup}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleBookFollowupSubmit}
              disabled={submittingFollowup || !selectedFollowupSlot}
              id="confirm-doctor-followup-btn"
            >
              <CheckCircle2 size={16} />
              <span>{submittingFollowup ? 'Scheduling...' : 'Confirm Follow-Up Appointment'}</span>
            </button>
          </>
        }
      >
        {followupError && (
          <div className="alert alert-error">
            <AlertCircle size={18} />
            <span>{followupError}</span>
          </div>
        )}

        <div
          style={{
            padding: '14px 18px',
            background: '#f8fafc',
            border: '1px solid var(--border-color)',
            borderRadius: 'var(--radius-md)',
            marginBottom: '16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <div style={{ fontSize: '0.78rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>
              Patient
            </div>
            <div style={{ fontWeight: 700, fontSize: '1rem', marginTop: 2 }}>
              {followupPatient?.fullName} ({followupPatient?.patientId})
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Attending Physician: <strong>{user?.displayName || 'Dr. Sarah Smith'}</strong> (Locked to your schedule)
            </div>
          </div>
          <span className="badge badge-booked">Direct Doctor Booking</span>
        </div>

        <div className="form-group">
          <label className="form-label">Follow-Up Date</label>
          <input
            type="date"
            className="form-input"
            value={followupDate}
            min={getTodayStr()}
            onChange={(e) => setFollowupDate(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Select Available Slot on Your Schedule ({followupDate})</label>
          {loadingSlots ? (
            <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-muted)' }}>
              Checking your available consultation slots...
            </div>
          ) : !followupSlots || followupSlots.slots.length === 0 ? (
            <div className="alert alert-info">
              {followupSlots?.message || 'No scheduled hours or open slots on this date.'}
            </div>
          ) : (
            <div className="slot-grid">
              {followupSlots.slots.map((slot) => (
                <button
                  type="button"
                  key={slot.time}
                  disabled={!slot.isAvailable}
                  className={`slot-chip ${!slot.isAvailable ? 'unavailable' : ''} ${
                    selectedFollowupSlot?.time === slot.time ? 'selected' : ''
                  }`}
                  onClick={() => setSelectedFollowupSlot(slot)}
                  title={slot.reasonUnavailable || `${slot.displayTime} Available`}
                >
                  <div>{slot.displayTime}</div>
                  <div style={{ fontSize: '0.68rem', opacity: 0.85 }}>to {slot.displayEndTime}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="form-group">
          <label className="form-label">Clinical Reason for Follow-Up</label>
          <input
            type="text"
            className="form-input"
            value={followupReason}
            onChange={(e) => setFollowupReason(e.target.value)}
            placeholder="e.g. 2-week blood pressure check, post-treatment review..."
          />
        </div>
      </Modal>
    </div>
  );
};
