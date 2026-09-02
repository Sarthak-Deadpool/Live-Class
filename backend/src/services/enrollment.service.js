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

const getMyEnrollmentsService = async (studentId) => {
  if (!studentId) {
    throw new AppError("Student Id is required", 400);
  }

  const enrollments = await Enrollment.find({ studentId: studentId });

  return enrollments;
};

const getCourseEnrollmentsService = async (teacherId, courseId) => {
  if (!teacherId) {
    throw new AppError("Teacher ID is required", 400);
  }
  if (!courseId) {
    throw new AppError("Course ID is required", 400);
  }

  const course = await Course.findById(courseId);

  if (!course) {
    throw new AppError("Course does not exist", 404);
  }

  if (course.teacherId.toString() !== teacherId) {
    throw new AppError("Forbidden", 403);
  }

  const enrollments = await Enrollment.find({
    courseId: courseId,
  });

  return enrollments;
};

const approveEnrollmentService = async (teacherId, enrollmentId) => {
  if (!teacherId) {
    throw new AppError("Teacher ID is required", 400);
  }

  const enrollment = await Enrollment.findById(enrollmentId);

  if (!enrollment) {
    throw new AppError("Enrollment not found", 404);
  }

  const courseId = enrollment.courseId;

  const course = await Course.findById(courseId);

  if (!course) {
    throw new AppError("Course not found", 404);
  }

  if (course.teacherId.toString() !== teacherId) {
    throw new AppError("Forbidden", 403);
  }

  if (enrollment.status !== "requested") {
    throw new AppError("Status must be requested", 400);
  }

  const response = await Enrollment.findByIdAndUpdate(
    enrollmentId,
    {
      status: "active",
      decidedAt: new Date(),
      decidedBy: teacherId,
    },
    { new: true },
  );

  return response;
};

const rejectEnrollmentService = async (teacherId, enrollmentId) => {
  if (!teacherId) {
    throw new AppError("Teacher ID is required", 400);
  }

  const enrollment = await Enrollment.findById(enrollmentId);

  if (!enrollment) {
    throw new AppError("Enrollment not found", 404);
  }

  const courseId = enrollment.courseId;

  const course = await Course.findById(courseId);

  if (!course) {
    throw new AppError("Course not found", 404);
  }

  if (course.teacherId.toString() !== teacherId) {
    throw new AppError("Forbidden", 403);
  }

  if (enrollment.status !== "requested") {
    throw new AppError("Status must be requested", 400);
  }

  const response = await Enrollment.findByIdAndUpdate(
    enrollmentId,
    {
      status: "rejected",
      decidedAt: new Date(),
      decidedBy: teacherId,
    },
    { new: true },
  );

  return response;
};

const withdrawEnrollmentService = async (studentId, enrollmentId) => {
  if (!studentId) {
    throw new AppError("Student ID is required", 400);
  }

  const enrollment = await Enrollment.findById(enrollmentId);

  if (!enrollment) {
    throw new AppError("Enrollment not found", 404);
  }

  if (enrollment.studentId.toString() !== studentId) {
    throw new AppError("Forbidden", 403);
  }

  if (!["requested", "active"].includes(enrollment.status)) {
    throw new AppError(
      "You cannot withdrawn course which is not requested or active",
      400,
    );
  }

  const response = await Enrollment.findByIdAndUpdate(
    enrollmentId,
    {
      status: "withdrawn",
      decidedAt: new Date(),
      decidedBy: studentId,
    },
    { new: true },
  );

  return response;
};

const removeEnrollmentService = async (
  teacherId,
  enrollmentId,
  removalReason,
) => {
  if (!teacherId) {
    throw new AppError("Teacher ID is required", 400);
  }

  const enrollment = await Enrollment.findById(enrollmentId);

  if (!enrollment) {
    throw new AppError("Enrollment not found", 404);
  }

  const courseId = enrollment.courseId;

  const course = await Course.findById(courseId);

  if (!course) {
    throw new AppError("Course not found", 404);
  }

  if (course.teacherId.toString() !== teacherId) {
    throw new AppError("Forbidden", 403);
  }

  if (enrollment.status === "removed") {
    throw new AppError("Cannot remove course with status removed", 400);
  }

  const response = await Enrollment.findByIdAndUpdate(
    enrollmentId,
    {
      status: "removed",
      removedAt: new Date(),
      removedBy: teacherId,
      removalReason: removalReason,
    },
    { new: true },
  );

  return response;
};

module.exports = {
  requestEnrollmentService,
  getMyEnrollmentsService,
  getCourseEnrollmentsService,
  approveEnrollmentService,
  rejectEnrollmentService,
  withdrawEnrollmentService,
  removeEnrollmentService,
};
