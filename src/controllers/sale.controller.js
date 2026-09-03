const saleService = require('../services/sale.service');

async function getSales(req, res) {
  try {
    const sales = await saleService.getSales(req.user.storeId, req.query);
    return res.json({
      success: true,
      data: sales,
    });
  } catch (error) {
    console.error('Get sales error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch sales',
    });
  }
}

async function getSaleById(req, res) {
  try {
    const sale = await saleService.getSaleById(req.user.storeId, req.params.id);
    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'Sale not found',
      });
    }
    return res.json({
      success: true,
      data: sale,
    });
  } catch (error) {
    console.error('Get sale by id error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch sale',
    });
  }
}

async function getPublicSharedInvoice(req, res) {
  try {
    const { id } = req.params;
    const sale = await saleService.getPublicSharedInvoice(id);

    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found or link has expired',
      });
    }

    return res.json({
      success: true,
      data: sale,
    });
  } catch (error) {
    console.error('Get public shared invoice error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch invoice',
    });
  }
}

async function createSale(req, res) {
  try {
    const sale = await saleService.createSale({
      storeId: req.user.storeId,
      customerId: req.body.customerId,
      customerName: req.body.customerName,
      customerPhone: req.body.customerPhone,
      doctorId: req.body.doctorId,
      doctorName: req.body.doctorName,
      invoiceNumber: req.body.invoiceNumber,
      invoiceDate: req.body.invoiceDate,
      dueDate: req.body.dueDate,
      doctor: req.body.doctor,
      discountPercent: req.body.discountPercent,
      paymentMethod: req.body.paymentMethod,
      paymentStatus: req.body.paymentStatus,
      paidAmount: req.body.paidAmount,
      status: req.body.status,
      items: req.body.items,
      notes: req.body.notes,
      prescriptions: req.body.prescriptions,
      isAyushman: Boolean(req.body.isAyushman),
      ayushmanCardNo: req.body.ayushmanCardNo || null,
      beneficiaryId: req.body.beneficiaryId || null,
      claimStatus: req.body.claimStatus || (req.body.isAyushman ? 'PENDING' : null),
      saleId: req.body.saleId || req.params?.id || null,
      reminders: Array.isArray(req.body.reminders) ? req.body.reminders : (req.body.reminder ? [req.body.reminder] : []),
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

async function deleteSale(req, res) {
  try {
    const deleted = await saleService.deleteSale(req.user.storeId, req.params.id);
    return res.json({
      success: true,
      data: deleted,
    });
  } catch (error) {
    console.error('Delete sale error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete sale',
    });
  }
}

module.exports = {
  getSales,
  getSaleById,
  getPublicSharedInvoice,
  createSale,
  deleteSale,
};
