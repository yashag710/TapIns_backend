const Transaction = require("../models/transactionModel");
const axios = require("axios"); 

const finalCheckController = async (req, res) => {
    try {
        const { transaction_id, ruleBasedResult, mlBasedResult } = req.body;

        const mlBasedData = mlBasedResult.fraudulent || false;
        const ruleBasedData = ruleBasedResult.is_fraud || false;

        const transaction = await Transaction.findOne({ _id: transaction_id });

        if (!transaction) {
            console.log("❌ Transaction not found!");
            return res.status(404).json({
                success: false,
                message: "Transaction not found"
            });
        }

        console.log("🔍 Original Transaction:", transaction);

        let isFraud = false;
        let fraudScore = ruleBasedResult.fraud_score || 0;
        let failedAttempts = transaction.failed_attempts || 0;
        let paymentStatus = "Completed";

        // Decide fraud status
        if (ruleBasedData && mlBasedData) {
            isFraud = true;
            failedAttempts += 1;
            paymentStatus = "failed";
        }

        // Update the transaction
        await Transaction.updateOne(
            { _id: transaction._id },
            {
                $set: {
                    is_fraud: isFraud,
                    fraud_score: fraudScore,
                    failed_attempts: failedAttempts,
                    payment: paymentStatus
                }
            }
        );

        if (isFraud) {
            try {
                await axios.post("http://localhost:5000/api/report-fraud", {
                    transaction_id: transaction._id,
                    amount: transaction.amount,
                    payer_id: transaction.payer_id,
                    payee_id: transaction.payee_id,
                    timestamp: transaction.date,
                    fraud_score: fraudScore,
                    reason: "Detected by both rule-based and ML-based systems"
                });
                console.log("🚨 Fraudulent transaction reported to SEBI.");
            } catch (reportErr) {
                console.error("❌ Error reporting to SEBI:", reportErr.message);
            }
        }

        console.log(`✅ Transaction marked as ${isFraud ? "fraudulent" : "non-fraudulent"}`);

        return res.status(200).json({
            success: true,
            message: "Transaction status updated",
            transaction_id: transaction._id,
            is_fraud: isFraud,
            status: paymentStatus
        });

    } catch (error) {
        console.error("❌ Final check controller error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

module.exports = finalCheckController;