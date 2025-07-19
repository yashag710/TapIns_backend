const axios = require('axios');
const getRegionFromIP = require('../utils/getRegionFromIp');
const Transaction = require('../models/transactionModel');

// Main controller function
exports.transactionController = async (req, res) => {
    const messageData = req.body;

    if (!messageData || !messageData.amount || !messageData.payer_id || !messageData.payee_id) {
        return res.status(400).json({ error: "Missing required transaction fields." });
    }

    // Prepare transaction data
    const transactionData = {
        amount: parseFloat(messageData.amount || 0),
        payer_id: messageData.payer_id || '',
        payee_id: messageData.payee_id || '',
        payment_mode: messageData.payment_mode || '',
        payment_channel: messageData.payment_channel || '',
        ip: messageData.ip || '',
        state: await getRegionFromIP(messageData.ip || ''),
        timestamp: new Date().toISOString()
    };

    console.log("📥 Transaction data prepared:", transactionData);

    // Save transaction to DB
    let newTransaction;
    try {
        newTransaction = new Transaction(transactionData);
        await newTransaction.save();
        console.log("✅ Transaction saved successfully:", newTransaction._id);
    } catch (error) {
        console.error("❌ Error saving transaction:", error.message);
        return res.status(500).json({ error: error.message });
    }

    // Add ID and timestamp to transactionData for next steps
    transactionData.transaction_id = newTransaction._id;

    try {
        // Step 1: Rule-based analysis
        const ruleBasedRes = await axios.post("http://localhost:5000/api/ruleBased", transactionData);
        const ruleBasedResult = ruleBasedRes.data;
        const failedAttempts = ruleBasedResult.failed_attempts || 0;

        // Step 2: ML-based prediction
        const mlBasedTransactionData = {
            payer_id: transactionData.payer_id,
            amount: transactionData.amount,
            ip: transactionData.ip,
            state: transactionData.state?.toString() || 'unknown',
            failed_attempt: failedAttempts,
        };
        const mlBasedRes = await axios.post("https://mlmodelfraud-production.up.railway.app/predict", mlBasedTransactionData);
        const mlBasedResult = mlBasedRes.data;

        // Step 3: Final check
        const finalCheckRes = await axios.post("http://localhost:5000/api/finalCheck", {
            transaction_id: transactionData.transaction_id,
            ruleBasedResult: ruleBasedResult,
            mlBasedResult: mlBasedResult
        });
        const finalCheckResult = finalCheckRes.data;

        // Final Response
        if (finalCheckResult.success) {
            console.log("✅ Final check passed for transaction:", transactionData.transaction_id);
            return res.status(200).json({
                state: transactionData.state.toString(),
                amount: transactionData.amount,
                ip: transactionData.ip,
                transaction_id: transactionData.transaction_id,
                rule_based: ruleBasedResult,
                ml_based: mlBasedResult,
                final_check: finalCheckResult,
                timestamp: transactionData.timestamp
            });
        } else {
            return res.status(403).json({
                amount: transactionData.amount,
                ip: transactionData.ip,
                transaction_id: transactionData.transaction_id,
                rule_based: ruleBasedResult,
                ml_based: mlBasedResult,
                final_check: finalCheckResult,
                timestamp: transactionData.timestamp
            });
        }

    } catch (error) {
        console.error("❌ Error during transaction analysis:", error.message);
        return res.status(500).json({
            transaction_id: transactionData.transaction_id,
            error: error.message,
            timestamp: transactionData.timestamp
        });
    }
};
