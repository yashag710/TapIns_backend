const { Kafka } = require('kafkajs');
const axios = require('axios');
const getRegionFromIP = require('../utils/getRegionFromIp');
const Transaction = require('../models/transactionModel');

const KAFKA_BROKER = "pkc-7xoy1.eu-central-1.aws.confluent.cloud:9092";
const KAFKA_TOPIC = "transaction-requests";
const KAFKA_GROUP_ID = "fraud-detection-consumer-group";

const kafka = new Kafka({
    clientId: 'fraud-consumer',
    brokers: [KAFKA_BROKER],
    ssl: true,
    sasl: {
        mechanism: 'plain',
        username: 'QHJFS7WLXRWPCSBX',
        password: '4lYzgK8en3XusMQ6BqeDOBe1bHJCl/CppGLSHg0UBLUWKTDUXxGFEiRvLxvd5ica'
    }
});

const consumer = kafka.consumer({ groupId: KAFKA_GROUP_ID });

async function TransactionCreation(messageData) {
    const transactionData = {
        amount: parseFloat(messageData.amount || 0),
        payer_id: messageData.payer_id || '',
        payee_id: messageData.payee_id || '',
        payment_mode: messageData.payment_mode || '',
        payment_channel: messageData.payment_channel || '',
        ip: messageData.ip || '',
        state: getRegionFromIP(messageData.ip || ''),
        timestamp: messageData.timestamp || ''
    };

    console.log("📥 Transaction data prepared:", transactionData);

    try {
        const newTransaction = new Transaction(transactionData);
        await newTransaction.save();
        console.log("✅ Transaction saved successfully:", newTransaction._id);
        return { transaction_id: newTransaction._id, timestamp: newTransaction.timestamp };

    } catch (error) {
        console.error("❌ Error saving transaction:", error.message);
        return { error: error.message };
    }
}

async function sendToApis(messageData) {
    const response = await TransactionCreation(messageData);
    if (response.error) return { ...response };

    const transactionData = {
        transaction_id: response.transaction_id || 'unknown',
        amount: parseFloat(messageData.amount || 0),
        payer_id: messageData.payer_id || '',
        payee_id: messageData.payee_id || '',
        payment_mode: messageData.payment_mode || '',
        payment_channel: messageData.payment_channel || '',
        ip: messageData.ip || '',
        state: getRegionFromIP(messageData.ip || ''),
        timestamp: response.timestamp || ''
    };

    try {
        const ruleBasedRes = await axios.post("http://localhost:5000/api/ruleBased", transactionData);
        const ruleBasedResult = ruleBasedRes.data;
        // Collecting the failed attempts from the rule-based result
        const failedAttempts = ruleBasedResult.failed_attempts || 0;
        
        // Preparing the data for the ML model
        const mlBasedTransactionData = {
            payer_id : transactionData.payer_id,
            amount : transactionData.amount,
            ip : transactionData.ip,
            state : transactionData.state?.toString() || 'unknown',
            failed_attempt : failedAttempts,
        }
        // Sending the axios request to the ml model for confirmation
        const mlBasedRes = await axios.post("http://localhost:5001/predict", mlBasedTransactionData);
        const mlBasedResult = mlBasedRes.data;

        // Sending the request to the final check API
        const finalCheckRes = await axios.post("http://localhost:5000/api/finalCheck",{
            transaction_id : transactionData.transaction_id,
            ruleBasedResult: ruleBasedResult,
            mlBasedResult: mlBasedResult
        });
        const finalCheckResult = finalCheckRes.data;
        if (finalCheckResult.success) {
            console.log("✅ Final check passed for transaction:", transactionData.transaction_id);
            console.log({
            transaction_id: transactionData.transaction_id,
            rule_based: ruleBasedResult,
            ml_based: mlBasedResult,
            final_check: finalCheckResult,
            timestamp: transactionData.timestamp
            });
            res.redirect("http://localhost:5173/transaction-result?transaction_id=" + transactionData.transaction_id);
        }
    } catch (error) {
        return {
            transaction_id: transactionData.transaction_id,
            error: error.message,
            timestamp: transactionData.timestamp
        };
    }
}

async function runConsumer() {
    await consumer.connect();
    await consumer.subscribe({ topic: KAFKA_TOPIC, fromBeginning: true });

    await consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
            const rawMessage = message.value.toString();
            try {
                const parsedMessage = JSON.parse(rawMessage);
                console.log("📩 Received message:", parsedMessage);
                const result = await sendToApis(parsedMessage);
                if (!result.error) {
                    console.log("✅ Processed transaction:", result);
                } else {
                    console.log("❌ Failed:", result.error);
                }
            } catch (err) {
                console.error("⚠️ Error parsing message:", err.message);
            }
        }
    });
}

module.exports = runConsumer;
