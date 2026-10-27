import React from 'react';
import { Modal } from './Modal';
import { AlertTriangle, UserCheck, UserPlus } from 'lucide-react';

export const DuplicateWarningModal = ({
  isOpen,
  onClose,
  duplicates = [],
  onSelectExisting,
  onConfirmRegisterAnyway,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Possible Duplicate Patient Detected"
      id="duplicate-warning-modal"
      footer={
        <>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            id="cancel-dup-btn"
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onConfirmRegisterAnyway}
            id="confirm-register-anyway-btn"
          >
            <UserPlus size={16} />
            <span>Register as New Patient Anyway</span>
          </button>
        </>
      }
    >
      <div className="alert alert-warning">
        <AlertTriangle size={20} style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <strong>Potential Duplicate Match</strong>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.84rem' }}>
            CareDesk allows families or shared households to share phone numbers. However, an
            existing patient record with a similar name or identical phone number was found. You
            can choose the existing record or continue creating a new patient.
          </p>
        </div>
      </div>

      <h4 style={{ margin: '16px 0 10px 0', fontSize: '0.9rem' }}>
        Existing Matching Records ({duplicates.length})
      </h4>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {duplicates.map((pat) => (
          <div
            key={pat._id}
            style={{
              padding: '12px 16px',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-md)',
              background: '#f8fafc',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{pat.fullName}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                ID: <strong>{pat.patientId}</strong> • Phone: {pat.phone}
                {pat.email ? ` • ${pat.email}` : ''}
              </div>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => onSelectExisting(pat)}
              id={`select-existing-patient-${pat.patientId}`}
            >
              <UserCheck size={14} />
              <span>Select This Patient</span>
            </button>
          </div>
        ))}
      </div>
    </Modal>
  );
};
