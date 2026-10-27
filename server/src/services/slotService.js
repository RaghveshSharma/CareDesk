import { DateTime } from 'luxon';
import { Doctor } from '../models/Doctor.js';
import { DoctorSchedule } from '../models/DoctorSchedule.js';
import { Appointment } from '../models/Appointment.js';

export const CONSULTATION_DURATION_MINUTES = 20;
export const BUFFER_GAP_MINUTES = 5;

/**
 * Returns available slots for a doctor on a specific date (YYYY-MM-DD).
 * Respects 20-min consultation duration, 5-min buffer gap, break intervals, and clinic timezone.
 */
export const getAvailableSlotsForDate = async (doctorId, dateStr) => {
  const doctor = await Doctor.findById(doctorId);
  if (!doctor || !doctor.isActive) {
    throw new Error('Doctor not found or inactive');
  }

  const duration = doctor.appointmentDuration || CONSULTATION_DURATION_MINUTES;
  const buffer = BUFFER_GAP_MINUTES;

  // Find any schedule for this doctor to discover clinic timezone, or default
  const sampleSchedule = await DoctorSchedule.findOne({ doctorId });
  const timezone = sampleSchedule?.clinicTimezone || 'Asia/Kolkata';

  // Parse date in clinic timezone
  const targetDate = DateTime.fromISO(dateStr, { zone: timezone });
  if (!targetDate.isValid) {
    throw new Error('Invalid date format. Use YYYY-MM-DD.');
  }

  // JS/Mongoose schema dayOfWeek: 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const dayOfWeek = targetDate.weekday === 7 ? 0 : targetDate.weekday;

  const schedule = await DoctorSchedule.findOne({
    doctorId,
    dayOfWeek,
    isActive: true,
  });

  if (!schedule) {
    return {
      date: dateStr,
      doctorId,
      doctorName: doctor.displayName,
      timezone,
      workingHours: null,
      slots: [],
      message: 'Doctor is not scheduled to work on this day.',
    };
  }

  const [startHour, startMin] = schedule.startTime.split(':').map(Number);
  const [endHour, endMin] = schedule.endTime.split(':').map(Number);

  const workStart = targetDate.set({ hour: startHour, minute: startMin, second: 0, millisecond: 0 });
  const workEnd = targetDate.set({ hour: endHour, minute: endMin, second: 0, millisecond: 0 });

  // Map break intervals
  const breaks = (schedule.breakIntervals || []).map((b) => {
    const [bStartH, bStartM] = b.startTime.split(':').map(Number);
    const [bEndH, bEndM] = b.endTime.split(':').map(Number);
    return {
      start: targetDate.set({ hour: bStartH, minute: bStartM, second: 0, millisecond: 0 }),
      end: targetDate.set({ hour: bEndH, minute: bEndM, second: 0, millisecond: 0 }),
      label: b.label || 'Break',
    };
  });

  // Query all active (non-cancelled) appointments for this doctor on this day
  const dayRangeStart = targetDate.startOf('day').toJSDate();
  const dayRangeEnd = targetDate.endOf('day').toJSDate();

  const bookedAppointments = await Appointment.find({
    doctorId,
    status: { $nin: ['cancelled'] },
    startTime: { $gte: dayRangeStart, $lte: dayRangeEnd },
  }).select('startTime endTime status');

  const now = DateTime.now().setZone(timezone);

  const slots = [];
  let currentSlotStart = workStart;

  while (currentSlotStart < workEnd) {
    const currentSlotEnd = currentSlotStart.plus({ minutes: duration });

    // If slot extends beyond working hours, stop
    if (currentSlotEnd > workEnd) {
      break;
    }

    // Check if slot overlaps with any scheduled break
    const overlappingBreak = breaks.find(
      (b) => currentSlotStart < b.end && currentSlotEnd > b.start
    );

    if (overlappingBreak) {
      // Advance to the end of the break
      currentSlotStart = overlappingBreak.end;
      continue;
    }

    // Check if slot is in the past
    const isPast = currentSlotStart <= now;

    // Check if already booked
    const isBooked = bookedAppointments.some((appt) => {
      const apptStart = DateTime.fromJSDate(appt.startTime, { zone: timezone });
      return apptStart.toMillis() === currentSlotStart.toMillis();
    });

    const isAvailable = !isPast && !isBooked;

    slots.push({
      time: currentSlotStart.toFormat('HH:mm'),
      displayTime: currentSlotStart.toFormat('hh:mm a'),
      displayEndTime: currentSlotEnd.toFormat('hh:mm a'),
      startTime: currentSlotStart.toISO(),
      endTime: currentSlotEnd.toISO(),
      durationMinutes: duration,
      bufferGapMinutes: buffer,
      isAvailable,
      reasonUnavailable: isPast
        ? 'Past time'
        : isBooked
        ? 'Already booked'
        : null,
    });

    // Advance to next slot: Consultation duration + 5 minute gap
    currentSlotStart = currentSlotEnd.plus({ minutes: buffer });
  }

  return {
    date: dateStr,
    doctorId,
    doctorName: doctor.displayName,
    timezone,
    workingHours: `${schedule.startTime} - ${schedule.endTime}`,
    consultationDuration: duration,
    bufferGap: buffer,
    breaks: schedule.breakIntervals,
    slots,
  };
};

/**
 * Validates whether a specific slot is legal to book for a doctor.
 */
export const validateSlotForBooking = async (doctorId, startTimeIso, excludeAppointmentId = null) => {
  const doctor = await Doctor.findById(doctorId);
  if (!doctor || !doctor.isActive) {
    throw new Error('Selected doctor is inactive or not found.');
  }

  const duration = doctor.appointmentDuration || CONSULTATION_DURATION_MINUTES;
  const sampleSchedule = await DoctorSchedule.findOne({ doctorId });
  const timezone = sampleSchedule?.clinicTimezone || 'Asia/Kolkata';

  const slotStart = DateTime.fromISO(startTimeIso, { zone: timezone });
  if (!slotStart.isValid) {
    throw new Error('Invalid appointment start time format.');
  }

  const now = DateTime.now().setZone(timezone);
  if (slotStart <= now) {
    throw new Error('Cannot book an appointment slot in the past.');
  }

  const dayOfWeek = slotStart.weekday === 7 ? 0 : slotStart.weekday;
  const schedule = await DoctorSchedule.findOne({
    doctorId,
    dayOfWeek,
    isActive: true,
  });

  if (!schedule) {
    throw new Error('Doctor has no working schedule on this day.');
  }

  const [startHour, startMin] = schedule.startTime.split(':').map(Number);
  const [endHour, endMin] = schedule.endTime.split(':').map(Number);

  const workStart = slotStart.set({ hour: startHour, minute: startMin, second: 0, millisecond: 0 });
  const workEnd = slotStart.set({ hour: endHour, minute: endMin, second: 0, millisecond: 0 });
  const slotEnd = slotStart.plus({ minutes: duration });

  if (slotStart < workStart || slotEnd > workEnd) {
    throw new Error(
      `Appointment slot is outside doctor's working hours (${schedule.startTime} - ${schedule.endTime}).`
    );
  }

  // Check break overlap
  const breaks = (schedule.breakIntervals || []).map((b) => {
    const [bStartH, bStartM] = b.startTime.split(':').map(Number);
    const [bEndH, bEndM] = b.endTime.split(':').map(Number);
    return {
      start: slotStart.set({ hour: bStartH, minute: bStartM, second: 0, millisecond: 0 }),
      end: slotStart.set({ hour: bEndH, minute: bEndM, second: 0, millisecond: 0 }),
      label: b.label || 'Break',
    };
  });

  for (const b of breaks) {
    if (slotStart < b.end && slotEnd > b.start) {
      throw new Error(`Requested slot falls during the doctor's ${b.label}.`);
    }
  }

  // Confirm requested slot aligns exactly with the doctor's approved slot schedule
  const dateStr = slotStart.toFormat('yyyy-MM-dd');
  const daySchedule = await getAvailableSlotsForDate(doctorId, dateStr);
  const matchingSlot = daySchedule.slots.find((s) => {
    const sStart = DateTime.fromISO(s.startTime, { zone: timezone });
    return sStart.toMillis() === slotStart.toMillis();
  });

  if (!matchingSlot) {
    throw new Error(
      `Requested time (${slotStart.toFormat('hh:mm a')}) does not align with the doctor's approved consultation slot schedule.`
    );
  }

  // Interval overlap check: Any active appointment where startTime < slotEnd AND endTime > slotStart
  const overlapQuery = {
    doctorId,
    status: { $ne: 'cancelled' },
    startTime: { $lt: slotEnd.toJSDate() },
    endTime: { $gt: slotStart.toJSDate() },
  };

  if (excludeAppointmentId) {
    overlapQuery._id = { $ne: excludeAppointmentId };
  }

  const existingOverlap = await Appointment.findOne(overlapQuery);
  if (existingOverlap) {
    throw new Error('This appointment slot overlaps with an existing booked consultation.');
  }

  return {
    valid: true,
    slotStart: slotStart.toJSDate(),
    slotEnd: slotEnd.toJSDate(),
    timezone,
  };
};
