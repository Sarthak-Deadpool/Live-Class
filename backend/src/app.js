/** @format */

const express = require("express");
const courseRoutes = require("./routes/course.route");

const app = express();

app.use("/api/course");



module.exports = app;
