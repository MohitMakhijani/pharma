const dashboardService = require('../services/dashboard.service');

async function getDashboard(req, res) {
  try {
    const data = await dashboardService.getDashboard(
      req.user.storeId
    );

    return res.status(200).json({
      success: true,
      data,
    });

  } catch (error) {
    console.error('Get dashboard error:', error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to load dashboard',
    });
  }
}

module.exports = {
  getDashboard,
};
