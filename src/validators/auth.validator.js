const { z } = require('zod');

const registerSchema = z.object({
  storeName: z.string().trim().min(2).max(100),
  storeCode: z.string().trim().min(2).max(30),
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().optional(),
  phone: z.string().trim().min(10).max(15).optional(),
  password: z.string().min(8).max(100),
});

const loginSchema = z.object({
  identifier: z.string().trim().min(3),
  password: z.string().min(1),
});

module.exports = {
  registerSchema,
  loginSchema,
};
