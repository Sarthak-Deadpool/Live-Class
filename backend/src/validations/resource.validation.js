/** @format */

const { zod } = require("zod");

const uploadResourceSchema = zod.object({
  courseId: zod
    .string()
    .trim()
    .regex(/^[0-9a-fA-F]{24}$/, "Invalid course ID"),

  title: zod.string().trim().min(3).max(50),
});

module.exports = { uploadResourceSchema };
