import React, { useState } from 'react';
import { Modal } from './Modal';
import { api } from '../services/api';
import { useToast } from './Toast';
import { AlertTriangle, XCircle } from 'lucide-react';

export const CancelModal = ({
  isOpen,
  onClose,
  appointment,
  onAppointmentCancelled,
}) => {
  const { addToast } = useToast();
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!appointment) return null;

  const handleCancel = async () => {
    setSubmitting(true);
    setErrorMessage('');

    try {
      const res = await api.cancelAppointment(appointment._id, reason);
      addToast('Appointment cancelled successfully. Slot freed.', 'info');
      if (onAppointmentCancelled) {
        onAppointmentCancelled(res.appointment);
      }
      onClose();
    } catch (err) {
      setErrorMessage(err.message || 'Failed to cancel appointment.');
    } finally {
      setSubmitting(false);
    }
  };

  const apptTime = new Date(appointment.startTime).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Confirm Appointment Cancellation"
      id="cancel-appointment-modal"
      footer={
        <>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={submitting}
            id="abort-cancel-btn"
          >
            Keep Appointment
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={handleCancel}
            disabled={submitting}
            id="confirm-cancel-btn"
          >
            <XCircle size={16} />
            <span>{submitting ? 'Cancelling...' : 'Confirm & Free Slot'}</span>
          </button>
        </>
      }
    >
      {errorMessage && (
        <div className="alert alert-error">
          <AlertTriangle size={18} />
          <span>{errorMessage}</span>
        </div>
      )}

      <div className="alert alert-warning">
        <AlertTriangle size={20} style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <strong>Are you sure you want to cancel this booking?</strong>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.84rem' }}>
            Cancelling will immediately release the 20-minute slot back to the clinic's open
            schedule while maintaining this record in historical logs.
          </p>
        </div>
      </div>

      <div
        style={{
          padding: '12px 16px',
          background: '#f8fafc',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-color)',
          marginBottom: '16px',
          fontSize: '0.88rem',
        }}
      >
        <div>
          Patient: <strong>{appointment.patientId?.fullName}</strong> ({appointment.patientId?.patientId})
        </div>
        <div style={{ marginTop: 4, color: 'var(--text-muted)' }}>
          Doctor: {appointment.doctorId?.displayName} • Scheduled for: <strong>{apptTime}</strong>
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">
          Reason for Cancellation <span className="optional">(optional)</span>
        </label>
        <textarea
          className="form-textarea"
          id="cancel-reason-textarea"
          rows={2}
          placeholder="e.g. Patient called to cancel, schedule conflict, illness..."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </div>
    </Modal>
  );
};
