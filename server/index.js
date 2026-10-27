import dotenv from 'dotenv';
import app from './src/app.js';
import { connectDB } from './src/config/db.js';
import { User } from './src/models/User.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '.env') });

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();

    // Ensure admin user is present
    let admin = await User.findOne({ role: 'admin' });
    if (!admin) {
      if (process.env.NODE_ENV === 'production') {
        console.warn(
          '⚠️  Production Security Notice: No administrator account detected in persistent database. Please provision an admin account using secure environment credentials rather than fixed defaults.'
        );
      } else {
        const passwordHash = await User.hashPassword('Password123!');
        await User.create({
          name: 'Dr. Rajesh Sharma, MD (Clinic Director / Admin)',
          email: 'admin@caredesk.clinic',
          passwordHash,
          role: 'admin',
          isActive: true,
        });
        console.log('👑 Development/Demo Mode: Initialized Admin account: admin@caredesk.clinic');
      }
    } else {
      console.log(`👑 Admin account ready: ${admin.email}`);
    }

    const server = app.listen(PORT, () => {
      console.log(`🚀 CareDesk Server is running at http://localhost:${PORT}`);
      console.log(`📋 Health check: http://localhost:${PORT}/api/health`);
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use by another running process.`);
        console.error(`💡 Tip: Close any existing terminal running node on port ${PORT}.`);
        process.exit(1);
      } else {
        console.error('❌ Server error:', err);
      }
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
