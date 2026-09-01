const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');

const authRoutes = require('./routes/auth.routes');
const errorHandler = require('./middleware/error.middleware');
const userRoutes = require('./routes/user.routes');
const productRoutes = require('./routes/product.routes');
const productSupplierRoutes = require('./routes/productSupplier.routes');
const supplierRoutes = require('./routes/supplier.routes');
const customerLedgerRoutes = require('./routes/customerLedger.routes');

const productBatchRoutes = require('./routes/productBatch.routes');
const stockRoutes = require('./routes/stock.routes');
const purchaseRoutes = require('./routes/purchase.routes');
const purchasePaymentRoutes = require('./routes/purchasePayment.routes');
const customerRoutes = require('./routes/customer.routes');
const publicCustomerRoutes = require('./routes/publicCustomer.routes');
const salePaymentRoutes = require('./routes/salePayment.routes');
const saleRoutes = require('./routes/sale.routes');
const saleQueryRoutes = require('./routes/saleQuery.routes');
const salesReturnRoutes = require('./routes/salesReturn.routes');
const doctorRoutes = require('./routes/doctor.routes');
const uploadRoutes = require('./routes/upload.routes');
const gstRoutes = require('./routes/gst.routes');
const collectionRoutes = require('./routes/collection.routes');
const scheduleDrugRoutes = require('./routes/scheduleDrugs.routes');
const restockRoutes = require('./routes/restock.routes');
const billingNoteRoutes = require('./routes/billingNote.routes');
const advancedSalesReportRoutes = require('./routes/advancedSalesReport.routes');
const purchasesReportRoutes = require('./routes/purchasesReport.routes');
const comprehensiveReportsRoutes = require('./routes/comprehensiveReports.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const catalogRoutes = require('./routes/catalog.routes');
const modulePlaceholderRoutes = require('./routes/modulePlaceholder.routes');


const app = express();

app.use((req, res, next) => {
  console.log('🔥 GLOBAL REQUEST:', req.method, req.originalUrl);
  console.log('🔥 AUTH HEADER:', req.headers.authorization);
  next();
});


app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(morgan('dev'));
app.use('/api/auth', (req, res, next) => {
  console.log('🔥 AUTH PREFIX HIT:', req.method, req.originalUrl);
  next();
}, authRoutes);

app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api', productSupplierRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/customers', customerLedgerRoutes);
app.use('/api/public', publicCustomerRoutes);
app.use('/api', productBatchRoutes);
app.use('/api', stockRoutes);
app.use('/api', purchaseRoutes);
app.use('/api', purchasePaymentRoutes);
app.use('/api', salePaymentRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api', doctorRoutes);
app.use('/api', uploadRoutes);
app.use('/api/gst', gstRoutes);
app.use('/api/collection', collectionRoutes);
app.use('/api/schedule-drugs', scheduleDrugRoutes);
app.use('/api/restocks', restockRoutes);
app.use('/api/billing-notes', billingNoteRoutes);
app.use('/api/sales-report', advancedSalesReportRoutes);
app.use('/api/purchases-report', purchasesReportRoutes);
app.use('/api/comprehensive-reports', comprehensiveReportsRoutes);
app.use('/api', saleRoutes);
app.use('/api/sales', saleQueryRoutes);
app.use('/api', salesReturnRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/catalog', catalogRoutes);
app.use('/api/modules', modulePlaceholderRoutes);

app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Pharma ERP API is running',
  });
});

app.use(errorHandler);

module.exports = app;
