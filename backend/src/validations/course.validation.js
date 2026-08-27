/** @format */

const { z } = require("zod");

const createCourseSchema = z.object({
  title: z.string().trim().min(3).max(50),
  description: z.string().trim().max(2000).optional(),
  status: z.enum(["draft", "active"]),
});

const updateCourseSchema = z.object({
  title: z.string().trim().min(3).max(50).optional(),
  description: z.string().trim().max(2000).optional(),
});

const updateCourseStatusSchema = z.object({
  status: z.enum(["draft", "active", "archived"]),
});

module.exports = {
  createCourseSchema,
  updateCourseSchema,
  updateCourseStatusSchema,
};
