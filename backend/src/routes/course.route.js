/** @format */

const express = require("express");

const validate = require("../middlewares/validate.middleware");
const {
  createCourseSchema,
  updateCourseSchema,
  updateCourseStatusSchema,
} = require("../validations/course.validation");

const {
  createCourse,
  getAllCourses,
  getCourseById,
  updateCourse,
  updateCourseStatus,
} = require("../controller/course.controller");

const router = express.Router();

router.post("/", validate(createCourseSchema), createCourse);
router.get("/", getAllCourses);
router.get("/:id", getCourseById);
router.patch("/:id", validate(updateCourseSchema), updateCourse);
router.patch(
  "/:id/status",
  validate(updateCourseStatusSchema),
  updateCourseStatus,
);

module.exports = router;
