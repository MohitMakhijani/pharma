const saleService = require('../services/sale.service');

async function createSale(req, res) {
  try {
    const sale = await saleService.createSale({
      storeId: req.user.storeId,
      customerId: req.body.customerId,
      invoiceNumber: req.body.invoiceNumber,
      invoiceDate: req.body.invoiceDate,
      items: req.body.items,
      notes: req.body.notes,
    });

    return res.status(201).json({
      success: true,
      message: 'Sale created successfully',
      data: sale,
    });

  } catch (error) {

    console.error('Create sale error:', error);

    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to create sale',
    });

  }
}


module.exports = {
  createSale,
};
