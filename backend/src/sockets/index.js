/** @format */
const { setSocketIO } = require("./socket.instance");
const jwt = require("jsonwebtoken");
const AppError = require("../errors/app.error");
const Course = require("../models/course.model");
const Enrollment = require("../models/enrollment.model");

const initializeSocket = (io) => {
  setSocketIO(io);
  io.use((socket, next) => {
    try {
      const accessToken = socket.handshake.auth?.token;

      if (!accessToken) {
        return next(new AppError("Authentication token required"));
      }

      const decoded = jwt.verify(accessToken, process.env.ACCESS_SECRET);

      if (!decoded.userId || !decoded.email || !decoded.role) {
        return next(new Error("Invalid authentication token"));
      }

      socket.user = {
        userId: decoded.userId,
        email: decoded.email,
        role: decoded.role,
      };
      next();
    } catch (error) {
      return next(new AppError("Invalid or Expired token"));
    }
  });

  io.on("connection", (socket) => {
    console.log(
      `Socket connected : ${socket.id} | User : ${socket.user.userId} `,
    );

    socket.join(`user:${socket.user.userId}`);

    socket.on("join:course", async (courseId, callback) => {
      try {
        if (!courseId) {
          return callback?.({
            success: false,
            message: "Course ID is required",
          });
        }

        if (socket.user.role === "teacher") {
          const course = await Course.findOne({
            _id: courseId,
            teacherId: socket.user.userId,
          });

          if (!course) {
            return callback?.({
              success: false,
              message: "Forbidden",
            });
          }
        }

        if (socket.user.role === "student") {
          const enrollment = await Enrollment.findOne({
            studentId: socket.user.userId,
            courseId: courseId,
            status: "active",
          });

          if (!enrollment) {
            return callback?.({
              success: false,
              message: "Forbidden",
            });
          }
        }

        const roomName = `course:${courseId}`;

        await socket.join(roomName);

        return callback?.({
          success: true,
          message: "Joined course room",
          room: roomName,
        });
      } catch (error) {
        return callback?.({
          success: false,
          message: "Unable to join course room",
        });
      }
    });

    socket.on("disconnect", () => {
      console.log(`Socket disconnected : ${socket.id}`);
    });
  });
};

module.exports = initializeSocket;
