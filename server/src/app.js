import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/authRoutes.js';
import patientRoutes from './routes/patientRoutes.js';
import doctorRoutes from './routes/doctorRoutes.js';
import appointmentRoutes from './routes/appointmentRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import patientPortalRoutes from './routes/patientPortalRoutes.js';

const app = express();

// Trust reverse proxy for Render / Cloud deployments (enables secure cookies behind HTTPS proxy)
app.set('trust proxy', 1);

// Normalize and prepare allowed origins
const clientUrls = (process.env.CLIENT_URL || '')
  .split(',')
  .map((u) => u.trim().replace(/\/$/, ''))
  .filter(Boolean);

const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  ...clientUrls,
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, Postman, or server-to-server)
      if (!origin) {
        return callback(null, true);
      }

      const normalizedOrigin = origin.replace(/\/$/, '');

      // Allow if exact match, or if on localhost during development, or any vercel.app deployment
      if (
        allowedOrigins.includes(normalizedOrigin) ||
        (process.env.NODE_ENV !== 'production' && normalizedOrigin.startsWith('http://localhost:')) ||
        normalizedOrigin.endsWith('.vercel.app')
      ) {
        return callback(null, true);
      }

      // Strictly reject origins outside the approved whitelist
      const corsError = new Error(`CORS Error: Origin '${origin}' is not authorized.`);
      corsError.statusCode = 403;
      return callback(corsError);
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

// Request logger (clean, ignore periodic background polling to keep terminal clean)
app.use((req, res, next) => {
  if (!req.originalUrl.includes('/metrics') && !req.originalUrl.includes('/health') && req.method !== 'GET') {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.originalUrl}`);
  }
  next();
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/patient', patientPortalRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'CareDesk Workflow System API',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'API route not found' });
});

// Centralized error handling
app.use((err, req, res, next) => {
  console.error('CareDesk Server Error:', err.message);

  if (err.message && err.message.startsWith('CORS Error:')) {
    return res.status(403).json({ error: err.message });
  }

  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ error: messages.join('. ') });
  }

  if (err.code === 11000) {
    return res.status(409).json({
      error: 'Conflict: Record with identical unique key or active slot already exists.',
    });
  }

  const statusCode = err.statusCode || 500;
  return res.status(statusCode).json({
    error: err.message || 'An unexpected server error occurred.',
  });
});

export default app;
