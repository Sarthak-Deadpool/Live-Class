/** @format */
const crypto = require("crypto");
const { AccessToken } = require("livekit-server-sdk");
const AppError = require("../errors/app.error");

const ClassroomSession = require("../models/classroomSession.model");
const User = require("../models/user.model");
const Enrollment = require("../models/enrollment.model");
const livekitConfig = require("../config/livekit.config");

const generateLiveKitJoinTokenService = async (userId, sessionId) => {
  if (!userId) {
    throw new AppError("User ID is required", 400);
  }

  if (!sessionId) {
    throw new AppError("Session ID is required", 400);
  }

  const session = await ClassroomSession.findById(sessionId);

  if (!session) {
    throw new AppError("Session not found", 404);
  }

  if (session.lifecycle !== "live") {
    throw new AppError("Session is not live", 400);
  }

  const user = await User.findById(userId);

  if (!user) {
    throw new AppError("User not found", 404);
  }

  if (user.role === "teacher") {
    if (session.teacherId.toString() !== userId) {
      throw new AppError("Forbidden", 403);
    }
  }

  if (user.role === "student") {
    const enrollment = await Enrollment.findOne({
      studentId: userId,
      courseId: session.courseId,
      status: "active",
    });

    if (!enrollment) {
      throw new AppError("Forbidden", 403);
    }
  }

  if (!session.liveRoom.roomName) {
    session.liveRoom.roomName = `classroom-${crypto.randomUUID()}`;
    await session.save();
  }

  const roomName = session.liveRoom.roomName;

  const token = new AccessToken(livekitConfig.apiKey, livekitConfig.apiSecret, {
    identity: userId.toString(),
    ttl: "10m",
  });

  if (user.role === "teacher") {
    token.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      canPublishSources: [
        "camera",
        "microphone",
        "screen_share",
        "screen_share_audio",
      ],
    });
  }

  if (user.role === "student") {
    token.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      canPublishSources: ["camera", "microphone"],
    });
  }

  const liveKitToken = await token.toJwt();

  return {
    token: liveKitToken,
    serverUrl: livekitConfig.serverUrl,
    roomName,
  };
};

module.exports = { generateLiveKitJoinTokenService };
