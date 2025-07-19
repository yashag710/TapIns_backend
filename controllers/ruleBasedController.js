const Transaction = require("../models/transactionModel");
const geoip = require('geoip-lite');

const FRAUD_SCORE_THRESHOLD = 0.7;

exports.ruleBased = async (req, res) => {
  try {
    const { transaction_id } = req.body.transaction_idq || 'unknown';
    const transaction = await Transaction.findOne({ transaction_id });

    if (!transaction) {
      return res.status(404).json({
        transaction_id: "unknown",
        is_fraud: false,
        fraud_reason: "Transaction not found",
        fraud_score: 0,
        failed_attempts: 0
      });
    }

    const {
      amount,
      payer_id,
      payee_id,
      payment_mode,
      payment_channel,
      ip,
      state
    } = transaction;

    let fraudReason = "No fraud detected";
    let fraudScore = 0.0;
    let fraudFlags = [];

    const geo = geoip.lookup(ip);
    const country = geo ? geo.country : null;

    const userTransactions = await getUserTransactionHistory(payer_id);
    const failed_attempts = await getFailedAttempts(payer_id);

    // === Amount Risk Check ===
    if (amount > 10000) {
      fraudFlags.push("High-value transaction");
      fraudScore += 0.2;
    }

    if ([500, 1000, 2000].includes(amount)) {
      fraudFlags.push("Round amount transaction");
      fraudScore += 0.05; // reduced from 0.1
    }

    // === Country Risk Check ===
    const highRiskCountries = ["PK", "US", "IR", "BY", "RU"];
    if (country && highRiskCountries.includes(country)) {
      fraudFlags.push(`Transaction from high-risk country: ${country}`);
      fraudScore += 0.2; // reduced from 0.3
    }

    // === Known Fraudulent IPs ===
    const knownFraudIPs = await getFraudulentIPs();
    if (knownFraudIPs.includes(ip)) {
      fraudFlags.push("Known fraudulent IP address");
      fraudScore += 0.1; // reduced from 0.7
    }

    // === Payer-Payee Relationship ===
    const priorTransactions = await validatePayerPayeeRelationship(payer_id, payee_id);
    if (priorTransactions === 0) {
      if (userTransactions.length === 0) {
        fraudFlags.push("New user with first transaction");
        fraudScore += 0.1;
      } else if (userTransactions.length <= 5) {
        fraudFlags.push("New user's first transaction with this payee");
        fraudScore += 0.15;
      } else {
        fraudFlags.push("Established user's first transaction with this payee");
        fraudScore += 0.1;
      }
    }

    // === Velocity Check ===
    if (failed_attempts >= 3) {
      fraudFlags.push("Multiple failed attempts");
      fraudScore += 0.3; // reduced from 0.5
    }

    const recentTransactionCount = await getRecentTransactionCount(payer_id, 60);
    if (recentTransactionCount > 5) {
      fraudFlags.push("Unusual transaction frequency");
      fraudScore += 0.2; // reduced from 0.3
    }

    // === Behavioral Analysis ===
    const userAvgAmount = calculateAverageTransactionAmount(userTransactions);
    if (userAvgAmount && amount > userAvgAmount * 5) {
      fraudFlags.push("Amount significantly above user average");
      fraudScore += 0.2; // reduced from 0.3
    }

    // === Payment Mode ===
    const highRiskPaymentModes = ["cryptocurrency", "wire_transfer", "gift_card"];
    if (highRiskPaymentModes.includes(payment_mode)) {
      fraudFlags.push("High-risk payment method");
      fraudScore += 0.1;
    }

    // === Payment Channel ===
    const highRiskChannels = ["api", "third_party_processor"];
    if (highRiskChannels.includes(payment_channel)) {
      fraudFlags.push("High-risk payment channel");
      fraudScore += 0.1;
    }

    // === Payee Fraud Rate ===
    const payeeFraudRatio = await getPayeeFraudRatio(payee_id);
    if (payeeFraudRatio > 0.1) {
      fraudFlags.push("Payee has high fraud rate");
      fraudScore += 0.2; // reduced from 0.5
    }

    // Normalize fraud score
    fraudScore = Math.min(fraudScore, 1.0);

    const isFraud = fraudScore >= FRAUD_SCORE_THRESHOLD;

    if (isFraud && fraudFlags.length > 0) {
      fraudReason = fraudFlags[0];
    }

    return res.status(200).json({
      transaction_id: transaction.transaction_id,
      is_fraud: isFraud,
      fraud_reason: fraudReason,
      fraud_score: fraudScore,
      failed_attempts: failed_attempts
    });
  } catch (error) {
    console.error("Fraud detection error:", error);
    return res.status(500).json({
      transaction_id: "unknown",
      is_fraud: false,
      fraud_reason: "Error processing fraud detection",
      fraud_score: 0,
    });
  }
};


// Function to validate payer-payee relationship // Correct Function
async function validatePayerPayeeRelationship(payerId, payeeId) {
  try {
    // Counting previous transactions between this payer and payee
    return await Transaction.countDocuments({
      payer_id: payerId,
      payee_id: payeeId,
      payment: 'completed'
    });
  } catch (error) {
    console.error("Error validating payer-payee relationship:", error);
    return 0;
  }
}



// Function to update transaction with fraud analysis data // Partial correct
async function updateTransactionWithFraudData(transactionId, isFraud, fraudScore) {
  try {
    await Transaction.findOneAndUpdate(
      { transaction_id: transactionId },
      { 
        is_fraud: isFraud,
        fraud_score: fraudScore
      }
    );
  } catch (error) {
    console.error("Error updating transaction with fraud data:", error);
  }
}

// Function to get user's transaction history
async function getUserTransactionHistory(payerId) {
  try {
    // Get last 50 transactions for this payer
    return await Transaction.find({ payer_id: payerId })
      .sort({ date: -1 })
      .limit(50);
  } catch (error) {
    console.error("Error fetching user transaction history:", error);
    return [];
  }
}

// Function to get failed attempts count - modified to use payer_id //Correct
async function getFailedAttempts(payerId) {
  try {
    // Count failed attempts in the last 24 hours for this payer
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const failedTransactions = await Transaction.countDocuments({
      payer_id: payerId,
      payment: 'failed',
      date: { $gte: oneDayAgo }
    });
    
    return failedTransactions;
  } catch (error) {
    console.error("Error fetching failed attempts:", error);
    return 0;
  }
}

// Function to get recent transaction count within minutes //Correct
async function getRecentTransactionCount(payerId, minutes) {
  try {
    const timeWindow = new Date(Date.now() - minutes * 60 * 1000);
    return await Transaction.countDocuments({
      payer_id: payerId,
      date: { $gte: timeWindow }
    });
  } catch (error) {
    console.error("Error counting recent transactions:", error);
    return 0;
  }
}

// Function to calculate average transaction amount //Correct
function calculateAverageTransactionAmount(transactions) {
  if (!transactions || transactions.length === 0) return null;
  
  const sum = transactions.reduce((total, tx) => total + tx.amount, 0);
  return sum / transactions.length;
}

// Function to get known fraudulent IPs from previous fraudulent transactions //Correct 
async function getFraudulentIPs() {
  try {
    // Get IPs from transactions marked as fraudulent
    const fraudTxs = await Transaction.find({ is_fraud: true }).limit(1000);
    return [...new Set(fraudTxs.map(tx => tx.ip))]; // Use Set to remove duplicates
  } catch (error) {
    console.error("Error fetching fraudulent IPs:", error);
    return [];
  }
}

// Function to get payee fraud ratio
async function getPayeeFraudRatio(payeeId) {
  try {
    const totalTxCount = await Transaction.countDocuments({ payee_id: payeeId });
    
    if (totalTxCount === 0) return 0;
    
    const fraudTxCount = await Transaction.countDocuments({
      payee_id: payeeId,
      is_fraud: true
    });
    
    return fraudTxCount / totalTxCount;
  } catch (error) {
    console.error("Error calculating payee fraud ratio:", error);
    return 0;
  }
}

// Additional utility for fraud reporting
exports.reportFraud = async (req, res) => {
  try {
    const { transaction_id } = req.body;
    
    // Update transaction as reported for fraud
    await Transaction.findOneAndUpdate(
      { transaction_id },
      { 
        is_fraud: true,
        is_fraud_reported: true
      }
    );
    
    return res.status(200).json({
      success: true,
      message: `Transaction ${transaction_id} marked as fraudulent`
    });
  } catch (error) {
    console.error("Error reporting fraud:", error);
    return res.status(500).json({
      success: false,
      message: "Error reporting fraud"
    });
  }
};

// Function to get fraud statistics
exports.getFraudStats = async (req, res) => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    // Get total transaction count in last 30 days
    const totalCount = await Transaction.countDocuments({
      date: { $gte: thirtyDaysAgo }
    });
    
    // Get fraudulent transaction count in last 30 days
    const fraudCount = await Transaction.countDocuments({
      date: { $gte: thirtyDaysAgo },
      is_fraud: true
    });
    
    // Get top fraudulent states
    const fraudByState = await Transaction.aggregate([
      { $match: { is_fraud: true, date: { $gte: thirtyDaysAgo } }},
      { $group: { _id: "$state", count: { $sum: 1 } }},
      { $sort: { count: -1 }},
      { $limit: 5 }
    ]);
    
    // Get average fraud score
    const avgScoreResult = await Transaction.aggregate([
      { $match: { date: { $gte: thirtyDaysAgo }, fraud_score: { $exists: true } }},
      { $group: { _id: null, avgScore: { $avg: "$fraud_score" } }}
    ]);
    
    const avgScore = avgScoreResult.length > 0 ? avgScoreResult[0].avgScore : 0;
    
    return res.status(200).json({
      totalTransactions: totalCount,
      fraudulentTransactions: fraudCount,
      fraudRate: totalCount > 0 ? (fraudCount / totalCount * 100).toFixed(2) + '%' : '0%',
      topFraudulentStates: fraudByState,
      averageFraudScore: avgScore.toFixed(2),
      fraudScoreThreshold: FRAUD_SCORE_THRESHOLD
    });
  } catch (error) {
    console.error("Error fetching fraud statistics:", error);
    return res.status(500).json({
      success: false,
      message: "Error retrieving fraud statistics"
    });
  }
};