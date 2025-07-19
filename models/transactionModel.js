const mongoose = require("mongoose");

const transactionSchema = mongoose.Schema({
    failed_attempts: {
        type: Number,
        default: 0
    },
    date: {
        type: Date,
        default: Date.now
    },
    payment_mode: {
        type: String,
        required: true
    },
    payment_channel: {
        type: String,
        required: true
    },
    payment: {
        type: String,
        enum: ['pending', 'completed', 'failed']
    },
    payee_id: {
        type: String,
        required: true,
    },
    payer_id: {
        type: String,
        required: true,
    },
    amount: {
        type: Number,
        required: true
    },
    ip: {
        type: String,
    },
    is_fraud: {
        type: Boolean,
        default: false
    },
    is_fraud_reported: {
        type: Boolean,
        default: false
    },
    fraud_score : {
        type : Number,
    },
});

module.exports = mongoose.model("Transaction", transactionSchema);