const service = require('../services/scheduleDrugReport.service');

async function getScheduleDrugReport(req, res) {
  try {
    const data = await service.getScheduleDrugReport(req.user.storeId, req.query);
    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Schedule Drug Report error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to load schedule drug register',
    });
  }
}

module.exports = {
  getScheduleDrugReport,
};
