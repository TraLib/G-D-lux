// backend/routes/auth.js
const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const User = require('../models/User');

const otpStore = {}; // temporary; ideally use DB

// Signup route
router.post('/signup', async (req, res) => {
  const { fullname, email, password } = req.body;
  try {
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: "Email already registered" });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore[email] = otp;

    // Send OTP email
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: 'youremail@gmail.com', pass: 'yourpassword' }
    });

    await transporter.sendMail({
      from: '"G&D LUX" <youremail@gmail.com>',
      to: email,
      subject: 'Your G&D LUX Verification OTP',
      text: `Hello ${fullname},\n\nYour OTP is ${otp}\n\nPlease verify within 10 minutes.`,
    });

    res.status(200).json({ message: "OTP sent to your email" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// Verify OTP route
router.post('/verify-otp', async (req, res) => {
  const { email, otp } = req.body;
  try {
    if (otpStore[email] && otpStore[email] === otp) {
      delete otpStore[email];
      // Create user in DB
      const user = new User({ fullname: email.split('@')[0], email });
      await user.save();
      return res.status(200).json({ message: "Email verified successfully!" });
    } else {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
