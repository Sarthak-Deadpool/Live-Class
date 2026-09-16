/** @format */

const { z } = require("zod");

const uploadResourceSchema = z.object({
  courseId: z
    .string()
    .trim()
    .regex(/^[0-9a-fA-F]{24}$/, "Invalid course ID"),

  title: z.string().trim().min(3).max(50),
});


module.exports = {uploadResourceSchema}