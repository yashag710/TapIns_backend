const express = require('express');
const router = express.Router();

// Import controllers with correct destructuring
const { transactionController } = require('../controllers/transactionController');
const { ruleBased } = require('../controllers/ruleBasedController');
const finalCheckController = require('../controllers/finalCheckController');
const { sendOTP , verifyOTP } = require('../controllers/otpController');
const { getTransactions} = require('../controllers/transactionDashboardController');
const { reportFraud } = require('../controllers/reportingController');

// Define routes with proper controller references
router.post('/transaction', transactionController);
router.post('/ruleBased', ruleBased);
router.post('/finalCheck', finalCheckController);
router.get('/transaction-dashboard', getTransactions);
router.post('/report-fraud', reportFraud);
// Otp verfication routes
router.post('/send-otp', sendOTP);
router.post('/verify-otp', verifyOTP);

module.exports = router;
