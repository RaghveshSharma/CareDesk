import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { api } from '../services/api';
import { useToast } from './Toast';
import { Calendar, Clock, AlertCircle, CheckCircle2 } from 'lucide-react';

export const RescheduleModal = ({
  isOpen,
  onClose,
  appointment,
  onAppointmentRescheduled,
}) => {
  const { addToast } = useToast();

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
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (isOpen && appointment) {
      const d = new Date(appointment.startTime);
      const apptDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      setSelectedDate(apptDate >= getTodayStr() ? apptDate : getTodayStr());
      setSelectedSlot(null);
      setErrorMessage('');
    }
  }, [isOpen, appointment]);

  useEffect(() => {
    if (isOpen && appointment?.doctorId?._id && selectedDate) {
      setLoadingSlots(true);
      setErrorMessage('');
      setSelectedSlot(null);

      api.getDoctorSlots(appointment.doctorId._id, selectedDate)
        .then((res) => {
          setSlotData(res);
        })
        .catch((err) => {
          setErrorMessage(err.message || 'Failed to fetch doctor slots.');
          setSlotData(null);
        })
        .finally(() => setLoadingSlots(false));
    }
  }, [isOpen, appointment, selectedDate]);

  if (!appointment) return null;

  const currentFormatted = new Date(appointment.startTime).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  const handleReschedule = async () => {
    if (!selectedSlot) {
      setErrorMessage('Please click an available slot to reschedule.');
      return;
    }

    setSubmitting(true);
    setErrorMessage('');

    try {
      const res = await api.rescheduleAppointment(appointment._id, selectedSlot.startTime);
      addToast('Appointment successfully rescheduled!', 'success');
      if (onAppointmentRescheduled) {
        onAppointmentRescheduled(res.appointment);
      }
      onClose();
    } catch (err) {
      setErrorMessage(
        err.message || 'The selected slot is no longer available. Your original appointment was kept unchanged.'
      );
      // Reload slots
      api.getDoctorSlots(appointment.doctorId._id, selectedDate)
        .then((res) => setSlotData(res))
        .catch(() => {});
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Reschedule Appointment"
      id="reschedule-modal"
      large={true}
      footer={
        <>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={submitting}
            id="cancel-reschedule-btn"
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleReschedule}
            disabled={submitting || !selectedSlot}
            id="confirm-reschedule-btn"
          >
            <CheckCircle2 size={16} />
            <span>{submitting ? 'Rescheduling...' : 'Confirm Reschedule'}</span>
          </button>
        </>
      }
    >
      {errorMessage && (
        <div className="alert alert-error" id="reschedule-error-alert">
          <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Current Details */}
      <div
        style={{
          padding: '14px 18px',
          background: '#f8fafc',
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          marginBottom: '16px',
        }}
      >
        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>CURRENT BOOKING</div>
        <div style={{ fontWeight: 700, fontSize: '1rem', marginTop: 2 }}>
          {appointment.patientId?.fullName} ({appointment.patientId?.patientId})
        </div>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 2 }}>
          Doctor: <strong>{appointment.doctorId?.displayName}</strong> • Current Slot:{' '}
          <span style={{ color: 'var(--primary)', fontWeight: 600 }}>{currentFormatted}</span>
        </div>
      </div>

      {/* Date Picker */}
      <div className="form-group">
        <label className="form-label">
          Choose New Date <span style={{ color: 'var(--status-cancelled-text)' }}>*</span>
        </label>
        <input
          type="date"
          className="form-input"
          id="reschedule-date-input"
          value={selectedDate}
          min={getTodayStr()}
          onChange={(e) => setSelectedDate(e.target.value)}
        />
      </div>

      {/* Available Slots */}
      <div className="form-group">
        <label className="form-label">Select New Available Slot ({selectedDate})</label>
        {loadingSlots ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading doctor schedule...
          </div>
        ) : !slotData || slotData.slots.length === 0 ? (
          <div className="alert alert-info">
            {slotData?.message || 'No available slots found on this date.'}
          </div>
        ) : (
          <div className="slot-grid">
            {slotData.slots.map((slot) => (
              <button
                type="button"
                key={slot.time}
                id={`reschedule-slot-${slot.time}`}
                disabled={!slot.isAvailable}
                className={`slot-chip ${!slot.isAvailable ? 'unavailable' : ''} ${
                  selectedSlot?.time === slot.time ? 'selected' : ''
                }`}
                onClick={() => setSelectedSlot(slot)}
                title={slot.reasonUnavailable || `${slot.displayTime} Available`}
              >
                {slot.displayTime}
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedSlot && (
        <div className="alert alert-success" style={{ padding: '10px 14px' }}>
          <CheckCircle2 size={16} />
          <span>
            New selected slot: <strong>{selectedSlot.displayTime}</strong> on {selectedDate}
          </span>
        </div>
      )}
    </Modal>
  );
};
