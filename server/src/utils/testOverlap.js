import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { Appointment } from '../models/Appointment.js';
import { Doctor } from '../models/Doctor.js';
import { validateSlotForBooking } from '../services/slotService.js';

dotenv.config();

const testIntervalOverlap = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  const doctor = await Doctor.findOne({ isActive: true });
  console.log('Testing interval overlap for doctor:', doctor.displayName);

  // Define Appointment 1: 14:00 to 14:20 on 2026-10-29
  const startTime1 = new Date('2026-10-29T14:00:00.000+05:30');
  const endTime1 = new Date('2026-10-29T14:20:00.000+05:30');

  // Clean test day
  await Appointment.deleteMany({
    doctorId: doctor._id,
    startTime: {
      $gte: new Date('2026-10-29T00:00:00.000Z'),
      $lte: new Date('2026-10-29T23:59:59.000Z'),
    },
  });

  const appt1 = await Appointment.create({
    patientId: new mongoose.Types.ObjectId(),
    doctorId: doctor._id,
    startTime: startTime1,
    endTime: endTime1,
    status: 'booked',
    isCancelled: false,
  });
  console.log(`Created baseline Appointment 1: [14:00 - 14:20] (id: ${appt1._id})`);

  // Case A: DIFFERENT start time (14:10) that is not on slot boundary
  console.log('Testing Candidate A with unaligned start time [14:10 - 14:30]...');
  let rejectedA = false;
  try {
    await validateSlotForBooking(doctor._id, '2026-10-29T14:10:00+05:30');
    console.log('❌ FAIL: Unaligned candidate was allowed!');
  } catch (err) {
    rejectedA = true;
    console.log('✅ PASS: Candidate A [14:10] rejected with schedule alignment error:', err.message);
  }

  // Case B: Candidate has an APPROVED slot start time (14:25), but overlaps an existing extended appointment [14:00, 14:35]
  console.log('\nTesting Candidate B with APPROVED slot start time 14:25 overlapping [14:00 - 14:35]...');
  // Extend appt1 endTime to 14:35
  appt1.endTime = new Date('2026-10-29T14:35:00.000+05:30');
  await appt1.save();

  let rejectedB = false;
  try {
    // 14:25 is an approved slot (14:00 + 20min + 5min buffer = 14:25), but it falls inside [14:00, 14:35]
    await validateSlotForBooking(doctor._id, '2026-10-29T14:25:00+05:30');
    console.log('❌ FAIL: Overlapping candidate was allowed!');
  } catch (err) {
    rejectedB = true;
    console.log('✅ PASS: Candidate B [14:25] rejected with interval overlap error:', err.message);
  }

  // Clean up test data
  await Appointment.deleteMany({
    doctorId: doctor._id,
    startTime: {
      $gte: new Date('2026-10-29T00:00:00.000Z'),
      $lte: new Date('2026-10-29T23:59:59.000Z'),
    },
  });
  await mongoose.disconnect();

  if (!rejectedA || !rejectedB) {
    console.error('❌ FAIL: One or more interval overlap tests did not reject properly.');
    process.exit(1);
  }
};

testIntervalOverlap()
  .then(() => {
    console.log('🎉 Interval overlap test completed successfully.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Test error:', err);
    process.exit(1);
  });
