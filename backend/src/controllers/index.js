const jwt = require('jsonwebtoken');
const cloudinary = require('cloudinary').v2;
const User = require('../models/User');
const Doctor = require('../models/Doctor');
const Appointment = require('../models/Appointment');
const HealthLog = require('../models/HealthLog');
const MedicalRecord = require('../models/MedicalRecord');
const Medication = require('../models/Medication');
const Message = require('../models/Message');

const JWT_SECRET = process.env.JWT_SECRET || 'meditrack_super_secret_jwt_key_12345';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Helper: Generate JWT Token
const generateToken = (user) => {
  return jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
};

// ==========================================
// 1. AUTHENTICATION & PROFILE CONTROLLERS
// ==========================================

exports.register = async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    const user = new User({
      email,
      password,
      role: 'patient',
      profile: { name }
    });

    await user.save();
    const token = generateToken(user);

    res.status(201).json({
      token,
      user: {
        _id: user._id,
        email: user.email,
        role: user.role,
        profile: user.profile
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    if (user.profile.status === 'suspended') {
      return res.status(403).json({ error: 'Your account has been suspended by the administrator.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(user);
    res.json({
      token,
      user: {
        _id: user._id,
        email: user.email,
        role: user.role,
        profile: user.profile
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.doctorLogin = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await User.findOne({ email });
    if (!user || user.role !== 'doctor') {
      return res.status(400).json({ error: 'Invalid doctor credentials' });
    }

    if (user.profile.status === 'suspended') {
      return res.status(403).json({ error: 'Your account has been suspended.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid doctor credentials' });
    }

    const token = generateToken(user);
    res.json({
      token,
      user: {
        _id: user._id,
        email: user.email,
        role: user.role,
        profile: user.profile
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { name, age, bloodGroup, allergies, emergencyContact } = req.body;
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (name) user.profile.name = name;
    if (age !== undefined) user.profile.age = age;
    if (bloodGroup !== undefined) user.profile.bloodGroup = bloodGroup;
    if (allergies !== undefined) user.profile.allergies = allergies;
    if (emergencyContact !== undefined) user.profile.emergencyContact = emergencyContact;

    await user.save();
    res.json({
      _id: user._id,
      email: user.email,
      role: user.role,
      profile: user.profile
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==========================================
// 2. DOCTOR & SPECIALIZATION LISTINGS
// ==========================================

exports.getDoctors = async (req, res) => {
  try {
    const doctors = await Doctor.find().populate({
      path: 'user',
      select: 'profile email'
    });
    res.json(doctors);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getSpecializations = async (req, res) => {
  try {
    const specializations = await Doctor.distinct('specialization');
    res.json(specializations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==========================================
// 3. APPOINTMENT CONTROLLERS
// ==========================================

exports.bookAppointment = async (req, res) => {
  try {
    const { doctorId, date, timeSlot } = req.body;
    if (!doctorId || !date || !timeSlot) {
      return res.status(400).json({ error: 'Doctor ID, date, and time slot are required' });
    }

    // Verify doctor exists and has role 'doctor'
    const docUser = await User.findOne({ _id: doctorId, role: 'doctor' });
    if (!docUser) {
      return res.status(400).json({ error: 'Doctor not found' });
    }

    // Verify double booking for that doctor at that slot
    const existing = await Appointment.findOne({ doctor: doctorId, date, timeSlot, status: 'scheduled' });
    if (existing) {
      return res.status(400).json({ error: 'This time slot is already booked for this doctor.' });
    }

    const appointment = new Appointment({
      patient: req.user._id,
      doctor: doctorId,
      date,
      timeSlot,
      status: 'scheduled'
    });

    await appointment.save();
    res.status(201).json(appointment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getAppointments = async (req, res) => {
  try {
    let query = {};
    if (req.user.role === 'patient') {
      query.patient = req.user._id;
    } else if (req.user.role === 'doctor') {
      query.doctor = req.user._id;
    } else if (req.user.role === 'admin') {
      // Admin sees all, filter by query param if supplied
      if (req.query.status) {
        query.status = req.query.status;
      }
    }

    const appointments = await Appointment.find(query)
      .populate({ path: 'patient', select: 'profile email' })
      .populate({ path: 'doctor', select: 'profile email' })
      .sort({ date: 1, timeSlot: 1 });

    res.json(appointments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateAppointmentStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['scheduled', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const appointment = await Appointment.findById(req.params.id);
    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    // Authorization checks
    if (req.user.role === 'patient' && appointment.patient.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Unauthorized action' });
    }
    if (req.user.role === 'doctor' && appointment.doctor.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Unauthorized action' });
    }

    appointment.status = status;
    await appointment.save();
    res.json(appointment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.addPrescription = async (req, res) => {
  try {
    const { prescriptionNotes } = req.body;
    const appointment = await Appointment.findById(req.params.id);

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    if (appointment.doctor.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Only the assigned doctor can add prescriptions.' });
    }

    appointment.prescriptionNotes = prescriptionNotes || '';
    if (appointment.status === 'scheduled') {
      appointment.status = 'completed';
    }
    await appointment.save();
    res.json(appointment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==========================================
// 4. HEALTH TRACKER CONTROLLERS
// ==========================================

exports.addHealthLog = async (req, res) => {
  try {
    const { weight, bloodPressureSystolic, bloodPressureDiastolic, bloodSugar, date } = req.body;
    const log = new HealthLog({
      patient: req.user._id,
      weight: weight ? Number(weight) : undefined,
      bloodPressureSystolic: bloodPressureSystolic ? Number(bloodPressureSystolic) : undefined,
      bloodPressureDiastolic: bloodPressureDiastolic ? Number(bloodPressureDiastolic) : undefined,
      bloodSugar: bloodSugar ? Number(bloodSugar) : undefined,
      date: date ? new Date(date) : undefined
    });

    await log.save();
    res.status(201).json(log);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getHealthLogs = async (req, res) => {
  try {
    // If doctor calls, allow specifying a patientId query param to check their history
    let patientId = req.user._id;
    if (req.user.role === 'doctor' && req.query.patientId) {
      patientId = req.query.patientId;
    }

    const logs = await HealthLog.find({ patient: patientId }).sort({ date: 1 });
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==========================================
// 5. MEDICAL RECORD CONTROLLERS
// ==========================================

exports.uploadMedicalRecord = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No PDF file uploaded' });
    }

    // Upload memory buffer to Cloudinary
    const uploadToCloudinary = (fileBuffer, originalName) => {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            resource_type: 'auto', // Cloudinary detects PDF
            folder: 'meditrack_records',
            public_id: `${Date.now()}_${originalName.replace(/[^a-zA-Z0-9]/g, '_')}`
          },
          (error, result) => {
            if (error) return reject(error);
            resolve(result);
          }
        );
        stream.end(fileBuffer);
      });
    };

    const cloudinaryResult = await uploadToCloudinary(req.file.buffer, req.file.originalname);

    const record = new MedicalRecord({
      patient: req.user._id,
      fileName: req.body.fileName || req.file.originalname,
      fileUrl: cloudinaryResult.secure_url,
      cloudinaryId: cloudinaryResult.public_id,
      date: new Date()
    });

    await record.save();
    res.status(201).json(record);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getMedicalRecords = async (req, res) => {
  try {
    let patientId = req.user._id;
    if (req.user.role === 'doctor' && req.query.patientId) {
      patientId = req.query.patientId;
    }

    const records = await MedicalRecord.find({ patient: patientId }).sort({ date: -1 });
    res.json(records);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteMedicalRecord = async (req, res) => {
  try {
    const record = await MedicalRecord.findById(req.params.id);
    if (!record) {
      return res.status(404).json({ error: 'Medical record not found' });
    }

    if (record.patient.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized to delete this record' });
    }

    // Delete from Cloudinary
    if (record.cloudinaryId && !record.cloudinaryId.startsWith('mock_')) {
      await cloudinary.uploader.destroy(record.cloudinaryId);
    }

    await MedicalRecord.findByIdAndDelete(req.params.id);
    res.json({ message: 'Medical record deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==========================================
// 6. MEDICATION CONTROLLERS
// ==========================================

exports.addMedication = async (req, res) => {
  try {
    const { name, dosage, frequency, startDate, endDate } = req.body;
    if (!name || !dosage || !frequency || !startDate || !endDate) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const medication = new Medication({
      patient: req.user._id,
      name,
      dosage,
      frequency,
      startDate: new Date(startDate),
      endDate: new Date(endDate)
    });

    await medication.save();
    res.status(201).json(medication);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getMedications = async (req, res) => {
  try {
    let patientId = req.user._id;
    if (req.user.role === 'doctor' && req.query.patientId) {
      patientId = req.query.patientId;
    }

    const medications = await Medication.find({ patient: patientId }).sort({ startDate: 1 });
    res.json(medications);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteMedication = async (req, res) => {
  try {
    const medication = await Medication.findById(req.params.id);
    if (!medication) {
      return res.status(404).json({ error: 'Medication entry not found' });
    }

    if (medication.patient.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await Medication.findByIdAndDelete(req.params.id);
    res.json({ message: 'Medication removed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==========================================
// 7. CHAT MESSAGE HISTORY CONTROLLER
// ==========================================

exports.getChatHistory = async (req, res) => {
  try {
    const { partnerId } = req.params;
    const userId = req.user._id;

    const messages = await Message.find({
      $or: [
        { sender: userId, receiver: partnerId },
        { sender: partnerId, receiver: userId }
      ]
    }).sort({ timestamp: 1 });

    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ==========================================
// 8. ADMIN CONTROLLERS
// ==========================================

exports.getAnalytics = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalDoctors = await User.countDocuments({ role: 'doctor' });
    const totalPatients = await User.countDocuments({ role: 'patient' });
    const totalAppointments = await Appointment.countDocuments();
    const completedAppointments = await Appointment.countDocuments({ status: 'completed' });
    const scheduledAppointments = await Appointment.countDocuments({ status: 'scheduled' });
    const cancelledAppointments = await Appointment.countDocuments({ status: 'cancelled' });

    res.json({
      totalUsers,
      totalDoctors,
      totalPatients,
      totalAppointments,
      completedAppointments,
      scheduledAppointments,
      cancelledAppointments
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateUserStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!['active', 'suspended'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.profile.status = status;
    await user.save();
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.promoteToDoctor = async (req, res) => {
  try {
    const { userId, specialization, biography, education, days, slots } = req.body;
    if (!userId || !specialization) {
      return res.status(400).json({ error: 'User ID and specialization are required' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.role = 'doctor';
    await user.save();

    // Check if Doctor profile already exists
    let doctorProfile = await Doctor.findOne({ user: userId });
    if (doctorProfile) {
      doctorProfile.specialization = specialization;
      if (biography !== undefined) doctorProfile.biography = biography;
      if (education !== undefined) doctorProfile.education = education;
      if (days) doctorProfile.schedule.days = days;
      if (slots) doctorProfile.schedule.slots = slots;
      await doctorProfile.save();
    } else {
      doctorProfile = new Doctor({
        user: userId,
        specialization,
        biography: biography || '',
        education: education || '',
        schedule: {
          days: days || ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
          slots: slots || ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00']
        }
      });
      await doctorProfile.save();
    }

    res.json({ message: 'User successfully promoted to Doctor', user, doctorProfile });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.demoteDoctor = async (req, res) => {
  try {
    const { id } = req.params; // Doctor profile ID or User ID? Let's check both
    let doctorProfile = await Doctor.findById(id);
    if (!doctorProfile) {
      // fallback check by user id
      doctorProfile = await Doctor.findOne({ user: id });
    }

    if (!doctorProfile) {
      return res.status(404).json({ error: 'Doctor profile not found' });
    }

    const userId = doctorProfile.user;
    const user = await User.findById(userId);
    if (user) {
      user.role = 'patient';
      await user.save();
    }

    await Doctor.findByIdAndDelete(doctorProfile._id);
    res.json({ message: 'Doctor demoted to Patient and profile deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
