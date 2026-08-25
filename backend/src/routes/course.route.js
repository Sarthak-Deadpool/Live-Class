/** @format */

const express = require("express");
const router = express.Router();

const {
  createCourse,
  getAllCourses,
  getCourseById,
  updateCourse,
  updateCourseStatus,
} = require("../controller/course.controller");

router.post("/", createCourse);
router.get("/", getAllCourses);
router.get("/:id", getCourseById);
router.patch("/:id", updateCourse);
router.patch("/:id/status", updateCourseStatus);

module.exports = router;
