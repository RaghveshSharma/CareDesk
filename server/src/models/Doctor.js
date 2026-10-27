import mongoose from 'mongoose';

const doctorSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    displayName: {
      type: String,
      required: [true, 'Display name is required'],
      trim: true,
    },
    specialty: {
      type: String,
      default: 'General Outpatient Medicine',
      trim: true,
    },
    appointmentDuration: {
      type: Number,
      default: 20, // 20 minutes fixed slots
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    activeConsultationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

export const Doctor = mongoose.model('Doctor', doctorSchema);
