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
const salePaymentRoutes = require('./routes/salePayment.routes');
const saleRoutes = require('./routes/sale.routes');
const saleQueryRoutes = require('./routes/saleQuery.routes');
const salesReturnRoutes = require('./routes/salesReturn.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const catalogRoutes = require('./routes/catalog.routes');


const app = express();

app.use((req, res, next) => {
  console.log('🔥 GLOBAL REQUEST:', req.method, req.originalUrl);
  console.log('🔥 AUTH HEADER:', req.headers.authorization);
  next();
});


app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
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
app.use('/api', productBatchRoutes);
app.use('/api', stockRoutes);
app.use('/api', purchaseRoutes);
app.use('/api', purchasePaymentRoutes);
app.use('/api', salePaymentRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api', saleRoutes);
app.use('/api/sales', saleQueryRoutes);
app.use('/api', salesReturnRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/catalog', catalogRoutes);

app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Pharma ERP API is running',
  });
});

app.use(errorHandler);

module.exports = app;
