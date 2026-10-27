import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Activity, LogOut, User, Clock } from 'lucide-react';

export const Navbar = () => {
  const { user, logout } = useAuth();
  const [loggingOut, setLoggingOut] = React.useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    // Smooth transition delay of ~500ms for premium UX
    await new Promise((resolve) => setTimeout(resolve, 500));
    window.history.pushState({}, '', '/');
    await logout();
    setLoggingOut(false);
  };

  return (
    <>
      <header className="navbar" id="app-navbar">
        <div className="nav-brand">
          <div className="brand-icon-wrapper">
            <Activity size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="brand-title">CareDesk</span>
              <span className="brand-badge">Healthcare System</span>
            </div>
            <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', margin: 0 }}>
              Clinic Appointment & Visit Workflow System
            </p>
          </div>
        </div>

        <div className="nav-right">
          {user ? (
            <>
              <div className="user-badge-chip" id="user-info-chip">
                <User size={16} color="var(--primary)" />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.84rem', fontWeight: 700, lineHeight: 1.2 }}>
                    {user.displayName || user.name}
                  </span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                    {user.email}
                  </span>
                </div>
                <span className={`role-pill ${user.role}`}>{user.role}</span>
              </div>

              <button
                onClick={handleLogout}
                className="btn btn-secondary btn-sm"
                id="logout-btn"
                title="Sign out of CareDesk"
                disabled={loggingOut}
                style={{ opacity: loggingOut ? 0.7 : 1, transition: 'all 0.2s ease' }}
              >
                {loggingOut ? (
                  <>
                    <span
                      style={{
                        width: 13,
                        height: 13,
                        border: '2px solid currentColor',
                        borderTopColor: 'transparent',
                        borderRadius: '50%',
                        display: 'inline-block',
                        animation: 'spin 0.6s linear infinite',
                      }}
                    />
                    <span>Signing Out...</span>
                  </>
                ) : (
                  <>
                    <LogOut size={15} />
                    <span>Sign Out</span>
                  </>
                )}
              </button>
            </>
          ) : (
            <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              Clinic Management Portal
            </span>
          )}
        </div>
      </header>

      {/* Smooth Sign Out Transition Overlay */}
      {loggingOut && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <div
            style={{
              background: '#ffffff',
              padding: '22px 32px',
              borderRadius: 'var(--radius-lg)',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.15)',
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              color: 'var(--text-main)',
              fontWeight: 600,
              fontSize: '0.92rem',
            }}
          >
            <div
              style={{
                width: 22,
                height: 22,
                border: '3px solid #e2e8f0',
                borderTopColor: 'var(--primary)',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }}
            />
            <span>Signing out securely...</span>
          </div>
        </div>
      )}
    </>
  );
};
