/** @format */
const AppError = require("../errors/app.error");
const Course = require("../models/course.model");
const Enrollment = require("../models/enrollment.model");

const createCourseService = async (teacherId, title, description, status) => {
  // Validation

  if (!teacherId) {
    throw new AppError("Teacher ID is required", 400);
  }

  const trimmedTitle = title?.trim();
  const trimmedDescription = description?.trim();

  const createdCourse = await Course.create({
    teacherId: teacherId,
    title: trimmedTitle,
    description: trimmedDescription,
    status: status,
  });

  return createdCourse;
};

const getAllCoursesService = async (userId, role) => {
  // validation
  if (!userId) {
    throw new AppError("User ID is required", 400);
  }
  if (!role) {
    throw new AppError("Role is required", 400);
  }

  if (!["teacher", "student"].includes(role)) {
    throw new AppError("Invalid role", 400);
  }

  // for teacher
  if (role === "teacher") {
    const courses = await Course.find({ teacherId: userId });
    return courses;
  }

  // for student
  if (role === "student") {
    const enrollments = await Enrollment.find({
      studentId: userId,
      status: "active",
    });

    const courseIds = enrollments.map((enrollment) => enrollment.courseId);

    const courses = await Course.find({
      _id: { $in: courseIds },
    });

    return courses;
  }
};

const getCourseByIdService = async (courseId, userId, role) => {
  // valdation
  if (!courseId) {
    throw new AppError("Course ID is required", 400);
  }

  if (!userId) {
    throw new AppError("User ID is required", 400);
  }

  if (!role) {
    throw new AppError("Role is required", 400);
  }

  if (!["teacher", "student"].includes(role)) {
    throw new AppError("Invalid role", 400);
  }

  // finding Course

  const course = await Course.findById(courseId);

  if (!course) {
    throw new AppError("Course not found", 404);
  }

  // student
  if (role === "student") {
    const enrollment = await Enrollment.findOne({
      courseId: courseId,
      studentId: userId,
      status: "active",
    });

    if (!enrollment) {
      throw new AppError("Forbidden", 403);
    }

    return course;
  }
  // teacher
  if (role === "teacher") {
    if (course.teacherId.toString() !== userId) {
      throw new AppError("Forbidden", 403);
    }
    return course;
  }
};

const updateCourseService = async (courseId, teacherId, title, description) => {
  // validation
  if (!courseId) {
    throw new AppError("Course ID is required", 400);
  }

  if (!teacherId) {
    throw new AppError("Teacher ID is required", 400);
  }

  // finding course
  const course = await Course.findOne({
    _id: courseId,
    teacherId: teacherId,
  });

  if (!course) {
    throw new AppError("Course not found", 404);
  }

  // update course
  const updateData = {};

  if (title !== undefined) {
    updateData.title = title?.trim();
  }
  if (description !== undefined) {
    updateData.description = description?.trim();
  }

  const updatedCourse = await Course.findOneAndUpdate(
    { _id: courseId, teacherId: teacherId },

    updateData,

    { new: true },
  );

  return updatedCourse;
};

const updateCourseStatusService = async (courseId, teacherId, status) => {
  // validation

  if (!courseId) {
    throw new AppError("Course ID is required", 400);
  }

  if (!teacherId) {
    throw new AppError("Teacher ID is required", 400);
  }

  // find course
  const course = await Course.findOne({
    _id: courseId,
    teacherId: teacherId,
  });

  if (!course) {
    throw new AppError("Course not found", 404);
  }
  // upadte course
  if (course.status === "draft" && status !== "active") {
    throw new AppError("Draft course can only be activated", 400);
  }
  if (course.status === "active" && status !== "archived") {
    throw new AppError("Active course can only be archived", 400);
  }
  if (course.status === "archived") {
    throw new AppError("Archived course cannot change status", 400);
  }
  const updatedCourse = await Course.findOneAndUpdate(
    { _id: courseId, teacherId: teacherId },
    {
      status: status,
    },
    { new: true },
  );

  return updatedCourse;
};

module.exports = {
  createCourseService,
  getAllCoursesService,
  getCourseByIdService,
  updateCourseService,
  updateCourseStatusService,
};
