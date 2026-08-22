require('dotenv').config();

const app = require('./app');
const prisma = require('./config/prisma');

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    await prisma.$connect();

    console.log('Database connected');

    app.listen(PORT, () => {
      console.log(`Pharma ERP API running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
