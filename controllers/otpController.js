const twilio = require("twilio");
const OTP = require("../models/otpModel");
const dotenv = require("dotenv");
const User = require('../models/userModel');

dotenv.config();

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// Generate random 6-digit OTP
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

exports.sendOTP = async (req, res) => {
    const { phone } = req.body;
    if (!phone) return res.status(400).json({ error: "Phone number is required" });

    const otp = generateOTP();

    try {
        // Send SMS
        await client.messages.create({
            body: `Your OTP is ${otp}`,
            from: process.env.TWILIO_PHONE_NUMBER,
            to: phone
        });

        // Store in DB
        await OTP.create({ phone, otp });

        return res.status(200).json({ success: true, message: "OTP sent successfully" });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Failed to send OTP" });
    }
};

exports.verifyOTP = async (req, res) => {
    const { phone, otp, name, payerId } = req.body;
    if (!phone || !otp) return res.status(400).json({ error: "Phone and OTP are required" });

    try {
        console.log("Verifying OTP for phone:", phone, "otp:", otp);
        const record = await OTP.findOne({ phone, otp });
        console.log("OTP record found:", record);
        if (!record) return res.status(401).json({ error: "Invalid OTP" });

        
        const result = await saveUser(name, phone, payerId);
        if (!result) {
          return res.status(500).json({ error: "Failed to save user" });
        }
        // OTP matched – delete it so it can't be reused
        await OTP.deleteMany({ phone });

        return res.status(200).json({ success: true, message: "Phone verified successfully" });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "OTP verification failed" });
    }
};

// Save user to database if not already exists
async function saveUser(name, phone, payerId) {
  try {
    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      console.log("User already exists:", existingUser);
      return existingUser;
    }

    const user = new User({ name, phone, payerId });
    await user.save();
    console.log("User saved:", user);
    return user;
  } catch (err) {
    console.error("Error saving user:", err.message);
    throw err;
  }
}
