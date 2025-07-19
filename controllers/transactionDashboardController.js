const Transaction = require('../models/transactionModel');

const getTransactions = async (req, res) => {
  try {
    const {
      dateFrom,
      dateTo,
      payerId,
      payeeId,
      transactionId,
      page = 1,
      limit = 10,
      ip // Get IP directly from request query/body
    } = req.query;

    // Remove the IP detection logic since it's coming from client

    // Build filter object
    const filter = {};
    if (dateFrom && dateTo) {
      filter.date = { $gte: new Date(dateFrom), $lte: new Date(dateTo) };
    }
    if (payerId) filter.payer_id = payerId;
    if (payeeId) filter.payee_id = payeeId;
    if (transactionId) filter.transaction_id = transactionId;

    // Calculate pagination
    const skip = (page - 1) * limit;
    
    // Get total count
    const total = await Transaction.countDocuments(filter);
    
    // Get transactions
    const transactions = await Transaction.find(filter)
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ date: -1 })
      .lean()  // Convert to plain JavaScript objects
      .then(transactions => transactions.map(txn => ({
        // Transform field names to match frontend expectations
        id: txn._id,
        date: txn.date,
        amount: txn.amount,
        payer: txn.payer_id,
        payee: txn.payee_id,
        channel: txn.payment_channel,
        mode: txn.payment_mode,
        fraudPredicted: txn.is_fraud ? 'Yes' : 'No',
        fraudReported: txn.is_fraud_reported ? 'Yes' : 'No',
        ipAddress: txn.ip || ip // Use the IP from request
      })));

    // Define dynamic columns
    const columns = [
      { key: 'id', label: 'Transaction ID', type: 'text' },
      { key: 'date', label: 'Date & Time', type: 'text' },
      { key: 'amount', label: 'Amount', type: 'text' },
      { key: 'payer', label: 'Payer ID', type: 'text' },
      { key: 'payee', label: 'Payee ID', type: 'text' },
      { key: 'channel', label: 'Channel', type: 'text' },
      { key: 'mode', label: 'Payment Mode', type: 'text' },
      { key: 'fraudPredicted', label: 'Fraud Predicted', type: 'status' },
      { key: 'fraudReported', label: 'Fraud Sent', type: 'status' },
      { key: 'ipAddress', label: 'IP Address', type: 'text' } // New column
    ];

    // Send response
    res.json({
      data: {
        transactions,
        columns,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Error in getTransactions:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getTransactionStats = async (req, res) => {
  try {
    const stats = await Transaction.aggregate([
      {
        $group: {
          _id: null,
          totalTransactions: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          fraudulentTransactions: {
            $sum: { $cond: [{ $eq: ['$fraudPredicted', 'Yes'] }, 1, 0] }
          }
        }
      }
    ]);

    res.json({
      stats: stats[0] || {
        totalTransactions: 0,
        totalAmount: 0,
        fraudulentTransactions: 0
      }
    });

  } catch (error) {
    console.error('Error in getTransactionStats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getTransactions,
  getTransactionStats
};
