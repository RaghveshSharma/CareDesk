# 🏥 CareDesk — Clinic Appointment & Visit Workflow System

<div align="center">

![CareDesk Logo](https://img.shields.io/badge/CareDesk-Clinic_Workflow_System-0284c7?style=for-the-badge&logo=medlineplus&logoColor=white)

[![Node.js](https://img.shields.io/badge/Node.js-v20%2B-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-v19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![Express](https://img.shields.io/badge/Express-v4.21-000000?style=flat-square&logo=express&logoColor=white)](https://expressjs.com/)
[![MongoDB Atlas](https://img.shields.io/badge/MongoDB-Atlas_Replica_Set-47A248?style=flat-square&logo=mongodb&logoColor=white)](https://www.mongodb.com/atlas)
[![Vite](https://img.shields.io/badge/Vite-v8.3-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Security](https://img.shields.io/badge/Auth-100%25_Zero--Storage_HttpOnly_Cookies-blueviolet?style=flat-square&logo=auth0&logoColor=white)](#-security--data-privacy-architecture)
[![Concurrency](https://img.shields.io/badge/Concurrency-Atomic_CAS_Mutex-success?style=flat-square)](#-how-it-works-technical-deep-dive)
[![Deployment](https://img.shields.io/badge/Deployment-Render_%2B_Vercel-black?style=flat-square&logo=vercel&logoColor=white)](#-cloud-deployment-guide-render--vercel)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

**An enterprise-grade, race-safe outpatient clinic management platform engineered with React, Node.js, Express, and MongoDB Atlas.**  
*Enforcing strict Role-Based Access Control (RBAC), atomic database-level concurrency locks, server-validated slot scheduling, rotational receptionist shifts with automatic queue cycles, and zero-client-storage security.*

[Quick Start](#-quick-start-in-2-commands) • [Demo Accounts](#-pre-seeded-evaluation-credentials) • [Architecture](#-system-architecture--workflows) • [Deployment Guide](#-cloud-deployment-guide-render--vercel) • [API Docs](#-complete-api-reference)

</div>

---

## 📋 Table of Contents
- [Executive Overview](#-executive-overview)
- [Quick Start in 2 Commands](#-quick-start-in-2-commands)
- [Pre-Seeded Evaluation Credentials](#-pre-seeded-evaluation-credentials)
- [System Architecture & Workflows](#-system-architecture--workflows)
- [Role-Based Dashboard Features](#-role-based-dashboard-features)
- [How It Works: Technical Deep Dive](#-how-it-works-technical-deep-dive)
  - [1. Race-Safe Consultation Mutex](#1-the-one-active-consultation-concurrency-mutex)
  - [2. Interval-Overlap Slot Booking Engine](#2-interval-overlap-prevention--partial-unique-indexes)
  - [3. Patient Record Isolation Boundary](#3-strict-patient-record-isolation)
  - [4. Server-Side Schedule Validator](#4-server-validated-doctor-schedules)
- [Automated Verification & Testing](#-automated-verification--testing)
- [Cloud Deployment Guide (Render + Vercel)](#-cloud-deployment-guide-render--vercel)
- [Complete API Reference](#-complete-api-reference)
- [Project Directory Structure](#-project-directory-structure)
- [Security & Data Privacy Architecture](#-security--data-privacy-architecture)

---

## 🌟 Executive Overview

In busy outpatient clinics, high-concurrency booking conflicts, unauthorized access to medical records, and race conditions during simultaneous consultations can lead to severe operational chaos and HIPAA/GDPR non-compliance.

**CareDesk** solves these challenges with architectural rigor:
1. **Atomic Consultation Mutex**: Guarantees a doctor can never attend to more than one patient at a time, backed by atomic compare-and-swap MongoDB operations that are 100% race-safe.
2. **Server-Side Slot & Overlap Protection**: Mathematical validation ensures no appointment can overlap with another booked consultation, reinforced by a MongoDB partial unique index.
3. **Zero-Client-Storage Security**: No JWTs, passwords, or tokens are ever stored in `localStorage` or `sessionStorage`. All authentication relies on secure `HttpOnly`, `SameSite=None` (production) cookies, rendering the application immune to token theft via XSS.
4. **Patient Data Scoping**: Patients can only inspect their own records. Doctors can only view health histories of patients actively assigned to their consultations.
5. **Rotational Shift Rostering**: 3-shift operational cycle with live queue transitions and emergency on-call physician routing.

---

## 🚀 Quick Start in 2 Commands

### Prerequisites
- **Node.js 20.18+ or 22+**
- **npm 10+**
- Internet access for initial dependency downloads and MongoDB Atlas connection.

```bash
# 1. Install all dependencies across root, server, and client
npm run setup

# 2. Seed database with certified demo accounts, doctor shift schedules, and patients
npm run seed
```

Start the application:

```bash
# Terminal 1: Backend Server (runs on http://localhost:5000)
npm run server:dev

# Terminal 2: Frontend Client (runs on http://localhost:5173)
npm run client
```

Navigate to **[http://localhost:5173](http://localhost:5173)**. Use the **1-Click Quick Login Bar** on the sign-in screen to instantly test any role without manual typing!

---

## 🔑 Pre-Seeded Evaluation Credentials

The database includes certified, pre-configured accounts representing all clinical roles:

| Role | Name | Email | Password | Responsibility / Operational Shift |
| :--- | :--- | :--- | :--- | :--- |
| 👑 **Administrator** | Dr. Rajesh Sharma, MD | `admin@caredesk.clinic` | `Password123!` | Executive oversight, staff provisioning, status governance, doctor schedules |
| 📋 **Receptionist 1** | Ananya Verma | `ananya.verma@caredesk.clinic` | `ananyaverma` | **Shift 1: Morning (08:00 – 16:00)** • Check-in, intake triage & booking |
| 📋 **Receptionist 2** | Elena Vance | `elena.vance@caredesk.clinic` | `elenavance` | **Shift 2: Evening (16:00 – 00:00)** • Follow-up intake & diagnostic handover |
| 🩺 **Doctor 1** | Dr. Priya Nair, MD | `dr.priyanair@caredesk.clinic` | `priyanair` | **Internal Medicine & Family Care** (Morning OPD Desk) |
| 🩺 **Doctor 2** | Dr. Arjun Mehta, MS | `dr.arjunmehta@caredesk.clinic` | `arjunmehta` | **Orthopedic Surgery & Sports Medicine** (Evening OPD Desk) |
| 🩺 **Doctor 3** | Dr. Sarah Jenkins, MD | `dr.sarahjenkins@caredesk.clinic` | `sarahjenkins` | **Pediatrics** • 🚨 **Emergency On-Call Doctor** (Night Triage) |
| 👤 **Patient 1** | Rohan Sharma | `rohan.sharma@gmail.com` | `patient123` | Patient ID: `PAT-2026-0001` • Self-service portal & personal booking history |
| 👤 **Patient 2** | Sneha Patel | `sneha.patel@gmail.com` | `patient123` | Patient ID: `PAT-2026-0002` • Prescription timeline & appointment reschedule |

---

## 🏗️ System Architecture & Workflows

### Deployment Topology
```text
┌───────────────────────────────┐
│     Client (Browser SPA)      │
│     React 19 + Vite 8.3       │
│   Hosted on Vercel Edge CDN   │
└───────────────┬───────────────┘
                │ HTTPS + credentials: 'include'
                ▼
┌───────────────────────────────┐
│       Backend API Gateway     │
│   Express 4 + Node.js (ESM)   │
│   Hosted on Render Web Svc    │
│   (Trust Proxy 1 + SameSite)  │
└───────────────┬───────────────┘
                │ Mongoose 8 (Connection Pool)
                ▼
┌───────────────────────────────┐
│     MongoDB Atlas Cluster     │
│  - Partial Unique Indexes     │
│  - Document Mutex Locks       │
│  - Atomic findOneAndUpdate    │
└───────────────────────────────┘
```

### Appointment Lifecycle State Machine

```mermaid
stateDiagram-v2
    [*] --> booked: Booked by Patient or Receptionist
    booked --> checked_in: Patient Arrives at Clinic (Check-In)
    booked --> cancelled: Cancelled by Patient or Receptionist (Slot Freed)
    booked --> no_show: Patient Fails to Attend (End of Day)
    
    checked_in --> in_consultation: Doctor Starts Visit (Atomic CAS Mutex Acquired)
    checked_in --> cancelled: Patient Leaves Prior to Consultation
    
    in_consultation --> completed: Doctor Concludes Visit (Lock Released + Rx Stored)
    
    completed --> [*]
    cancelled --> [*]
    no_show --> [*]
```

---

## 🎯 Role-Based Dashboard Features

### 1. Receptionist Hub (`/receptionist`)
* **Rotational Shift Indicator**: Shows real-time clinic shift based on current wall-clock time (`Morning 08:00–16:00`, `Evening 16:00–00:00`, or `Night/Emergency 00:00–08:00`), on-duty staff badge, and 2-receptionist coverage status.
* **Queue Handover & Rollover**: Explains the 08:00 AM queue transition where Night triage archives and Day intake begins anew.
* **Patient Intake with Duplicate Detection**: Soft-warning dialog if an incoming phone or email matches an existing patient, offering 1-click continuation or reuse.
* **Smart Appointment Booking**: Dynamic slot selector calculating doctor shift hours, lunch breaks, tea breaks, and active bookings with interval overlap validation.
* **1-Click Arrival Check-In**: Transitions appointments to `checked_in`, automatically sorting the doctor's waiting queue in chronological order of physical arrival.

### 2. Doctor Consultation Room (`/doctor`)
* **Single Active Consultation Guarantee**: Doctor can only attend to **one patient at a time**. The "Start Consultation" action acquires an atomic lock on the Doctor record (`activeConsultationId`).
* **Live Waiting Queue**: Real-time patient queue sorted chronologically by arrival time, displaying patient age, gender, reason for visit, and waiting duration.
* **Clinical Encounter Notes**: Integrated medical record drawer for recording symptoms, vitals, clinical observations, diagnosis, and prescription medications.
* **Atomic Complete Visit**: Concluding an appointment atomically transitions status to `completed`, releases the doctor's consultation lock, records the end timestamp, and updates queue counters.
* **Scoped Historical Chart**: View past visits, previous diagnosis notes, and medication timelines for patients assigned to the doctor.

### 3. Patient Self-Service Portal (`/portal` & `/patient`)
* **Real-Time Booking**: Book consultations with certified specialists, selecting from real-time available slots calculated server-side.
* **Interactive Timeline**: Visual stepper showing appointment progression: `Booked` ➔ `Checked In` ➔ `In Consultation` ➔ `Completed`.
* **Prescription & Visit Summaries**: View attending doctor, specialty, clinic room, and prescribed medications once consultation is complete.
* **Cancellation & Rescheduling**: Cancel or reschedule up to appointment time, immediately freeing the slot in the database for other patients.
* **Data Privacy**: Strictly limited to viewing **only their own** medical records and appointments.

### 4. Administrator Governance Center (`/admin`)
* **Clinical Performance Dashboard**: Real-time aggregated metrics across all doctors (total assigned, attended visits, queue wait count, no-shows, and percentage completion rate).
* **Staff Provisioning**: Securely provision new doctor and receptionist accounts under certified `@caredesk.clinic` credentials with cryptographic bcrypt hashing.
* **Shift Rostering & Rotation**: View receptionist shifts and rotate assignments with a single click (`Morning` ➔ `Evening` ➔ `Night`).
* **Doctor Working Hours & Breaks Editor**: Server-validated weekly schedule modal to configure shift start/end, lunch break, afternoon tea break, and Sunday clinics.
* **Instant Access Control (Pause / Terminate)**: Suspend or terminate compromised staff credentials in real time. Suspended users receive an immediate lock-out notification with administrator-specified audit reasons upon any API request.

---

## 🧭 How It Works: Technical Deep Dive

### 1. The "One Active Consultation" Concurrency Mutex

In standard web apps, checking if a doctor is busy and then updating the appointment is vulnerable to race conditions:
```text
Request A (Start Visit) ──► Check: No active consult? Yes ───► [Delay] ──► Start Visit
Request B (Start Visit) ─────────► Check: No active consult? Yes ────────► Start Visit  ❌ RACE HAZARD!
```

**CareDesk Solution**: Document-level atomic compare-and-swap mutex directly on MongoDB:

```javascript
// server/src/routes/appointmentRoutes.js

// 1. Reject already-started visits upfront before touching any locks
if (appointment.status === 'in_consultation') {
  return res.status(400).json({ error: 'This visit is already in consultation.' });
}

// 2. Atomically lock doctor record strictly from activeConsultationId: null
const lockAcquired = await Doctor.findOneAndUpdate(
  { _id: doctorId, activeConsultationId: null },
  { activeConsultationId: appointment._id },
  { new: true }
);

if (!lockAcquired) {
  return res.status(409).json({
    error: 'Doctor already has an active consultation in progress. Complete the current consultation before starting another.',
  });
}

// 3. Atomically update appointment status to in_consultation
// If any subsequent error occurs, release ONLY if newly acquired by this request
```

If two requests arrive at the exact same millisecond, MongoDB's write lock ensures only **one** transaction succeeds; the other is immediately rejected with HTTP `409 Conflict`. Repeated calls to already-started visits are safely blocked at step 1 before touching any lock, ensuring locks are never cleared accidentally.

---

### 2. Interval-Overlap Prevention & Partial Unique Indexes

MongoDB partial indexes only support equality (`$eq`), `$exists`, `$gt`, `$lt`, and `$type` expressions (`$nin` is unsupported). CareDesk implements an automated schema hook maintaining an explicit Boolean field `isCancelled`:

```javascript
// server/src/models/Appointment.js
appointmentSchema.index(
  { doctorId: 1, startTime: 1 },
  {
    unique: true,
    partialFilterExpression: { isCancelled: false },
  }
);
```

In addition, CareDesk enforces **slot alignment and interval overlap checks** on the server:
- An incoming booking request's start time must align with the doctor's approved schedule slot intervals (e.g. `14:00`, `14:20`, `14:40`).
- If an appointment exists for `14:00 - 14:35`, an overlapping booking at `14:25` is mathematically rejected with HTTP `409 Conflict`.

---

### 3. Strict Patient Record Isolation

To prevent horizontal privilege escalation and unauthorized access:
- **Patient Requests**: Patients can only query `/api/appointments` and `/api/patients/:id` for their own `patientProfile`. Any attempt to supply another patient's ID is rejected with `403 Forbidden`.
- **Doctor Requests**: Doctors can only access patient charts if an appointment exists between that doctor and patient:
  ```javascript
  const hasRelationship = await Appointment.exists({
    doctorId: req.user.doctorId,
    patientId: patient._id,
  });
  if (!hasRelationship) {
    return res.status(403).json({
      error: 'Access Restricted: You may only view patient records assigned to your consultations.',
    });
  }
  ```

---

### 4. Server-Validated Doctor Schedules

Schedule modification is protected on the server (`PUT /api/admin/doctors/:id/schedules`):
- `workEnd` must be strictly later than `workStart`.
- Break intervals (`lunchStart`/`lunchEnd`, `teaStart`/`teaEnd`) must be fully contained within working hours.
- Break intervals cannot overlap each other.
- Slot duration must be an integer between 5 and 60 minutes.

---

## 🧪 Automated Verification & Testing

CareDesk includes automated tests to verify concurrency and scheduling rules:

```bash
# Run the automated interval-overlap and slot alignment test suite
npm test
```

### What `npm test` Exercises:
1. **Unapproved Slot Alignment**: Attempts to book an unaligned start time (`14:10`) that falls between standard slots. Asserts server rejection (`400 Bad Request`).
2. **Genuine Interval Overlap**: Books a baseline slot (`14:00 - 14:35`) and attempts to book an approved slot start time (`14:25`) that falls inside the first appointment's duration. Asserts server rejection (`409 Conflict`).
3. **Database Index Verification**: Checks that MongoDB Atlas reports `doctorId_1_startTime_1` as an active partial unique index.
4. **Zero Residual Artifacts**: All test appointments are automatically purged from the database after testing. Supports `TEST_MONGODB_URI` for completely isolated test clusters.

---

## ☁️ Cloud Deployment Guide (Render + Vercel)

### Architecture Notes for Cross-Origin Deployment
When the frontend is deployed on **Vercel** (`https://*.vercel.app`) and the backend is deployed on **Render** (`https://*.onrender.com`), browsers treat them as different origins:
1. **Reverse Proxy Trust**: The backend uses `app.set('trust proxy', 1)` so Express correctly identifies HTTPS connections forwarded by Render's proxy.
2. **SameSite Cookies**: Authentication cookies are set with `sameSite: 'none'` and `secure: true` in production, allowing cookies to travel across cross-origin `fetch` calls.
3. **Credentials Support**: Every client API call uses `credentials: 'include'` via our centralized `apiFetch` service.
4. **SPA Rewrites**: `client/vercel.json` rewrites all sub-routes to `/index.html` to eliminate 404s on page refresh.

---

### Step 1: Deploy Backend on Render

1. Log in to your [Render Dashboard](https://dashboard.render.com/) and click **New +** ➔ **Web Service**.
2. Connect your GitHub repository: `RaghveshSharma/CareDesk`.
3. Configure the service:
   - **Name**: `caredesk-api`
   - **Branch**: `main`
   - **Root Directory**: `server`
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node index.js`
4. Set the following **Environment Variables**:

| Variable Name | Example Value | Purpose |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Enables secure `SameSite=None` cookies and proxy handling |
| `PORT` | `5000` | Port for Express listener |
| `MONGODB_URI` | `mongodb+srv://user:pass@cluster.mongodb.net/caredesk` | MongoDB Atlas Replica Set connection string |
| `JWT_SECRET` | `caredesk_production_jwt_secret_key_2026_supersecure` | Minimum 32-character signing key |
| `CLIENT_URL` | `https://your-caredesk-frontend.vercel.app` | Your Vercel frontend origin |

5. Click **Create Web Service**. When deployment completes, copy your Render URL (e.g. `https://caredesk-api.onrender.com`).

---

### Step 2: Deploy Frontend on Vercel

1. Log in to your [Vercel Dashboard](https://vercel.com/dashboard) and click **Add New...** ➔ **Project**.
2. Import the `CareDesk` repository.
3. Configure project settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: Click *Edit* and select **`client`**
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Set the **Environment Variable**:

| Variable Name | Value | Purpose |
| :--- | :--- | :--- |
| `VITE_API_URL` | `https://caredesk-api.onrender.com` | Your Render backend URL *(no trailing slash)* |

5. Click **Deploy**. Vercel will build and assign your domain (e.g. `https://caredesk.vercel.app`).

---

### Step 3: Complete the Handshake

1. Copy your live Vercel URL (e.g. `https://caredesk.vercel.app`).
2. Go to **Render Dashboard** ➔ `caredesk-api` ➔ **Environment**.
3. Update `CLIENT_URL` with your exact Vercel URL and save. Render will redeploy automatically.

---

## 🔌 Complete API Reference

| Method | Endpoint | Authorization | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Public | Authenticates credentials, issues HttpOnly cookie |
| `POST` | `/api/auth/register-patient`| Public | Self-service patient portal signup |
| `GET` | `/api/auth/me` | Authenticated | Returns current session identity, role, and shift |
| `POST` | `/api/auth/logout` | Authenticated | Clears HttpOnly cookie |
| `GET` | `/api/appointments` | Scoped | List appointments (Patients see only own; Doctors see own) |
| `GET` | `/api/appointments/:id` | Protected | Details for an appointment with ownership verification |
| `POST` | `/api/appointments` | Receptionist / Patient | Creates booking with slot alignment and overlap check |
| `PATCH`| `/api/appointments/:id/check-in` | Receptionist | Marks arrival and assigns queue position |
| `PATCH`| `/api/appointments/:id/start-visit` | Doctor (Self Only) | **Atomic Mutex**: Acquires consultation lock from `null` |
| `PATCH`| `/api/appointments/:id/complete-visit` | Doctor (Self Only) | Saves clinical notes/Rx, releases lock, marks completed |
| `PATCH`| `/api/appointments/:id/cancel` | Receptionist / Patient | Cancels booking, sets `isCancelled: true`, frees slot |
| `PATCH`| `/api/appointments/:id/no-show` | Receptionist | Records patient no-show at end of clinic hours |
| `GET` | `/api/patients/:id` | Scoped | Patient health profile (Scoped to assigned doctors & patient) |
| `GET` | `/api/patients/search` | Receptionist | Fast phone/name lookup during front-desk intake |
| `GET` | `/api/doctors` | Authenticated | Lists all active doctors, specialties, and bios |
| `GET` | `/api/doctors/:id/available-slots` | Authenticated | Calculates real-time open slots based on schedule & bookings |
| `GET` | `/api/admin/staff` | Admin | Real-time staff list with live clinical performance metrics |
| `POST` | `/api/admin/staff` | Admin | Provisions new staff account (`@caredesk.clinic`) |
| `PATCH`| `/api/admin/staff/:id/status` | Admin | Suspends, terminates, or reactivates staff account |
| `PATCH`| `/api/admin/staff/:id/shift` | Admin | Rotates receptionist shift assignment |
| `PUT` | `/api/admin/doctors/:id/schedules` | Admin | Validates and updates doctor working hours & breaks |

---

## 🗂️ Project Directory Structure

```text
CareFlow/
├── .env.example                     # Environment template (safe for version control)
├── .gitignore                       # Protects node_modules, .env, and build artifacts
├── package.json                     # Root orchestrator (setup, seed, test, client, server)
├── README.md                        # Master enterprise documentation
│
├── server/                          # Backend API (Express 4 + Node.js ESM)
│   ├── index.js                     # Server entry point & database connection
│   ├── package.json                 # Backend dependencies (mongoose, bcryptjs, jsonwebtoken)
│   └── src/
│       ├── app.js                   # Express app, CORS, reverse proxy trust, routes
│       ├── config/                  # Database connection & connection retry logic
│       ├── middleware/              # Auth & RBAC guards (authenticate, requireRole)
│       ├── models/                  # Mongoose Schemas (User, Doctor, Schedule, Patient, Appointment)
│       ├── routes/                  # API endpoints (auth, appointment, doctor, admin, patient)
│       ├── services/                # Dynamic slot calculation engine (slotService.js)
│       └── utils/
│           ├── backfillAndIndex.js  # Partial unique index sync & schema backfill
│           ├── seedRunner.js        # Repeatable idempotency database seed runner
│           └── testOverlap.js       # Interval overlap & slot alignment test suite
│
└── client/                          # Frontend SPA (Vite + React 19)
    ├── package.json                 # Frontend dependencies (lucide-react, react-router)
    ├── vite.config.js               # Dev server proxy configuration
    ├── vercel.json                  # SPA rewrite rules for Vercel deployment
    ├── index.html                   # HTML5 entry with Inter font & viewport metadata
    └── src/
        ├── App.jsx                  # Main router & Role-Based Protected Routes
        ├── main.jsx                 # Application DOM mount
        ├── index.css                # Custom CSS design system (tokens, badges, tables)
        ├── context/                 # AuthContext (HttpOnly session state management)
        ├── components/              # Reusable UI (Modals, Toast alerts, Badges, Header)
        ├── pages/                   # Role Dashboards (Admin, Doctor, Receptionist, Patient, Login)
        └── services/                # Centralized apiFetch with credentials: 'include'
```

---

## 🔐 Security & Data Privacy Architecture

- **100% Zero-Client-Storage**: Tokens and credentials are never placed in browser storage (`localStorage` / `sessionStorage`). Sessions rely strictly on `HttpOnly`, `SameSite=None` (production) cookies.
- **Bcrypt Password Encryption**: All staff and patient passwords hashed with 10 salt rounds.
- **Server-Side Authorization**: Every API route enforces role-based access control. Front-desk staff cannot call clinical or administrative endpoints.
- **Administrative Lockout Protection**: The system prevents administrators from accidentally suspending or terminating their own active account.
- **Idempotent Seeding & Sandbox Testing**: Seed scripts and overlap tests support isolated database URIs (`DEMO_MONGODB_URI`, `TEST_MONGODB_URI`) to guarantee zero interference with production records.

---

<div align="center">
  <sub>CareDesk Clinic Appointment & Visit Workflow System • Built for reliability, concurrency safety, and patient trust.</sub>
</div>
