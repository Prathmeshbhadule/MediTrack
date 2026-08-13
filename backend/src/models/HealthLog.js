const mongoose = require('mongoose');

const healthLogSchema = new mongoose.Schema({
  patient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  weight: { type: Number },
  bloodPressureSystolic: { type: Number },
  bloodPressureDiastolic: { type: Number },
  bloodSugar: { type: Number },
  date: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('HealthLog', healthLogSchema);
