import express from 'express';
import { Patient } from '../models/Patient.js';
import { Appointment } from '../models/Appointment.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Helper to generate next Patient ID
const generatePatientId = async () => {
  const currentYear = new Date().getFullYear();
  const count = await Patient.countDocuments();
  const sequence = String(count + 1).padStart(4, '0');
  return `PAT-${currentYear}-${sequence}`;
};

// GET /api/patients/search?q=...
// Receptionist only
router.get('/search', authenticate, requireRole('receptionist'), async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.trim() === '') {
      const recentPatients = await Patient.find().sort({ createdAt: -1 }).limit(20);
      return res.json({ patients: recentPatients });
    }

    const trimmed = q.trim();
    const regex = new RegExp(trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

    const patients = await Patient.find({
      $or: [{ fullName: regex }, { phone: regex }, { patientId: regex }],
    })
      .sort({ createdAt: -1 })
      .limit(30);

    return res.json({ patients });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to search patients' });
  }
});

// GET /api/patients/:id
// Accessible by receptionist/admin, patient (own record only), or doctor (assigned patients only)
router.get('/:id', authenticate, async (req, res) => {
  try {
    const patientId = req.params.id;

    // 1. If the authenticated user is a patient, strictly restrict them to their own record
    if (req.user.role === 'patient') {
      const ownPatientId = (req.patient?._id || req.user.patientProfile || req.user.patientId)?.toString();
      if (!ownPatientId || ownPatientId !== patientId) {
        return res.status(403).json({
          error: 'Access denied: Patients may only access their own personal health record.',
        });
      }
    }

    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({ error: 'Patient record not found' });
    }

    // 2. If the authenticated user is a doctor, verify they have an appointment assigned to this patient
    if (req.user.role === 'doctor') {
      if (!req.user.doctorId) {
        return res.status(403).json({ error: 'Doctor profile not associated with this account.' });
      }
      const hasAppointment = await Appointment.exists({
        doctorId: req.user.doctorId,
        patientId: patient._id,
      });
      if (!hasAppointment) {
        return res.status(403).json({
          error: 'Access denied: Doctors may only view clinical records of patients assigned to their consultations.',
        });
      }
    }

    return res.json({ patient });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch patient details' });
  }
});

// POST /api/patients
// Receptionist only
router.post('/', authenticate, requireRole('receptionist'), async (req, res) => {
  try {
    const { fullName, phone, email, dateOfBirth, gender, confirmDuplicate } = req.body;

    if (!fullName || fullName.trim() === '') {
      return res.status(400).json({ error: 'Patient full name is required.' });
    }
    if (!phone || phone.trim() === '') {
      return res.status(400).json({ error: 'Patient phone number is required.' });
    }

    const trimmedName = fullName.trim();
    const trimmedPhone = phone.trim();

    // Check for potential duplicate by matching phone or case-insensitive name
    if (!confirmDuplicate) {
      const escapedName = trimmedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const duplicates = await Patient.find({
        $or: [
          { phone: trimmedPhone },
          { fullName: new RegExp(`^${escapedName}$`, 'i') },
        ],
      });

      if (duplicates.length > 0) {
        return res.status(200).json({
          isDuplicateWarning: true,
          message:
            'A patient with a matching name or phone number already exists in CareDesk. You may select an existing patient or confirm registration to create a new profile.',
          duplicates,
        });
      }
    }

    // Auto-generate patient ID
    let patientId = await generatePatientId();
    // Ensure uniqueness
    let existingId = await Patient.findOne({ patientId });
    while (existingId) {
      const randSuffix = Math.floor(1000 + Math.random() * 9000);
      patientId = `PAT-${new Date().getFullYear()}-${randSuffix}`;
      existingId = await Patient.findOne({ patientId });
    }

    const newPatient = await Patient.create({
      patientId,
      fullName: trimmedName,
      phone: trimmedPhone,
      email: email ? email.trim() : '',
      dateOfBirth: dateOfBirth ? dateOfBirth.trim() : '',
      gender: gender || '',
      createdBy: req.user._id,
    });

    return res.status(201).json({
      message: 'Patient registered successfully',
      patient: newPatient,
    });
  } catch (error) {
    console.error('Patient registration error:', error.message);
    return res.status(500).json({ error: error.message || 'Failed to register patient' });
  }
});

export default router;
