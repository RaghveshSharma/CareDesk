import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useToast } from '../components/Toast';
import { Modal } from '../components/Modal';
import {
  Shield,
  Users,
  UserPlus,
  Stethoscope,
  UserCheck,
  RefreshCw,
  AlertCircle,
  PauseCircle,
  PlayCircle,
  XCircle,
  CheckCircle2,
  TrendingUp,
  Clock,
  Ban,
  Activity,
  Calendar,
  Save,
} from 'lucide-react';

export const AdminDashboard = () => {
  const { addToast } = useToast();

  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);

  // New staff modal
  const [isNewStaffModalOpen, setIsNewStaffModalOpen] = useState(false);
  const [newStaffForm, setNewStaffForm] = useState({
    name: '',
    email: '',
    password: 'Password123!',
    role: 'doctor',
    specialty: 'Internal Medicine',
    shift: 'morning',
    isEmergencyOnCall: false,
  });
  const [creatingStaff, setCreatingStaff] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Status modification modal (Suspend / Terminate)
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [targetStatus, setTargetStatus] = useState('suspended'); // 'suspended' | 'terminated' | 'active'
  const [statusReason, setStatusReason] = useState('');
  const [submittingStatus, setSubmittingStatus] = useState(false);

  // Doctor Schedule Configuration Modal
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [selectedDoctorForSchedule, setSelectedDoctorForSchedule] = useState(null);
  const [scheduleForm, setScheduleForm] = useState({
    workStart: '09:00',
    workEnd: '18:00',
    lunchStart: '12:00',
    lunchEnd: '12:45',
    breakStart: '15:00',
    breakEnd: '15:15',
    includeSunday: false,
    sundayStart: '10:00',
    sundayEnd: '16:00',
  });
  const [loadingSchedule, setLoadingSchedule] = useState(false);
  const [savingSchedule, setSavingSchedule] = useState(false);

  const handleOpenScheduleModal = async (doc) => {
    setSelectedDoctorForSchedule(doc);
    setIsScheduleModalOpen(true);
    setLoadingSchedule(true);

    try {
      if (doc.doctorProfile?._id) {
        const res = await api.getDoctorSchedules(doc.doctorProfile._id);
        const weekdaySched = (res.schedules || []).find((s) => s.dayOfWeek >= 1 && s.dayOfWeek <= 6);
        const sundaySched = (res.schedules || []).find((s) => s.dayOfWeek === 0);

        if (weekdaySched) {
          const lunch = (weekdaySched.breakIntervals || []).find((b) => b.label?.toLowerCase().includes('lunch')) || weekdaySched.breakIntervals?.[0];
          const afternoon = (weekdaySched.breakIntervals || []).find((b) => b.label?.toLowerCase().includes('afternoon')) || weekdaySched.breakIntervals?.[1];

          setScheduleForm({
            workStart: weekdaySched.startTime || '09:00',
            workEnd: weekdaySched.endTime || '18:00',
            lunchStart: lunch?.startTime || '12:00',
            lunchEnd: lunch?.endTime || '12:45',
            breakStart: afternoon?.startTime || '15:00',
            breakEnd: afternoon?.endTime || '15:15',
            includeSunday: sundaySched ? sundaySched.isActive !== false : false,
            sundayStart: sundaySched?.startTime || '10:00',
            sundayEnd: sundaySched?.endTime || '16:00',
          });
        }
      }
    } catch (err) {
      console.error('Error fetching doctor schedule:', err);
    } finally {
      setLoadingSchedule(false);
    }
  };

  const handleSaveSchedule = async (e) => {
    e.preventDefault();
    if (!selectedDoctorForSchedule?.doctorProfile?._id) return;
    setSavingSchedule(true);

    try {
      const schedules = [];
      // Monday through Saturday (days 1 to 6)
      for (let day = 1; day <= 6; day++) {
        schedules.push({
          dayOfWeek: day,
          startTime: scheduleForm.workStart,
          endTime: scheduleForm.workEnd,
          breakIntervals: [
            { startTime: scheduleForm.lunchStart, endTime: scheduleForm.lunchEnd, label: 'Lunch (45 min)' },
            { startTime: scheduleForm.breakStart, endTime: scheduleForm.breakEnd, label: 'Afternoon Break (15 min)' },
          ],
          isActive: true,
        });
      }

      // Sunday (day 0)
      schedules.push({
        dayOfWeek: 0,
        startTime: scheduleForm.sundayStart,
        endTime: scheduleForm.sundayEnd,
        breakIntervals: [
          { startTime: '13:00', endTime: '13:30', label: 'Sunday Lunch (30 min)' },
        ],
        isActive: scheduleForm.includeSunday,
      });

      await api.updateDoctorSchedules(selectedDoctorForSchedule.doctorProfile._id, schedules);
      addToast(`Working schedule and break intervals for ${selectedDoctorForSchedule.name} updated successfully!`, 'success');
      setIsScheduleModalOpen(false);
    } catch (err) {
      addToast(err.message || 'Failed to update working schedule', 'error');
    } finally {
      setSavingSchedule(false);
    }
  };

  const loadAdminData = async () => {
    setLoading(true);
    try {
      const res = await api.getStaff();
      setStaff(res.staff || []);
    } catch (err) {
      console.error('Failed to load admin staff data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAdminData();
  }, []);

  const handleOpenStatusModal = (staffMember, action) => {
    setSelectedStaff(staffMember);
    setTargetStatus(action);
    setStatusReason(
      action === 'suspended'
        ? 'Temporary leave / Administrative credential audit'
        : action === 'terminated'
        ? 'Contract concluded / Administrative revocation'
        : 'Reinstated by clinic administrator'
    );
    setIsStatusModalOpen(true);
  };

  const handleConfirmStatusChange = async () => {
    if (!selectedStaff) return;
    setSubmittingStatus(true);
    try {
      await api.updateStaffStatus(selectedStaff._id, targetStatus, statusReason);
      const actionText =
        targetStatus === 'suspended'
          ? 'suspended (access paused)'
          : targetStatus === 'terminated'
          ? 'permanently terminated'
          : 'reactivated';

      addToast(`Staff account for ${selectedStaff.name} has been ${actionText}.`, 'info');
      setIsStatusModalOpen(false);
      setSelectedStaff(null);
      loadAdminData();
    } catch (err) {
      addToast(err.message || 'Failed to update staff status', 'error');
    } finally {
      setSubmittingStatus(false);
    }
  };

  const handleCreateStaff = async (e) => {
    e.preventDefault();
    setCreatingStaff(true);
    setErrorMessage('');

    try {
      await api.createStaff(newStaffForm);
      addToast(`Provisioned new ${newStaffForm.role} account for ${newStaffForm.name}!`, 'success');
      setIsNewStaffModalOpen(false);
      setNewStaffForm({
        name: '',
        email: '',
        password: 'Password123!',
        role: 'doctor',
        specialty: 'Internal Medicine',
        shift: 'morning',
        isEmergencyOnCall: false,
      });
      loadAdminData();
    } catch (err) {
      setErrorMessage(err.message || 'Failed to provision staff account');
    } finally {
      setCreatingStaff(false);
    }
  };

  const handleRotateShift = async (staffMember) => {
    const shiftOrder = ['morning', 'evening', 'night'];
    const currentIndex = shiftOrder.indexOf(staffMember.shift || 'morning');
    const nextShift = shiftOrder[(currentIndex + 1) % shiftOrder.length];
    try {
      await api.updateStaffShift(staffMember._id, { shift: nextShift });
      addToast(`Rotated ${staffMember.name}'s shift to ${nextShift.toUpperCase()}`, 'success');
      loadAdminData();
    } catch (err) {
      addToast(err.message || 'Failed to update shift', 'error');
    }
  };

  const doctors = staff.filter((s) => s.role === 'doctor');
  const receptionists = staff.filter((s) => s.role === 'receptionist');
  const activeStaffCount = staff.filter((s) => (s.status || (s.isActive ? 'active' : 'inactive')) === 'active').length;
  const suspendedStaffCount = staff.filter((s) => s.status === 'suspended').length;
  const terminatedStaffCount = staff.filter((s) => s.status === 'terminated').length;

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 'var(--radius-md)',
              background: 'linear-gradient(135deg, #0f172a 0%, #334155 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              boxShadow: '0 4px 10px rgba(15, 23, 42, 0.2)',
            }}
          >
            <Shield size={24} />
          </div>
          <div>
            <h2>Clinic Administration & Staff Operations</h2>
            <p style={{ margin: 0, fontSize: '0.84rem' }}>
              Monitor doctor performance metrics, manage credentials, and control access permissions.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            className="btn btn-primary"
            id="open-new-staff-modal-btn"
            onClick={() => setIsNewStaffModalOpen(true)}
          >
            <UserPlus size={16} />
            <span>Provision New Certified Staff</span>
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={loadAdminData}
            title="Refresh records"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="stat-grid">
        <div className="stat-card" style={{ '--stat-accent': '#10b981' }}>
          <div
            className="stat-icon-wrapper"
            style={{ '--stat-bg': '#ecfdf5', '--stat-color': '#10b981' }}
          >
            <Users size={24} />
          </div>
          <div>
            <div className="stat-label">Active Staff</div>
            <div className="stat-value">{activeStaffCount}</div>
          </div>
        </div>

        <div className="stat-card" style={{ '--stat-accent': '#6d28d9' }}>
          <div
            className="stat-icon-wrapper"
            style={{ '--stat-bg': '#f5f3ff', '--stat-color': '#6d28d9' }}
          >
            <Stethoscope size={24} />
          </div>
          <div>
            <div className="stat-label">Doctors on Roster</div>
            <div className="stat-value">{doctors.length}</div>
          </div>
        </div>

        <div className="stat-card" style={{ '--stat-accent': '#0284c7' }}>
          <div
            className="stat-icon-wrapper"
            style={{ '--stat-bg': '#e0f2fe', '--stat-color': '#0284c7' }}
          >
            <UserCheck size={24} />
          </div>
          <div>
            <div className="stat-label">Receptionists</div>
            <div className="stat-value">{receptionists.length}</div>
          </div>
        </div>

        <div className="stat-card" style={{ '--stat-accent': '#be123c' }}>
          <div
            className="stat-icon-wrapper"
            style={{ '--stat-bg': '#fff1f2', '--stat-color': '#be123c' }}
          >
            <Ban size={24} />
          </div>
          <div>
            <div className="stat-label">Suspended / Revoked</div>
            <div className="stat-value">{suspendedStaffCount + terminatedStaffCount}</div>
          </div>
        </div>
      </div>

      {/* Section 1: Doctor Working Performance & Throughput */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h3>Doctor Performance & Working Throughput</h3>
            <p style={{ fontSize: '0.82rem', margin: 0 }}>
              Live audit of patient consultations attended, completion rates, and account access status.
            </p>
          </div>
          <span className="badge badge-booked">Live Clinical Workload</span>
        </div>

        <div className="table-wrapper">
          <table className="data-table" id="doctor-performance-table">
            <thead>
              <tr>
                <th>Doctor & Specialty</th>
                <th>Total Assigned</th>
                <th>Patients Attended (Completed)</th>
                <th>In Queue / Consulting</th>
                <th>No-Shows & Cancellations</th>
                <th>Completion Rate</th>
                <th>Access Status</th>
                <th style={{ textAlign: 'right' }}>Access Control</th>
              </tr>
            </thead>
            <tbody>
              {doctors.map((doc) => {
                const metrics = doc.metrics || {};
                const currentStatus = doc.status || 'active';

                return (
                  <tr key={doc._id} id={`doctor-row-${doc._id}`}>
                    <td>
                      <div style={{ fontWeight: 700, fontSize: '0.94rem' }}>{doc.name}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {doc.doctorProfile?.specialty || 'General Medicine'} • {doc.email}
                      </div>
                      <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                        {doc.isEmergencyOnCall ? (
                          <span style={{ fontSize: '0.72rem', padding: '2px 7px', borderRadius: 4, background: '#fee2e2', color: '#991b1b', fontWeight: 600 }}>
                            🚨 Emergency On-Call
                          </span>
                        ) : (
                          <span style={{ fontSize: '0.72rem', padding: '2px 7px', borderRadius: 4, background: '#f1f5f9', color: '#475569', fontWeight: 600 }}>
                            🕒 Regular Outpatient (OPD)
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Total */}
                    <td>
                      <strong style={{ fontSize: '1rem' }}>{metrics.totalAppointments || 0}</strong>
                    </td>

                    {/* Attended / Completed */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <CheckCircle2 size={16} color="#059669" />
                        <span style={{ fontWeight: 700, color: '#047857' }}>
                          {metrics.completedVisits || 0} attended
                        </span>
                      </div>
                    </td>

                    {/* Queue */}
                    <td>
                      <div style={{ fontSize: '0.84rem' }}>
                        <span>Waiting: <strong>{metrics.waitingInQueue || 0}</strong></span>
                        <span style={{ margin: '0 6px', color: '#cbd5e1' }}>|</span>
                        <span style={{ color: '#6d28d9' }}>Active: <strong>{metrics.inConsultation || 0}</strong></span>
                      </div>
                    </td>

                    {/* No-Shows & Cancelled */}
                    <td>
                      <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        <span>No-Show: <strong>{metrics.noShowCount || 0}</strong></span>
                        <span style={{ margin: '0 6px', color: '#cbd5e1' }}>|</span>
                        <span>Cancelled: <strong>{metrics.cancelledCount || 0}</strong></span>
                      </div>
                    </td>

                    {/* Completion Rate */}
                    <td style={{ minWidth: '130px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div
                          style={{
                            flex: 1,
                            height: 6,
                            background: '#e2e8f0',
                            borderRadius: 4,
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              width: `${metrics.completionRate || 0}%`,
                              height: '100%',
                              background: '#10b981',
                            }}
                          />
                        </div>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700 }}>
                          {metrics.completionRate || 0}%
                        </span>
                      </div>
                    </td>

                    {/* Status Badge */}
                    <td>
                      {currentStatus === 'active' ? (
                        <span className="badge badge-completed">
                          <span className="badge-dot" /> Active Access
                        </span>
                      ) : currentStatus === 'suspended' ? (
                        <span className="badge badge-checked_in" style={{ background: '#fffbeb', color: '#b45309' }}>
                          <PauseCircle size={12} /> Paused / Suspended
                        </span>
                      ) : (
                        <span className="badge badge-cancelled">
                          <Ban size={12} /> Terminated
                        </span>
                      )}
                      {doc.statusReason && currentStatus !== 'active' && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
                          {doc.statusReason}
                        </div>
                      )}
                    </td>

                    {/* Actions */}
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                        {currentStatus === 'active' ? (
                          <>
                            {doc.doctorProfile && (
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                id={`schedule-btn-${doc._id}`}
                                onClick={() => handleOpenScheduleModal(doc)}
                                title="Configure doctor working schedule and breaks"
                                style={{ borderColor: 'var(--border-color)', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                              >
                                <Clock size={13} color="var(--primary)" />
                                <span>Hours & Breaks</span>
                              </button>
                            )}
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              id={`suspend-btn-${doc._id}`}
                              onClick={() => handleOpenStatusModal(doc, 'suspended')}
                              title="Temporarily pause doctor access"
                            >
                              <PauseCircle size={13} color="#b45309" />
                              <span>Pause</span>
                            </button>
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              id={`terminate-btn-${doc._id}`}
                              onClick={() => handleOpenStatusModal(doc, 'terminated')}
                              title="Permanently terminate doctor access"
                            >
                              <Ban size={13} />
                              <span>Terminate</span>
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-success btn-sm"
                            id={`reactivate-btn-${doc._id}`}
                            onClick={() => handleOpenStatusModal(doc, 'active')}
                            title="Re-activate doctor access"
                          >
                            <PlayCircle size={13} />
                            <span>Reactivate Access</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 2: Receptionists & Staff Accounts */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h3>Front Desk Receptionist Staff</h3>
            <p style={{ fontSize: '0.82rem', margin: 0 }}>
              Authorized front desk staff managing patient intake and appointment schedules.
            </p>
          </div>
        </div>

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Staff Name</th>
                <th>Role</th>
                <th>Official Email</th>
                <th>Assigned Shift & Hours</th>
                <th>Bookings Managed</th>
                <th>Access Status</th>
                <th style={{ textAlign: 'right' }}>Access Control</th>
              </tr>
            </thead>
            <tbody>
              {receptionists.map((rec) => {
                const currentStatus = rec.status || 'active';
                return (
                  <tr key={rec._id} id={`receptionist-row-${rec._id}`}>
                    <td>
                      <strong>{rec.name}</strong>
                    </td>
                    <td>
                      <span className="role-pill receptionist">Receptionist</span>
                    </td>
                    <td>{rec.email}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span
                          style={{
                            padding: '3px 8px',
                            borderRadius: '6px',
                            fontSize: '0.76rem',
                            fontWeight: 700,
                            background:
                              rec.shift === 'evening'
                                ? '#fef3c7'
                                : rec.shift === 'night'
                                ? '#ede9fe'
                                : '#e0f2fe',
                            color:
                              rec.shift === 'evening'
                                ? '#b45309'
                                : rec.shift === 'night'
                                ? '#6d28d9'
                                : '#0369a1',
                          }}
                        >
                          {rec.shift === 'evening' ? '🌇 Evening' : rec.shift === 'night' ? '🌙 Night' : '🌅 Morning'}
                        </span>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          {rec.shiftHours || '08:00 - 16:00'}
                        </span>
                      </div>
                    </td>
                    <td>
                      <strong>{rec.metrics?.appointmentsBooked || 0}</strong> appointments
                    </td>
                    <td>
                      {currentStatus === 'active' ? (
                        <span className="badge badge-completed">
                          <span className="badge-dot" /> Active Access
                        </span>
                      ) : currentStatus === 'suspended' ? (
                        <span className="badge badge-checked_in">
                          <PauseCircle size={12} /> Suspended
                        </span>
                      ) : (
                        <span className="badge badge-cancelled">
                          <Ban size={12} /> Terminated
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                        {currentStatus === 'active' ? (
                          <>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleRotateShift(rec)}
                              title="Rotate to next shift (Morning -> Evening -> Night)"
                            >
                              <RefreshCw size={12} />
                              <span>Rotate</span>
                            </button>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleOpenStatusModal(rec, 'suspended')}
                            >
                              <PauseCircle size={13} color="#b45309" />
                              <span>Pause</span>
                            </button>
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              onClick={() => handleOpenStatusModal(rec, 'terminated')}
                            >
                              <Ban size={13} />
                              <span>Terminate</span>
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-success btn-sm"
                            onClick={() => handleOpenStatusModal(rec, 'active')}
                          >
                            <PlayCircle size={13} />
                            <span>Reactivate</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Staff Status Change Modal (Suspend / Terminate / Reactivate) */}
      <Modal
        isOpen={isStatusModalOpen}
        onClose={() => setIsStatusModalOpen(false)}
        title={
          targetStatus === 'suspended'
            ? `Suspend Account Access: ${selectedStaff?.name}`
            : targetStatus === 'terminated'
            ? `Permanently Terminate Access: ${selectedStaff?.name}`
            : `Reactivate Account Access: ${selectedStaff?.name}`
        }
        id="staff-status-modal"
        footer={
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsStatusModalOpen(false)}
              disabled={submittingStatus}
            >
              Cancel
            </button>
            <button
              type="button"
              className={`btn ${targetStatus === 'terminated' ? 'btn-danger' : targetStatus === 'suspended' ? 'btn-secondary' : 'btn-success'}`}
              onClick={handleConfirmStatusChange}
              disabled={submittingStatus}
              id="confirm-status-change-btn"
            >
              {submittingStatus ? 'Updating...' : `Confirm ${targetStatus === 'suspended' ? 'Suspension' : targetStatus === 'terminated' ? 'Termination' : 'Reactivation'}`}
            </button>
          </>
        }
      >
        <div
          className={`alert ${
            targetStatus === 'terminated'
              ? 'alert-error'
              : targetStatus === 'suspended'
              ? 'alert-warning'
              : 'alert-success'
          }`}
        >
          <AlertCircle size={20} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <strong>
              {targetStatus === 'suspended'
                ? 'Temporary Account Suspension'
                : targetStatus === 'terminated'
                ? 'Permanent Access Revocation'
                : 'Reactivating Account Access'}
            </strong>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.84rem' }}>
              {targetStatus === 'suspended'
                ? 'The user will be immediately locked out. Any attempt to log in or make API calls will display a notification that their access has been temporarily paused by the Administrator.'
                : targetStatus === 'terminated'
                ? 'All access permissions will be permanently revoked. The user will be blocked with a termination notice.'
                : 'Account access will be restored immediately, allowing the staff member to sign in and resume operations.'}
            </p>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">
            Administrative Reason for {targetStatus} <span style={{ color: 'var(--status-cancelled-text)' }}>*</span>
          </label>
          <input
            type="text"
            className="form-input"
            id="status-reason-input"
            value={statusReason}
            onChange={(e) => setStatusReason(e.target.value)}
            placeholder="e.g. Scheduled leave, license review, contract end..."
            required
          />
          <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'block', marginTop: 4 }}>
            This message will be shown to the staff member upon login or denied access attempt.
          </span>
        </div>
      </Modal>

      {/* Direct Staff Provision Modal */}
      <Modal
        isOpen={isNewStaffModalOpen}
        onClose={() => setIsNewStaffModalOpen(false)}
        title="Provision Certified Staff Account"
        id="provision-staff-modal"
        footer={
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsNewStaffModalOpen(false)}
              disabled={creatingStaff}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              id="confirm-provision-staff-btn"
              onClick={handleCreateStaff}
              disabled={creatingStaff}
            >
              <UserPlus size={16} />
              <span>{creatingStaff ? 'Provisioning...' : 'Provision Staff Account'}</span>
            </button>
          </>
        }
      >
        {errorMessage && (
          <div className="alert alert-error">
            <AlertCircle size={18} />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="form-group">
          <label className="form-label">
            Full Name <span style={{ color: 'var(--status-cancelled-text)' }}>*</span>
          </label>
          <input
            type="text"
            className="form-input"
            id="staff-name-input"
            placeholder="e.g. Dr. Rajesh Kumar or Sneha Patil"
            value={newStaffForm.name}
            onChange={(e) => setNewStaffForm({ ...newStaffForm, name: e.target.value })}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">
            Staff Email (Certified Clinic Email){' '}
            <span style={{ color: 'var(--status-cancelled-text)' }}>*</span>
          </label>
          <input
            type="email"
            className="form-input"
            id="staff-email-input"
            placeholder="e.g. dr.rajesh@caredesk.clinic"
            value={newStaffForm.email}
            onChange={(e) => setNewStaffForm({ ...newStaffForm, email: e.target.value })}
            required
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div className="form-group">
            <label className="form-label">Role</label>
            <select
              className="form-select"
              id="staff-role-select"
              value={newStaffForm.role}
              onChange={(e) => setNewStaffForm({ ...newStaffForm, role: e.target.value })}
            >
              <option value="doctor">Doctor</option>
              <option value="receptionist">Receptionist</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Initial Password</label>
            <input
              type="text"
              className="form-input"
              value={newStaffForm.password}
              onChange={(e) => setNewStaffForm({ ...newStaffForm, password: e.target.value })}
              required
            />
          </div>
        </div>

        {newStaffForm.role === 'receptionist' && (
          <div className="form-group">
            <label className="form-label">Assigned Clinic Shift</label>
            <select
              className="form-select"
              id="staff-shift-select"
              value={newStaffForm.shift}
              onChange={(e) => setNewStaffForm({ ...newStaffForm, shift: e.target.value })}
            >
              <option value="morning">🌅 Shift 1: Morning (08:00 – 16:00)</option>
              <option value="evening">🌇 Shift 2: Evening (16:00 – 00:00)</option>
              <option value="night">🌙 Shift 3: Night / Emergency (00:00 – 08:00)</option>
            </select>
          </div>
        )}

        {newStaffForm.role === 'doctor' && (
          <>
            <div className="form-group">
              <label className="form-label">Clinical Specialty</label>
              <input
                type="text"
                className="form-input"
                id="staff-specialty-input"
                placeholder="e.g. Cardiology & Outpatient Care"
                value={newStaffForm.specialty}
                onChange={(e) => setNewStaffForm({ ...newStaffForm, specialty: e.target.value })}
              />
            </div>
            <div className="form-group" style={{ marginTop: 8 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.88rem' }}>
                <input
                  type="checkbox"
                  checked={newStaffForm.isEmergencyOnCall}
                  onChange={(e) => setNewStaffForm({ ...newStaffForm, isEmergencyOnCall: e.target.checked })}
                />
                <span>🚨 <strong>Designate as Emergency On-Call Doctor</strong> (Night & 24x7 Coverage)</span>
              </label>
            </div>
          </>
        )}
      </Modal>

      {/* Doctor Working Hours & Breaks Configuration Modal */}
      <Modal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        title={`Doctor Working Hours & Breaks: ${selectedDoctorForSchedule?.name || ''}`}
        id="doctor-schedule-modal"
        footer={
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsScheduleModalOpen(false)}
              disabled={savingSchedule}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              id="save-doctor-schedule-btn"
              onClick={handleSaveSchedule}
              disabled={savingSchedule}
            >
              <Save size={16} />
              <span>{savingSchedule ? 'Saving Schedule...' : 'Save Schedule Configuration'}</span>
            </button>
          </>
        }
      >
        {loadingSchedule ? (
          <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
            Loading doctor schedule rules...
          </div>
        ) : (
          <form onSubmit={handleSaveSchedule}>
            <div
              style={{
                marginBottom: 14,
                padding: '10px 12px',
                background: '#f8fafc',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                fontSize: '0.82rem',
              }}
            >
              <strong>Weekly Consultation Slots:</strong> Updating these hours and breaks adjusts all
              available 20-minute consultation slots generated on the booking screens for this doctor.
            </div>

            <div
              style={{
                fontWeight: 700,
                fontSize: '0.86rem',
                marginBottom: 8,
                color: 'var(--primary)',
              }}
            >
              1. Daily Shift Working Hours (Monday – Saturday)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
              <div className="form-group">
                <label className="form-label">Shift Start Time</label>
                <input
                  type="time"
                  className="form-input"
                  id="schedule-work-start"
                  value={scheduleForm.workStart}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, workStart: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Shift End Time</label>
                <input
                  type="time"
                  className="form-input"
                  id="schedule-work-end"
                  value={scheduleForm.workEnd}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, workEnd: e.target.value })}
                  required
                />
              </div>
            </div>

            <div
              style={{
                fontWeight: 700,
                fontSize: '0.86rem',
                marginBottom: 8,
                color: 'var(--primary)',
              }}
            >
              2. Scheduled Lunch Break (No Consultations Generated)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
              <div className="form-group">
                <label className="form-label">Lunch Start</label>
                <input
                  type="time"
                  className="form-input"
                  id="schedule-lunch-start"
                  value={scheduleForm.lunchStart}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, lunchStart: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Lunch End</label>
                <input
                  type="time"
                  className="form-input"
                  id="schedule-lunch-end"
                  value={scheduleForm.lunchEnd}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, lunchEnd: e.target.value })}
                  required
                />
              </div>
            </div>

            <div
              style={{
                fontWeight: 700,
                fontSize: '0.86rem',
                marginBottom: 8,
                color: 'var(--primary)',
              }}
            >
              3. Afternoon Rest Gap / Tea Break
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
              <div className="form-group">
                <label className="form-label">Break Start</label>
                <input
                  type="time"
                  className="form-input"
                  id="schedule-break-start"
                  value={scheduleForm.breakStart}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, breakStart: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Break End</label>
                <input
                  type="time"
                  className="form-input"
                  id="schedule-break-end"
                  value={scheduleForm.breakEnd}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, breakEnd: e.target.value })}
                  required
                />
              </div>
            </div>

            <div
              style={{
                fontWeight: 700,
                fontSize: '0.86rem',
                marginBottom: 8,
                color: 'var(--primary)',
              }}
            >
              4. Sunday Outpatient Care Schedule
            </div>
            <div style={{ marginBottom: 12 }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: 'pointer',
                  fontSize: '0.86rem',
                }}
              >
                <input
                  type="checkbox"
                  id="schedule-sunday-toggle"
                  checked={scheduleForm.includeSunday}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, includeSunday: e.target.checked })}
                />
                <span>Enable Sunday Clinic Outpatient Consultations for this doctor</span>
              </label>
            </div>

            {scheduleForm.includeSunday && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 14,
                  padding: '10px 12px',
                  background: '#f1f5f9',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <div className="form-group">
                  <label className="form-label">Sunday Start</label>
                  <input
                    type="time"
                    className="form-input"
                    value={scheduleForm.sundayStart}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, sundayStart: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Sunday End</label>
                  <input
                    type="time"
                    className="form-input"
                    value={scheduleForm.sundayEnd}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, sundayEnd: e.target.value })}
                  />
                </div>
              </div>
            )}
          </form>
        )}
      </Modal>
    </div>
  );
};
