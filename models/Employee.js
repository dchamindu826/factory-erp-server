const mongoose = require('mongoose');

const EmployeeSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  nic: String,
  employeeId: { type: String, unique: true, required: true },
  position: String,
  phone: String,
  email: String,
  address: String,
  image: String, // මෙතනට දැනට image URL එකක් හෝ base64 එකක් දාමු
  bankDetails: {
    accountNumber: String,
    accountName: String,
    bank: String,
    branch: String
  },
  qrCode: String, // QR code එක string එකක් විදිහට සේව් වෙනවා
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Employee', EmployeeSchema);