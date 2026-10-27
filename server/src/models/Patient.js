import mongoose from 'mongoose';

const patientSchema = new mongoose.Schema(
  {
    patientId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    fullName: {
      type: String,
      required: [true, 'Patient full name is required'],
      trim: true,
      index: true,
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
      index: true,
    },
    email: {
      type: String,
      trim: true,
      default: '',
    },
    dateOfBirth: {
      type: String, // YYYY-MM-DD
      default: '',
    },
    gender: {
      type: String,
      enum: ['Female', 'Male', 'Other', 'Prefer not to say', ''],
      default: '',
    },
    bloodGroup: {
      type: String,
      enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Unknown', ''],
      default: '',
    },
    allergies: {
      type: String,
      trim: true,
      default: '',
    },
    chronicConditions: {
      type: String,
      trim: true,
      default: '',
    },
    currentMedications: {
      type: String,
      trim: true,
      default: '',
    },
    emergencyContactName: {
      type: String,
      trim: true,
      default: '',
    },
    emergencyContactPhone: {
      type: String,
      trim: true,
      default: '',
    },
    emergencyContactRelation: {
      type: String,
      trim: true,
      default: '',
    },
    address: {
      type: String,
      trim: true,
      default: '',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export const Patient = mongoose.model('Patient', patientSchema);
