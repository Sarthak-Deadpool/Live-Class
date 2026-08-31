/** @format */

const AppError = require("../errors/app.error");

const Course = require("../models/course.model");
const Enrollment = require("../models/enrollment.model");

const requestEnrollmentService = async (studentId, courseId) => {
  if (!studentId) {
    throw new AppError("Student ID is required", 400);
  }

  const course = await Course.findById(courseId);

  if (!course) {
    throw new AppError("Course not found", 404);
  }

  if (["draft", "archived"].includes(course.status)) {
    throw new AppError(
      "Enrollment request cannot make for draft or archived course",
      400,
    );
  }

  if (
    await Enrollment.findOne({
      studentId: studentId,
      courseId: courseId,
      status: { $in: ["requested", "active"] },
    })
  ) {
    throw new AppError("Cannot make another request for single course", 400);
  }

  const response = await Enrollment.create({
    studentId: studentId,
    courseId: courseId,
    status: "requested",
    requestedAt: new Date(),
  });

  return response;
};

module.exports = { requestEnrollmentService };
