import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { api } from '../services/api';
import { useToast } from './Toast';
import { Calendar, Clock, Stethoscope, User, AlertCircle, CheckCircle2 } from 'lucide-react';

export const BookAppointmentModal = ({
  isOpen,
  onClose,
  preselectedPatient = null,
  onAppointmentBooked,
}) => {
  const { addToast } = useToast();

  const [doctors, setDoctors] = useState([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [patientSearch, setPatientSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);

  const getTodayStr = () => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const [selectedDate, setSelectedDate] = useState(getTodayStr());

  const [slotData, setSlotData] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [reasonForVisit, setReasonForVisit] = useState('');
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Load doctors on mount
  useEffect(() => {
    if (isOpen) {
      api.getDoctors()
        .then((res) => {
          if (res.doctors && res.doctors.length > 0) {
            setDoctors(res.doctors);
            setSelectedDoctorId(res.doctors[0]._id);
          }
        })
        .catch((err) => console.error('Failed to load doctors:', err));
    }
  }, [isOpen]);

  // Handle preselected patient
  useEffect(() => {
    if (preselectedPatient) {
      setSelectedPatientId(preselectedPatient._id);
      setPatientSearch(`${preselectedPatient.fullName} (${preselectedPatient.patientId})`);
    } else {
      setSelectedPatientId('');
      setPatientSearch('');
    }
    setErrorMessage('');
    setSelectedSlot(null);
  }, [preselectedPatient, isOpen]);

  // Search patients as user types (if not preselected)
  useEffect(() => {
    if (!preselectedPatient && patientSearch.trim().length >= 1) {
      const timer = setTimeout(() => {
        api.searchPatients(patientSearch.trim())
          .then((res) => setSearchResults(res.patients || []))
          .catch(() => setSearchResults([]));
      }, 250);
      return () => clearTimeout(timer);
    } else {
      setSearchResults([]);
    }
  }, [patientSearch, preselectedPatient]);

  // Fetch slots whenever doctor or date changes
  useEffect(() => {
    if (isOpen && selectedDoctorId && selectedDate) {
      setLoadingSlots(true);
      setErrorMessage('');
      setSelectedSlot(null);

      api.getDoctorSlots(selectedDoctorId, selectedDate)
        .then((res) => {
          setSlotData(res);
        })
        .catch((err) => {
          setErrorMessage(err.message || 'Failed to fetch doctor slots.');
          setSlotData(null);
        })
        .finally(() => setLoadingSlots(false));
    }
  }, [isOpen, selectedDoctorId, selectedDate]);

  const handleBooking = async (e) => {
    e.preventDefault();
    if (!selectedPatientId) {
      setErrorMessage('Please search and select a patient first.');
      return;
    }
    if (!selectedDoctorId) {
      setErrorMessage('Please select a doctor.');
      return;
    }
    if (!selectedSlot) {
      setErrorMessage('Please click to select an available appointment slot.');
      return;
    }

    setSubmitting(true);
    setErrorMessage('');

    try {
      const res = await api.bookAppointment({
        patientId: selectedPatientId,
        doctorId: selectedDoctorId,
        startTime: selectedSlot.startTime,
        reasonForVisit,
      });

      addToast('Appointment successfully booked!', 'success');
      if (onAppointmentBooked) {
        onAppointmentBooked(res.appointment);
      }
      onClose();
    } catch (err) {
      setErrorMessage(err.message || 'Failed to book appointment.');
      // Refresh slots on collision
      if (err.status === 409) {
        api.getDoctorSlots(selectedDoctorId, selectedDate)
          .then((res) => setSlotData(res))
          .catch(() => {});
      }
    } finally {
      setSubmitting(false);
    }
  };

  const morningSlots = slotData?.slots?.filter((s) => {
    const hour = parseInt(s.time.split(':')[0], 10);
    return hour < 12;
  }) || [];

  const afternoonSlots = slotData?.slots?.filter((s) => {
    const hour = parseInt(s.time.split(':')[0], 10);
    return hour >= 12;
  }) || [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Book Outpatient Appointment"
      id="book-appointment-modal"
      large={true}
      footer={
        <>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={submitting}
            id="cancel-book-modal-btn"
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleBooking}
            disabled={submitting || !selectedSlot || !selectedPatientId}
            id="submit-booking-btn"
          >
            <CheckCircle2 size={16} />
            <span>{submitting ? 'Booking...' : 'Confirm Appointment Booking'}</span>
          </button>
        </>
      }
    >
      {errorMessage && (
        <div className="alert alert-error" id="booking-error-alert">
          <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Patient Selection */}
      <div className="form-group">
        <label className="form-label">
          Patient <span style={{ color: 'var(--status-cancelled-text)' }}>*</span>
        </label>
        {preselectedPatient ? (
          <div
            style={{
              padding: '10px 14px',
              background: '#f1f5f9',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <strong>{preselectedPatient.fullName}</strong>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginLeft: 8 }}>
                ({preselectedPatient.patientId} • {preselectedPatient.phone})
              </span>
            </div>
            <span className="badge badge-booked">Preselected</span>
          </div>
        ) : (
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              className="form-input"
              id="patient-search-input"
              placeholder="Search existing patient by Name, Phone, or ID..."
              value={patientSearch}
              onChange={(e) => {
                setPatientSearch(e.target.value);
                setSelectedPatientId('');
              }}
            />
            {searchResults.length > 0 && !selectedPatientId && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  background: '#ffffff',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: 'var(--shadow-lg)',
                  maxHeight: '200px',
                  overflowY: 'auto',
                  zIndex: 50,
                  marginTop: '4px',
                }}
              >
                {searchResults.map((pat) => (
                  <div
                    key={pat._id}
                    id={`patient-option-${pat.patientId}`}
                    onClick={() => {
                      setSelectedPatientId(pat._id);
                      setPatientSearch(`${pat.fullName} (${pat.patientId})`);
                      setSearchResults([]);
                    }}
                    style={{
                      padding: '10px 14px',
                      cursor: 'pointer',
                      borderBottom: '1px solid #f1f5f9',
                      fontSize: '0.85rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '#ffffff')}
                  >
                    <div>
                      <strong>{pat.fullName}</strong> ({pat.patientId})
                    </div>
                    <span style={{ color: 'var(--text-muted)' }}>{pat.phone}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        {/* Doctor Selection */}
        <div className="form-group">
          <label className="form-label">
            Attending Doctor <span style={{ color: 'var(--status-cancelled-text)' }}>*</span>
          </label>
          <select
            className="form-select"
            id="doctor-select"
            value={selectedDoctorId}
            onChange={(e) => setSelectedDoctorId(e.target.value)}
          >
            {doctors.map((doc) => (
              <option key={doc._id} value={doc._id}>
                {doc.displayName} ({doc.specialty})
              </option>
            ))}
          </select>
        </div>

        {/* Date Selection */}
        <div className="form-group">
          <label className="form-label">
            Appointment Date <span style={{ color: 'var(--status-cancelled-text)' }}>*</span>
          </label>
          <input
            type="date"
            className="form-input"
            id="appointment-date-input"
            value={selectedDate}
            min={getTodayStr()}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
        </div>
      </div>

      {/* Available Slots Grid */}
      <div className="form-group" style={{ marginTop: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 }}>
          <label className="form-label" style={{ marginBottom: 0 }}>
            Available 20-Minute Slots ({selectedDate})
          </label>
          {slotData && (
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Hours: {slotData.workingHours || 'Not scheduled'} • 5-min prep buffer between slots
            </span>
          )}
        </div>

        {slotData?.breaks && slotData.breaks.length > 0 && (
          <div style={{ display: 'flex', gap: 8, margin: '6px 0 10px 0', flexWrap: 'wrap' }}>
            {slotData.breaks.map((b, idx) => (
              <span
                key={idx}
                style={{
                  fontSize: '0.73rem',
                  padding: '2px 8px',
                  background: '#f1f5f9',
                  border: '1px solid #e2e8f0',
                  borderRadius: 'var(--radius-full)',
                  color: '#475569',
                }}
              >
                ☕ {b.label}: {b.startTime} - {b.endTime}
              </span>
            ))}
            <span
              style={{
                fontSize: '0.73rem',
                padding: '2px 8px',
                background: '#fff1f2',
                border: '1px solid #fecdd3',
                borderRadius: 'var(--radius-full)',
                color: '#be123c',
              }}
            >
              🚨 Evening reserved for Emergencies
            </span>
          </div>
        )}

        {loadingSlots ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Calculating real-time doctor availability...
          </div>
        ) : !slotData || slotData.slots.length === 0 ? (
          <div className="alert alert-info" style={{ marginTop: 10 }}>
            {slotData?.message || 'No scheduled working hours or available slots found for this date.'}
          </div>
        ) : (
          <div style={{ marginTop: 12 }}>
            {morningSlots.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
                  Morning Consultation Slots
                </span>
                <div className="slot-grid">
                  {morningSlots.map((slot) => (
                    <button
                      type="button"
                      key={slot.time}
                      id={`slot-${slot.time}`}
                      disabled={!slot.isAvailable}
                      className={`slot-chip ${!slot.isAvailable ? 'unavailable' : ''} ${
                        selectedSlot?.time === slot.time ? 'selected' : ''
                      }`}
                      onClick={() => setSelectedSlot(slot)}
                      title={slot.reasonUnavailable || `${slot.displayTime} - ${slot.displayEndTime} (20 min + 5m buffer)`}
                    >
                      <div>{slot.displayTime}</div>
                      <div style={{ fontSize: '0.68rem', opacity: 0.85 }}>to {slot.displayEndTime}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {afternoonSlots.length > 0 && (
              <div>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
                  Afternoon Consultation Slots
                </span>
                <div className="slot-grid">
                  {afternoonSlots.map((slot) => (
                    <button
                      type="button"
                      key={slot.time}
                      id={`slot-${slot.time}`}
                      disabled={!slot.isAvailable}
                      className={`slot-chip ${!slot.isAvailable ? 'unavailable' : ''} ${
                        selectedSlot?.time === slot.time ? 'selected' : ''
                      }`}
                      onClick={() => setSelectedSlot(slot)}
                      title={slot.reasonUnavailable || `${slot.displayTime} - ${slot.displayEndTime} (20 min + 5m buffer)`}
                    >
                      <div>{slot.displayTime}</div>
                      <div style={{ fontSize: '0.68rem', opacity: 0.85 }}>to {slot.displayEndTime}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {selectedSlot && (
        <div className="alert alert-success" style={{ padding: '10px 14px', marginTop: 10 }}>
          <CheckCircle2 size={16} />
          <span>
            Selected Slot: <strong>{selectedSlot.displayTime}</strong> on {selectedDate} with{' '}
            {doctors.find((d) => d._id === selectedDoctorId)?.displayName}
          </span>
        </div>
      )}

      {/* Reason for Visit */}
      <div className="form-group" style={{ marginTop: '12px' }}>
        <label className="form-label">
          Reason for Visit <span className="optional">(optional)</span>
        </label>
        <textarea
          className="form-textarea"
          id="reason-for-visit-input"
          rows={2}
          placeholder="e.g. Follow-up consultation, fever, seasonal checkup..."
          value={reasonForVisit}
          onChange={(e) => setReasonForVisit(e.target.value)}
        />
      </div>
    </Modal>
  );
};
