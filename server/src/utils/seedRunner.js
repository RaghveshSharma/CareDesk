import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { User } from '../models/User.js';
import { Doctor } from '../models/Doctor.js';
import { DoctorSchedule } from '../models/DoctorSchedule.js';
import { Patient } from '../models/Patient.js';
import { Appointment } from '../models/Appointment.js';
import { runBackfillAndIndex } from './backfillAndIndex.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from server/.env or root .env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
if (!process.env.MONGODB_URI) {
  dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
}

export const seedDatabase = async () => {
  const mongoUri = process.env.DEMO_MONGODB_URI;

  if (!mongoUri) {
    console.error('❌ Execution Halted: DEMO_MONGODB_URI environment variable is required to run the seed script.');
    console.error('To protect primary database records from unexpected demo writes, npm run seed will not fall back to MONGODB_URI.');
    console.error('Usage: DEMO_MONGODB_URI=<demo-database-uri> npm run seed');
    process.exit(1);
  }

  console.log('🍃 Connecting to dedicated demo database via DEMO_MONGODB_URI...');
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(mongoUri);
  }
  console.log('✓ MongoDB connection established.');

  // 1. Admin Account
  const adminEmail = 'admin@caredesk.clinic';
  let admin = await User.findOne({ email: adminEmail });
  if (!admin) {
    const passwordHash = await User.hashPassword('Password123!');
    admin = await User.create({
      name: 'Dr. Rajesh Sharma, MD',
      email: adminEmail,
      passwordHash,
      role: 'admin',
      status: 'active',
      isActive: true,
      shift: 'general',
      shiftHours: '09:00 - 18:00',
    });
    console.log('✓ Created Administrator: admin@caredesk.clinic');
  } else {
    console.log('✓ Administrator verified: admin@caredesk.clinic');
  }

  // 2. Receptionists (Rotational Shift Rostering: Morning, Evening, Night)
  const receptionistsData = [
    {
      name: 'Ananya Verma',
      email: 'ananya.verma@caredesk.clinic',
      password: 'ananyaverma',
      shift: 'morning',
      shiftHours: '08:00 - 16:00',
    },
    {
      name: 'Elena Vance',
      email: 'elena.vance@caredesk.clinic',
      password: 'elenavance',
      shift: 'evening',
      shiftHours: '16:00 - 00:00',
    },
  ];

  const seededReceptionists = [];
  for (const rData of receptionistsData) {
    let rec = await User.findOne({ email: rData.email });
    if (!rec) {
      const passwordHash = await User.hashPassword(rData.password);
      rec = await User.create({
        name: rData.name,
        email: rData.email,
        passwordHash,
        role: 'receptionist',
        status: 'active',
        isActive: true,
        shift: rData.shift,
        shiftHours: rData.shiftHours,
      });
      console.log(`✓ Created Receptionist: ${rData.email} (${rData.shift} shift)`);
    } else {
      rec.shift = rData.shift;
      rec.shiftHours = rData.shiftHours;
      await rec.save();
      console.log(`✓ Verified Receptionist: ${rData.email} (${rData.shift} shift)`);
    }
    seededReceptionists.push(rec);
  }

  // 3. Doctors & Working Schedules
  const doctorsData = [
    {
      name: 'Dr. Priya Nair, MD',
      email: 'dr.priyanair@caredesk.clinic',
      password: 'priyanair',
      specialty: 'Internal Medicine & Family Care',
      shift: 'morning',
      shiftHours: '08:00 - 16:00',
      isEmergencyOnCall: false,
    },
    {
      name: 'Dr. Arjun Mehta, MS',
      email: 'dr.arjunmehta@caredesk.clinic',
      password: 'arjunmehta',
      specialty: 'Orthopedic Surgery & Sports Medicine',
      shift: 'evening',
      shiftHours: '16:00 - 00:00',
      isEmergencyOnCall: false,
    },
    {
      name: 'Dr. Sarah Jenkins, MD',
      email: 'dr.sarahjenkins@caredesk.clinic',
      password: 'sarahjenkins',
      specialty: 'Pediatric & Adolescent Medicine',
      shift: 'night',
      shiftHours: '00:00 - 08:00',
      isEmergencyOnCall: true,
    },
  ];

  const seededDoctors = [];
  for (const dData of doctorsData) {
    let docUser = await User.findOne({ email: dData.email });
    let doctorDoc = null;

    if (!docUser) {
      const passwordHash = await User.hashPassword(dData.password);
      docUser = await User.create({
        name: dData.name,
        email: dData.email,
        passwordHash,
        role: 'doctor',
        status: 'active',
        isActive: true,
        shift: dData.shift,
        shiftHours: dData.shiftHours,
        isEmergencyOnCall: dData.isEmergencyOnCall,
      });

      doctorDoc = await Doctor.create({
        userId: docUser._id,
        displayName: dData.name,
        specialty: dData.specialty,
        appointmentDuration: 20,
        isActive: true,
      });

      docUser.doctorProfile = doctorDoc._id;
      await docUser.save();
      console.log(`✓ Created Doctor: ${dData.email} (${dData.specialty})`);
    } else {
      doctorDoc = await Doctor.findOne({ userId: docUser._id });
      if (!doctorDoc) {
        doctorDoc = await Doctor.create({
          userId: docUser._id,
          displayName: dData.name,
          specialty: dData.specialty,
          appointmentDuration: 20,
          isActive: true,
        });
        docUser.doctorProfile = doctorDoc._id;
      }
      docUser.shift = dData.shift;
      docUser.shiftHours = dData.shiftHours;
      docUser.isEmergencyOnCall = dData.isEmergencyOnCall;
      await docUser.save();
      console.log(`✓ Verified Doctor: ${dData.email}`);
    }

    // Ensure schedules exist for this doctor
    const existingSched = await DoctorSchedule.findOne({ doctorId: doctorDoc._id });
    if (!existingSched) {
      const schedules = [];
      const timezone = 'Asia/Kolkata';
      for (let day = 1; day <= 6; day++) {
        schedules.push({
          doctorId: doctorDoc._id,
          dayOfWeek: day,
          startTime: '09:00',
          endTime: '18:00',
          breakIntervals: [
            { startTime: '12:00', endTime: '12:45', label: 'Lunch (45 min)' },
            { startTime: '15:00', endTime: '15:15', label: 'Afternoon Break (15 min)' },
          ],
          clinicTimezone: timezone,
          isActive: true,
        });
      }
      schedules.push({
        doctorId: doctorDoc._id,
        dayOfWeek: 0,
        startTime: '10:00',
        endTime: '16:00',
        breakIntervals: [{ startTime: '13:00', endTime: '13:30', label: 'Sunday Lunch (30 min)' }],
        clinicTimezone: timezone,
        isActive: false,
      });
      await DoctorSchedule.insertMany(schedules);
      console.log(`✓ Seeded weekly working schedules for ${doctorDoc.displayName}`);
    }

    seededDoctors.push({ user: docUser, doctor: doctorDoc });
  }

  // 4. Patients
  const patientsData = [
    {
      fullName: 'Rohan Sharma',
      email: 'rohan.sharma@gmail.com',
      phone: '+91 98765 43210',
      patientId: 'PAT-2026-0001',
      dateOfBirth: new Date('1988-05-14'),
      gender: 'Male',
    },
    {
      fullName: 'Sneha Patel',
      email: 'sneha.patel@gmail.com',
      phone: '+91 98765 43211',
      patientId: 'PAT-2026-0002',
      dateOfBirth: new Date('1994-09-22'),
      gender: 'Female',
    },
    {
      fullName: 'Arthur Dent',
      email: 'arthur.dent@galaxy.org',
      phone: '+91 98765 43212',
      patientId: 'PAT-2026-0003',
      dateOfBirth: new Date('1982-11-03'),
      gender: 'Male',
    },
  ];

  const seededPatients = [];
  for (const pData of patientsData) {
    let p = await Patient.findOne({ patientId: pData.patientId });
    if (!p) {
      p = await Patient.create(pData);
      console.log(`✓ Created Patient: ${pData.fullName} (${pData.patientId})`);
    } else {
      console.log(`✓ Verified Patient: ${pData.fullName} (${pData.patientId})`);
    }

    // Ensure User auth account for patient portal access
    let patUser = await User.findOne({ email: pData.email });
    if (!patUser) {
      const passwordHash = await User.hashPassword('patient123');
      await User.create({
        name: pData.fullName,
        email: pData.email,
        passwordHash,
        role: 'patient',
        patientProfile: p._id,
        status: 'active',
        isActive: true,
      });
      console.log(`✓ Created Patient Portal login: ${pData.email}`);
    }
    seededPatients.push(p);
  }

  // 5. Backfill & Ensure Unique Index
  await runBackfillAndIndex();

  const totalAppts = await Appointment.countDocuments();
  console.log(`\n========================================`);
  console.log(`🎉 CAREDESK DATABASE SEEDING COMPLETED`);
  console.log(`========================================`);
  console.log(`Admin Login:        admin@caredesk.clinic / Password123!`);
  console.log(`Receptionists:      ananya.verma@caredesk.clinic / ananyaverma (Morning)`);
  console.log(`                    elena.vance@caredesk.clinic / elenance (Evening)`);
  console.log(`Doctors:            dr.priyanair@caredesk.clinic / priyanair`);
  console.log(`                    dr.arjunmehta@caredesk.clinic / arjunmehta`);
  console.log(`                    dr.sarahjenkins@caredesk.clinic / sarahjenkins (Night/Emergency)`);
  console.log(`Patients:           rohan.sharma@gmail.com / patient123`);
  console.log(`                    sneha.patel@gmail.com / patient123`);
  console.log(`Total Appointments: ${totalAppts}`);
  console.log(`========================================\n`);
};

// If run directly from CLI
if (process.argv[1] && process.argv[1].endsWith('seedRunner.js')) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Seeding error:', err);
      process.exit(1);
    });
}
