const service = require('../services/advancedSalesReport.service');

async function getAdvancedSalesReport(req, res) {
  try {
    const data = await service.getAdvancedSalesReport(req.user.storeId, req.query);
    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Advanced sales report error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate advanced sales report',
    });
  }
}

module.exports = {
  getAdvancedSalesReport,
};
