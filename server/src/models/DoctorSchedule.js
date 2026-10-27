import mongoose from 'mongoose';

const breakIntervalSchema = new mongoose.Schema(
  {
    startTime: {
      type: String, // "HH:mm" (24-hour format)
      required: true,
    },
    endTime: {
      type: String, // "HH:mm"
      required: true,
    },
    label: {
      type: String,
      default: 'Lunch Break',
    },
  },
  { _id: false }
);

const doctorScheduleSchema = new mongoose.Schema(
  {
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      required: true,
      index: true,
    },
    dayOfWeek: {
      type: Number, // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
      required: true,
      min: 0,
      max: 6,
    },
    startTime: {
      type: String, // "09:00"
      required: true,
    },
    endTime: {
      type: String, // "17:00"
      required: true,
    },
    breakIntervals: [breakIntervalSchema],
    clinicTimezone: {
      type: String,
      default: 'Asia/Kolkata',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to ensure 1 schedule rule per doctor per day of week
doctorScheduleSchema.index({ doctorId: 1, dayOfWeek: 1 }, { unique: true });

export const DoctorSchedule = mongoose.model('DoctorSchedule', doctorScheduleSchema);
