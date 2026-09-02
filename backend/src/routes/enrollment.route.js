/** @format */

const express = require("express");

const auth = require("../middlewares/auth.middleware");
const authorizationMiddleware = require("../middlewares/authorization.middleware");
const validate = require("../middlewares/validate.middleware");

const {
  requestEnrollmentSchema,
  approveEnrollmentSchema,
  rejectEnrollmentSchema,
  withdrawEnrollmentSchema,
  removeEnrollmentSchema,
} = require("../validations/enrollment.validation");

const {
  requestEnrollment,
  getMyEnrollments,
  getCourseEnrollments,
  approveEnrollment,
  rejectEnrollment,
  withdrawEnrollment,
  removeEnrollment,
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
  "/courseEnrollments/:courseId",
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

router.patch(
  "/reject/:enrollmentId",
  auth,
  authorizationMiddleware("teacher"),
  validate(rejectEnrollmentSchema),
  rejectEnrollment,
);

router.patch(
  "/withdraw/:enrollmentId",
  auth,
  authorizationMiddleware("student"),
  validate(withdrawEnrollmentSchema),
  withdrawEnrollment,
);

router.patch(
  "/remove/:enrollmentId",
  auth,
  authorizationMiddleware("teacher"),
  validate(removeEnrollmentSchema),
  removeEnrollment,
);

module.exports = router;
