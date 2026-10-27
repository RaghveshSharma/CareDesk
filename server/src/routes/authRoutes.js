import express from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/User.js';
import { Doctor } from '../models/Doctor.js';
import { Patient } from '../models/Patient.js';
import { generateToken, authenticate } from '../middleware/auth.js';

const router = express.Router();

// Helper to generate next unique Patient ID
const generatePatientId = async () => {
  const currentYear = new Date().getFullYear();
  const count = await Patient.countDocuments();
  const sequence = String(count + 1).padStart(4, '0');
  let id = `PAT-${currentYear}-${sequence}`;
  let exists = await Patient.findOne({ patientId: id });
  while (exists) {
    const randSuffix = Math.floor(1000 + Math.random() * 9000);
    id = `PAT-${currentYear}-${randSuffix}`;
    exists = await Patient.findOne({ patientId: id });
  }
  return id;
};

// POST /api/auth/register-patient & /api/auth/register (Public Patient Portal Signup)
router.post(['/register', '/register-patient'], async (req, res) => {
  try {
    const { fullName, email, phone, password, dateOfBirth, gender } = req.body;

    if (!fullName || !email || !phone || !password) {
      return res.status(400).json({
        error: 'Full name, email address, phone number, and password are required.',
      });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPhone = phone.trim();

    // Prevent unauthorized registration under clinic staff domain
    if (trimmedEmail.endsWith('@caredesk.clinic')) {
      return res.status(400).json({
        error:
          '@caredesk.clinic email addresses are reserved for authorized clinic staff provisioned directly by the Clinic Administrator. Please use your personal email address as a patient.',
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: trimmedEmail });
    if (existingUser) {
      return res.status(400).json({
        error: 'An account with this email address already exists. Please sign in.',
      });
    }

    // Check if patient record already exists with this phone or email
    let patient = await Patient.findOne({
      $or: [{ email: trimmedEmail }, { phone: trimmedPhone }],
    });

    if (!patient) {
      const patientId = await generatePatientId();
      patient = await Patient.create({
        patientId,
        fullName: fullName.trim(),
        phone: trimmedPhone,
        email: trimmedEmail,
        dateOfBirth: dateOfBirth ? dateOfBirth.trim() : '',
        gender: gender || '',
      });
    }

    const passwordHash = await User.hashPassword(password);
    const user = await User.create({
      name: fullName.trim(),
      email: trimmedEmail,
      passwordHash,
      role: 'patient',
      patientProfile: patient._id,
      status: 'active',
      isActive: true,
    });

    const token = generateToken(user);

    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('caredesk_token', token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      maxAge: 8 * 60 * 60 * 1000,
    });

    return res.status(201).json({
      message: 'Account created successfully! Welcome to CareDesk Patient Portal.',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        patientCode: patient.patientId,
        patientProfile: patient._id,
      },
    });
  } catch (error) {
    console.error('Patient signup error:', error);
    return res.status(500).json({ error: error.message || 'Failed to complete registration' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: 'Please provide both email and password.',
      });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: trimmedEmail });
    if (!user) {
      return res.status(401).json({
        error: 'Invalid email or password.',
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        error: 'Invalid email or password.',
      });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({
        error: `Account Suspended: Your staff account access has been temporarily paused by the Clinic Administrator. Reason: "${user.statusReason || 'Administrative review'}". Please contact admin@caredesk.clinic for reinstatement.`,
        accountStatus: 'suspended',
      });
    }

    if (user.status === 'terminated') {
      return res.status(403).json({
        error: `Access Terminated: Your staff account access has been permanently revoked by the Clinic Administrator. Reason: "${user.statusReason || 'Administrative termination'}". Please contact admin@caredesk.clinic if you believe this is in error.`,
        accountStatus: 'terminated',
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        error: 'Account access is currently inactive. Please contact admin@caredesk.clinic.',
        accountStatus: 'inactive',
      });
    }

    const token = generateToken(user);

    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('caredesk_token', token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      maxAge: 8 * 60 * 60 * 1000,
    });

    let doctorInfo = null;
    let patientInfo = null;

    if (user.role === 'doctor') {
      doctorInfo = await Doctor.findOne({ userId: user._id });
    } else if (user.role === 'patient') {
      if (user.patientProfile) {
        patientInfo = await Patient.findById(user.patientProfile);
      } else {
        patientInfo = await Patient.findOne({ email: user.email });
      }
    }

    return res.json({
      message: 'Signed in successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        shift: user.shift || 'morning',
        shiftHours: user.shiftHours || '08:00 - 16:00',
        isEmergencyOnCall: !!user.isEmergencyOnCall,
        doctorId: doctorInfo ? doctorInfo._id : null,
        displayName: doctorInfo ? doctorInfo.displayName : user.name,
        patientCode: patientInfo ? patientInfo.patientId : null,
        patientProfile: patientInfo ? patientInfo._id : null,
      },
    });
  } catch (error) {
    console.error('Login error:', error.message);
    return res.status(500).json({ error: 'Internal server error during login' });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  try {
    let doctorInfo = null;
    let patientInfo = null;

    if (req.user.role === 'doctor') {
      doctorInfo = await Doctor.findOne({ userId: req.user._id });
    } else if (req.user.role === 'patient') {
      if (req.user.patientProfile) {
        patientInfo = await Patient.findById(req.user.patientProfile);
      } else {
        patientInfo = await Patient.findOne({ email: req.user.email });
      }
    }

    return res.json({
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        shift: req.user.shift || 'morning',
        shiftHours: req.user.shiftHours || '08:00 - 16:00',
        isEmergencyOnCall: !!req.user.isEmergencyOnCall,
        doctorId: doctorInfo ? doctorInfo._id : null,
        displayName: doctorInfo ? doctorInfo.displayName : req.user.name,
        patientCode: patientInfo ? patientInfo.patientId : null,
        patientProfile: patientInfo ? patientInfo._id : null,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to verify session' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  const isProduction = process.env.NODE_ENV === 'production';
  res.clearCookie('caredesk_token', {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
  });
  return res.json({ message: 'Signed out successfully' });
});

export default router;
