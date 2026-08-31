/** @format */

const { z } = require("zod");

const requestEnrollmentSchema = z.object({
  courseId: z
    .string()
    .trim()
    .regex(/^[0-9a-fA-F]{24}$/, "Invalid course ID"),
});

const approveEnrollmentSchema = z.object({
  enrollmentId: z
    .string()
    .trim()
    .regex(/^[0-9a-fA-F]{24}$/, "Invalid enrollment ID"),
});
const rejectEnrollmentSchema = z.object({
  enrollmentId: z
    .string()
    .trim()
    .regex(/^[0-9a-fA-F]{24}$/, "Invalid enrollment ID"),
});
const withdrawEnrollmentSchema = z.object({
  enrollmentId: z
    .string()
    .trim()
    .regex(/^[0-9a-fA-F]{24}$/, "Invalid enrollment ID"),
});
const removeEnrollmentSchema = z.object({
  enrollmentId: z
    .string()
    .trim()
    .regex(/^[0-9a-fA-F]{24}$/, "Invalid enrollment ID"),
  removalReason: z.string().trim()
});

module.exports = {
  requestEnrollmentSchema,
  approveEnrollmentSchema,
  rejectEnrollmentSchema,
  withdrawEnrollmentSchema,
  removeEnrollmentSchema,
};
