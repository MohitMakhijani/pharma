const service = require('../services/billingNote.service');

async function getBillingNotes(req, res) {
  try {
    const data = await service.getBillingNotes(req.user.storeId, req.query);
    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Get billing notes error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to load billing notes',
    });
  }
}

async function createBillingNote(req, res) {
  try {
    const data = await service.createBillingNote(req.user.storeId, req.body);
    return res.status(201).json({
      success: true,
      message: 'Billing note created',
      data,
    });
  } catch (error) {
    console.error('Create billing note error:', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to create billing note',
    });
  }
}

async function deleteBillingNote(req, res) {
  try {
    await service.deleteBillingNote(req.user.storeId, req.params.id);
    return res.json({
      success: true,
      message: 'Billing note removed',
    });
  } catch (error) {
    console.error('Delete billing note error:', error);
    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to delete billing note',
    });
  }
}

module.exports = {
  getBillingNotes,
  createBillingNote,
  deleteBillingNote,
};
