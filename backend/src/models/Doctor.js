const mongoose = require('mongoose');

const doctorSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  specialization: { type: String, required: true },
  biography: { type: String, default: '' },
  education: { type: String, default: '' },
  schedule: {
    days: { type: [String], default: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] },
    slots: { type: [String], default: ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'] }
  }
}, { timestamps: true });

module.exports = mongoose.model('Doctor', doctorSchema);
