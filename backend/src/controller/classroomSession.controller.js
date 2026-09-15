/** @format */

const { getSocketIO } = require("../sockets/socket.instance");

const {
  createClassroomSessionService,
  getMySessionsService,
  getClassroomSessionByIdService,
  updateClassroomSessionService,
  startClassroomSessionService,
  endClassroomSessionService,
  cancelClassroomSessionService,
  changeClassroomSessionModeService,
  getLiveClassroomSessionService,
} = require("../services/classroomSession.service");

const createClassroomSession = async (req, res) => {
  const teacherId = req.user.userId;
  const { courseId, title, scheduledStart, scheduledEnd, mode } = req.body;

  const response = await createClassroomSessionService(
    teacherId,
    courseId,
    title,
    scheduledStart,
    scheduledEnd,
    mode,
  );

  return res.status(201).json({
    success: true,
    data: response,
  });
};

const getMySessions = async (req, res) => {
  const teacherId = req.user.userId;

  const response = await getMySessionsService(teacherId);

  return res.status(200).json({
    success: true,
    data: response,
  });
};

const getClassroomSessionById = async (req, res) => {
  const teacherId = req.user.userId;
  const sessionId = req.params.sessionId;

  const response = await getClassroomSessionByIdService(teacherId, sessionId);

  return res.status(200).json({
    success: true,
    data: response,
  });
};

const updateClassroomSession = async (req, res) => {
  const teacherId = req.user.userId;
  const sessionId = req.params.sessionId;

  const { title, scheduledStart, scheduledEnd } = req.body;

  const response = await updateClassroomSessionService(
    teacherId,
    sessionId,
    title,
    scheduledStart,
    scheduledEnd,
  );

  return res.status(200).json({
    success: true,
    data: response,
  });
};

const startClassroomSession = async (req, res) => {
  const teacherId = req.user.userId;
  const sessionId = req.params.sessionId;

  const response = await startClassroomSessionService(teacherId, sessionId);

  const io = getSocketIO();

  io.to(`course:${response.courseId}`).emit("class:started", {
    sessionId: response._id,
    courseId: response.courseId,
    lifecycle: response.lifecycle,
    startedAt: response.liveRoom.startedAt,
  });

  return res.status(200).json({
    success: true,
    data: response,
  });
};

const endClassroomSession = async (req, res) => {
  const teacherId = req.user.userId;
  const sessionId = req.params.sessionId;

  const response = await endClassroomSessionService(teacherId, sessionId);

  const io = getSocketIO();

  io.to(`course:${response.courseId}`).emit("class:ended", {
    sessionId: response._id,
    courseId: response.courseId,
    lifecycle: response.lifecycle,
    endedAt: response.liveRoom.endedAt,
  });

  return res.status(200).json({
    success: true,
    data: response,
  });
};

const cancelClassroomSession = async (req, res) => {
  const teacherId = req.user.userId;
  const sessionId = req.params.sessionId;

  const response = await cancelClassroomSessionService(teacherId, sessionId);

  return res.status(200).json({
    success: true,
    data: response,
  });
};

const changeClassroomSessionMode = async (req, res) => {
  const teacherId = req.user.userId;
  const sessionId = req.params.sessionId;
  const mode = req.body.mode;

  const response = await changeClassroomSessionModeService(
    teacherId,
    sessionId,
    mode,
  );

  if (response.mode === "online") {
    const io = getSocketIO();

    io.to(`course:${response.courseId}`).emit("class:online", {
      sessionId: response._id,
      courseId: response.courseId,
      mode: response.mode,
      modeChangedAt: response.modeChangedAt,
    });
  }

  return res.status(200).json({
    success: true,
    data: response,
  });
};

const getLiveClassroomSession = async (req, res) => {
  const studentId = req.user.userId;
  const sessionId = req.params.sessionId;

  const response = await getLiveClassroomSessionService(studentId, sessionId);

  return res.status(200).json({
    success: true,
    data: response,
  });
};

module.exports = {
  createClassroomSession,
  getMySessions,
  getClassroomSessionById,
  updateClassroomSession,
  startClassroomSession,
  endClassroomSession,
  cancelClassroomSession,
  changeClassroomSessionMode,
  getLiveClassroomSession,
};
