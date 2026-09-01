const service = require('../services/collectionReport.service');

async function getCollectionReport(req, res) {
  try {
    const data = await service.getCollectionReport(req.user.storeId, req.query);
    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Collection Report error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate collection report',
    });
  }
}

module.exports = {
  getCollectionReport,
};
