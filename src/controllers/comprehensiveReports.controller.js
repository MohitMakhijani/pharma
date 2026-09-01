const reportsService = require('../services/comprehensiveReports.service');

async function getMarginReports(req, res) {
  try {
    const data = await reportsService.getMarginReports(req.user.storeId, req.query);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Margin Reports error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to load margin reports' });
  }
}

async function getStockReports(req, res) {
  try {
    const data = await reportsService.getStockReports(req.user.storeId, req.query);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Stock Reports error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to load stock reports' });
  }
}

async function getEntelligentReports(req, res) {
  try {
    const data = await reportsService.getEntelligentReports(req.user.storeId, req.query);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('eNtelligent Reports error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to load eNtelligent reports' });
  }
}

async function getOthersReports(req, res) {
  try {
    const data = await reportsService.getOthersReports(req.user.storeId, req.query);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Others Reports error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to load others reports' });
  }
}

async function getAccountingReports(req, res) {
  try {
    const data = await reportsService.getAccountingReports(req.user.storeId);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Accounting Reports error:', error);
    return res.status(500).json({ success: false, message: error.message || 'Failed to load accounting reports' });
  }
}

module.exports = {
  getMarginReports,
  getStockReports,
  getEntelligentReports,
  getOthersReports,
  getAccountingReports,
};
