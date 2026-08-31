/** @format */

const express = require("express");

const auth = require("../middlewares/auth.middleware");
const authorizationMiddleware = require("../middlewares/authorization.middleware");
const validate = require("../middlewares/validate.middleware");

const {
  requestEnrollmentSchema,
} = require("../validations/enrollment.validation");

const { requestEnrollment } = require("../controller/enrollment.controller");

const router = express.Router();

router.post(
  "/",
  auth,
  authorizationMiddleware("student"),
  validate(requestEnrollmentSchema),
  requestEnrollment,
);



module.exports = router;
