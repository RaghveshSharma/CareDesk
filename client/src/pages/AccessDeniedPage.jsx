import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert, ArrowLeft, Clock } from 'lucide-react';

export const AccessDeniedPage = ({ onNavigate }) => {
  const { user } = useAuth();
  const [countdown, setCountdown] = useState(5);

  const targetRole =
    user?.role === 'doctor'
      ? 'doctor'
      : user?.role === 'receptionist'
      ? 'receptionist'
      : user?.role === 'admin'
      ? 'admin'
      : user?.role === 'patient'
      ? 'patient'
      : 'login';

  const handleReturn = () => {
    onNavigate(targetRole);
  };

  useEffect(() => {
    if (countdown <= 0) {
      handleReturn();
      return;
    }

    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [countdown, targetRole]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '75vh',
        padding: '24px',
      }}
    >
      <div
        className="card"
        style={{
          maxWidth: '540px',
          textAlign: 'center',
          padding: '42px 36px',
          boxShadow: 'var(--shadow-xl)',
          border: '1px solid #fecdd3',
        }}
        id="access-denied-card"
      >
        <div
          style={{
            width: 70,
            height: 70,
            borderRadius: '50%',
            background: 'var(--status-cancelled-bg)',
            color: 'var(--status-cancelled-text)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 20,
            boxShadow: '0 4px 12px rgba(225, 29, 72, 0.15)',
          }}
        >
          <ShieldAlert size={36} />
        </div>

        <h2 style={{ color: '#9f1239', fontSize: '1.5rem' }}>Access Denied (403 Forbidden)</h2>
        <p style={{ marginTop: 12, fontSize: '0.92rem', lineHeight: 1.5 }}>
          You do not have permission to access this page or endpoint. In CareDesk, role-based
          access controls strictly isolate Receptionist, Doctor, and Admin workflows on both client
          and server.
        </p>

        {user && (
          <div
            style={{
              margin: '22px 0',
              padding: '14px 18px',
              background: '#f8fafc',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              fontSize: '0.88rem',
              textAlign: 'left',
            }}
          >
            <div>
              Signed in as: <strong>{user.name}</strong> ({user.email})
            </div>
            <div style={{ marginTop: 4 }}>
              Active Role: <span className={`role-pill ${user.role}`}>{user.role}</span>
            </div>
          </div>
        )}

        {/* Live 5-second countdown indicator */}
        <div
          style={{
            background: '#fff1f2',
            border: '1px solid #fecdd3',
            borderRadius: 'var(--radius-md)',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            marginBottom: 20,
            color: '#be123c',
            fontWeight: 600,
            fontSize: '0.9rem',
          }}
          id="countdown-banner"
        >
          <Clock size={18} className="animate-pulse" />
          <span>
            Redirecting automatically to your dashboard in{' '}
            <strong
              style={{
                fontSize: '1.25rem',
                color: '#9f1239',
                display: 'inline-block',
                minWidth: '18px',
                textAlign: 'center',
              }}
              id="countdown-timer-value"
            >
              {countdown}
            </strong>{' '}
            seconds...
          </span>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          style={{ width: '100%', padding: '12px' }}
          onClick={handleReturn}
          id="return-dashboard-btn"
        >
          <ArrowLeft size={16} />
          <span>Return to My Dashboard Now ({targetRole})</span>
        </button>
      </div>
    </div>
  );
};
