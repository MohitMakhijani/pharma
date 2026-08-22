const purchasePaymentService = require('../services/purchasePayment.service');

async function addPayment(req, res) {
  try {
    const payment = await purchasePaymentService.addPayment({
      storeId: req.user.storeId,
      purchaseId: req.params.purchaseId,
      amount: req.body.amount,
      paymentMethod: req.body.paymentMethod,
      referenceNumber: req.body.referenceNumber,
      notes: req.body.notes,
    });

    return res.status(201).json({
      success: true,
      message: 'Purchase payment recorded successfully',
      data: payment,
    });
  } catch (error) {
    console.error('Add purchase payment error:', error);

    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to record purchase payment',
    });
  }
}

async function getPayments(req, res) {
  try {
    const payments = await purchasePaymentService.getPayments(
      req.user.storeId,
      req.params.purchaseId
    );

    return res.json({
      success: true,
      data: payments,
    });
  } catch (error) {
    console.error('Get purchase payments error:', error);

    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to fetch purchase payments',
    });
  }
}

module.exports = {
  addPayment,
  getPayments,
};
