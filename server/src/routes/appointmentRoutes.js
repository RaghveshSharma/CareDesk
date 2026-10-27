import express from 'express';
import { DateTime } from 'luxon';
import { Appointment, VALID_TRANSITIONS } from '../models/Appointment.js';
import { Patient } from '../models/Patient.js';
import { Doctor } from '../models/Doctor.js';
import { authenticate, requireRole, filterAppointmentForRole } from '../middleware/auth.js';
import { validateSlotForBooking } from '../services/slotService.js';

const router = express.Router();

const checkTransition = (currentStatus, nextStatus) => {
  const allowed = VALID_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(nextStatus)) {
    const error = new Error(
      `Invalid appointment status transition. Cannot move from '${currentStatus}' to '${nextStatus}'.`
    );
    error.statusCode = 400;
    throw error;
  }
};

// GET /api/appointments/metrics - Summary stats for dashboard header
router.get('/metrics', authenticate, async (req, res) => {
  try {
    const { date } = req.query;
    const target = date
      ? DateTime.fromISO(date, { zone: 'Asia/Kolkata' })
      : DateTime.now().setZone('Asia/Kolkata');
    const dayStart = target.startOf('day').toJSDate();
    const dayEnd = target.endOf('day').toJSDate();

    const query = {
      startTime: { $gte: dayStart, $lte: dayEnd },
    };

    // If doctor, scope metrics strictly to that doctor
    if (req.user.role === 'doctor') {
      if (!req.user.doctorId) {
        return res.status(400).json({ error: 'Doctor profile missing for this user' });
      }
      query.doctorId = req.user.doctorId;
    }

    const [todayCount, checkedInCount, completedCount, inConsultationCount, bookedCount] =
      await Promise.all([
        Appointment.countDocuments(query),
        Appointment.countDocuments({ ...query, status: 'checked_in' }),
        Appointment.countDocuments({ ...query, status: 'completed' }),
        Appointment.countDocuments({ ...query, status: 'in_consultation' }),
        Appointment.countDocuments({ ...query, status: 'booked' }),
      ]);

    return res.json({
      todayCount,
      checkedInCount,
      completedCount,
      inConsultationCount,
      bookedCount,
    });
  } catch (error) {
    console.error('Metrics error:', error.message);
    return res.status(500).json({ error: 'Failed to calculate metrics' });
  }
});

// GET /api/appointments - List appointments with filters
router.get('/', authenticate, async (req, res) => {
  try {
    const { date, status, doctorId } = req.query;
    const query = {};

    // Role-based scoping:
    if (req.user.role === 'doctor') {
      if (!req.user.doctorId) {
        return res.status(400).json({ error: 'Doctor account is not linked to a doctor profile.' });
      }
      // Doctor can ONLY ever see their own appointments!
      query.doctorId = req.user.doctorId;
    } else if (doctorId) {
      query.doctorId = doctorId;
    }

    if (date) {
      const dayStart = DateTime.fromISO(date, { zone: 'Asia/Kolkata' }).startOf('day').toJSDate();
      const dayEnd = DateTime.fromISO(date, { zone: 'Asia/Kolkata' }).endOf('day').toJSDate();
      query.startTime = { $gte: dayStart, $lte: dayEnd };
    }

    if (status) {
      query.status = status;
    }

    let appointmentQuery = Appointment.find(query)
      .populate('patientId', 'patientId fullName phone email dateOfBirth gender')
      .populate('doctorId', 'displayName specialty appointmentDuration')
      .sort({ startTime: 1 });

    // RECEPTIONIST ACCESS RULE: Receptionist MUST NOT receive visitSummary in API response!
    if (req.user.role !== 'doctor') {
      appointmentQuery = appointmentQuery.select('-visitSummary');
    }

    const appointments = await appointmentQuery.exec();
    return res.json({ appointments });
  } catch (error) {
    console.error('List appointments error:', error.message);
    return res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

// GET /api/appointments/:id - Single appointment view
router.get('/:id', authenticate, async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id)
      .populate('patientId', 'patientId fullName phone email dateOfBirth gender')
      .populate('doctorId', 'displayName specialty appointmentDuration');

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Role ownership check for doctor
    if (req.user.role === 'doctor') {
      if (appointment.doctorId._id.toString() !== req.user.doctorId.toString()) {
        return res.status(403).json({
          error: 'Access denied: You are not authorized to view appointments assigned to other doctors.',
        });
      }
    }

    const filtered = filterAppointmentForRole(appointment, req.user.role);
    return res.json({ appointment: filtered });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch appointment details' });
  }
});

// POST /api/appointments - Book a new appointment
// Receptionist only
router.post('/', authenticate, requireRole('receptionist'), async (req, res) => {
  try {
    const { patientId, doctorId, startTime, reasonForVisit } = req.body;

    if (!patientId || !doctorId || !startTime) {
      return res.status(400).json({
        error: 'Patient, Doctor, and Appointment Start Time are required.',
      });
    }

    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({ error: 'Selected patient does not exist.' });
    }

    const doctor = await Doctor.findById(doctorId);
    if (!doctor || !doctor.isActive) {
      return res.status(404).json({ error: 'Selected doctor is not active or not found.' });
    }

    // Validate slot against doctor's schedule, breaks, past times, and collisions
    const validation = await validateSlotForBooking(doctorId, startTime);

    const newAppointment = await Appointment.create({
      patientId,
      doctorId,
      startTime: validation.slotStart,
      endTime: validation.slotEnd,
      status: 'booked',
      reasonForVisit: reasonForVisit ? reasonForVisit.trim() : '',
      bookedBy: req.user._id,
    });

    const populated = await Appointment.findById(newAppointment._id)
      .populate('patientId', 'patientId fullName phone')
      .populate('doctorId', 'displayName specialty')
      .select('-visitSummary');

    return res.status(201).json({
      message: 'Appointment booked successfully.',
      appointment: populated,
    });
  } catch (error) {
    // Catch atomic double booking collision (MongoDB unique index error code 11000)
    if (error.code === 11000) {
      return res.status(409).json({
        error:
          'This appointment slot was just booked by another user. Please choose another available time slot.',
      });
    }
    return res.status(400).json({ error: error.message || 'Failed to book appointment' });
  }
});

// PATCH /api/appointments/:id/reschedule
// Receptionist only
router.patch('/:id/reschedule', authenticate, requireRole('receptionist'), async (req, res) => {
  try {
    const { newStartTime } = req.body;
    if (!newStartTime) {
      return res.status(400).json({ error: 'New appointment start time is required.' });
    }

    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found.' });
    }

    if (appointment.status !== 'booked') {
      return res.status(400).json({
        error: `Only 'booked' appointments can be rescheduled. Current status is '${appointment.status}'.`,
      });
    }

    // Validate new slot (rescheduling must not lose original appointment if new slot is unavailable)
    const validation = await validateSlotForBooking(
      appointment.doctorId,
      newStartTime,
      appointment._id
    );

    appointment.startTime = validation.slotStart;
    appointment.endTime = validation.slotEnd;
    await appointment.save();

    const updated = await Appointment.findById(appointment._id)
      .populate('patientId', 'patientId fullName phone')
      .populate('doctorId', 'displayName specialty')
      .select('-visitSummary');

    return res.json({
      message: 'Appointment rescheduled successfully.',
      appointment: updated,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        error: 'The new appointment slot is already taken. The original appointment remains unchanged.',
      });
    }
    return res.status(400).json({ error: error.message || 'Failed to reschedule appointment' });
  }
});

// PATCH /api/appointments/:id/cancel
// Receptionist only
router.patch('/:id/cancel', authenticate, requireRole('receptionist'), async (req, res) => {
  try {
    const { reason } = req.body;
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found.' });
    }

    checkTransition(appointment.status, 'cancelled');

    const wasInConsultation = appointment.status === 'in_consultation';
    appointment.status = 'cancelled';
    appointment.cancelledAt = new Date();
    appointment.cancellationReason = reason ? reason.trim() : 'Cancelled by receptionist';
    await appointment.save();

    if (wasInConsultation) {
      await Doctor.findByIdAndUpdate(appointment.doctorId, { activeConsultationId: null });
    }

    return res.json({
      message: 'Appointment cancelled successfully. Slot is now available for new bookings.',
      appointment: filterAppointmentForRole(appointment, req.user.role),
    });
  } catch (error) {
    const status = error.statusCode || 400;
    return res.status(status).json({ error: error.message || 'Failed to cancel appointment' });
  }
});

// PATCH /api/appointments/:id/check-in
// Receptionist only
router.patch('/:id/check-in', authenticate, requireRole('receptionist'), async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found.' });
    }

    checkTransition(appointment.status, 'checked_in');

    appointment.status = 'checked_in';
    appointment.checkedInAt = new Date();
    await appointment.save();

    const populated = await Appointment.findById(appointment._id)
      .populate('patientId', 'patientId fullName phone')
      .populate('doctorId', 'displayName specialty')
      .select('-visitSummary');

    return res.json({
      message: 'Patient checked in successfully. Appointment is ready for doctor consultation.',
      appointment: populated,
    });
  } catch (error) {
    const status = error.statusCode || 400;
    return res.status(status).json({ error: error.message || 'Failed to check in appointment' });
  }
});

// PATCH /api/appointments/:id/no-show
// Receptionist only
router.patch('/:id/no-show', authenticate, requireRole('receptionist'), async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found.' });
    }

    checkTransition(appointment.status, 'no_show');

    appointment.status = 'no_show';
    await appointment.save();

    return res.json({
      message: 'Appointment marked as no-show.',
      appointment: filterAppointmentForRole(appointment, req.user.role),
    });
  } catch (error) {
    const status = error.statusCode || 400;
    return res.status(status).json({ error: error.message || 'Failed to update appointment' });
  }
});

// PATCH /api/appointments/:id/start-visit
// Doctor only
router.patch('/:id/start-visit', authenticate, requireRole('doctor'), async (req, res) => {
  try {
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found.' });
    }

    // Doctor ownership check:
    if (appointment.doctorId.toString() !== req.user.doctorId.toString()) {
      return res.status(403).json({
        error: 'Access denied: You can only start visits for appointments assigned to you.',
      });
    }

    // Race-safe atomic lock acquisition on Doctor document:
    // Only one concurrent request can transition activeConsultationId from null to appointment._id.
    const lockedDoctor = await Doctor.findOneAndUpdate(
      {
        _id: req.user.doctorId,
        $or: [
          { activeConsultationId: null },
          { activeConsultationId: appointment._id },
        ],
      },
      { activeConsultationId: appointment._id },
      { new: true }
    );

    if (!lockedDoctor) {
      const activeConsultation = await Appointment.findOne({
        doctorId: req.user.doctorId,
        status: 'in_consultation',
        _id: { $ne: appointment._id },
      }).populate('patientId', 'fullName');

      const activePatient = activeConsultation?.patientId?.fullName || 'another patient';
      return res.status(409).json({
        error: `Doctor already has an ongoing consultation in progress with ${activePatient}. Please complete and sign off the active consultation before calling a new patient.`,
      });
    }

    try {
      checkTransition(appointment.status, 'in_consultation');

      appointment.status = 'in_consultation';
      appointment.visitStartedAt = appointment.visitStartedAt || new Date();
      await appointment.save();
    } catch (transError) {
      // Revert atomic lock if transition fails
      await Doctor.findByIdAndUpdate(req.user.doctorId, { activeConsultationId: null });
      throw transError;
    }

    const populated = await Appointment.findById(appointment._id)
      .populate('patientId', 'patientId fullName phone email dateOfBirth gender')
      .populate('doctorId', 'displayName specialty');

    return res.json({
      message: 'Visit started. Appointment is now in consultation.',
      appointment: populated,
    });
  } catch (error) {
    const status = error.statusCode || 400;
    return res.status(status).json({ error: error.message || 'Failed to start visit' });
  }
});

// PATCH /api/appointments/:id/summary
// Doctor only - save or update draft visit summary
router.patch('/:id/summary', authenticate, requireRole('doctor'), async (req, res) => {
  try {
    const { visitSummary } = req.body;
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found.' });
    }

    if (appointment.doctorId.toString() !== req.user.doctorId.toString()) {
      return res.status(403).json({
        error: 'Access denied: You can only record summaries for appointments assigned to you.',
      });
    }

    if (!['in_consultation', 'completed'].includes(appointment.status)) {
      return res.status(400).json({
        error: `Visit summary can only be updated while in consultation or completed. Current status is '${appointment.status}'.`,
      });
    }

    appointment.visitSummary = visitSummary || '';
    await appointment.save();

    return res.json({
      message: 'Visit summary saved successfully.',
      appointment,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to save visit summary' });
  }
});

// PATCH /api/appointments/:id/complete-visit
// Doctor only
router.patch('/:id/complete-visit', authenticate, requireRole('doctor'), async (req, res) => {
  try {
    const { visitSummary } = req.body;
    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found.' });
    }

    if (appointment.doctorId.toString() !== req.user.doctorId.toString()) {
      return res.status(403).json({
        error: 'Access denied: You can only complete appointments assigned to you.',
      });
    }

    checkTransition(appointment.status, 'completed');

    appointment.status = 'completed';
    appointment.visitCompletedAt = new Date();
    if (typeof visitSummary === 'string') {
      appointment.visitSummary = visitSummary.trim();
    }
    await appointment.save();

    // Release atomic consultation lock on Doctor document:
    await Doctor.findByIdAndUpdate(appointment.doctorId, { activeConsultationId: null });

    const populated = await Appointment.findById(appointment._id)
      .populate('patientId', 'patientId fullName phone email dateOfBirth gender')
      .populate('doctorId', 'displayName specialty');

    return res.json({
      message: 'Appointment completed successfully.',
      appointment: populated,
    });
  } catch (error) {
    const status = error.statusCode || 400;
    return res.status(status).json({ error: error.message || 'Failed to complete appointment' });
  }
});

// POST /api/appointments/doctor-book
// Doctor only: Allows a doctor to schedule a follow-up appointment strictly on THEIR OWN schedule
router.post('/doctor-book', authenticate, requireRole('doctor'), async (req, res) => {
  try {
    const { patientId, startTime, reasonForVisit } = req.body;

    if (!patientId || !startTime) {
      return res.status(400).json({ error: 'Patient ID and Appointment Start Time are required.' });
    }

    if (!req.user.doctorId) {
      return res.status(400).json({ error: 'Doctor profile missing for this user' });
    }

    // STRICT ROLE SCOPING: Doctor can only book on their OWN schedule
    const doctorId = req.user.doctorId;

    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({ error: 'Selected patient does not exist.' });
    }

    const validation = await validateSlotForBooking(doctorId, startTime);

    const newAppointment = await Appointment.create({
      patientId,
      doctorId,
      startTime: validation.slotStart,
      endTime: validation.slotEnd,
      status: 'booked',
      reasonForVisit: reasonForVisit ? reasonForVisit.trim() : 'Doctor-scheduled clinical follow-up',
      bookedBy: req.user._id,
    });

    const populated = await Appointment.findById(newAppointment._id)
      .populate('patientId', 'patientId fullName phone email dateOfBirth gender')
      .populate('doctorId', 'displayName specialty');

    return res.status(201).json({
      message: 'Follow-up appointment scheduled successfully on your calendar.',
      appointment: populated,
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        error: 'This appointment slot was just taken. Please choose another available time on your schedule.',
      });
    }
    return res.status(400).json({ error: error.message || 'Failed to book follow-up appointment' });
  }
});

export default router;
