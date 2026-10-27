import express from 'express';
import { Doctor } from '../models/Doctor.js';
import { DoctorSchedule } from '../models/DoctorSchedule.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { getAvailableSlotsForDate } from '../services/slotService.js';

const router = express.Router();

// GET /api/doctors - Get active doctors list
router.get('/', authenticate, async (req, res) => {
  try {
    const doctors = await Doctor.find({ isActive: true })
      .select('_id displayName specialty appointmentDuration isActive')
      .populate('userId', 'email name');
    return res.json({ doctors });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to retrieve doctors' });
  }
});

// GET /api/doctors/:id/schedule - Get doctor's weekly schedule rules
router.get('/:id/schedule', authenticate, async (req, res) => {
  try {
    const schedules = await DoctorSchedule.find({
      doctorId: req.params.id,
      isActive: true,
    }).sort({ dayOfWeek: 1 });
    return res.json({ schedules });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to retrieve schedule' });
  }
});

// GET /api/doctors/:id/slots?date=YYYY-MM-DD - Get slots for a specific date
router.get('/:id/slots', authenticate, async (req, res) => {
  try {
    const { date } = req.query;
    if (!date) {
      return res.status(400).json({ error: 'Query parameter date (YYYY-MM-DD) is required.' });
    }

    const slotData = await getAvailableSlotsForDate(req.params.id, date);
    return res.json(slotData);
  } catch (error) {
    return res.status(400).json({ error: error.message || 'Failed to calculate available slots' });
  }
});

// GET /api/doctors/me/profile - Doctor-only endpoint
router.get('/me/profile', authenticate, requireRole('doctor'), async (req, res) => {
  try {
    const doctor = await Doctor.findOne({ userId: req.user._id });
    if (!doctor) {
      return res.status(404).json({ error: 'Doctor profile not found' });
    }
    return res.json({ doctor });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch doctor profile' });
  }
});

export default router;
