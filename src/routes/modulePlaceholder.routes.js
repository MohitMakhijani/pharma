const express = require('express');

const router = express.Router();

const modules = [
  'billing-notes',
  'create-debit-note',
  'drugs-trash',
  'customers-trash',
  'suppliers-trash',
  'sales-returned',
  'sales-drafts',
  'purchase-orders',
  'restocks',
  'purchases-trash',
  'purchase-drafts',
  'sales-invoice',
  'advanced-sales-report',
  'collection-report',
  'gst-returns',
  'ayushman-sales',
  'nrx',
  'old-sales-report',
  'purchases-report',
  'schedule-drug-reports',
];

modules.forEach((moduleName) => {
  router.get(`/${moduleName}`, (req, res) => {
    res.status(200).json({
      success: true,
      module: moduleName,
      message: `${moduleName} endpoint is ready for implementation`,
    });
  });
});

module.exports = router;
