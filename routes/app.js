const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");  

const {checkFraud} = require("../controllers/ruleBasedController"); 
const transactionController = require('../controllers/transactionController');
const { updateController } = require("../controllers/updateController");
const reportingController = require("../controllers/reportingController");

// Define routes
router.post("/ruleBased", checkFraud);
router.post("/update", updateController);
router.get('/transactions', transactionController.getTransactions);
router.get('/transactions/stats', transactionController.getTransactionStats);
router.post('/result', reportingController.reportFraud);

module.exports = router;
