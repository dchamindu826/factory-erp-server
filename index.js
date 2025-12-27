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

// --- MongoDB Connection Logic ---
const dbUser = "dchamindu826";
const dbPass = encodeURIComponent("@#Chamindu10@#"); 
const dbName = "FactoryERP";
const clusterUrl = "cluster0.migbifr.mongodb.net";

const MONGO_URI = `mongodb+srv://${dbUser}:${dbPass}@${clusterUrl}/${dbName}?retryWrites=true&w=majority&appName=Cluster0`;

let isConnected = false;

const connectDB = async () => {
  if (isConnected) return;
  try {
    const db = await mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 5000 });
    isConnected = db.connections[0].readyState;
    console.log("✅ MongoDB Connected Successfully!");
  } catch (err) {
    console.error("❌ DB Connection Error:", err.message);
  }
};

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
  bankDetails: { accountNumber: String, accountName: String, bank: String, branch: String },
  qrCode: String,
  createdAt: { type: Date, default: Date.now }
});

// Update Attendance Schema with OT & Method
const AttendanceSchema = new mongoose.Schema({
  employeeId: { type: String, required: true },
  fullName: String,
  date: String,      // YYYY-MM-DD
  inTime: String,    // HH:mm
  outTime: String,   // HH:mm
  otHours: { type: Number, default: 0 },
  status: { type: String, default: 'Present' }, // Present, Leave
  method: { type: String, default: 'QR' },       // QR, Manual
  isHoliday: { type: Boolean, default: false },
  timestamp: { type: Date, default: Date.now }
});

const Employee = mongoose.models.Employee || mongoose.model('Employee', EmployeeSchema);
const Attendance = mongoose.models.Attendance || mongoose.model('Attendance', AttendanceSchema);

// --- OT Calculation Helper ---
const calculateOT = (date, inT, outT, isHoliday) => {
  if (!outT || !inT) return 0;
  const day = new Date(date).getDay(); // 0-Sun, 6-Sat
  const [outH, outM] = outT.split(':').map(Number);
  const exitTimeDecimal = outH + outM / 60;

  let ot = 0;
  if (isHoliday || day === 0) {
    // Sunday or Holiday (OT starts from 8:00 AM)
    const [inH, inM] = inT.split(':').map(Number);
    ot = exitTimeDecimal - (inH + inM / 60);
  } else if (day === 6) {
    // Saturday (OT starts after 1:00 PM / 13:00)
    ot = exitTimeDecimal > 13 ? exitTimeDecimal - 13 : 0;
  } else {
    // Weekdays (OT starts after 5:00 PM / 17:00)
    ot = exitTimeDecimal > 17 ? exitTimeDecimal - 17 : 0;
  }
  return ot > 0 ? parseFloat(ot.toFixed(2)) : 0;
};

// --- API Routes ---

// 1. Get All Employees
app.get('/api/employees', async (req, res) => {
  await connectDB();
  try {
    const employees = await Employee.find().sort({ createdAt: -1 });
    res.json(employees);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// 2. Register New Employee
app.post('/api/employees', async (req, res) => {
  await connectDB();
  try {
    const data = req.body;
    const qrCodeData = await QRCode.toDataURL(data.employeeId);
    const newEmployee = new Employee({ ...data, qrCode: qrCodeData });
    await newEmployee.save();
    res.status(201).json({ message: "Employee registered!", employee: newEmployee });
  } catch (error) { res.status(500).json({ error: "Duplicate ID or Server Error" }); }
});

// 3. Update Employee
app.put('/api/employees/:id', async (req, res) => {
  await connectDB();
  try {
    const { id } = req.params;
    const updateData = req.body;
    if (updateData.employeeId) {
      updateData.qrCode = await QRCode.toDataURL(updateData.employeeId);
    }
    const updatedEmployee = await Employee.findByIdAndUpdate(id, { $set: updateData }, { new: true });
    res.json(updatedEmployee);
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// 4. Delete Employee
app.delete('/api/employees/:id', async (req, res) => {
  await connectDB();
  try {
    await Employee.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted" });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// 5. Attendance Mark (QR) with 8:30 Logic
app.post('/api/attendance', async (req, res) => {
  await connectDB();
  try {
    const { employeeId } = req.body;
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.getHours().toString().padStart(2, '0') + ":" + now.getMinutes().toString().padStart(2, '0');
    
    const employee = await Employee.findOne({ employeeId });
    if (!employee) return res.status(404).json({ message: "Invalid QR" });

    // 8:30 logic (8.5 decimal)
    const isLate = (now.getHours() + now.getMinutes() / 60) > 8.5;

    const record = new Attendance({ 
      employeeId: employee.employeeId, 
      fullName: employee.fullName,
      date: dateStr,
      inTime: timeStr,
      status: isLate ? 'Leave' : 'Present',
      method: 'QR'
    });
    await record.save();
    res.status(201).json({ message: `Marked: ${employee.fullName} (${isLate ? 'Late/Leave' : 'Present'})` });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

// 6. Manual Bulk Import (Excel)
app.post('/api/attendance/bulk', async (req, res) => {
  await connectDB();
  try {
    const records = req.body.map(rec => ({
      ...rec,
      otHours: calculateOT(rec.date, rec.inTime, rec.outTime, rec.isHoliday),
      method: 'Manual'
    }));
    await Attendance.insertMany(records);
    res.json({ message: "Excel Data Imported Successfully" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 7. Get All Attendance
app.get('/api/attendance', async (req, res) => {
  await connectDB();
  try {
    const records = await Attendance.find().sort({ date: -1 });
    res.json(records);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 8. Update Attendance Record (Manual Edit)
app.put('/api/attendance/:id', async (req, res) => {
  await connectDB();
  try {
    const updateData = req.body;
    updateData.otHours = calculateOT(updateData.date, updateData.inTime, updateData.outTime, updateData.isHoliday);
    const updated = await Attendance.findByIdAndUpdate(req.params.id, { $set: updateData }, { new: true });
    res.json(updated);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

const PORT = process.env.PORT || 5000;
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
}

module.exports = app;