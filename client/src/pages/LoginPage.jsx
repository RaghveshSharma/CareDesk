import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Activity,
  Lock,
  Mail,
  AlertCircle,
  ArrowRight,
  UserCheck,
  Stethoscope,
  Shield,
  ShieldAlert,
  UserPlus,
  LogIn,
  Phone,
  Calendar,
  User,
  HeartPulse,
} from 'lucide-react';

export const LoginPage = ({ onLoginSuccess }) => {
  const { login, registerPatient } = useAuth();

  const [activeTab, setActiveTab] = useState('signin'); // 'signin' | 'signup'

  // Sign In Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [accountStatus, setAccountStatus] = useState(null);

  // Patient Sign Up Form State
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPhone, setSignupPhone] = useState('');
  const [signupDob, setSignupDob] = useState('');
  const [signupGender, setSignupGender] = useState('Female');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupLoading, setSignupLoading] = useState(false);
  const [signupError, setSignupError] = useState('');
  const [signupSuccess, setSignupSuccess] = useState('');

  const [filledFeedback, setFilledFeedback] = useState(null);

  const handleSignIn = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMessage('Please enter both your email address and password.');
      setAccountStatus(null);
      return;
    }

    setLoading(true);
    setErrorMessage('');
    setAccountStatus(null);

    try {
      // 300ms visual feedback so button clearly shows "Authenticating..." state
      await new Promise((resolve) => setTimeout(resolve, 300));
      const user = await login(email, password);
      if (onLoginSuccess && user) {
        onLoginSuccess(user);
      }
    } catch (err) {
      setErrorMessage(err.message || 'Invalid email or password.');
      if (err.data?.accountStatus) {
        setAccountStatus(err.data.accountStatus);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    setSignupError('');
    setSignupSuccess('');

    if (!signupName.trim() || !signupEmail.trim() || !signupPhone.trim() || !signupPassword) {
      setSignupError('Please provide your full name, email, phone number, and password.');
      return;
    }

    // Guard against unauthorized staff domain claim
    const lowerEmail = signupEmail.trim().toLowerCase();
    if (lowerEmail.endsWith('@caredesk.clinic')) {
      setSignupError(
        '@caredesk.clinic emails are reserved for certified clinic staff (Receptionists, Doctors, Admins) provisioned by the Administrator. Please register with your personal email as a patient.'
      );
      return;
    }

    if (signupPassword.length < 6) {
      setSignupError('Password must be at least 6 characters long.');
      return;
    }

    setSignupLoading(true);
    try {
      setSignupSuccess('Account created successfully! Entering Patient Portal...');
      await new Promise((resolve) => setTimeout(resolve, 300));
      const user = await registerPatient({
        fullName: signupName.trim(),
        email: lowerEmail,
        phone: signupPhone.trim(),
        dateOfBirth: signupDob,
        gender: signupGender,
        password: signupPassword,
      });

      if (onLoginSuccess && user) {
        onLoginSuccess(user);
      }
    } catch (err) {
      setSignupError(err.message || 'Registration failed. Please check your details and try again.');
    } finally {
      setSignupLoading(false);
    }
  };

  const handleQuickFill = (demoEmail, demoPass, label) => {
    setActiveTab('signin');
    setEmail(demoEmail);
    setPassword(demoPass);
    setErrorMessage('');
    setAccountStatus(null);
    if (label) {
      setFilledFeedback(`Credentials populated for ${label}. Click "Sign In to Dashboard" to enter.`);
      setTimeout(() => setFilledFeedback(null), 3000);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-card" style={{ maxWidth: activeTab === 'signup' ? '480px' : '440px' }}>
        {/* Brand Header */}
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 'var(--radius-lg)',
              background: 'linear-gradient(135deg, #0d9488 0%, #06b6d4 100%)',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 8px 16px var(--primary-glow)',
              marginBottom: 10,
            }}
          >
            <Activity size={26} />
          </div>
          <h1>CareDesk</h1>
          <p style={{ fontSize: '0.85rem', marginTop: 2 }}>
            Clinic Appointment & Visit Workflow System
          </p>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-light)', marginTop: 4 }}>
            Outpatient Healthcare Operations & Patient Portal
          </div>
        </div>

        {/* Tab Switcher */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            background: '#f1f5f9',
            padding: '4px',
            borderRadius: 'var(--radius-md)',
            marginBottom: '20px',
            gap: '4px',
          }}
          id="auth-tab-group"
        >
          <button
            type="button"
            onClick={() => {
              setActiveTab('signin');
              setErrorMessage('');
              setSignupError('');
            }}
            id="tab-signin-btn"
            style={{
              padding: '8px 12px',
              fontSize: '0.85rem',
              fontWeight: 600,
              border: 'none',
              borderRadius: 'calc(var(--radius-md) - 2px)',
              cursor: 'pointer',
              background: activeTab === 'signin' ? '#ffffff' : 'transparent',
              color: activeTab === 'signin' ? 'var(--primary)' : 'var(--text-muted)',
              boxShadow: activeTab === 'signin' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.15s ease',
            }}
          >
            <LogIn size={15} />
            <span>Sign In</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('signup');
              setErrorMessage('');
              setSignupError('');
            }}
            id="tab-signup-btn"
            style={{
              padding: '8px 12px',
              fontSize: '0.85rem',
              fontWeight: 600,
              border: 'none',
              borderRadius: 'calc(var(--radius-md) - 2px)',
              cursor: 'pointer',
              background: activeTab === 'signup' ? '#ffffff' : 'transparent',
              color: activeTab === 'signup' ? 'var(--primary)' : 'var(--text-muted)',
              boxShadow: activeTab === 'signup' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.15s ease',
            }}
          >
            <UserPlus size={15} />
            <span>Patient Sign Up</span>
          </button>
        </div>

        {/* TAB 1: SIGN IN */}
        {activeTab === 'signin' && (
          <div>
            {errorMessage && (
              <div
                className="alert alert-error"
                id="login-error-alert"
                style={{
                  borderLeft:
                    accountStatus === 'terminated'
                      ? '4px solid #be123c'
                      : accountStatus === 'suspended'
                      ? '4px solid #d97706'
                      : undefined,
                  marginBottom: '16px',
                }}
              >
                {accountStatus ? (
                  <ShieldAlert size={20} style={{ flexShrink: 0, marginTop: 2 }} />
                ) : (
                  <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
                )}
                <div>
                  <div style={{ fontWeight: 700 }}>
                    {accountStatus === 'suspended'
                      ? 'Staff Account Suspended'
                      : accountStatus === 'terminated'
                      ? 'Staff Access Terminated'
                      : 'Authentication Failed'}
                  </div>
                  <div style={{ fontSize: '0.84rem', marginTop: 3 }}>{errorMessage}</div>
                </div>
              </div>
            )}

            {/* Feedback notification when credentials are quick-filled */}
            {filledFeedback && (
              <div
                style={{
                  marginBottom: '14px',
                  padding: '9px 12px',
                  background: '#f0fdf4',
                  border: '1px solid #86efac',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.82rem',
                  color: '#166534',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  animation: 'fadeIn 0.2s ease',
                }}
                id="credentials-filled-notice"
              >
                <UserCheck size={16} color="#16a34a" style={{ flexShrink: 0 }} />
                <span>{filledFeedback}</span>
              </div>
            )}

            <form onSubmit={handleSignIn} id="login-form">
              <div className="form-group">
                <label className="form-label" htmlFor="login-email">
                  Email Address
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="email"
                    id="login-email"
                    className="form-input"
                    style={{ paddingLeft: '38px' }}
                    placeholder="patient@email.com or staff@caredesk.clinic"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                  />
                  <Mail
                    size={18}
                    style={{
                      position: 'absolute',
                      left: 12,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--text-light)',
                    }}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="login-password">
                  Password
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="password"
                    id="login-password"
                    className="form-input"
                    style={{ paddingLeft: '38px' }}
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                  <Lock
                    size={18}
                    style={{
                      position: 'absolute',
                      left: 12,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--text-light)',
                    }}
                  />
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', padding: '12px', marginTop: 10 }}
                id="login-submit-btn"
                disabled={loading}
              >
                <span>{loading ? 'Authenticating...' : 'Sign In to Dashboard'}</span>
                <ArrowRight size={16} />
              </button>
            </form>

            {/* Demo Accounts Quick-Fill Section */}
            <div className="demo-account-pills" style={{ marginTop: 14 }}>
              <div
                style={{
                  fontSize: '0.74rem',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: 'var(--text-muted)',
                  letterSpacing: '0.05em',
                  marginBottom: 8,
                  textAlign: 'center',
                }}
              >
                1-Click Role Fill (Evaluation & Testing)
              </div>

              <button
                type="button"
                className="demo-pill-btn"
                id="fill-patient-credentials"
                onClick={() =>
                  handleQuickFill('rohan.sharma@example.com', 'rohansharma', 'Patient (Rohan Sharma)')
                }
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <HeartPulse size={16} color="#0d9488" />
                  <div>
                    <strong>Rohan Sharma (Patient)</strong>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      rohan.sharma@example.com
                    </div>
                  </div>
                </div>
                <span className="role-pill" style={{ background: '#ccfbf1', color: '#0f766e' }}>
                  Patient
                </span>
              </button>

              <button
                type="button"
                className="demo-pill-btn"
                id="fill-doctor-credentials"
                onClick={() =>
                  handleQuickFill('dr.priyanair@caredesk.clinic', 'priyanair', 'Doctor (Dr. Priya Nair)')
                }
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Stethoscope size={16} color="#6d28d9" />
                  <div>
                    <strong>Dr. Priya Nair, MD (Lead Doctor)</strong>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      dr.priyanair@caredesk.clinic
                    </div>
                  </div>
                </div>
                <span className="role-pill doctor">Doctor</span>
              </button>

              <button
                type="button"
                className="demo-pill-btn"
                id="fill-receptionist-credentials"
                onClick={() =>
                  handleQuickFill('ananya.verma@caredesk.clinic', 'ananyaverma', 'Receptionist (Ananya Verma)')
                }
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <UserCheck size={16} color="#0369a1" />
                  <div>
                    <strong>Ananya Verma (Lead Receptionist)</strong>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      ananya.verma@caredesk.clinic
                    </div>
                  </div>
                </div>
                <span className="role-pill receptionist">Reception</span>
              </button>

              <button
                type="button"
                className="demo-pill-btn"
                id="fill-admin-credentials"
                onClick={() =>
                  handleQuickFill('admin@caredesk.clinic', 'Password123!', 'Admin (Dr. Rajesh Sharma)')
                }
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Shield size={16} color="#0f172a" />
                  <div>
                    <strong>Dr. Rajesh Sharma, MD (Clinic Director)</strong>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      admin@caredesk.clinic
                    </div>
                  </div>
                </div>
                <span className="role-pill admin" style={{ background: '#0f172a', color: '#fff' }}>
                  Admin
                </span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: PATIENT SIGN UP */}
        {activeTab === 'signup' && (
          <div>
            <div
              style={{
                marginBottom: '14px',
                padding: '10px 12px',
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.78rem',
                color: '#166534',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <HeartPulse size={18} color="#16a34a" style={{ flexShrink: 0 }} />
              <div>
                <strong>Self-Service Patient Registration:</strong> Create an outpatient account to book appointments, manage your visits, and view clinical summaries.
              </div>
            </div>

            {signupError && (
              <div className="alert alert-error" id="signup-error-alert" style={{ marginBottom: 14 }}>
                <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
                <div style={{ fontSize: '0.84rem' }}>{signupError}</div>
              </div>
            )}

            {signupSuccess && (
              <div className="alert alert-success" id="signup-success-alert" style={{ marginBottom: 14 }}>
                <UserCheck size={18} style={{ flexShrink: 0, marginTop: 2 }} />
                <div style={{ fontSize: '0.84rem' }}>{signupSuccess}</div>
              </div>
            )}

            <form onSubmit={handleSignUp} id="patient-signup-form">
              <div className="form-group">
                <label className="form-label" htmlFor="signup-name">
                  Full Name *
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    id="signup-name"
                    className="form-input"
                    style={{ paddingLeft: '38px' }}
                    placeholder="e.g. Johnathan Doe"
                    value={signupName}
                    onChange={(e) => setSignupName(e.target.value)}
                    required
                  />
                  <User
                    size={18}
                    style={{
                      position: 'absolute',
                      left: 12,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--text-light)',
                    }}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="signup-email">
                  Personal Email Address *
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="email"
                    id="signup-email"
                    className="form-input"
                    style={{ paddingLeft: '38px' }}
                    placeholder="e.g. john.doe@gmail.com"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    required
                  />
                  <Mail
                    size={18}
                    style={{
                      position: 'absolute',
                      left: 12,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--text-light)',
                    }}
                  />
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 3 }}>
                  Note: @caredesk.clinic is reserved for authorized clinic staff.
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="form-group">
                  <label className="form-label" htmlFor="signup-phone">
                    Phone Number *
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="tel"
                      id="signup-phone"
                      className="form-input"
                      style={{ paddingLeft: '34px', fontSize: '0.84rem' }}
                      placeholder="+91-9876543210"
                      value={signupPhone}
                      onChange={(e) => setSignupPhone(e.target.value)}
                      required
                    />
                    <Phone
                      size={15}
                      style={{
                        position: 'absolute',
                        left: 10,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'var(--text-light)',
                      }}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="signup-dob">
                    Date of Birth
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type="date"
                      id="signup-dob"
                      className="form-input"
                      style={{ paddingLeft: '34px', fontSize: '0.84rem' }}
                      value={signupDob}
                      onChange={(e) => setSignupDob(e.target.value)}
                    />
                    <Calendar
                      size={15}
                      style={{
                        position: 'absolute',
                        left: 10,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        color: 'var(--text-light)',
                      }}
                    />
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="signup-gender">
                  Gender
                </label>
                <select
                  id="signup-gender"
                  className="form-input"
                  value={signupGender}
                  onChange={(e) => setSignupGender(e.target.value)}
                >
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                  <option value="Other">Other</option>
                  <option value="Prefer not to say">Prefer not to say</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="signup-password">
                  Create Password *
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="password"
                    id="signup-password"
                    className="form-input"
                    style={{ paddingLeft: '38px' }}
                    placeholder="At least 6 characters"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    required
                  />
                  <Lock
                    size={18}
                    style={{
                      position: 'absolute',
                      left: 12,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      color: 'var(--text-light)',
                    }}
                  />
                </div>
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                style={{ width: '100%', padding: '12px', marginTop: 8 }}
                id="signup-submit-btn"
                disabled={signupLoading}
              >
                <span>{signupLoading ? 'Registering...' : 'Register & Enter Patient Portal'}</span>
                <ArrowRight size={16} />
              </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: 14, fontSize: '0.82rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Already registered as a patient? </span>
              <button
                type="button"
                onClick={() => setActiveTab('signin')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                Sign In here
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
