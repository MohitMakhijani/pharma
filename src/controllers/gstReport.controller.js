const service = require('../services/gstReport.service');

async function getGstReport(req, res) {
  try {
    const data = await service.getGstReport(req.user.storeId, req.query);
    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('GST Report error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate GST report',
    });
  }
}

module.exports = {
  getGstReport,
};
