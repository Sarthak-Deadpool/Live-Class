/** @format */

const express = require("express");
const errorMiddleware = require("./middlewares/error.middleware");
const courseRoutes = require("./routes/course.route");
const userRoutes = require("./routes/user.route");

const app = express();

app.use(express.json());

app.use("/auth/user", userRoutes);
app.use("/api/course", courseRoutes);
app.use(errorMiddleware);
module.exports = app;
