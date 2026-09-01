const service = require('../services/purchasesReport.service');

async function getPurchasesReport(req, res) {
  try {
    const data = await service.getPurchasesReport(req.user.storeId, req.query);
    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Purchases report error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate purchases report',
    });
  }
}

module.exports = {
  getPurchasesReport,
};
