import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { api } from '../services/api';
import {
  Calendar,
  Clock,
  User,
  HeartPulse,
  PlusCircle,
  FileText,
  AlertCircle,
  CheckCircle,
  XCircle,
  Stethoscope,
  RefreshCw,
  Phone,
  Mail,
  ShieldCheck,
  ChevronRight,
  Info,
  MapPin,
  Activity,
  Heart,
} from 'lucide-react';

const formatDateLocal = (d) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getTodayStr = () => formatDateLocal(new Date());
const getTomorrowStr = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return formatDateLocal(d);
};
const getDayAfterTomorrowStr = () => {
  const d = new Date();
  d.setDate(d.getDate() + 2);
  return formatDateLocal(d);
};

const getInitialBookingDate = () => {
  const now = new Date();
  // If after clinic hours (18:00), default to tomorrow for immediate slot availability
  if (now.getHours() >= 18) {
    return getTomorrowStr();
  }
  return getTodayStr();
};

export const PatientDashboard = () => {
  const { user } = useAuth();
  const { addToast } = useToast();

  const [activeTab, setActiveTab] = useState('upcoming'); // 'upcoming' | 'book' | 'history' | 'profile'
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [upcomingList, setUpcomingList] = useState([]);
  const [pastList, setPastList] = useState([]);

  // Booking Flow State
  const [doctors, setDoctors] = useState([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [selectedDate, setSelectedDate] = useState(getInitialBookingDate());
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [slots, setSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [reasonForVisit, setReasonForVisit] = useState('');
  const [bookingInProgress, setBookingInProgress] = useState(false);

  // Cancellation State
  const [cancelModalAppointment, setCancelModalAppointment] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelLoading, setCancelLoading] = useState(false);

  // Profile Edit State (Demographics + Optional Clinical & Emergency Info)
  const [profilePhone, setProfilePhone] = useState('');
  const [profileDob, setProfileDob] = useState('');
  const [profileGender, setProfileGender] = useState('Prefer not to say');
  const [profileBloodGroup, setProfileBloodGroup] = useState('Unknown');
  const [profileAllergies, setProfileAllergies] = useState('');
  const [profileChronicConditions, setProfileChronicConditions] = useState('');
  const [profileCurrentMedications, setProfileCurrentMedications] = useState('');
  const [profileEmergencyName, setProfileEmergencyName] = useState('');
  const [profileEmergencyPhone, setProfileEmergencyPhone] = useState('');
  const [profileEmergencyRelation, setProfileEmergencyRelation] = useState('Spouse');
  const [profileAddress, setProfileAddress] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const fetchPatientData = async () => {
    try {
      setLoading(true);
      const [profileRes, apptsRes, docsRes] = await Promise.all([
        api.getPatientProfile().catch(() => null),
        api.getPatientAppointments().catch(() => ({ appointments: [], upcoming: [], past: [] })),
        api.getDoctors().catch(() => ({ doctors: [] })),
      ]);

      if (profileRes?.patient) {
        setProfile(profileRes.patient);
        setProfilePhone(profileRes.patient.phone || '');
        setProfileDob(profileRes.patient.dateOfBirth || '');
        setProfileGender(profileRes.patient.gender || 'Prefer not to say');
        setProfileBloodGroup(profileRes.patient.bloodGroup || 'Unknown');
        setProfileAllergies(profileRes.patient.allergies || '');
        setProfileChronicConditions(profileRes.patient.chronicConditions || '');
        setProfileCurrentMedications(profileRes.patient.currentMedications || '');
        setProfileEmergencyName(profileRes.patient.emergencyContactName || '');
        setProfileEmergencyPhone(profileRes.patient.emergencyContactPhone || '');
        setProfileEmergencyRelation(profileRes.patient.emergencyContactRelation || 'Spouse');
        setProfileAddress(profileRes.patient.address || '');
      }

      if (apptsRes) {
        setAppointments(apptsRes.appointments || []);
        setUpcomingList(apptsRes.upcoming || []);
        setPastList(apptsRes.past || []);
      }

      if (docsRes?.doctors) {
        const activeDocs = docsRes.doctors.filter((d) => d.isActive !== false);
        setDoctors(activeDocs);
        if (activeDocs.length > 0) {
          setSelectedDoctorId((prev) => prev || activeDocs[0]._id);
        }
      }
    } catch (err) {
      console.error('Error fetching patient portal data:', err);
      addToast(err.message || 'Failed to load patient records', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatientData();
  }, []);

  // Fetch slots whenever selected doctor or date changes
  useEffect(() => {
    if (!selectedDoctorId || !selectedDate) return;

    let isMounted = true;
    const fetchSlots = async () => {
      setSlotsLoading(true);
      setSelectedSlot(null);
      try {
        const res = await api.getDoctorSlots(selectedDoctorId, selectedDate);
        if (isMounted) {
          setSlots(res.slots || []);
        }
      } catch (err) {
        if (isMounted) {
          setSlots([]);
        }
      } finally {
        if (isMounted) {
          setSlotsLoading(false);
        }
      }
    };

    fetchSlots();
    return () => {
      isMounted = false;
    };
  }, [selectedDoctorId, selectedDate]);

  const handleBookAppointment = async (e) => {
    e.preventDefault();
    if (!selectedDoctorId || !selectedSlot) {
      addToast('Please choose an available appointment time slot.', 'warning');
      return;
    }

    setBookingInProgress(true);
    try {
      const res = await api.patientBookAppointment({
        doctorId: selectedDoctorId,
        startTime: selectedSlot.startTime,
        reasonForVisit: reasonForVisit.trim() || 'Consultation',
      });

      addToast(res.message || 'Appointment scheduled successfully!', 'success');
      setReasonForVisit('');
      setSelectedSlot(null);
      setActiveTab('upcoming');
      await fetchPatientData();
    } catch (err) {
      addToast(err.message || 'Could not complete appointment booking.', 'error');
    } finally {
      setBookingInProgress(false);
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancelModalAppointment) return;

    setCancelLoading(true);
    try {
      const res = await api.cancelPatientAppointment(
        cancelModalAppointment._id,
        cancelReason || 'Cancelled by patient via portal'
      );
      addToast(res.message || 'Appointment cancelled successfully.', 'success');
      setCancelModalAppointment(null);
      setCancelReason('');
      await fetchPatientData();
    } catch (err) {
      addToast(err.message || 'Failed to cancel appointment', 'error');
    } finally {
      setCancelLoading(false);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const res = await api.updatePatientProfile({
        phone: profilePhone,
        dateOfBirth: profileDob,
        gender: profileGender,
        bloodGroup: profileBloodGroup,
        allergies: profileAllergies,
        chronicConditions: profileChronicConditions,
        currentMedications: profileCurrentMedications,
        emergencyContactName: profileEmergencyName,
        emergencyContactPhone: profileEmergencyPhone,
        emergencyContactRelation: profileEmergencyRelation,
        address: profileAddress,
      });
      if (res.patient) {
        setProfile(res.patient);
      }
      addToast('Health profile details updated successfully.', 'success');
    } catch (err) {
      addToast(err.message || 'Failed to update profile.', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const formatDateTime = (isoStr) => {
    if (!isoStr) return '—';
    try {
      const d = new Date(isoStr);
      return (
        d.toLocaleDateString('en-US', {
          weekday: 'short',
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }) +
        ', ' +
        d.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        })
      );
    } catch (e) {
      return isoStr;
    }
  };

  const formatTimeOnly = (isoStr) => {
    if (!isoStr) return '—';
    try {
      const d = new Date(isoStr);
      return d.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch (e) {
      return isoStr;
    }
  };

  if (loading) {
    return (
      <div className="main-content" style={{ padding: '60px 20px', textAlign: 'center' }}>
        <RefreshCw size={28} className="animate-spin" style={{ margin: '0 auto 12px auto', color: 'var(--primary)' }} />
        <p style={{ color: 'var(--text-muted)' }}>Loading your patient portal...</p>
      </div>
    );
  }

  const patientCode = profile?.patientId || user?.patientCode || 'PAT-PORTAL';
  const patientFullName = profile?.fullName || user?.name || 'Patient';

  return (
    <div className="main-content" style={{ paddingBottom: '60px' }}>
      {/* Patient Header Card */}
      <div
        className="card"
        style={{
          marginTop: '0px',
          background: 'linear-gradient(135deg, #042f2e 0%, #115e59 100%)',
          color: '#ffffff',
          borderRadius: 'var(--radius-lg)',
          padding: '28px 32px',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-lg)',
        }}
        id="patient-header-banner"
      >
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span
                style={{
                  background: 'rgba(255,255,255,0.18)',
                  backdropFilter: 'blur(4px)',
                  padding: '3px 10px',
                  borderRadius: '20px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                }}
              >
                PATIENT PORTAL
              </span>
              <span
                style={{
                  background: '#2dd4bf',
                  color: '#042f2e',
                  padding: '3px 10px',
                  borderRadius: '20px',
                  fontSize: '0.78rem',
                  fontWeight: 800,
                  letterSpacing: '0.04em',
                }}
                id="patient-badge-id"
              >
                {patientCode}
              </span>
            </div>

            <h1 style={{ color: '#ffffff', fontSize: '1.8rem', fontWeight: 700, margin: '4px 0' }}>
              Welcome, {patientFullName}
            </h1>
            <p style={{ color: '#ccfbf1', fontSize: '0.9rem', maxWidth: '600px', lineHeight: 1.5 }}>
              Access your upcoming outpatient clinic appointments, book visits with doctors, and review your completed clinical consultation summaries.
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginTop: 14, fontSize: '0.84rem', color: '#e6fffa', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Mail size={15} color="#5eead4" />
                <span>{profile?.email || user?.email}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Phone size={15} color="#5eead4" />
                <span>{profile?.phone || 'No phone registered'}</span>
              </div>
              {profile?.gender && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <User size={15} color="#5eead4" />
                  <span>{profile.gender}</span>
                </div>
              )}
              {profile?.bloodGroup && profile.bloodGroup !== 'Unknown' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Heart size={15} color="#5eead4" />
                  <span>Blood: {profile.bloodGroup}</span>
                </div>
              )}
              {profile?.allergies && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <ShieldCheck size={15} color="#5eead4" />
                  <span>Allergies: {profile.allergies}</span>
                </div>
              )}
            </div>
          </div>

          <button
            type="button"
            className="btn"
            style={{
              background: '#2dd4bf',
              color: '#042f2e',
              fontWeight: 700,
              padding: '12px 20px',
              borderRadius: 'var(--radius-md)',
              boxShadow: '0 4px 12px rgba(45, 212, 191, 0.35)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: '0.92rem',
            }}
            onClick={() => setActiveTab('book')}
            id="quick-book-button"
          >
            <PlusCircle size={18} />
            <span>Book New Appointment</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div
        style={{
          display: 'flex',
          gap: 10,
          margin: '24px 0 20px 0',
          borderBottom: '1px solid var(--border-color)',
          paddingBottom: '4px',
          flexWrap: 'wrap',
        }}
        id="patient-tabs-bar"
      >
        <button
          type="button"
          onClick={() => setActiveTab('upcoming')}
          id="tab-upcoming"
          style={{
            padding: '10px 18px',
            fontSize: '0.92rem',
            fontWeight: 600,
            border: 'none',
            borderBottom: activeTab === 'upcoming' ? '3px solid var(--primary)' : '3px solid transparent',
            background: 'none',
            color: activeTab === 'upcoming' ? 'var(--primary)' : 'var(--text-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            transition: 'all 0.15s ease',
          }}
        >
          <Calendar size={18} />
          <span>Upcoming Appointments</span>
          {upcomingList.length > 0 && (
            <span
              style={{
                background: 'var(--primary)',
                color: '#fff',
                padding: '1px 8px',
                borderRadius: '12px',
                fontSize: '0.74rem',
                fontWeight: 700,
              }}
            >
              {upcomingList.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('book')}
          id="tab-book"
          style={{
            padding: '10px 18px',
            fontSize: '0.92rem',
            fontWeight: 600,
            border: 'none',
            borderBottom: activeTab === 'book' ? '3px solid var(--primary)' : '3px solid transparent',
            background: 'none',
            color: activeTab === 'book' ? 'var(--primary)' : 'var(--text-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            transition: 'all 0.15s ease',
          }}
        >
          <PlusCircle size={18} />
          <span>Book an Appointment</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('history')}
          id="tab-history"
          style={{
            padding: '10px 18px',
            fontSize: '0.92rem',
            fontWeight: 600,
            border: 'none',
            borderBottom: activeTab === 'history' ? '3px solid var(--primary)' : '3px solid transparent',
            background: 'none',
            color: activeTab === 'history' ? 'var(--primary)' : 'var(--text-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            transition: 'all 0.15s ease',
          }}
        >
          <FileText size={18} />
          <span>Past Records & Clinical Advice</span>
          {pastList.length > 0 && (
            <span
              style={{
                background: '#f1f5f9',
                color: '#475569',
                padding: '1px 8px',
                borderRadius: '12px',
                fontSize: '0.74rem',
                fontWeight: 700,
              }}
            >
              {pastList.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('profile')}
          id="tab-profile"
          style={{
            padding: '10px 18px',
            fontSize: '0.92rem',
            fontWeight: 600,
            border: 'none',
            borderBottom: activeTab === 'profile' ? '3px solid var(--primary)' : '3px solid transparent',
            background: 'none',
            color: activeTab === 'profile' ? 'var(--primary)' : 'var(--text-muted)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            transition: 'all 0.15s ease',
          }}
        >
          <User size={18} />
          <span>My Health Profile</span>
        </button>
      </div>

      {/* TAB 1: UPCOMING APPOINTMENTS */}
      {activeTab === 'upcoming' && (
        <div>
          {upcomingList.length === 0 ? (
            <div className="card empty-state" id="patient-no-upcoming-card">
              <div className="empty-state-icon" style={{ background: '#f0fdfa', color: '#0d9488' }}>
                <Calendar size={30} />
              </div>
              <h3>No Upcoming Appointments</h3>
              <p style={{ maxWidth: '440px', margin: '8px auto 20px auto' }}>
                You have no pending clinic visits at this time. If you need medical consultation or a preventive checkup, schedule a slot below.
              </p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setActiveTab('book')}
                id="book-first-appt-btn"
              >
                <PlusCircle size={16} />
                <span>Book an Appointment</span>
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '16px' }} id="patient-upcoming-list">
              {upcomingList.map((apt) => {
                const docName = apt.doctorId?.displayName || 'Outpatient Physician';
                const docSpecialty = apt.doctorId?.specialty || 'General Practice';
                const isBooked = apt.status === 'booked';

                return (
                  <div
                    key={apt._id}
                    className="card"
                    style={{
                      padding: '20px 24px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '16px',
                      borderLeft: '4px solid var(--primary)',
                    }}
                    id={`upcoming-appt-${apt._id}`}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                        <span className={`status-badge ${apt.status}`}>
                          {apt.status === 'booked'
                            ? 'Booked & Confirmed'
                            : apt.status === 'checked_in'
                            ? 'Checked In — In Reception'
                            : apt.status === 'in_consultation'
                            ? 'In Consultation with Doctor'
                            : apt.status}
                        </span>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          ID: {apt._id.slice(-6).toUpperCase()}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-dark)' }}>
                        <Stethoscope size={18} color="var(--primary)" />
                        <span>{docName}</span>
                        <span style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--text-muted)' }}>
                          ({docSpecialty})
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 8, fontSize: '0.88rem', color: 'var(--text-muted)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Calendar size={15} color="var(--primary)" />
                          <span>{formatDateTime(apt.startTime)}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Clock size={15} color="var(--primary)" />
                          <span>Slot: {formatTimeOnly(apt.startTime)} – {formatTimeOnly(apt.endTime)} (20m)</span>
                        </div>
                      </div>

                      {apt.reasonForVisit && (
                        <div style={{ marginTop: 8, fontSize: '0.84rem', color: 'var(--text-dark)' }}>
                          <strong>Reason:</strong> {apt.reasonForVisit}
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {isBooked ? (
                        <button
                          type="button"
                          className="btn btn-danger"
                          style={{ padding: '8px 14px', fontSize: '0.84rem' }}
                          onClick={() => {
                            setCancelModalAppointment(apt);
                            setCancelReason('');
                          }}
                          id={`cancel-appt-btn-${apt._id}`}
                        >
                          <XCircle size={15} />
                          <span>Cancel Booking</span>
                        </button>
                      ) : (
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', textAlign: 'right' }}>
                          <em>Checked in / In progress. Cancellation is locked.</em>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: BOOK AN APPOINTMENT */}
      {activeTab === 'book' && (
        <div className="card" style={{ padding: '28px 32px' }} id="patient-booking-card">
          <div style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: '1.3rem', color: 'var(--text-dark)' }}>Book an Outpatient Appointment</h2>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', marginTop: 4 }}>
              Choose a doctor and date to see real-time 20-minute available consultation slots.
            </p>
          </div>

          <form onSubmit={handleBookAppointment}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18, marginBottom: 20 }}>
              {/* Doctor Selector */}
              <div className="form-group">
                <label className="form-label" htmlFor="patient-book-doctor">
                  Select Clinic Physician *
                </label>
                <select
                  id="patient-book-doctor"
                  className="form-input"
                  value={selectedDoctorId}
                  onChange={(e) => setSelectedDoctorId(e.target.value)}
                  required
                >
                  {doctors.map((doc) => (
                    <option key={doc._id} value={doc._id}>
                      {doc.displayName} — {doc.specialty}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date Selector */}
              <div className="form-group">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <label className="form-label" htmlFor="patient-book-date" style={{ margin: 0 }}>
                    Appointment Date *
                  </label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      type="button"
                      id="quick-date-today"
                      onClick={() => setSelectedDate(getTodayStr())}
                      style={{
                        padding: '2px 8px',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        borderRadius: 4,
                        border: '1px solid var(--border-color)',
                        background: selectedDate === getTodayStr() ? 'var(--primary)' : '#f8fafc',
                        color: selectedDate === getTodayStr() ? '#fff' : 'var(--text-muted)',
                        cursor: 'pointer',
                      }}
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      id="quick-date-tomorrow"
                      onClick={() => setSelectedDate(getTomorrowStr())}
                      style={{
                        padding: '2px 8px',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        borderRadius: 4,
                        border: '1px solid var(--border-color)',
                        background: selectedDate === getTomorrowStr() ? 'var(--primary)' : '#f8fafc',
                        color: selectedDate === getTomorrowStr() ? '#fff' : 'var(--text-muted)',
                        cursor: 'pointer',
                      }}
                    >
                      Tomorrow
                    </button>
                    <button
                      type="button"
                      id="quick-date-dayafter"
                      onClick={() => setSelectedDate(getDayAfterTomorrowStr())}
                      style={{
                        padding: '2px 8px',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        borderRadius: 4,
                        border: '1px solid var(--border-color)',
                        background: selectedDate === getDayAfterTomorrowStr() ? 'var(--primary)' : '#f8fafc',
                        color: selectedDate === getDayAfterTomorrowStr() ? '#fff' : 'var(--text-muted)',
                        cursor: 'pointer',
                      }}
                    >
                      +2 Days
                    </button>
                  </div>
                </div>
                <input
                  type="date"
                  id="patient-book-date"
                  className="form-input"
                  value={selectedDate}
                  min={getTodayStr()}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Time Slot Picker */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <label className="form-label" style={{ margin: 0 }}>
                  Available 20-Minute Slots (with 5-minute prep gap)
                </label>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Mon–Sat 09:00–18:00 (Lunch 12:00–12:45, Tea 15:00–15:15) | Sun 10:00–16:00
                </span>
              </div>

              {slotsLoading ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  <RefreshCw size={20} className="animate-spin" style={{ margin: '0 auto 8px auto' }} />
                  <span>Loading schedule slots...</span>
                </div>
              ) : slots.length === 0 ? (
                <div
                  style={{
                    padding: '20px',
                    background: '#f8fafc',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-color)',
                    textAlign: 'center',
                    fontSize: '0.88rem',
                    color: 'var(--text-muted)',
                  }}
                >
                  No doctor schedule active for this date. Please pick another date.
                </div>
              ) : (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                    gap: 10,
                    maxHeight: '260px',
                    overflowY: 'auto',
                    padding: '8px',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-md)',
                    background: '#f8fafc',
                  }}
                  id="patient-slots-grid"
                >
                  {slots.map((s, idx) => {
                    const isAvailable = Boolean(s.isAvailable);
                    const isSelected = selectedSlot?.startTime === s.startTime;

                    let bg = '#ffffff';
                    let borderColor = 'var(--border-color)';
                    let color = 'var(--text-dark)';
                    let cursor = 'pointer';

                    if (!isAvailable) {
                      bg = '#e2e8f0';
                      borderColor = '#cbd5e1';
                      color = '#94a3b8';
                      cursor = 'not-allowed';
                    } else if (isSelected) {
                      bg = 'var(--primary)';
                      borderColor = 'var(--primary)';
                      color = '#ffffff';
                    }

                    return (
                      <button
                        key={idx}
                        type="button"
                        id={`patient-slot-${s.time.replace(':', '-')}`}
                        disabled={!isAvailable}
                        onClick={() => setSelectedSlot(s)}
                        style={{
                          padding: '10px 8px',
                          borderRadius: 'var(--radius-sm)',
                          border: `1px solid ${borderColor}`,
                          background: bg,
                          color: color,
                          cursor: cursor,
                          textAlign: 'center',
                          transition: 'all 0.15s ease',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 2,
                        }}
                        title={
                          !isAvailable
                            ? s.reasonUnavailable || 'Slot unavailable'
                            : `${s.displayTime} - ${s.displayEndTime} (20m + 5m buffer)`
                        }
                      >
                        <span style={{ fontWeight: 700, fontSize: '0.86rem' }}>{s.displayTime || s.time}</span>
                        <span style={{ fontSize: '0.68rem', opacity: isSelected ? 0.9 : 0.7 }}>
                          {isAvailable ? 'Available' : s.reasonUnavailable || 'Unavailable'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Reason for Visit */}
            <div className="form-group" style={{ marginBottom: 20 }}>
              <label className="form-label" htmlFor="patient-reason">
                Reason for Outpatient Visit / Symptoms
              </label>
              <textarea
                id="patient-reason"
                className="form-input"
                rows={3}
                placeholder="Briefly describe your symptoms or reason for visit (e.g. routine checkup, sore throat, medication review)..."
                value={reasonForVisit}
                onChange={(e) => setReasonForVisit(e.target.value)}
              />
            </div>

            {/* Submit */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
              <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)' }}>
                {selectedSlot ? (
                  <span>
                    Selected Slot: <strong>{selectedDate} at {selectedSlot.displayTime || selectedSlot.time}</strong> (20 mins)
                  </span>
                ) : (
                  <span>Please choose an available slot chip above.</span>
                )}
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={!selectedSlot || bookingInProgress}
                style={{ padding: '12px 24px' }}
                id="patient-confirm-booking-btn"
              >
                <span>{bookingInProgress ? 'Reserving Slot...' : 'Confirm Appointment'}</span>
                <ChevronRight size={16} />
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 3: PAST RECORDS & DOCTOR VISIT SUMMARIES */}
      {activeTab === 'history' && (
        <div>
          <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: '0.86rem' }}>
            <Info size={16} color="var(--primary)" />
            <span>
              Outpatient records contain discharge advice and clinical summaries recorded by your physician upon visit completion.
            </span>
          </div>

          {pastList.length === 0 ? (
            <div className="card empty-state" id="patient-no-history-card">
              <div className="empty-state-icon" style={{ background: '#f8fafc', color: '#64748b' }}>
                <FileText size={28} />
              </div>
              <h3>No Past Medical Records</h3>
              <p style={{ maxWidth: '400px', margin: '8px auto' }}>
                Completed visit notes and historical clinic appointments will appear here after consultations.
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '16px' }} id="patient-past-records-list">
              {pastList.map((apt) => {
                const isCompleted = apt.status === 'completed';
                const docName = apt.doctorId?.displayName || 'Outpatient Doctor';
                const docSpecialty = apt.doctorId?.specialty || 'General Practice';

                return (
                  <div
                    key={apt._id}
                    className="card"
                    style={{
                      padding: '22px 26px',
                      borderLeft: isCompleted ? '4px solid #10b981' : '4px solid #cbd5e1',
                    }}
                    id={`past-appt-${apt._id}`}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                          <span className={`status-badge ${apt.status}`}>
                            {apt.status === 'completed'
                              ? 'Visit Completed'
                              : apt.status === 'cancelled'
                              ? 'Cancelled'
                              : apt.status === 'no_show'
                              ? 'No-Show'
                              : apt.status}
                          </span>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {formatDateTime(apt.startTime)}
                          </span>
                        </div>

                        <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-dark)', marginTop: 4 }}>
                          Consultation with {docName} ({docSpecialty})
                        </div>

                        {apt.reasonForVisit && (
                          <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginTop: 4 }}>
                            <strong>Presented Reason:</strong> {apt.reasonForVisit}
                          </div>
                        )}
                      </div>

                      <div style={{ textAlign: 'right', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        Slot: {formatTimeOnly(apt.startTime)} – {formatTimeOnly(apt.endTime)}
                      </div>
                    </div>

                    {/* CLINICAL VISIT SUMMARY (Visible to Patient) */}
                    {isCompleted && (
                      <div
                        style={{
                          marginTop: '16px',
                          padding: '14px 18px',
                          background: '#f0fdf4',
                          border: '1px solid #bbf7d0',
                          borderRadius: 'var(--radius-md)',
                        }}
                        id={`visit-summary-${apt._id}`}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#166534', fontWeight: 700, fontSize: '0.84rem', marginBottom: 6 }}>
                          <HeartPulse size={16} />
                          <span>Physician Clinical Notes & Recommendations:</span>
                        </div>
                        <div style={{ fontSize: '0.88rem', color: '#14532d', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                          {apt.visitSummary ? apt.visitSummary : 'No detailed notes entered for this consultation.'}
                        </div>
                      </div>
                    )}

                    {apt.status === 'cancelled' && apt.cancellationReason && (
                      <div
                        style={{
                          marginTop: '12px',
                          padding: '10px 14px',
                          background: '#fff1f2',
                          border: '1px solid #fecdd3',
                          borderRadius: 'var(--radius-md)',
                          fontSize: '0.82rem',
                          color: '#9f1239',
                        }}
                      >
                        <strong>Cancellation Note:</strong> {apt.cancellationReason}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 4: MY HEALTH PROFILE */}
      {activeTab === 'profile' && (
        <div className="card" style={{ maxWidth: '780px', margin: '0 auto', padding: '32px 36px' }} id="patient-profile-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 'var(--radius-md)',
                background: 'linear-gradient(135deg, #0d9488 0%, #06b6d4 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
              }}
            >
              <HeartPulse size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.35rem', margin: 0, fontWeight: 700 }}>My Health & Outpatient Profile</h2>
              <p style={{ fontSize: '0.86rem', color: 'var(--text-muted)', margin: 0 }}>
                Manage your outpatient contact info, optional health history, and emergency contacts.
              </p>
            </div>
          </div>

          <form onSubmit={handleSaveProfile} style={{ marginTop: 24 }}>
            {/* SECTION 1: Identity & Contact */}
            <div style={{ marginBottom: 28 }}>
              <div
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: 'var(--primary)',
                  letterSpacing: '0.05em',
                  marginBottom: 14,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <User size={14} />
                <span>1. Patient Identity & Contact Information</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">CareDesk Patient Code</label>
                  <input
                    type="text"
                    className="form-input"
                    value={patientCode}
                    disabled
                    style={{ background: '#f1f5f9', fontWeight: 700 }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Full Legal Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={patientFullName}
                    disabled
                    style={{ background: '#f1f5f9' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Registered Email</label>
                  <input
                    type="text"
                    className="form-input"
                    value={profile?.email || user?.email || ''}
                    disabled
                    style={{ background: '#f1f5f9' }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="edit-phone">
                    Phone Number <span style={{ color: '#be123c' }}>*</span>
                  </label>
                  <input
                    type="tel"
                    id="edit-phone"
                    className="form-input"
                    value={profilePhone}
                    onChange={(e) => setProfilePhone(e.target.value)}
                    placeholder="+91-XXXXXXXXXX"
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-dob">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    id="edit-dob"
                    className="form-input"
                    value={profileDob}
                    onChange={(e) => setProfileDob(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="edit-gender">
                    Gender
                  </label>
                  <select
                    id="edit-gender"
                    className="form-input"
                    value={profileGender}
                    onChange={(e) => setProfileGender(e.target.value)}
                  >
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                    <option value="Other">Other</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="edit-address">
                  Residential Address <span className="optional">(Optional)</span>
                </label>
                <input
                  type="text"
                  id="edit-address"
                  className="form-input"
                  placeholder="Street address, Apartment / Suite, City, Postal Code"
                  value={profileAddress}
                  onChange={(e) => setProfileAddress(e.target.value)}
                />
              </div>
            </div>

            {/* SECTION 2: Optional Clinical & Medical Details */}
            <div
              style={{
                marginBottom: 28,
                padding: '20px',
                background: '#f8fafc',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-color)',
              }}
            >
              <div
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: '#0f766e',
                  letterSpacing: '0.05em',
                  marginBottom: 6,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Heart size={14} color="#0d9488" />
                <span>2. Clinical & Medical Information (Optional)</span>
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 16 }}>
                Filling this out is completely voluntary. It assists your doctor during consultations to check for contraindications and drug safety.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-blood-group">
                    Blood Group <span className="optional">(Optional)</span>
                  </label>
                  <select
                    id="edit-blood-group"
                    className="form-input"
                    value={profileBloodGroup}
                    onChange={(e) => setProfileBloodGroup(e.target.value)}
                  >
                    <option value="Unknown">Unknown / Not Tested</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="edit-allergies">
                    Known Allergies (Food / Drug) <span className="optional">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    id="edit-allergies"
                    className="form-input"
                    placeholder="e.g. Penicillin, Peanuts, Sulfa antibiotics, NSAIDs (or None)"
                    value={profileAllergies}
                    onChange={(e) => setProfileAllergies(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-chronic">
                    Chronic Conditions / Medical History <span className="optional">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    id="edit-chronic"
                    className="form-input"
                    placeholder="e.g. Asthma, Hypertension, Type 2 Diabetes, Migraine (or None)"
                    value={profileChronicConditions}
                    onChange={(e) => setProfileChronicConditions(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="edit-medications">
                    Current Medications / Supplements <span className="optional">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    id="edit-medications"
                    className="form-input"
                    placeholder="e.g. Metformin 500mg, Daily Vitamin D, Inhaler PRN (or None)"
                    value={profileCurrentMedications}
                    onChange={(e) => setProfileCurrentMedications(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* SECTION 3: Emergency Contact */}
            <div
              style={{
                marginBottom: 24,
                padding: '20px',
                background: '#fdf4ff',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid #f5d0fe',
              }}
            >
              <div
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: '#86198f',
                  letterSpacing: '0.05em',
                  marginBottom: 6,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Phone size={14} color="#a21caf" />
                <span>3. Emergency Contact Details (Optional)</span>
              </div>
              <p style={{ fontSize: '0.82rem', color: '#701a75', marginBottom: 16 }}>
                Whom should the clinic notify in an emergency situation?
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr 1fr', gap: 14 }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="edit-emergency-name">
                    Contact Name
                  </label>
                  <input
                    type="text"
                    id="edit-emergency-name"
                    className="form-input"
                    placeholder="e.g. Jane Dent"
                    value={profileEmergencyName}
                    onChange={(e) => setProfileEmergencyName(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="edit-emergency-phone">
                    Emergency Phone
                  </label>
                  <input
                    type="tel"
                    id="edit-emergency-phone"
                    className="form-input"
                    placeholder="+91-XXXXXXXXXX"
                    value={profileEmergencyPhone}
                    onChange={(e) => setProfileEmergencyPhone(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="edit-emergency-relation">
                    Relationship
                  </label>
                  <select
                    id="edit-emergency-relation"
                    className="form-input"
                    value={profileEmergencyRelation}
                    onChange={(e) => setProfileEmergencyRelation(e.target.value)}
                  >
                    <option value="Spouse">Spouse</option>
                    <option value="Parent">Parent</option>
                    <option value="Child">Child</option>
                    <option value="Sibling">Sibling</option>
                    <option value="Guardian">Guardian</option>
                    <option value="Friend">Friend</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ width: '100%', padding: '13px', fontSize: '0.94rem' }}
              disabled={savingProfile}
              id="save-profile-btn"
            >
              <span>{savingProfile ? 'Updating Health Profile...' : 'Save Health Profile Changes'}</span>
            </button>
          </form>
        </div>
      )}

      {/* CANCELLATION MODAL */}
      {cancelModalAppointment && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: '440px' }} id="cancel-modal">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: 'var(--status-cancelled-bg)',
                  color: 'var(--status-cancelled-text)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <AlertCircle size={22} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.15rem' }}>Cancel Appointment</h3>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Slot will be released for other patients
                </div>
              </div>
            </div>

            <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Are you sure you want to cancel your scheduled visit with{' '}
              <strong>{cancelModalAppointment.doctorId?.displayName || 'your physician'}</strong> on{' '}
              {formatDateTime(cancelModalAppointment.startTime)}?
            </p>

            <div className="form-group" style={{ marginTop: 14 }}>
              <label className="form-label" htmlFor="cancel-reason-input">
                Reason for cancellation (optional):
              </label>
              <input
                type="text"
                id="cancel-reason-input"
                className="form-input"
                placeholder="e.g. Schedule conflict, feeling better..."
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setCancelModalAppointment(null)}
                disabled={cancelLoading}
              >
                Keep Appointment
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleConfirmCancel}
                disabled={cancelLoading}
                id="confirm-cancel-btn"
              >
                <span>{cancelLoading ? 'Cancelling...' : 'Yes, Cancel Appointment'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
