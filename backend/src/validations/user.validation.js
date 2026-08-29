/** @format */

const { z } = require("zod");

const registerUserSchema = z.object({
  name: z.string().trim().min(3).max(30),
  email: z
    .string()
    .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Invalid email format")
    .toLowerCase(),
  password: z
    .string()
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,16}$/,
      "Password must contain uppercase, lowercase, number and special character",
    ),
  role: z.enum(["teacher", "student"]),
});

const loginUserSchema = z.object({
  email: z
    .string()
    .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Invalid email format")
    .toLowerCase(),
  password: z.string(),
});

module.exports = { registerUserSchema, loginUserSchema };
