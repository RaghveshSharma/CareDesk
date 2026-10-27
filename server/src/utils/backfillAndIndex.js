import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { Appointment } from '../models/Appointment.js';
import { Doctor } from '../models/Doctor.js';

dotenv.config();

export const runBackfillAndIndex = async () => {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error('MONGODB_URI is required to run backfill and index verification.');
  }

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(mongoUri);
  }

  console.log('🔄 Backfilling isCancelled field on existing appointments in MongoDB Atlas...');
  const resCancelled = await Appointment.updateMany(
    { status: 'cancelled' },
    { $set: { isCancelled: true } }
  );
  console.log(`✓ Updated cancelled appointments: ${resCancelled.modifiedCount} modified.`);

  const resActive = await Appointment.updateMany(
    { status: { $ne: 'cancelled' } },
    { $set: { isCancelled: false } }
  );
  console.log(`✓ Updated active appointments: ${resActive.modifiedCount} modified.`);

  // Synchronize doctor activeConsultationId locks for any ongoing consultations
  console.log('🔄 Synchronizing Doctor.activeConsultationId locks for live consultations...');
  const doctors = await Doctor.find({});
  for (const doc of doctors) {
    const ongoing = await Appointment.findOne({ doctorId: doc._id, status: 'in_consultation' });
    doc.activeConsultationId = ongoing ? ongoing._id : null;
    await doc.save();
    console.log(`✓ Doctor ${doc.displayName}: activeConsultationId = ${doc.activeConsultationId || 'null'}`);
  }

  // Re-build unique index on Appointment collection
  console.log('🔄 Verifying and creating partial unique index on Appointment collection...');
  try {
    const existingIndexes = await Appointment.collection.indexes();
    const hasOldIndex = existingIndexes.some((idx) => idx.name === 'doctorId_1_startTime_1');
    if (hasOldIndex) {
      console.log('Dropping existing doctorId_1_startTime_1 index to update partialFilterExpression...');
      await Appointment.collection.dropIndex('doctorId_1_startTime_1');
    }
  } catch (err) {
    console.log('Index drop notice:', err.message);
  }

  const createdIndexName = await Appointment.collection.createIndex(
    { doctorId: 1, startTime: 1 },
    {
      name: 'doctorId_1_startTime_1',
      unique: true,
      partialFilterExpression: { isCancelled: false },
    }
  );
  console.log(`✅ Unique index created successfully: ${createdIndexName}`);

  const verifiedIndexes = await Appointment.collection.indexes();
  console.log('📋 Verified Appointment Indexes in MongoDB Atlas:');
  console.dir(verifiedIndexes, { depth: null });

  return verifiedIndexes;
};

// If run directly:
if (process.argv[1]?.endsWith('backfillAndIndex.js')) {
  runBackfillAndIndex()
    .then(() => {
      console.log('✅ Backfill and Index Verification completed successfully.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Backfill failed:', err);
      process.exit(1);
    });
}
