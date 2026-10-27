const handleResponse = async (response) => {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorMsg = data.error || data.message || `Request failed with status ${response.status}`;
    const err = new Error(errorMsg);
    err.status = response.status;
    err.data = data;
    throw err;
  }
  return data;
};

export const api = {
  // Auth
  async login(email, password) {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });
    return handleResponse(res);
  },

  async getMe() {
    const res = await fetch('/api/auth/me', {
      credentials: 'include',
    });
    return handleResponse(res);
  },

  async logout() {
    const res = await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
    return handleResponse(res);
  },

  // Admin Only
  async getStaff() {
    const res = await fetch('/api/admin/staff', {
      credentials: 'include',
    });
    return handleResponse(res);
  },

  async createStaff(data) {
    const res = await fetch('/api/admin/staff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    return handleResponse(res);
  },

  async updateStaffStatus(id, status, reason = '') {
    const res = await fetch(`/api/admin/staff/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status, reason }),
    });
    return handleResponse(res);
  },

  async updateStaffShift(id, { shift, isEmergencyOnCall }) {
    const res = await fetch(`/api/admin/staff/${id}/shift`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ shift, isEmergencyOnCall }),
    });
    return handleResponse(res);
  },

  async getDoctorSchedules(doctorId) {
    const res = await fetch(`/api/admin/doctors/${doctorId}/schedules`, {
      credentials: 'include',
    });
    return handleResponse(res);
  },

  async updateDoctorSchedules(doctorId, schedules) {
    const res = await fetch(`/api/admin/doctors/${doctorId}/schedules`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ schedules }),
    });
    return handleResponse(res);
  },

  // Patients
  async searchPatients(q = '') {
    const res = await fetch(`/api/patients/search?q=${encodeURIComponent(q)}`, {
      credentials: 'include',
    });
    return handleResponse(res);
  },

  async getPatient(id) {
    const res = await fetch(`/api/patients/${id}`, {
      credentials: 'include',
    });
    return handleResponse(res);
  },

  async registerPatient(patientData) {
    const res = await fetch('/api/patients', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(patientData),
    });
    return handleResponse(res);
  },

  // Doctors
  async getDoctors() {
    const res = await fetch('/api/doctors', {
      credentials: 'include',
    });
    return handleResponse(res);
  },

  async getDoctorSlots(doctorId, dateStr) {
    const res = await fetch(`/api/doctors/${doctorId}/slots?date=${dateStr}`, {
      credentials: 'include',
    });
    return handleResponse(res);
  },

  // Appointments
  async getMetrics(dateStr) {
    const url = dateStr ? `/api/appointments/metrics?date=${encodeURIComponent(dateStr)}` : '/api/appointments/metrics';
    const res = await fetch(url, {
      credentials: 'include',
    });
    return handleResponse(res);
  },

  async getAppointments(filters = {}) {
    const params = new URLSearchParams();
    if (filters.date) params.append('date', filters.date);
    if (filters.status) params.append('status', filters.status);
    if (filters.doctorId) params.append('doctorId', filters.doctorId);

    const res = await fetch(`/api/appointments?${params.toString()}`, {
      credentials: 'include',
    });
    return handleResponse(res);
  },

  async getAppointment(id) {
    const res = await fetch(`/api/appointments/${id}`, {
      credentials: 'include',
    });
    return handleResponse(res);
  },

  async bookAppointment(bookingData) {
    const res = await fetch('/api/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(bookingData),
    });
    return handleResponse(res);
  },

  async rescheduleAppointment(id, newStartTime) {
    const res = await fetch(`/api/appointments/${id}/reschedule`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ newStartTime }),
    });
    return handleResponse(res);
  },

  async cancelAppointment(id, reason) {
    const res = await fetch(`/api/appointments/${id}/cancel`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ reason }),
    });
    return handleResponse(res);
  },

  async checkInAppointment(id) {
    const res = await fetch(`/api/appointments/${id}/check-in`, {
      method: 'PATCH',
      credentials: 'include',
    });
    return handleResponse(res);
  },

  async markNoShow(id) {
    const res = await fetch(`/api/appointments/${id}/no-show`, {
      method: 'PATCH',
      credentials: 'include',
    });
    return handleResponse(res);
  },

  // Doctor Only
  async startVisit(id) {
    const res = await fetch(`/api/appointments/${id}/start-visit`, {
      method: 'PATCH',
      credentials: 'include',
    });
    return handleResponse(res);
  },

  async saveVisitSummary(id, visitSummary) {
    const res = await fetch(`/api/appointments/${id}/summary`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ visitSummary }),
    });
    return handleResponse(res);
  },

  async completeVisit(id, visitSummary) {
    const res = await fetch(`/api/appointments/${id}/complete-visit`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ visitSummary }),
    });
    return handleResponse(res);
  },

  async doctorBookFollowup(bookingData) {
    const res = await fetch('/api/appointments/doctor-book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(bookingData),
    });
    return handleResponse(res);
  },

  // Patient Portal
  async registerPatientAuth(userData) {
    const res = await fetch('/api/auth/register-patient', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(userData),
    });
    return handleResponse(res);
  },

  async getPatientProfile() {
    const res = await fetch('/api/patient/profile', {
      credentials: 'include',
    });
    return handleResponse(res);
  },

  async updatePatientProfile(profileData) {
    const res = await fetch('/api/patient/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(profileData),
    });
    return handleResponse(res);
  },

  async getPatientAppointments() {
    const res = await fetch('/api/patient/appointments', {
      credentials: 'include',
    });
    return handleResponse(res);
  },

  async patientBookAppointment(bookingData) {
    const res = await fetch('/api/patient/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(bookingData),
    });
    return handleResponse(res);
  },

  async cancelPatientAppointment(id, reason) {
    const res = await fetch(`/api/patient/appointments/${id}/cancel`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ reason }),
    });
    return handleResponse(res);
  },
};
