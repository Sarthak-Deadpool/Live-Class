/** @format */

const express = require("express");

const validate = require("../middlewares/validate.middleware");
const {
  createCourseSchema,
  updateCourseSchema,
  updateCourseStatusSchema,
} = require("../validations/course.validation");

const auth = require("../middlewares/auth.middleware");
const authorizationMiddleware = require("../middlewares/authorization.middleware");

const {
  createCourse,
  getAllCourses,
  getCourseById,
  updateCourse,
  updateCourseStatus,
} = require("../controller/course.controller");

const router = express.Router();

router.post(
  "/",
  auth,
  authorizationMiddleware("teacher"),
  validate(createCourseSchema),
  createCourse,
);
router.get("/", auth, getAllCourses);
router.get("/:id", auth, getCourseById);
router.patch(
  "/:id",
  auth,
  authorizationMiddleware("teacher"),
  validate(updateCourseSchema),
  updateCourse,
);
router.patch(
  "/:id/status",
  auth,
  authorizationMiddleware("teacher"),
  validate(updateCourseStatusSchema),
  updateCourseStatus,
);

module.exports = router;
