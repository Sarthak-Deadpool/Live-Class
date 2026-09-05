/** @format */

const express = require("express");
const cookieParser = require("cookie-parser");
const errorMiddleware = require("./middlewares/error.middleware");
const courseRoutes = require("./routes/course.route");
const userRoutes = require("./routes/user.route");
const enrollmentRoutes = require("./routes/enrollment.route");
const classroomSessionRoutes = require("./routes/classroomSession.route");

const app = express();

app.use(express.json());
app.use(cookieParser());

app.use("/api/auth", userRoutes);
app.use("/api/course", courseRoutes);
app.use("/api/enrollment", enrollmentRoutes);
app.use("/api/classroomSession", classroomSessionRoutes);
app.use(errorMiddleware);
module.exports = app;
