import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { Appointment } from '../models/Appointment.js';
import { Doctor } from '../models/Doctor.js';
import { validateSlotForBooking } from '../services/slotService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const testIntervalOverlap = async () => {
  const mongoUri = process.env.TEST_MONGODB_URI;

  if (!mongoUri) {
    console.error('❌ Execution Halted: TEST_MONGODB_URI environment variable is required to run automated tests.');
    console.error('To protect primary and demo databases from test mutations, tests will not fall back to MONGODB_URI or DEMO_MONGODB_URI.');
    console.error('Usage: Specify TEST_MONGODB_URI before running npm test (e.g. TEST_MONGODB_URI=mongodb://localhost:27017/caredesk_test npm test).');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);
  console.log('🔒 Connected to isolated test database via TEST_MONGODB_URI');

  const doctor = await Doctor.findOne({ isActive: true });
  if (!doctor) {
    console.error('❌ Test Setup Error: No active doctor found in test database to perform overlap assertions.');
    process.exit(1);
  }

  console.log('Testing interval overlap for doctor:', doctor.displayName);

  // Array to record ONLY test records created during this execution
  const createdTestAppointmentIds = [];

  try {
    // Define Appointment 1: 14:00 to 14:20 on 2026-10-29
    const startTime1 = new Date('2026-10-29T14:00:00.000+05:30');
    const endTime1 = new Date('2026-10-29T14:20:00.000+05:30');

    const appt1 = await Appointment.create({
      patientId: new mongoose.Types.ObjectId(),
      doctorId: doctor._id,
      startTime: startTime1,
      endTime: endTime1,
      status: 'booked',
      isCancelled: false,
    });
    createdTestAppointmentIds.push(appt1._id);
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

    if (!rejectedA || !rejectedB) {
      console.error('❌ FAIL: One or more interval overlap tests did not reject properly.');
      process.exit(1);
    }
  } finally {
    // Strictly delete ONLY test appointments created by this test execution
    if (createdTestAppointmentIds.length > 0) {
      const deleteResult = await Appointment.deleteMany({ _id: { $in: createdTestAppointmentIds } });
      console.log(`🧹 Cleaned up only created test records (${deleteResult.deletedCount} test appointment(s) removed).`);
    }
    await mongoose.disconnect();
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
