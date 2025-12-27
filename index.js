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
// Password එකේ special characters තියෙන නිසා මෙහෙම හදන එක වඩාත් නිවැරදියි
const dbUser = "dchamindu826";
const dbPass = encodeURIComponent("@#Chamindu10@#"); 
const dbName = "FactoryERP";
const clusterUrl = "cluster0.migbifr.mongodb.net";

const MONGO_URI = `mongodb+srv://${dbUser}:${dbPass}@${clusterUrl}/${dbName}?retryWrites=true&w=majority&appName=Cluster0`;

// Serverless පරිසරයක (Vercel) connection එක handle කරන විදිහ
let isConnected = false;

const connectDB = async () => {
  if (isConnected) return;

  try {
    const db = await mongoose.connect(MONGO_URI, {
      serverSelectionTimeoutMS: 5000, // තත්පර 5ක් ඇතුළත connect වුණේ නැත්නම් error එකක් දෙන්න
    });
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
  await connectDB();
  try {
    const employees = await Employee.find().sort({ createdAt: -1 });
    res.json(employees);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
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
  } catch (error) {
    res.status(500).json({ error: "Duplicate ID or Server Error" });
  }
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
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 4. Delete Employee
app.delete('/api/employees/:id', async (req, res) => {
  await connectDB();
  try {
    await Employee.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Attendance Mark
app.post('/api/attendance', async (req, res) => {
  await connectDB();
  try {
    const { employeeId } = req.body;
    const employee = await Employee.findOne({ employeeId });
    if (!employee) return res.status(404).json({ message: "Invalid QR" });

    const record = new Attendance({ employeeId: employee.employeeId, fullName: employee.fullName });
    await record.save();
    res.status(201).json({ message: `Marked: ${employee.fullName}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Vercel start
const PORT = process.env.PORT || 5000;
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
}

module.exports = app;