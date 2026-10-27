import mongoose from 'mongoose';

export const APPOINTMENT_STATUSES = [
  'booked',
  'checked_in',
  'in_consultation',
  'completed',
  'cancelled',
  'no_show',
];

export const VALID_TRANSITIONS = {
  booked: ['checked_in', 'cancelled', 'no_show'],
  checked_in: ['in_consultation'],
  in_consultation: ['completed'],
  completed: [],
  cancelled: [],
  no_show: [],
};

const appointmentSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: [true, 'Patient ID is required'],
      index: true,
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      required: [true, 'Doctor ID is required'],
      index: true,
    },
    startTime: {
      type: Date,
      required: [true, 'Start time is required'],
      index: true,
    },
    endTime: {
      type: Date,
      required: [true, 'End time is required'],
    },
    status: {
      type: String,
      enum: APPOINTMENT_STATUSES,
      default: 'booked',
      index: true,
    },
    reasonForVisit: {
      type: String,
      trim: true,
      default: '',
    },
    bookedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    visitSummary: {
      type: String,
      trim: true,
      default: '',
      // Note: Protected field. Only doctors assigned to this appointment can read or edit this!
    },
    visitStartedAt: {
      type: Date,
      default: null,
    },
    visitCompletedAt: {
      type: Date,
      default: null,
    },
    checkedInAt: {
      type: Date,
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
    cancellationReason: {
      type: String,
      trim: true,
      default: '',
    },
    isCancelled: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Synchronize isCancelled flag with status before save
appointmentSchema.pre('save', function (next) {
  if (this.isModified('status') || this.isNew) {
    this.isCancelled = this.status === 'cancelled';
  }
  next();
});

// Atomic anti-double-booking unique index:
// Compliant with MongoDB partial index specification (using supported equality expression isCancelled: false instead of unsupported $nin)
appointmentSchema.index(
  { doctorId: 1, startTime: 1 },
  {
    unique: true,
    partialFilterExpression: {
      isCancelled: false,
    },
  }
);

export const Appointment = mongoose.model('Appointment', appointmentSchema);
