# MediTrack - Personal Health & Appointment Management System

MediTrack is a secure, responsive, and modern full-stack web application designed to help patients track health metrics (weight, blood pressure, glucose), schedule and review consultations with doctors, upload medical record reports (PDFs), manage medication lists, and communicate with clinicians in real-time.

## Technology Stack

- **Frontend**: React 18 + Vite (no CSS frameworks, pure inline styles for maximum control, Google Fonts - Outfit & Inter)
- **Backend**: Node.js + Express.js + Mongoose + Socket.io
- **Database**: MongoDB (Atlas free tier)
- **Authentication**: JWT + Google OAuth 2.0 (Passport.js) + standard email/password
- **File Upload**: Cloudinary (free tier) for PDF documents

---

## Getting Started

### 1. Installation

Run the root command to install dependencies for the root package, the backend server, and the frontend client concurrently:

```bash
npm run install:all
```

### 2. Configuration

Create and configure a `backend/.env` file with your credentials (see `backend/.env.example` as a template):

```env
PORT=5000
MONGODB_URI=your_mongodb_atlas_connection_string
JWT_SECRET=your_jwt_signing_key_here
GOOGLE_CLIENT_ID=your_google_oauth_client_id
GOOGLE_CLIENT_SECRET=your_google_oauth_client_secret
GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/google/callback
FRONTEND_URL=http://localhost:5173
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
```

### 3. Seed Database

MediTrack comes with a pre-wired seeding script that populates a platform Administrator account and three Doctor accounts with different specializations (Cardiology, Dermatology, Pediatrics):

```bash
npm run seed
```

#### Pre-seeded Accounts
- **Administrator**:
  - Email: `admin@meditrack.com`
  - Password: `adminpassword123`
- **Clinicians** (Specialists):
  - Email: `doctor.alice@meditrack.com` / Password: `doctorpassword123` (Cardiology)
  - Email: `doctor.bob@meditrack.com` / Password: `doctorpassword123` (Dermatology)
  - Email: `doctor.clara@meditrack.com` / Password: `doctorpassword123` (Pediatrics)

### 4. Run Development Servers

Start both the backend API and frontend Vite servers concurrently with:

```bash
npm run dev
```

The frontend application will open at [http://localhost:5173](http://localhost:5173) and the backend API will run at [http://localhost:5000](http://localhost:5000).

---

## Application Roles & Features

### 1. Patient Panel
- Register with email/password or use Google Sign-In.
- **Health Logs**: Record weight, blood glucose, and blood pressure readings. High-fidelity dynamic SVG line graphs trace values historically.
- **Consultations**: Choose medical specialization, pick active doctor, select slot, and schedule appointment.
- **Documents**: Upload PDF health records directly to Cloudinary and read/download them.
- **Medications**: Manage medication schedules with dosage and frequency details.
- **Clinician Chat**: Send and receive real-time Socket.io messages with doctors.

### 2. Clinician Panel (Doctor Portal)
- Accessible through the specialized login screen at `/doctor-login`.
- **Today's Queue**: Complete scheduled bookings, cancel slots, and write prescription notes.
- **Patient History**: Access patients' logs, active medications, and uploaded PDF medical reports.
- **Patient Chat**: Communicate with patient queue.

### 3. Administrator Panel
- **Statistics**: Total users, total active clinicians, total patients, and scheduled/completed/cancelled ratios.
- **Doctors**: Promote standard accounts to Doctor roles and assign their specialty/biographies, or demote them.
- **Moderate Users**: Suspend or reactivate user accounts. Suspending accounts revokes session validity immediately.
- **Logs**: Read all platform appointments with scheduled status filters.
