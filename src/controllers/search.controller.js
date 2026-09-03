const prisma = require('../config/prisma');

async function globalSearch(req, res) {
  try {
    const query = String(req.query.q || '').trim();
    const storeId = req.user?.storeId;

    if (!storeId) {
      return res.status(401).json({
        success: false,
        message: 'Store identification is required',
      });
    }

    if (!query || query.length < 1) {
      return res.json({
        success: true,
        data: {
          products: [],
          customers: [],
          suppliers: [],
          sales: [],
          purchases: [],
        },
      });
    }

    const [products, customers, suppliers, sales, purchases] = await Promise.all([
      // 1. Products (Search by name, genericName, brandName, sku, barcode, or formulation)
      prisma.product.findMany({
        where: {
          storeId,
          isDeleted: false,
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { genericName: { contains: query, mode: 'insensitive' } },
            { brandName: { contains: query, mode: 'insensitive' } },
            { sku: { contains: query, mode: 'insensitive' } },
            { barcode: { contains: query, mode: 'insensitive' } },
            { dosageForm: { contains: query, mode: 'insensitive' } },
            { rack: { contains: query, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          name: true,
          genericName: true,
          brandName: true,
          dosageForm: true,
          sku: true,
          rack: true,
          packaging: {
            take: 1,
            select: { name: true, conversionToBase: true },
          },
          batches: {
            where: { storeId },
            take: 3,
            orderBy: { expiryDate: 'asc' },
            select: {
              batchNumber: true,
              expiryDate: true,
              mrp: true,
              sellingPrice: true,
              stocks: {
                where: { storeId },
                select: { quantity: true },
              },
            },
          },
        },
        take: 6,
        orderBy: { name: 'asc' },
      }),

      // 2. Customers (Search by name, phone, alternatePhone, email, or gstin)
      prisma.customer.findMany({
        where: {
          storeId,
          isDeleted: false,
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { phone: { contains: query, mode: 'insensitive' } },
            { alternatePhone: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
            { gstin: { contains: query, mode: 'insensitive' } },
            { city: { contains: query, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          city: true,
          creditLimit: true,
          openingBalance: true,
        },
        take: 5,
        orderBy: { name: 'asc' },
      }),

      // 3. Suppliers (Search by name, contactPerson, phone, email, or gstin)
      prisma.supplier.findMany({
        where: {
          storeId,
          isDeleted: false,
          OR: [
            { name: { contains: query, mode: 'insensitive' } },
            { contactPerson: { contains: query, mode: 'insensitive' } },
            { phone: { contains: query, mode: 'insensitive' } },
            { email: { contains: query, mode: 'insensitive' } },
            { gstin: { contains: query, mode: 'insensitive' } },
            { city: { contains: query, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          name: true,
          contactPerson: true,
          phone: true,
          email: true,
          city: true,
          openingBalance: true,
        },
        take: 5,
        orderBy: { name: 'asc' },
      }),

      // 4. Sales Invoices (Search by invoiceNumber, doctor, or customer name)
      prisma.sale.findMany({
        where: {
          storeId,
          isDeleted: false,
          OR: [
            { invoiceNumber: { contains: query, mode: 'insensitive' } },
            { doctor: { contains: query, mode: 'insensitive' } },
            { customer: { name: { contains: query, mode: 'insensitive' } } },
            { customer: { phone: { contains: query, mode: 'insensitive' } } },
          ],
        },
        select: {
          id: true,
          invoiceNumber: true,
          invoiceDate: true,
          totalAmount: true,
          paidAmount: true,
          dueAmount: true,
          status: true,
          paymentStatus: true,
          customer: {
            select: { name: true, phone: true },
          },
        },
        take: 5,
        orderBy: { invoiceDate: 'desc' },
      }),

      // 5. Purchase Invoices (Search by invoiceNumber or supplier name)
      prisma.purchase.findMany({
        where: {
          storeId,
          isDeleted: false,
          OR: [
            { invoiceNumber: { contains: query, mode: 'insensitive' } },
            { supplier: { name: { contains: query, mode: 'insensitive' } } },
            { notes: { contains: query, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true,
          invoiceNumber: true,
          invoiceDate: true,
          totalAmount: true,
          paidAmount: true,
          dueAmount: true,
          status: true,
          paymentStatus: true,
          supplier: {
            select: { name: true, phone: true },
          },
        },
        take: 5,
        orderBy: { invoiceDate: 'desc' },
      }),
    ]);

    return res.json({
      success: true,
      data: {
        products,
        customers,
        suppliers,
        sales,
        purchases,
      },
      totalMatches:
        products.length +
        customers.length +
        suppliers.length +
        sales.length +
        purchases.length,
    });
  } catch (error) {
    console.error('Global search error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Global search encountered an error',
    });
  }
}

module.exports = {
  globalSearch,
};
