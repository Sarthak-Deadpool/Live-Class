/** @format */

const express = require("express");

const auth = require("../middlewares/auth.middleware");
const authorizationMiddleware = require("../middlewares/authorization.middleware");
const validate = require("../middlewares/validate.middleware");
const {
  createClassroomSessionSchema,
  updateClassroomSessionSchema,
  changeClassroomSessionModeSchema,
} = require("../validations/classroomSession.validation");
const {
  createClassroomSession,
  getMySessions,
  getClassroomSessionById,
  updateClassroomSession,
  startClassroomSession,
  endClassroomSession,
  cancelClassroomSession,
  changeClassroomSessionMode,
  getLiveClassroomSession,
} = require("../controller/classroomSession.controller");

const router = express.Router();

router.post(
  "/",
  auth,
  authorizationMiddleware("teacher"),
  validate(createClassroomSessionSchema),
  createClassroomSession,
);

router.get("/", auth, authorizationMiddleware("teacher"), getMySessions);

router.get(
  "/:sessionId",
  auth,
  authorizationMiddleware("teacher"),
  getClassroomSessionById,
);

router.patch(
  "/:sessionId",
  auth,
  authorizationMiddleware("teacher"),
  validate(updateClassroomSessionSchema),
  updateClassroomSession,
);

router.patch(
  "/start/:sessionId",
  auth,
  authorizationMiddleware("teacher"),
  startClassroomSession,
);
router.patch(
  "/end/:sessionId",
  auth,
  authorizationMiddleware("teacher"),
  endClassroomSession,
);

router.patch(
  "/cancel/:sessionId",
  auth,
  authorizationMiddleware("teacher"),
  cancelClassroomSession,
);

router.patch(
  "/changeMode/:sessionId",
  auth,
  authorizationMiddleware("teacher"),
  validate(changeClassroomSessionModeSchema),
  changeClassroomSessionMode,
);

router.get(
  "/live/:sessionId",
  auth,
  authorizationMiddleware("student"),
  getLiveClassroomSession,
);

module.exports = router;
