const express = require('express');
const passport = require('passport');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const controllers = require('../controllers');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const JWT_SECRET = process.env.JWT_SECRET || 'meditrack_super_secret_jwt_key_12345';

// Authenticator Middleware
const requireAuth = passport.authenticate('jwt', { session: false });

// Role Verifiers
const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    return next();
  }
  return res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
};

const isDoctorOrAdmin = (req, res, next) => {
  if (req.user && (req.user.role === 'doctor' || req.user.role === 'admin')) {
    return next();
  }
  return res.status(403).json({ error: 'Access denied. Doctor or Administrator privileges required.' });
};

const isDoctor = (req, res, next) => {
  if (req.user && req.user.role === 'doctor') {
    return next();
  }
  return res.status(403).json({ error: 'Access denied. Doctor privileges required.' });
};

// ==========================================
// 1. PUBLIC AUTHENTICATION ROUTES
// ==========================================
router.post('/auth/register', controllers.register);
router.post('/auth/login', controllers.login);
router.post('/auth/doctor-login', controllers.doctorLogin);

// ==========================================
// GOOGLE OAUTH ROUTES
// ==========================================
router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get(
  '/auth/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login-error' }),
  (req, res) => {
    try {
      const token = jwt.sign({ id: req.user._id, role: req.user.role }, JWT_SECRET, { expiresIn: '7d' });
      // Redirect back to frontend with token in the query params
      const targetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}?token=${token}`;
      res.redirect(targetUrl);
    } catch (err) {
      res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:5173'}?error=oauth_failed`);
    }
  }
);

// ==========================================
// 2. PROTECTED PROFILE ROUTES
// ==========================================
router.get('/profile', requireAuth, controllers.getProfile);
router.put('/profile', requireAuth, controllers.updateProfile);

// ==========================================
// 3. APPOINTMENT ROUTES
// ==========================================
router.post('/appointments', requireAuth, controllers.bookAppointment);
router.get('/appointments', requireAuth, controllers.getAppointments);
router.put('/appointments/:id', requireAuth, controllers.updateAppointmentStatus);
router.put('/appointments/:id/prescription', requireAuth, isDoctor, controllers.addPrescription);

// ==========================================
// 4. HEALTH TRACKER ROUTES
// ==========================================
router.post('/health-logs', requireAuth, controllers.addHealthLog);
router.get('/health-logs', requireAuth, controllers.getHealthLogs);

// ==========================================
// 5. MEDICAL RECORD ROUTES (Cloudinary)
// ==========================================
router.post('/medical-records', requireAuth, upload.single('file'), controllers.uploadMedicalRecord);
router.get('/medical-records', requireAuth, controllers.getMedicalRecords);
router.delete('/medical-records/:id', requireAuth, controllers.deleteMedicalRecord);

// ==========================================
// 6. MEDICATION SCHEDULE ROUTES
// ==========================================
router.post('/medications', requireAuth, controllers.addMedication);
router.get('/medications', requireAuth, controllers.getMedications);
router.delete('/medications/:id', requireAuth, controllers.deleteMedication);

// ==========================================
// 7. REAL-TIME CHAT HISTORY ROUTES
// ==========================================
router.get('/chat/history/:partnerId', requireAuth, controllers.getChatHistory);

// ==========================================
// 8. DOCTOR/SPECIALIZATION LISTING
// ==========================================
router.get('/doctors', requireAuth, controllers.getDoctors);
router.get('/specializations', requireAuth, controllers.getSpecializations);

// ==========================================
// 9. ADMIN MODERATION & ANALYTICS
// ==========================================
router.get('/admin/analytics', requireAuth, isAdmin, controllers.getAnalytics);
router.get('/admin/users', requireAuth, isAdmin, controllers.getUsers);
router.put('/admin/users/:id/status', requireAuth, isAdmin, controllers.updateUserStatus);
router.post('/admin/doctors', requireAuth, isAdmin, controllers.promoteToDoctor);
router.delete('/admin/doctors/:id', requireAuth, isAdmin, controllers.demoteDoctor);

module.exports = router;
