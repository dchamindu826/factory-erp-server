const express = require('express');
const router = express.Router();
const Employee = require('../models/Employee'); // ඔයාගේ model එක තියෙන තැනට path එක දෙන්න

// --- සේවකයෙකුගේ දත්ත Update කිරීම (PUT) ---
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // findByIdAndUpdate පාවිච්චි කරලා database එක update කිරීම
    const updatedEmployee = await Employee.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true } // new: true කියන්නේ update වුණාට පස්සේ තියෙන අලුත් data ටික return කරන්න කියන එක
    );

    if (!updatedEmployee) {
      return res.status(404).json({ message: "Employee not found" });
    }

    res.status(200).json(updatedEmployee);
  } catch (err) {
    console.error("Update Error:", err);
    res.status(500).json({ message: "Server Error", error: err.message });
  }
});

module.exports = router;