/** @format */

const { z } = require("zod");

const createClassroomSessionSchema = z.object({
  courseId: z
    .string()
    .trim()
    .regex(/^[0-9a-fA-F]{24}$/, "Invalid course ID"),
  title: z.string().trim().min(1),
  scheduledStart: z.coerce.date(),
  scheduledEnd: z.coerce.date(),
  mode: z.enum(["offline", "online"]),
});

const updateClassroomSessionSchema = z.object({
  title: z.string().trim().min(1),
  scheduledStart: z.coerce.date(),
  scheduledEnd: z.coerce.date(),
});

const changeClassroomSessionModeSchema = z.object({
  mode: z.enum(["offline", "online"]),
});

module.exports = {
  createClassroomSessionSchema,
  updateClassroomSessionSchema,
  changeClassroomSessionModeSchema,
};
