import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './components/Toast';
import { Navbar } from './components/Navbar';
import { LoginPage } from './pages/LoginPage';
import { ReceptionistDashboard } from './pages/ReceptionistDashboard';
import { DoctorDashboard } from './pages/DoctorDashboard';
import { AdminDashboard } from './pages/AdminDashboard';
import { PatientDashboard } from './pages/PatientDashboard';
import { AccessDeniedPage } from './pages/AccessDeniedPage';

function AppContent() {
  const { user, loading } = useAuth();
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const prevUserRef = React.useRef(user);

  useEffect(() => {
    const onPopState = () => setCurrentPath(window.location.pathname);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = (path) => {
    const formatted = path.startsWith('/') ? path : `/${path}`;
    window.history.pushState({}, '', formatted);
    setCurrentPath(formatted);
  };

  // Sync route state on user auth changes (login/logout)
  useEffect(() => {
    if (!user) {
      if (window.location.pathname !== '/' && window.location.pathname !== '') {
        window.history.replaceState({}, '', '/');
        setCurrentPath('/');
      }
    } else {
      const userDefaultPath = `/${user.role}`;
      // If user just logged in or is at root/login, redirect immediately to their role dashboard
      if (
        !prevUserRef.current ||
        prevUserRef.current.email !== user.email ||
        currentPath === '/' ||
        currentPath === '' ||
        currentPath === '/login'
      ) {
        window.history.replaceState({}, '', userDefaultPath);
        setCurrentPath(userDefaultPath);
      }
    }
    prevUserRef.current = user;
  }, [user, currentPath]);

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          fontFamily: 'var(--font-family)',
          color: 'var(--text-muted)',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              width: 32,
              height: 32,
              border: '3px solid var(--border-color)',
              borderTopColor: 'var(--primary)',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
              margin: '0 auto 12px auto',
            }}
          />
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          <span>Initializing CareDesk System...</span>
        </div>
      </div>
    );
  }

  // If not signed in, show login page
  if (!user) {
    return (
      <LoginPage
        onLoginSuccess={(signedInUser) => {
          if (signedInUser?.role) {
            navigate(`/${signedInUser.role}`);
          }
        }}
      />
    );
  }

  // If user just logged in or is switching account, prioritize user's role route
  // to prevent any millisecond flash of 403 Forbidden while states synchronize:
  const justLoggedIn = !prevUserRef.current || prevUserRef.current.email !== user.email;
  const activePath = justLoggedIn ? `/${user.role}` : currentPath;

  // Role routing & RBAC Access Denied checks:
  let pageComponent = null;

  if (activePath === `/${user.role}` || activePath === '/' || activePath === '' || activePath === '/login') {
    if (user.role === 'receptionist') {
      pageComponent = <ReceptionistDashboard />;
    } else if (user.role === 'doctor') {
      pageComponent = <DoctorDashboard />;
    } else if (user.role === 'admin') {
      pageComponent = <AdminDashboard />;
    } else if (user.role === 'patient') {
      pageComponent = <PatientDashboard />;
    }
  } else if (activePath === '/access-denied') {
    pageComponent = <AccessDeniedPage onNavigate={(role) => navigate(`/${role}`)} />;
  } else if (['/patient', '/doctor', '/receptionist', '/admin'].includes(activePath)) {
    // Explicit cross-role navigation attempt by authenticated user (e.g. receptionist navigating directly to /admin)
    pageComponent = <AccessDeniedPage onNavigate={(role) => navigate(`/${role}`)} />;
  } else {
    // Fallback: render user's authorized dashboard
    if (user.role === 'receptionist') {
      pageComponent = <ReceptionistDashboard />;
    } else if (user.role === 'doctor') {
      pageComponent = <DoctorDashboard />;
    } else if (user.role === 'admin') {
      pageComponent = <AdminDashboard />;
    } else if (user.role === 'patient') {
      pageComponent = <PatientDashboard />;
    }
  }

  return (
    <div className="app-layout">
      <Navbar />
      {pageComponent}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </AuthProvider>
  );
}
