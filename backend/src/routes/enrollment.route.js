/** @format */

const express = require("express");

const auth = require("../middlewares/auth.middleware");
const authorizationMiddleware = require("../middlewares/authorization.middleware");
const validate = require("../middlewares/validate.middleware");

const {
  requestEnrollmentSchema,
  approveEnrollmentSchema,
} = require("../validations/enrollment.validation");

const {
  requestEnrollment,
  getMyEnrollments,
  getCourseEnrollments,
  approveEnrollment,
} = require("../controller/enrollment.controller");

const router = express.Router();

router.post(
  "/",
  auth,
  authorizationMiddleware("student"),
  validate(requestEnrollmentSchema),
  requestEnrollment,
);

router.get("/me", auth, authorizationMiddleware("student"), getMyEnrollments);

router.get(
  "/course/:courseId",
  auth,
  authorizationMiddleware("teacher"),
  getCourseEnrollments,
);

router.patch(
  "/approve/:enrollmentId",
  auth,
  authorizationMiddleware("teacher"),
  validate(approveEnrollmentSchema),
  approveEnrollment,
);

module.exports = router;
