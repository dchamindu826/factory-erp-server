const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const QRCode = require('qrcode');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// --- MongoDB Connection ---
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://dchamindu826:%40%23Chamindu10%40%23@cluster0.migbifr.mongodb.net/FactoryERP?appName=Cluster0";

mongoose.connect(MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected Successfully!"))
  .catch(err => console.error("❌ DB Connection Error:", err));

// --- Schemas ---
const EmployeeSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  nic: String,
  employeeId: { type: String, unique: true, required: true },
  position: String,
  phone: String,
  email: String,
  address: String,
  image: String,
  bankDetails: {
    accountNumber: String,
    accountName: String,
    bank: String,
    branch: String
  },
  qrCode: String,
  createdAt: { type: Date, default: Date.now }
});

const AttendanceSchema = new mongoose.Schema({
  employeeId: { type: String, required: true },
  fullName: String,
  timestamp: { type: Date, default: Date.now },
  status: { type: String, default: 'Present' }
});

const Employee = mongoose.models.Employee || mongoose.model('Employee', EmployeeSchema);
const Attendance = mongoose.models.Attendance || mongoose.model('Attendance', AttendanceSchema);

// --- API Routes ---

// 1. Get All Employees
app.get('/api/employees', async (req, res) => {
  try {
    const employees = await Employee.find().sort({ createdAt: -1 });
    res.json(employees);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 2. Register New Employee
app.post('/api/employees', async (req, res) => {
  try {
    const data = req.body;
    const qrCodeData = await QRCode.toDataURL(data.employeeId);
    const newEmployee = new Employee({ ...data, qrCode: qrCodeData });
    await newEmployee.save();
    res.status(201).json({ message: "Employee registered!", employee: newEmployee });
  } catch (error) {
    res.status(500).json({ error: "Employee ID already exists or Server Error" });
  }
});

// 3. Update Employee (PUT - Fix for 404)
app.put('/api/employees/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // ID එක වෙනස් කරොත් විතරක් අලුත් QR එකක් හදනවා
    if (updateData.employeeId) {
      updateData.qrCode = await QRCode.toDataURL(updateData.employeeId);
    }

    const updatedEmployee = await Employee.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true }
    );

    if (!updatedEmployee) return res.status(404).json({ error: "Employee not found" });
    res.json({ message: "Updated successfully!", employee: updatedEmployee });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Delete Employee
app.delete('/api/employees/:id', async (req, res) => {
  try {
    await Employee.findByIdAndDelete(req.params.id);
    res.json({ message: "Employee deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Attendance Mark (QR Scanner එකෙන් මේකට දත්ත එවනවා)
app.post('/api/attendance', async (req, res) => {
  try {
    const { employeeId } = req.body;
    const employee = await Employee.findOne({ employeeId });

    if (!employee) return res.status(404).json({ message: "Invalid QR Code" });

    const attendance = new Attendance({
      employeeId: employee.employeeId,
      fullName: employee.fullName
    });

    await attendance.save();
    res.status(201).json({ message: `Attendance Marked: ${employee.fullName}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Server Start
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));