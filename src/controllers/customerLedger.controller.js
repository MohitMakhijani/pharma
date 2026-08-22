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

module.exports = {
  getCustomerLedger,
};
