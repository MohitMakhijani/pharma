const customerLedgerService = require('../services/customerLedger.service');

async function getCustomerLedger(req, res) {
  try {
    const ledger = await customerLedgerService.getCustomerLedger(
      req.params.customerId,
      req.user.storeId
    );

    return res.json({
      success: true,
      data: ledger,
    });
  } catch (error) {
    console.error('Get customer ledger error:', error);

    return res.status(error.statusCode || 400).json({
      success: false,
      message: error.message || 'Failed to fetch customer ledger',
    });
  }
}

async function addCustomerPayment(req, res) {
  try {
    const payment = await customerLedgerService.addCustomerPayment({ customerId: req.params.customerId, storeId: req.user.storeId, amount: req.body.amount, paymentMethod: req.body.paymentMethod, referenceNumber: req.body.referenceNumber, notes: req.body.notes });
    return res.status(201).json({ success: true, message: 'Customer payment recorded successfully', data: payment });
  } catch (error) {
    return res.status(error.statusCode || 400).json({ success: false, message: error.message || 'Failed to record customer payment' });
  }
}

module.exports = {
  getCustomerLedger,
  addCustomerPayment,
};
