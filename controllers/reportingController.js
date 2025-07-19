const transactionModel = require('../models/transactionModel');
const fraudReportingModel = require('../models/fraud_reporting');
const User = require('../models/userModel');
const twilio = require("twilio");

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

const reportFraud = async (req, res) => {
    try {
        const { transaction_id, amount, payer_id, payee_id, timestamp, fraud_score, reason } = req.body;

        // Validate required fields
        if (!transaction_id) {
            return res.status(400).json({
                success: false,
                message: "Missing required fields"
            });
        }

        // Find the transaction
        const transaction = await transactionModel.findOne({ _id: transaction_id });
        if (!transaction) {
            return res.status(404).json({
                success: false,
                message: "Transaction not found"
            });
        }

        // Create a new fraud report
        const fraudReport = new fraudReportingModel({
            transaction_id: transaction._id,
            is_fraud: true,
            is_fraud_reported: true,
            reporting_entity_id: "SEBI - ID",
            amount,
            payer_id,
            payee_id,
            timestamp,
            fraud_score,
            reason
        });
        await fraudReport.save();

        // Find payer's phone number
        let payerUser = await User.findOne({ payer_id });
        if (!payerUser && transaction.payer_id) {
            payerUser = await User.findOne({ _id: transaction.payer_id }) || await User.findOne({ phone: transaction.payer_id });
        }

        // Send SMS if phone found
        if (payerUser && payerUser.phone) {
            const smsBody = `Alert: Your transaction (ID: ${transaction.transaction_id}) was flagged as fraudulent. Reason: ${reason || "Detected by our system"}. If this wasn't you, please contact support.`;
            try {
                await client.messages.create({
                    body: smsBody,
                    from: process.env.TWILIO_PHONE_NUMBER,
                    to: payerUser.phone
                });
                console.log("✅ Fraud alert SMS sent to user:", payerUser.phone);
            } catch (smsErr) {
                console.error("❌ Failed to send SMS:", smsErr.message);
            }
        } else {
            console.warn("⚠️ Could not find payer's phone number to send SMS.");
        }

        return res.status(200).json({
            success: true,
            message: "Fraud reported successfully",
            data: {
                transaction_id: transaction.transaction_id,
                is_fraud: transaction.is_fraud,
                is_fraud_reported: transaction.is_fraud_reported,
            }
        });

    } catch (error) {
        console.error("Error in reportFraud:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

module.exports = {
    reportFraud
};
