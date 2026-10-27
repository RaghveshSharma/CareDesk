import express from 'express';
import { Appointment, VALID_TRANSITIONS } from '../models/Appointment.js';
import { Patient } from '../models/Patient.js';
import { Doctor } from '../models/Doctor.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validateSlotForBooking } from '../services/slotService.js';

const router = express.Router();

// Middleware: All routes here require active patient authentication
router.use(authenticate, requireRole('patient'));

// Helper to ensure req.user.patientId is resolved
const resolvePatientId = async (req) => {
  if (req.user.patientId) return req.user.patientId;
  if (req.user.patientProfile) {
    req.user.patientId = req.user.patientProfile;
    return req.user.patientProfile;
  }
  let patient = await Patient.findOne({ email: req.user.email });
  if (!patient) {
    const currentYear = new Date().getFullYear();
    const randSuffix = Math.floor(1000 + Math.random() * 9000);
    patient = await Patient.create({
      patientId: `PAT-${currentYear}-${randSuffix}`,
      fullName: req.user.name,
      phone: '+91-9999999999',
      email: req.user.email,
    });
    req.user.patientProfile = patient._id;
    await req.user.save();
  }
  req.user.patientId = patient._id;
  return patient._id;
};

// GET /api/patient/profile - Get current patient's profile details
router.get('/profile', async (req, res) => {
  try {
    const patientId = await resolvePatientId(req);
    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({ error: 'Patient profile record not found' });
    }
    return res.json({
      patient,
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch patient profile' });
  }
});

// PATCH /api/patient/profile - Update personal profile details
router.patch('/profile', async (req, res) => {
  try {
    const patientId = await resolvePatientId(req);
    const {
      phone,
      dateOfBirth,
      gender,
      bloodGroup,
      allergies,
      chronicConditions,
      currentMedications,
      emergencyContactName,
      emergencyContactPhone,
      emergencyContactRelation,
      address,
    } = req.body;
    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({ error: 'Patient profile not found' });
    }

    if (phone !== undefined) patient.phone = phone.trim();
    if (dateOfBirth !== undefined) patient.dateOfBirth = dateOfBirth.trim();
    if (gender !== undefined) patient.gender = gender;
    if (bloodGroup !== undefined) patient.bloodGroup = bloodGroup;
    if (allergies !== undefined) patient.allergies = allergies.trim();
    if (chronicConditions !== undefined) patient.chronicConditions = chronicConditions.trim();
    if (currentMedications !== undefined) patient.currentMedications = currentMedications.trim();
    if (emergencyContactName !== undefined) patient.emergencyContactName = emergencyContactName.trim();
    if (emergencyContactPhone !== undefined) patient.emergencyContactPhone = emergencyContactPhone.trim();
    if (emergencyContactRelation !== undefined) patient.emergencyContactRelation = emergencyContactRelation;
    if (address !== undefined) patient.address = address.trim();

    await patient.save();
    return res.json({ message: 'Health profile updated successfully', patient });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to update profile' });
  }
});

// GET /api/patient/appointments - Fetch patient's upcoming and past appointments
router.get('/appointments', async (req, res) => {
  try {
    const patientId = await resolvePatientId(req);

    // Patients can see all their appointments, with visitSummary visible for completed visits
    const appointments = await Appointment.find({ patientId })
      .populate('doctorId', 'displayName specialty appointmentDuration')
      .populate('patientId', 'patientId fullName phone email dateOfBirth gender')
      .sort({ startTime: -1 })
      .exec();

    const now = new Date();
    const upcoming = [];
    const past = [];

    appointments.forEach((apt) => {
      const isPastOrFinished =
        ['completed', 'cancelled', 'no_show'].includes(apt.status) ||
        new Date(apt.endTime) < now;

      if (isPastOrFinished) {
        past.push(apt);
      } else {
        upcoming.push(apt);
      }
    });

    return res.json({
      appointments,
      upcoming,
      past,
    });
  } catch (error) {
    console.error('Patient appointments error:', error.message);
    return res.status(500).json({ error: 'Failed to retrieve appointments' });
  }
});

// POST /api/patient/appointments - Book a new appointment
router.post('/appointments', async (req, res) => {
  try {
    const patientId = await resolvePatientId(req);
    const { doctorId, startTime, reasonForVisit } = req.body;

    if (!doctorId || !startTime) {
      return res.status(400).json({
        error: 'Please select a Doctor and an appointment time slot.',
      });
    }

    const doctor = await Doctor.findById(doctorId);
    if (!doctor || !doctor.isActive) {
      return res.status(404).json({ error: 'Selected doctor is not available.' });
    }

    // Validate slot against doctor schedule, breaks, buffer, past times, collisions
    const validation = await validateSlotForBooking(doctorId, startTime);

    const newAppointment = await Appointment.create({
      patientId,
      doctorId,
      startTime: validation.slotStart,
      endTime: validation.slotEnd,
      status: 'booked',
      reasonForVisit: reasonForVisit ? reasonForVisit.trim() : 'Patient direct portal booking',
      bookedBy: req.user._id,
    });

    const populated = await Appointment.findById(newAppointment._id)
      .populate('doctorId', 'displayName specialty appointmentDuration')
      .populate('patientId', 'patientId fullName phone email');

    return res.status(201).json({
      message: 'Appointment booked successfully! We look forward to seeing you.',
      appointment: populated,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        error:
          'This appointment slot was just reserved by another patient. Please select another available time slot.',
      });
    }
    return res.status(400).json({ error: error.message || 'Failed to book appointment' });
  }
});

// PATCH /api/patient/appointments/:id/cancel - Patient cancels own booked appointment
router.patch('/appointments/:id/cancel', async (req, res) => {
  try {
    const patientId = await resolvePatientId(req);
    const { reason } = req.body;

    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Verify ownership
    if (appointment.patientId.toString() !== patientId.toString()) {
      return res.status(403).json({
        error: 'Unauthorized: You may only cancel your own appointments.',
      });
    }

    if (appointment.status !== 'booked') {
      return res.status(400).json({
        error: `Only 'booked' appointments can be cancelled online. Current status is '${appointment.status}'. Please contact clinic reception.`,
      });
    }

    appointment.status = 'cancelled';
    appointment.cancelledAt = new Date();
    appointment.cancellationReason = reason ? reason.trim() : 'Cancelled by patient via portal';
    await appointment.save();

    const populated = await Appointment.findById(appointment._id)
      .populate('doctorId', 'displayName specialty appointmentDuration')
      .populate('patientId', 'patientId fullName phone email');

    return res.json({
      message: 'Appointment cancelled successfully. The slot has been released.',
      appointment: populated,
    });
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Failed to cancel appointment' });
  }
});

export default router;
