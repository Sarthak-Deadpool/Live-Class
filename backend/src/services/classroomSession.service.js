/** @format */

const AppError = require("../errors/app.error");

const Course = require("../models/course.model");
const ClassroomSession = require("../models/classroomSession.model");
const Enrollment = require("../models/enrollment.model");

const createClassroomSessionService = async (
  teacherId,
  courseId,
  title,
  scheduledStart,
  scheduledEnd,
  mode,
) => {
  if (!teacherId) {
    throw new AppError("Teacher ID is required", 400);
  }

  const course = await Course.findById(courseId);

  if (!course) {
    throw new AppError("Course not found", 404);
  }

  if (course.teacherId.toString() !== teacherId) {
    throw new AppError("Forbidden", 403);
  }

  if (scheduledStart < new Date()) {
    throw new AppError("Scheduled time connot be past time", 400);
  }

  if (scheduledEnd <= scheduledStart) {
    throw new AppError("End time cannot be less than start time ", 400);
  }

  const response = await ClassroomSession.create({
    teacherId: teacherId,
    courseId: courseId,
    title: title,
    scheduledStart: scheduledStart,
    scheduledEnd: scheduledEnd,
    mode: mode,
    lifecycle: "scheduled",
  });

  return response;
};

const getMySessionsService = async (teacherId) => {
  if (!teacherId) {
    throw new AppError("Teacher ID is required", 400);
  }

  const sessions = await ClassroomSession.find({
    teacherId: teacherId,
  });

  return sessions;
};

const getClassroomSessionByIdService = async (teacherId, sessionId) => {
  if (!teacherId) {
    throw new AppError("Teacher ID is required", 400);
  }

  if (!sessionId) {
    throw new AppError("Session ID is required", 400);
  }

  const session = await ClassroomSession.findById(sessionId);

  if (!session) {
    throw new AppError("Session not found", 404);
  }
  if (session.teacherId.toString() !== teacherId) {
    throw new AppError("Forbidden", 403);
  }

  return session;
};

const updateClassroomSessionService = async (
  teacherId,
  sessionId,
  title,
  scheduledStart,
  scheduledEnd,
) => {
  if (!teacherId) {
    throw new AppError("Teacher ID is required", 400);
  }
  if (!sessionId) {
    throw new AppError("Session ID is required", 400);
  }

  const session = await ClassroomSession.findById(sessionId);
  if (!session) {
    throw new AppError("Session not found", 404);
  }

  if (session.teacherId.toString() !== teacherId) {
    throw new AppError("Forbidden", 403);
  }

  if (session.lifecycle !== "scheduled") {
    throw new AppError("Session is not at schedule state", 400);
  }

  if (scheduledStart < new Date()) {
    throw new AppError("Scheduled time connot be past time", 400);
  }

  if (scheduledEnd <= scheduledStart) {
    throw new AppError("End time cannot be less than start time ", 400);
  }

  const response = await ClassroomSession.findByIdAndUpdate(
    sessionId,
    {
      title: title,
      scheduledStart: scheduledStart,
      scheduledEnd: scheduledEnd,
    },
    { new: true },
  );

  return response;
};

const startClassroomSessionService = async (teacherId, sessionId) => {
  if (!teacherId) {
    throw new AppError("Teacher ID is required", 400);
  }
  if (!sessionId) {
    throw new AppError("Session ID is required", 400);
  }

  const session = await ClassroomSession.findById(sessionId);
  if (!session) {
    throw new AppError("Session not found", 404);
  }

  if (session.teacherId.toString() !== teacherId) {
    throw new AppError("Forbidden", 403);
  }

  if (session.lifecycle !== "scheduled") {
    throw new AppError("Session is not at schedule state", 400);
  }

  const response = await ClassroomSession.findByIdAndUpdate(
    sessionId,
    {
      lifecycle: "live",
      "liveRoom.startedAt": new Date(),
      "liveRoom.startedBy": teacherId,
    },
    { new: true },
  );

  return response;
};

const endClassroomSessionService = async (teacherId, sessionId) => {
  if (!teacherId) {
    throw new AppError("Teacher ID is required", 400);
  }
  if (!sessionId) {
    throw new AppError("Session ID is required", 400);
  }

  const session = await ClassroomSession.findById(sessionId);
  if (!session) {
    throw new AppError("Session not found", 404);
  }

  if (session.teacherId.toString() !== teacherId) {
    throw new AppError("Forbidden", 403);
  }

  if (session.lifecycle !== "live") {
    throw new AppError("Session is not at live state", 400);
  }

  const response = await ClassroomSession.findByIdAndUpdate(
    sessionId,
    {
      lifecycle: "completed",
      "liveRoom.endedAt": new Date(),
    },
    { new: true },
  );

  return response;
};

const cancelClassroomSessionService = async (teacherId, sessionId) => {
  if (!teacherId) {
    throw new AppError("Teacher ID is required", 400);
  }
  if (!sessionId) {
    throw new AppError("Session ID is required", 400);
  }

  const session = await ClassroomSession.findById(sessionId);
  if (!session) {
    throw new AppError("Session not found", 404);
  }

  if (session.teacherId.toString() !== teacherId) {
    throw new AppError("Forbidden", 403);
  }

  if (session.lifecycle !== "scheduled") {
    throw new AppError("Session is not at scheduled state", 400);
  }

  const response = await ClassroomSession.findByIdAndUpdate(
    sessionId,
    {
      lifecycle: "cancelled",
    },
    { new: true },
  );

  return response;
};

const changeClassroomSessionModeService = async (
  teacherId,
  sessionId,
  mode,
) => {
  if (!teacherId) {
    throw new AppError("Teacher ID is required", 400);
  }
  if (!sessionId) {
    throw new AppError("Session ID is required", 400);
  }

  const session = await ClassroomSession.findById(sessionId);
  if (!session) {
    throw new AppError("Session not found", 404);
  }

  if (session.teacherId.toString() !== teacherId) {
    throw new AppError("Forbidden", 403);
  }

  if (session.lifecycle !== "scheduled") {
    throw new AppError("Session is not at schedule state", 400);
  }

  const response = await ClassroomSession.findByIdAndUpdate(
    sessionId,
    {
      mode: mode,
      modeChangedAt: new Date(),
      modeChangedBy: teacherId,
    },
    { new: true },
  );

  return response;
};

const getLiveClassroomSessionService = async (studentId, sessionId) => {
  if (!studentId) {
    throw new AppError("Student ID is required", 400);
  }
  if (!sessionId) {
    throw new AppError("Session ID is required", 400);
  }

  const session = await ClassroomSession.findById(sessionId);

  if (!session) {
    throw new AppError("Session not found", 404);
  }

  if (session.lifecycle !== "live") {
    throw new AppError("Session is not live yet", 400);
  }

  const enrollment = await Enrollment.findOne({
    studentId: studentId,
    courseId: session.courseId,
    status: "active",
  });

  if (!enrollment) {
    throw new AppError("forbidden", 403);
  }

  return session;
};

module.exports = {
  createClassroomSessionService,
  getMySessionsService,
  getClassroomSessionByIdService,
  updateClassroomSessionService,
  startClassroomSessionService,
  endClassroomSessionService,
  cancelClassroomSessionService,
  changeClassroomSessionModeService,
  getLiveClassroomSessionService,
};
