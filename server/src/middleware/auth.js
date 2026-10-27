import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { Doctor } from '../models/Doctor.js';
import { Patient } from '../models/Patient.js';

const DEV_FALLBACK_SECRET = 'caredesk_dev_secret_key_clinic_2026';

// Production guardrail: require dedicated production JWT_SECRET
if (process.env.NODE_ENV === 'production') {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === DEV_FALLBACK_SECRET) {
    throw new Error(
      'FATAL CONFIGURATION ERROR: A strong, dedicated JWT_SECRET environment variable is strictly required in production mode.'
    );
  }
}

const JWT_SECRET = process.env.JWT_SECRET || DEV_FALLBACK_SECRET;

export const generateToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: '8h' }
  );
};

export const authenticate = async (req, res, next) => {
  try {
    let token = null;

    if (req.cookies && req.cookies.caredesk_token) {
      token = req.cookies.caredesk_token;
    } else if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer ')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        error: 'Authentication required. Please sign in to continue.',
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({
        error: 'Session expired or invalid token. Please sign in again.',
      });
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({
        error: 'User account not found.',
      });
    }

    // Check account status: active, suspended, or terminated
    if (user.status === 'suspended') {
      return res.status(403).json({
        error: `Account Suspended: Your access has been temporarily paused by the Clinic Administrator. Reason: "${user.statusReason || 'Administrative review'}". Please contact admin@caredesk.clinic for reinstatement.`,
        accountStatus: 'suspended',
      });
    }

    if (user.status === 'terminated') {
      return res.status(403).json({
        error: `Access Terminated: Your staff account access has been permanently revoked by the Clinic Administrator. Reason: "${user.statusReason || 'Policy termination'}". Contact admin@caredesk.clinic if you believe this is in error.`,
        accountStatus: 'terminated',
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        error: 'Account access has been deactivated by the Administrator.',
        accountStatus: 'inactive',
      });
    }

    // Attach user to req
    req.user = user;

    // If role is doctor, ensure doctorProfile is resolved
    if (user.role === 'doctor') {
      const doctor = await Doctor.findOne({ userId: user._id });
      if (doctor) {
        req.doctor = doctor;
        req.user.doctorId = doctor._id;
      }
    } else if (user.role === 'patient') {
      let patient = null;
      if (user.patientProfile) {
        patient = await Patient.findById(user.patientProfile);
      } else {
        patient = await Patient.findOne({ email: user.email });
      }
      if (patient) {
        req.patient = patient;
        req.user.patientId = patient._id;
        req.user.patientCode = patient.patientId;
      }
    }

    next();
  } catch (error) {
    return res.status(500).json({ error: 'Authentication internal error' });
  }
};

export const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Role '${req.user.role}' is not authorized to access this resource.`,
      });
    }

    next();
  };
};

/**
 * Filter out sensitive fields according to requester role.
 * - Non-doctor / non-patient roles (e.g. Receptionist, Admin) must never receive visitSummary.
 * - Doctors and the patient themselves can receive their visit summary advice.
 */
export const filterAppointmentForRole = (appointment, userRole) => {
  if (!appointment) return null;
  const raw = appointment.toObject ? appointment.toObject() : { ...appointment };

  if (userRole === 'receptionist' || userRole === 'admin') {
    delete raw.visitSummary;
  }
  return raw;
};
