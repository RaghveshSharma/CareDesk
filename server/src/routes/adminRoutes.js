import express from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { Doctor } from '../models/Doctor.js';
import { DoctorSchedule } from '../models/DoctorSchedule.js';
import { Appointment } from '../models/Appointment.js';
import { authenticate, requireRole } from '../middleware/auth.js';

const router = express.Router();

// Admin Only: Get all staff accounts with live doctor performance metrics
router.get('/staff', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const staffUsers = await User.find()
      .populate('doctorProfile')
      .sort({ createdAt: -1 });

    // Gather performance stats for doctors
    const staffWithMetrics = await Promise.all(
      staffUsers.map(async (u) => {
        const raw = u.toJSON ? u.toJSON() : { ...u._doc };

        if (u.role === 'doctor' && u.doctorProfile) {
          const docId = u.doctorProfile._id;
          const [total, completed, inConsult, waiting, noShow, cancelled] =
            await Promise.all([
              Appointment.countDocuments({ doctorId: docId }),
              Appointment.countDocuments({ doctorId: docId, status: 'completed' }),
              Appointment.countDocuments({ doctorId: docId, status: 'in_consultation' }),
              Appointment.countDocuments({ doctorId: docId, status: 'checked_in' }),
              Appointment.countDocuments({ doctorId: docId, status: 'no_show' }),
              Appointment.countDocuments({ doctorId: docId, status: 'cancelled' }),
            ]);

          const attendedCount = completed + inConsult;
          const actionableCount = total - cancelled;
          const completionRate =
            actionableCount > 0
              ? Math.round((completed / actionableCount) * 100)
              : 0;

          raw.metrics = {
            totalAppointments: total,
            completedVisits: completed,
            inConsultation: inConsult,
            waitingInQueue: waiting,
            noShowCount: noShow,
            cancelledCount: cancelled,
            attendedCount,
            completionRate,
          };
        } else if (u.role === 'receptionist') {
          const booked = await Appointment.countDocuments({ bookedBy: u._id });
          raw.metrics = {
            appointmentsBooked: booked,
          };
        }

        return raw;
      })
    );

    return res.json({ staff: staffWithMetrics });
  } catch (error) {
    console.error('Admin staff fetch error:', error);
    return res.status(500).json({ error: 'Failed to retrieve staff directory' });
  }
});

// Admin Only: Directly provision a certified staff account
router.post('/staff', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { name, email, password, role, specialty, shift, isEmergencyOnCall } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'Name, email, password, and role are required.' });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const existing = await User.findOne({ email: trimmedEmail });
    if (existing) {
      return res.status(400).json({ error: 'A staff user account with this email already exists.' });
    }

    const shiftHoursMap = {
      morning: '08:00 - 16:00',
      evening: '16:00 - 00:00',
      night: '00:00 - 08:00',
      general: '09:00 - 18:00',
    };
    const assignedShift = shift || (role === 'doctor' ? 'general' : 'morning');
    const assignedHours = shiftHoursMap[assignedShift] || '08:00 - 16:00';

    const passwordHash = await User.hashPassword(password);
    const user = await User.create({
      name: name.trim(),
      email: trimmedEmail,
      passwordHash,
      role,
      status: 'active',
      isActive: true,
      shift: assignedShift,
      shiftHours: assignedHours,
      isEmergencyOnCall: !!isEmergencyOnCall,
    });

    if (role === 'doctor') {
      const doctor = await Doctor.create({
        userId: user._id,
        displayName: name.trim().startsWith('Dr.') ? name.trim() : `Dr. ${name.trim()}`,
        specialty: specialty || 'General Medicine',
        appointmentDuration: 20,
        isActive: true,
      });

      user.doctorProfile = doctor._id;
      await user.save();

      // Seed standard schedules (20 min slot + 5 min gap)
      const timezone = 'Asia/Kolkata';
      const schedules = [];
      for (let day = 1; day <= 6; day++) {
        schedules.push({
          doctorId: doctor._id,
          dayOfWeek: day,
          startTime: '09:00',
          endTime: '18:00',
          breakIntervals: [
            { startTime: '12:00', endTime: '12:45', label: 'Lunch (45 min)' },
            { startTime: '15:00', endTime: '15:15', label: 'Afternoon Break (15 min)' },
          ],
          clinicTimezone: timezone,
        });
      }
      schedules.push({
        doctorId: doctor._id,
        dayOfWeek: 0,
        startTime: '10:00',
        endTime: '16:00',
        breakIntervals: [{ startTime: '13:00', endTime: '13:30', label: 'Sunday Lunch (30 min)' }],
        clinicTimezone: timezone,
      });
      await DoctorSchedule.insertMany(schedules);
    }

    return res.status(201).json({ message: 'Staff account provisioned successfully', user });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to provision staff account' });
  }
});

// Admin Only: Change staff status (active, suspended, terminated) with reason
router.patch('/staff/:id/status', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { status, reason } = req.body;

    if (!['active', 'suspended', 'terminated'].includes(status)) {
      return res.status(400).json({ error: "Status must be 'active', 'suspended', or 'terminated'." });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'Staff account not found' });
    }

    // Prevent admin from locking out their own active admin account
    if (user._id.toString() === req.user._id.toString() && status !== 'active') {
      return res.status(400).json({ error: 'You cannot suspend or terminate your own administrator account.' });
    }

    user.status = status;
    user.statusReason = reason ? reason.trim() : (status === 'suspended' ? 'Administrative pause' : status === 'terminated' ? 'Contract terminated' : '');
    user.statusUpdatedAt = new Date();
    user.statusUpdatedBy = req.user._id;
    user.isActive = status === 'active';
    await user.save();

    // If role is doctor, update doctor profile active status too
    if (user.role === 'doctor') {
      await Doctor.findOneAndUpdate(
        { userId: user._id },
        { isActive: status === 'active' }
      );
    }

    const actionLabel =
      status === 'suspended'
        ? 'suspended (paused)'
        : status === 'terminated'
        ? 'permanently terminated'
        : 'reactivated';

    return res.json({
      message: `Staff account for ${user.name} has been ${actionLabel}.`,
      user,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to update staff status' });
  }
});

// Admin Only: Update staff shift and emergency on-call status
router.patch('/staff/:id/shift', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { shift, isEmergencyOnCall } = req.body;
    const shiftHoursMap = {
      morning: '08:00 - 16:00',
      evening: '16:00 - 00:00',
      night: '00:00 - 08:00',
      general: '09:00 - 18:00',
    };

    const updateData = {};
    if (shift && shiftHoursMap[shift]) {
      updateData.shift = shift;
      updateData.shiftHours = shiftHoursMap[shift];
    }
    if (typeof isEmergencyOnCall === 'boolean') {
      updateData.isEmergencyOnCall = isEmergencyOnCall;
    }

    const user = await User.findByIdAndUpdate(req.params.id, updateData, { new: true }).populate('doctorProfile');
    if (!user) {
      return res.status(404).json({ error: 'Staff account not found' });
    }

    return res.json({ message: 'Staff shift updated successfully', user });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to update staff shift' });
  }
});

// Admin Only: Get doctor's weekly working schedules & breaks
router.get('/doctors/:doctorId/schedules', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.params.doctorId);
    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    const schedules = await DoctorSchedule.find({ doctorId: req.params.doctorId }).sort({ dayOfWeek: 1 });
    return res.json({ doctor, schedules });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to fetch doctor schedules' });
  }
});

// Admin Only: Update doctor's working hours and break intervals
router.put('/doctors/:doctorId/schedules', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const { schedules } = req.body;
    if (!Array.isArray(schedules) || schedules.length === 0) {
      return res.status(400).json({ error: 'Schedules array is required.' });
    }

    const doctor = await Doctor.findById(req.params.doctorId);
    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    const parseMinutes = (timeStr) => {
      if (typeof timeStr !== 'string') return null;
      const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(timeStr.trim());
      if (!match) return null;
      return parseInt(match[1], 10) * 60 + parseInt(match[2], 10);
    };

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    // Strict validation of working hours, breaks, bounds, and overlaps
    for (const item of schedules) {
      if (typeof item.dayOfWeek !== 'number' || item.dayOfWeek < 0 || item.dayOfWeek > 6) {
        return res.status(400).json({
          error: `Invalid dayOfWeek: '${item.dayOfWeek}'. Day must be an integer from 0 (Sunday) to 6 (Saturday).`,
        });
      }

      const dayName = dayNames[item.dayOfWeek];
      const workStartMin = parseMinutes(item.startTime);
      const workEndMin = parseMinutes(item.endTime);

      if (workStartMin === null || workEndMin === null) {
        return res.status(400).json({
          error: `Invalid shift time format on ${dayName}. Times must be in 'HH:mm' 24-hour format (e.g. '09:00').`,
        });
      }

      if (workEndMin <= workStartMin) {
        return res.status(400).json({
          error: `Shift end time (${item.endTime}) must be strictly after start time (${item.startTime}) on ${dayName}.`,
        });
      }

      const breaks = Array.isArray(item.breakIntervals) ? item.breakIntervals : [];
      const parsedBreaks = [];

      for (let bIndex = 0; bIndex < breaks.length; bIndex++) {
        const b = breaks[bIndex];
        const bStartMin = parseMinutes(b.startTime);
        const bEndMin = parseMinutes(b.endTime);
        const bLabel = b.label ? b.label.trim() : `Break ${bIndex + 1}`;

        if (bStartMin === null || bEndMin === null) {
          return res.status(400).json({
            error: `Invalid time format for break '${bLabel}' on ${dayName}. Use 'HH:mm' format.`,
          });
        }

        if (bEndMin <= bStartMin) {
          return res.status(400).json({
            error: `Break end time (${b.endTime}) must be strictly after break start time (${b.startTime}) for '${bLabel}' on ${dayName}.`,
          });
        }

        // Must fall within working hours
        if (bStartMin < workStartMin || bEndMin > workEndMin) {
          return res.status(400).json({
            error: `Break '${bLabel}' (${b.startTime} - ${b.endTime}) falls outside shift working hours (${item.startTime} - ${item.endTime}) on ${dayName}.`,
          });
        }

        // Check overlap with other breaks on the same day
        for (const prev of parsedBreaks) {
          if (bStartMin < prev.end && bEndMin > prev.start) {
            return res.status(400).json({
              error: `Break '${bLabel}' (${b.startTime}-${b.endTime}) overlaps with '${prev.label}' (${prev.startStr}-${prev.endStr}) on ${dayName}.`,
            });
          }
        }

        parsedBreaks.push({
          start: bStartMin,
          end: bEndMin,
          startStr: b.startTime,
          endStr: b.endTime,
          label: bLabel,
        });
      }
    }

    // Persist verified schedules
    for (const item of schedules) {
      await DoctorSchedule.findOneAndUpdate(
        { doctorId: doctor._id, dayOfWeek: item.dayOfWeek },
        {
          startTime: item.startTime.trim(),
          endTime: item.endTime.trim(),
          breakIntervals: item.breakIntervals || [],
          isActive: item.isActive !== undefined ? item.isActive : true,
          clinicTimezone: 'Asia/Kolkata',
        },
        { upsert: true, new: true, runValidators: true }
      );
    }

    const updated = await DoctorSchedule.find({ doctorId: doctor._id }).sort({ dayOfWeek: 1 });
    return res.json({
      message: `Schedule for ${doctor.displayName} updated successfully.`,
      schedules: updated,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to update doctor schedule' });
  }
});

export default router;
